const authService = require('../services/authService');
const { emitAdminStatsUpdate } = require('../sockets/socketManager');

const authController = {
  register: async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      emitAdminStatsUpdate().catch(() => {});
      res.status(201).json({ success: true, message: 'Registration successful.', data: result });
    } catch (err) {
      next(err);
    }
  },

  login: async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({ success: true, message: 'Login successful.', data: result });
    } catch (err) {
      next(err);
    }
  },

  getMe: async (req, res, next) => {
    try {
      const user = await authService.getProfile(req.user._id);
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },

  updateProfile: async (req, res, next) => {
    try {
      const user = await authService.updateProfile(req.user._id, req.body);
      res.status(200).json({ success: true, message: 'Profile updated successfully.', data: user });
    } catch (err) {
      next(err);
    }
  },

  changePassword: async (req, res, next) => {
    try {
      const result = await authService.changePassword(req.user._id, req.body);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
