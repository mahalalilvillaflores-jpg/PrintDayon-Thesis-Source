import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket() || {};

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!isAuthenticated || !user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const res = await notificationAPI.getAll();
      const raw = res.data?.data || res.data || {};
      const list = Array.isArray(raw)
        ? raw
        : (raw.notifications || res.data?.notifications || []);
      const count = typeof raw.unreadCount === 'number'
        ? raw.unreadCount
        : (typeof res.data?.unreadCount === 'number'
            ? res.data.unreadCount
            : list.filter((n) => !n.isRead).length);

      setNotifications(Array.isArray(list) ? list : []);
      setUnreadCount(count);
    } catch (err) {
      console.warn('Could not fetch notifications:', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, user?._id, fetchNotifications]);

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handleNewNotification = (newNotif) => {
      if (!newNotif) return;
      setNotifications((prev) => {
        const exists = prev.some((n) => n._id === newNotif._id);
        if (exists) return prev;
        return [newNotif, ...prev];
      });
      setUnreadCount((prev) => prev + 1);

      if (newNotif.title) {
        toast(newNotif.title, {
          icon: '🔔',
          duration: 4000,
        });
      }
    };

    const handleRequestStatusChange = () => {
      fetchNotifications(true);
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('request:accepted', handleRequestStatusChange);
    socket.on('request:queued', handleRequestStatusChange);
    socket.on('request:printing', handleRequestStatusChange);
    socket.on('request:ready', handleRequestStatusChange);
    socket.on('request:picked_up', handleRequestStatusChange);
    socket.on('request:completed', handleRequestStatusChange);
    socket.on('request:rejected', handleRequestStatusChange);
    socket.on('request:cancelled', handleRequestStatusChange);
    socket.on('request:status_changed', handleRequestStatusChange);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('request:accepted', handleRequestStatusChange);
      socket.off('request:queued', handleRequestStatusChange);
      socket.off('request:printing', handleRequestStatusChange);
      socket.off('request:ready', handleRequestStatusChange);
      socket.off('request:picked_up', handleRequestStatusChange);
      socket.off('request:completed', handleRequestStatusChange);
      socket.off('request:rejected', handleRequestStatusChange);
      socket.off('request:cancelled', handleRequestStatusChange);
      socket.off('request:status_changed', handleRequestStatusChange);
    };
  }, [socket, isAuthenticated, fetchNotifications]);

  const markRead = useCallback(async (id) => {
    if (!id) return;

    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationAPI.markRead(id);
    } catch (err) {
      console.error('Failed to mark notification read:', err);
      fetchNotifications(true);
    }
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await notificationAPI.markAllRead();
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Failed to mark all read:', err);
      fetchNotifications(true);
    }
  }, [fetchNotifications]);

  const deleteNotification = useCallback(async (id) => {
    if (!id) return;
    setNotifications((prev) => {
      const target = prev.find((n) => n._id === id);
      if (target && !target.isRead) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      return prev.filter((n) => n._id !== id);
    });

    try {
      await notificationAPI.delete(id);
      toast.success('Notification deleted');
    } catch (err) {
      console.error('Failed to delete notification:', err);
      toast.error('Failed to delete notification');
      fetchNotifications(true);
    }
  }, [fetchNotifications]);

  const clearAllNotifications = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);

    try {
      await notificationAPI.clearAll();
      toast.success('All notifications cleared');
    } catch (err) {
      console.error('Failed to clear notifications:', err);
      toast.error('Failed to clear notifications');
      fetchNotifications(true);
    }
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markRead,
        markAllRead,
        deleteNotification,
        clearAllNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      fetchNotifications: () => {},
      markRead: () => {},
      markAllRead: () => {},
      deleteNotification: () => {},
      clearAllNotifications: () => {},
    };
  }
  return context;
};

export default NotificationContext;
