import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, NotificationRepo, createCustomer, createDeptUser, createDepartment } from './setup.js';

describe('Notifications', () => {
  it('should return notification count', async () => {
    const customer = await createCustomer({ email: 'notifcount@test.com' });

    await NotificationRepo.create({ user_id: customer.user.id, type: 'new_response', message: 'Test notification' });
    await NotificationRepo.create({ user_id: customer.user.id, type: 'new_response', message: 'Another notification' });

    const res = await request(app)
      .get('/api/notifications/count')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(2);
  });

  it('should list notifications', async () => {
    const customer = await createCustomer({ email: 'notiflist@test.com' });

    await NotificationRepo.create({ user_id: customer.user.id, type: 'new_response', message: 'Test notification' });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].message).toBe('Test notification');
  });

  it('should delete a notification', async () => {
    const customer = await createCustomer({ email: 'notifdel@test.com' });
    const notif = await NotificationRepo.create({ user_id: customer.user.id, type: 'new_response', message: 'Delete me' });

    const res = await request(app)
      .delete(`/api/notifications/${notif.id}`)
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(200);

    const remaining = await NotificationRepo.count({ user_id: customer.user.id });
    expect(remaining).toBe(0);
  });

  it('should not list other users notifications', async () => {
    const user1 = await createCustomer({ email: 'u1@test.com' });
    const user2 = await createCustomer({ email: 'u2@test.com' });

    await NotificationRepo.create({ user_id: user1.user.id, type: 'new_response', message: 'User1 notif' });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${user2.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('should return zero count with no notifications', async () => {
    const customer = await createCustomer({ email: 'zeronotif@test.com' });

    const res = await request(app)
      .get('/api/notifications/count')
      .set('Authorization', `Bearer ${customer.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
  });
});
