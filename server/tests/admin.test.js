import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, createAdmin, createDepartment, FileCategoryRepo } from './setup.js';

describe('Admin - File Categories', () => {
  it('should create a file category', async () => {
    const { token } = await createAdmin();
    const dept = await createDepartment();

    const res = await request(app)
      .post('/api/admin/file-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tax Return File', description: 'For tax docs', departmentId: dept.id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Tax Return File');
  });

  it('should list file categories', async () => {
    const { token } = await createAdmin();
    const dept = await createDepartment();
    await FileCategoryRepo.create({ name: 'Tax Return File', department_id: dept.id });
    await FileCategoryRepo.create({ name: 'ITR Document', department_id: dept.id });

    const res = await request(app)
      .get('/api/admin/file-categories')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('should update a file category', async () => {
    const { token } = await createAdmin();
    const dept = await createDepartment();
    const fc = await FileCategoryRepo.create({ name: 'Old Name', department_id: dept.id });

    const res = await request(app)
      .put(`/api/admin/file-categories/${fc.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('should delete a file category', async () => {
    const { token } = await createAdmin();
    const dept = await createDepartment();
    const fc = await FileCategoryRepo.create({ name: 'To Delete', department_id: dept.id });

    const res = await request(app)
      .delete(`/api/admin/file-categories/${fc.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const count = await FileCategoryRepo.count();
    expect(count).toBe(0);
  });

  it('should reject creating file-category without name', async () => {
    const { token } = await createAdmin();
    const dept = await createDepartment();

    const res = await request(app)
      .post('/api/admin/file-categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ departmentId: dept.id });

    expect(res.status).toBe(400);
  });

  it('should reject unauthorized access', async () => {
    const res = await request(app).get('/api/admin/file-categories');
    expect(res.status).toBe(401);
  });
});
