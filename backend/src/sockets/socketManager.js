let _io = null;

const initSocket = (server) => {
  const { Server } = require('socket.io');
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map(url => url.trim().replace(/\/$/, ''));

  _io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (
          allowedOrigins.includes(cleanOrigin) ||
          allowedOrigins.includes('*') ||
          cleanOrigin.endsWith('.onrender.com') ||
          cleanOrigin.includes('localhost') ||
          cleanOrigin.includes('127.0.0.1')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Socket Authentication Middleware
  _io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization && socket.handshake.headers.authorization.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null) ||
        socket.handshake.query?.token;

      if (!token) {
        socket.user = null;
        return next();
      }

      const jwt = require('jsonwebtoken');
      const User = require('../models/User');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user && user.isActive && user.status !== 'suspended' && user.status !== 'deactivated') {
        socket.user = user;
      } else {
        socket.user = null;
      }
      return next();
    } catch (err) {
      socket.user = null;
      return next();
    }
  });

  _io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join:user', (userId) => {
      if (!socket.user) {
        return socket.emit('error:unauthorized', { message: 'Authentication required to join user room' });
      }
      if (socket.user._id.toString() !== userId?.toString()) {
        return socket.emit('error:unauthorized', { message: 'Unauthorized. You can only join your own user room.' });
      }
      socket.join(`user:${userId}`);
      console.log(`📡 User ${userId} joined room user:${userId}`);
    });

    socket.on('join:shop', async (shopId) => {
      if (!socket.user) {
        return socket.emit('error:unauthorized', { message: 'Authentication required to join shop room' });
      }
      if (socket.user.role === 'admin') {
        socket.join(`shop:${shopId}`);
        console.log(`🛡️ Admin socket ${socket.id} joined room shop:${shopId}`);
        return;
      }
      if (socket.user.role !== 'shop_owner') {
        return socket.emit('error:unauthorized', { message: 'Only shop owners can join a shop room.' });
      }
      try {
        const shopRepository = require('../repositories/shopRepository');
        const shop = await shopRepository.findById(shopId);
        if (!shop) {
          return socket.emit('error:not_found', { message: 'Shop not found.' });
        }
        const shopOwnerId = shop.ownerId?._id ? shop.ownerId._id.toString() : shop.ownerId?.toString();
        if (shopOwnerId !== socket.user._id.toString()) {
          return socket.emit('error:unauthorized', { message: 'Unauthorized. You can only join your own shop room.' });
        }
        socket.join(`shop:${shopId}`);
        console.log(`📡 Shop ${shopId} joined room shop:${shopId}`);
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('join:admin', () => {
      if (!socket.user || socket.user.role !== 'admin') {
        return socket.emit('error:unauthorized', { message: 'Unauthorized. Admin role required.' });
      }
      socket.join('admin');
      console.log(`🛡️  Admin socket ${socket.id} joined admin room`);
    });

    socket.on('leave:user', (userId) => socket.leave(`user:${userId}`));
    socket.on('leave:shop', (shopId) => socket.leave(`shop:${shopId}`));
    socket.on('leave:admin', () => socket.leave('admin'));

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  return _io;
};

const emitAdminStatsUpdate = async () => {
  if (!_io) return;
  try {
    const userRepository = require('../repositories/userRepository');
    const shopRepository = require('../repositories/shopRepository');
    const requestRepository = require('../repositories/requestRepository');

    const [usersByRole, shopStats, requestStats] = await Promise.all([
      userRepository.countByRole(),
      shopRepository.getStats(),
      requestRepository.getSystemStats(),
    ]);

    const users = { total: 0, customer: 0, shop_owner: 0, admin: 0 };
    usersByRole.forEach((r) => { users[r._id] = r.count; users.total += r.count; });

    const shops = { total: 0, pending: 0, verified: 0, rejected: 0 };
    shopStats.forEach((s) => { shops[s._id] = s.count; shops.total += s.count; });

    const requests = { total: 0 };
    requestStats.forEach((r) => { requests[r._id] = r.count; requests.total += r.count; });

    _io.to('admin').emit('stats:update', { users, shops, requests });
  } catch (err) {
    console.error('emitAdminStatsUpdate error:', err.message);
  }
};

const getIO = () => {
  if (!_io) {

    return {
      to: () => ({ emit: () => { } }),
      emit: () => { },
    };
  }
  return _io;
};

module.exports = { initSocket, getIO, emitAdminStatsUpdate };

