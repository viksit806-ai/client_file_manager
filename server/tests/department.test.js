import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import {
  app, DocumentRepo, NotificationRepo,
  createDeptUser, createCustomer, createDepartment, createFileCategory,
} from './setup.js';

const testUploadDir = path.resolve('./test-uploads');

describe('Department - Create Response', () => {
  beforeAll(() => {
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
  });

  it('should create a response document', async () => {
    const customer = await createCustomer({ name: 'Resp Customer', email: 'resp@test.com' });
    const dept = await createDepartment();
    const { token } = await createDeptUser(dept.id);
    const fileCat = await createFileCategory(dept.id);

    const res = await request(app)
      .post('/api/department/responses')
      .set('Authorization', `Bearer ${token}`)
      .field('customerId', customer.user.id.toString())
      .field('fileCategoryId', fileCat.id.toString())
      .field('notes', 'Test response notes')
      .attach('file', Buffer.from('test file content'), 'test-response.pdf');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.direction).toBe('response');
    expect(res.body.data.notes).toBe('Test response notes');

    // Verify notification was created for customer
    const notifications = await NotificationRepo.find({ user_id: customer.user.id });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('new_response');
  });

  it('should require file category', async () => {
    const customer = await createCustomer();
    const dept = await createDepartment();
    const { token } = await createDeptUser(dept.id);

    const res = await request(app)
      .post('/api/department/responses')
      .set('Authorization', `Bearer ${token}`)
      .field('customerId', customer.user.id.toString())
      .attach('file', Buffer.from('test'), 'test.pdf');

    expect(res.status).toBe(400);
  });

  it('should require a file', async () => {
    const customer = await createCustomer();
    const dept = await createDepartment();
    const { token } = await createDeptUser(dept.id);
    const fileCat = await createFileCategory(dept.id);

    const res = await request(app)
      .post('/api/department/responses')
      .set('Authorization', `Bearer ${token}`)
      .field('customerId', customer.user.id.toString())
      .field('fileCategoryId', fileCat.id.toString());

    expect(res.status).toBe(400);
  });

  it('should list responses', async () => {
    const customer = await createCustomer({ email: 'listresp@test.com' });
    const dept = await createDepartment();
    const { token } = await createDeptUser(dept.id);
    const fileCat = await createFileCategory(dept.id);

    // Create a response
    await request(app)
      .post('/api/department/responses')
      .set('Authorization', `Bearer ${token}`)
      .field('customerId', customer.user.id.toString())
      .field('fileCategoryId', fileCat.id.toString())
      .attach('file', Buffer.from('content'), 'doc.pdf');

    const res = await request(app)
      .get('/api/department/responses')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].direction).toBe('response');
  });

  it('should filter responses by customer', async () => {
    const customer1 = await createCustomer({ email: 'c1@test.com' });
    const customer2 = await createCustomer({ email: 'c2@test.com' });
    const dept = await createDepartment();
    const { token } = await createDeptUser(dept.id);
    const fileCat = await createFileCategory(dept.id);

    // Create response for customer1
    await request(app)
      .post('/api/department/responses')
      .set('Authorization', `Bearer ${token}`)
      .field('customerId', customer1.user.id.toString())
      .field('fileCategoryId', fileCat.id.toString())
      .attach('file', Buffer.from('content'), 'doc1.pdf');

    const res = await request(app)
      .get(`/api/department/responses?customerId=${customer2.user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});
