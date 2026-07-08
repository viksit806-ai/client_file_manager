import { describe, it, expect } from 'vitest';
import request from 'supertest';
import {
  app,
  createCustomer, createDeptUser, createDepartment, createFileCategory,
} from './setup.js';

describe('Customer - Responses', () => {
  it('should list own responses', async () => {
    const customer = await createCustomer({ email: 'myresp@test.com' });
    const dept = await createDepartment();
    const { token: deptToken } = await createDeptUser(dept.id);
    const fileCat = await createFileCategory(dept.id);

    // Dept creates a response for this customer
    await request(app)
      .post('/api/department/responses')
      .set('Authorization', `Bearer ${deptToken}`)
      .field('customerId', customer.user.id.toString())
      .field('fileCategoryId', fileCat.id.toString())
      .attach('file', Buffer.from('content'), 'resp.pdf');

    // Customer fetches own responses
    const res = await request(app)
      .get('/api/customer/responses')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].direction).toBe('response');
  });

  it('should show response categories grouped by fileCategory', async () => {
    const customer = await createCustomer({ email: 'catgroup@test.com' });
    const dept = await createDepartment();
    const { token: deptToken } = await createDeptUser(dept.id);
    const fileCat = await createFileCategory(dept.id);

    await request(app)
      .post('/api/department/responses')
      .set('Authorization', `Bearer ${deptToken}`)
      .field('customerId', customer.user.id.toString())
      .field('fileCategoryId', fileCat.id.toString())
      .attach('file', Buffer.from('content'), 'resp.pdf');

    const res = await request(app)
      .get('/api/customer/response-categories')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    const group = res.body.data.find(g => g.name === fileCat.name);
    expect(group).toBeDefined();
    expect(group.documents).toHaveLength(1);
  });

  it('should return empty responses list for new customer', async () => {
    const customer = await createCustomer({ email: 'noresp@test.com' });

    const res = await request(app)
      .get('/api/customer/responses')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});
