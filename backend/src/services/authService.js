const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const authService = {
  register: async ({ name, email, password, role, contactNumber }) => {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      const error = new Error('Email already registered.');
      error.statusCode = 409;
      throw error;
    }

    const allowedRoles = ['customer', 'shop_owner'];
    if (!allowedRoles.includes(role)) {
      const error = new Error('Invalid role.');
      error.statusCode = 400;
      throw error;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!passwordRegex.test(password)) {
      const error = new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character.');
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = contactNumber ? String(contactNumber).trim().replace(/\D/g, '') : '';
    if (role === 'shop_owner' && !cleanPhone) {
      const error = new Error('Cellphone number is required.');
      error.statusCode = 400;
      throw error;
    }
    if (cleanPhone && !/^09\d{9}$/.test(cleanPhone)) {
      const error = new Error('Cellphone number must be a valid 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).');
      error.statusCode = 400;
      throw error;
    }

    const user = await userRepository.create({ name, email, password, role, contactNumber: cleanPhone });
    const token = generateToken(user._id);

    try {
      const auditService = require('./auditService');
      auditService.log({
        action: 'user_registered',
        eventType: 'user',
        details: `New ${role === 'shop_owner' ? 'shop owner' : 'customer'} account registered: ${name}`,
        actorId: user._id,
        actorName: name,
        actorRole: role,
        metadata: { email, contactNumber },
      });
    } catch (err) { }

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactNumber: user.contactNumber,
        address: user.address || '',
        avatarUrl: user.avatarUrl || user.profilePhoto || '',
        profilePhoto: user.profilePhoto || user.avatarUrl || '',
      },
    };
  },

  login: async ({ email, password }) => {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    if (!user.isActive || user.status === 'suspended' || user.status === 'deactivated') {
      const msg = user.status === 'suspended'
        ? `Account suspended by administration${user.statusReason ? ': ' + user.statusReason : '. Contact support.'}`
        : 'Account has been deactivated. Contact support.';
      const error = new Error(msg);
      error.statusCode = 403;
      throw error;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    const token = generateToken(user._id);

    try {
      const auditService = require('./auditService');
      auditService.log({
        action: 'user_login',
        eventType: 'auth',
        details: `${user.role.replace('_', ' ').toUpperCase()} logged in: ${user.name}`,
        actorId: user._id,
        actorName: user.name,
        actorRole: user.role,
        metadata: { email: user.email },
      });
    } catch (err) { }

    let shopId = null;
    let shopName = null;
    let verificationStatus = null;
    if (user.role === 'shop_owner') {
      const shopRepository = require('../repositories/shopRepository');
      const shop = await shopRepository.findByOwnerId(user._id);
      if (shop) {
        shopId = shop._id;
        shopName = shop.shopName;
        verificationStatus = shop.verificationStatus;
      }
    }

    return {
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactNumber: user.contactNumber,
        address: user.address || '',
        avatarUrl: user.avatarUrl || user.profilePhoto || '',
        profilePhoto: user.profilePhoto || user.avatarUrl || '',
        shopId,
        shopName,
        verificationStatus,
        requiresOnboarding: user.role === 'shop_owner' && !shopId,
      },
    };
  },

  getProfile: async (userId) => {
    const user = await userRepository.findById(userId);
    if (!user) return null;
    const uObj = user.toObject ? user.toObject() : { ...user };
    if (user.role === 'shop_owner') {
      const shopRepository = require('../repositories/shopRepository');
      const shop = await shopRepository.findByOwnerId(user._id);
      if (shop) {
        uObj.shopId = shop._id;
        uObj.shopName = shop.shopName;
        uObj.verificationStatus = shop.verificationStatus;
      } else {
        uObj.shopId = null;
        uObj.shopName = null;
        uObj.verificationStatus = null;
        uObj.requiresOnboarding = true;
      }
    }
    return uObj;
  },

  updateProfile: async (userId, data) => {
    const user = await userRepository.findById(userId);
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const updates = {};
    if (data.name && typeof data.name === 'string') {
      const trimmed = data.name.trim();
      if (trimmed.length < 2) {
        const err = new Error('Name must be at least 2 characters.');
        err.statusCode = 400;
        throw err;
      }
      updates.name = trimmed;
    }

    if (data.contactNumber !== undefined) {
      const cleanPhone = String(data.contactNumber).trim().replace(/\D/g, '');
      if (cleanPhone && !/^09\d{9}$/.test(cleanPhone)) {
        const err = new Error('Cellphone number must be a valid 11-digit Philippine mobile number starting with 09 (e.g. 09171234567).');
        err.statusCode = 400;
        throw err;
      }
      updates.contactNumber = cleanPhone;
    }

    if (data.address !== undefined) {
      updates.address = String(data.address).trim();
    }

    if (data.profilePhoto !== undefined || data.avatarUrl !== undefined) {
      const photo = String(data.profilePhoto || data.avatarUrl || '').trim();
      updates.profilePhoto = photo;
      updates.avatarUrl = photo;
    }

    await userRepository.update(userId, updates);
    return await authService.getProfile(userId);
  },

  changePassword: async (userId, { currentPassword, newPassword }) => {
    if (!currentPassword || !newPassword) {
      const err = new Error('Both current password and new password are required.');
      err.statusCode = 400;
      throw err;
    }
    // Fetch the user with password hash
    const user = await require('../models/User').findById(userId).select('+password');
    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      const err = new Error('Current password is incorrect.');
      err.statusCode = 400;
      throw err;
    }
    if (newPassword.length < 8) {
      const err = new Error('New password must be at least 8 characters long.');
      err.statusCode = 400;
      throw err;
    }
    if (currentPassword === newPassword) {
      const err = new Error('New password must be different from your current password.');
      err.statusCode = 400;
      throw err;
    }
    user.password = newPassword; // pre-save hook hashes it
    await user.save();
    return { message: 'Password updated successfully.' };
  },
};

module.exports = authService;
