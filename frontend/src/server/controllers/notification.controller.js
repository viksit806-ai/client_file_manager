import * as NotificationRepo from '../db/notifications.js';
import AppError from '../utils/AppError.js';

export const getNotifications = async (req, res) => {
  const userId = req.user._id;
  const notifications = await NotificationRepo.find(
    { user_id: userId, is_read: false },
    { sort: { created_at: 'desc' }, limit: 50 }
  );
  res.json({ success: true, data: notifications });
};

export const getNotificationCount = async (req, res) => {
  const userId = req.user._id;
  const count = await NotificationRepo.count({ user_id: userId, is_read: false });
  res.json({ success: true, data: { count } });
};

export const deleteNotification = async (req, res) => {
  const userId = req.user._id;
  const { id } = req.params;
  const notification = await NotificationRepo.findOneAndDelete({ id, user_id: userId });
  if (!notification) throw new AppError('Notification not found', 404);
  res.json({ success: true, message: 'Notification dismissed' });
};
