const AuditLog = require('../models/AuditLog');
const { getIO } = require('../sockets/socketManager');

const auditService = {
  log: async ({ action, eventType = 'system', details, actorId = null, actorName = 'System', actorRole = 'system', targetId = null, targetName = '', metadata = {} }) => {
    try {
      const logEntry = new AuditLog({
        action,
        eventType,
        details,
        actorId,
        actorName,
        actorRole,
        targetId,
        targetName,
        metadata,
        timestamp: new Date(),
      });

      const saved = await logEntry.save();

      try {
        const io = getIO();
        io.to('admin').emit('audit:new', saved);
      } catch (err) {

      }

      return saved;
    } catch (err) {
      console.error('Failed to write audit log:', err.message);
      return null;
    }
  },

  getLogs: async (filter = {}, options = {}) => {
    const { page = 1, limit = 50, sort = { timestamp: -1 } } = options;
    const skip = (page - 1) * limit;

    const query = {};
    if (filter.eventType && filter.eventType !== 'all') {
      query.eventType = filter.eventType;
    }
    if (filter.search) {
      const s = filter.search;
      query.$or = [
        { details: { $regex: s, $options: 'i' } },
        { actorName: { $regex: s, $options: 'i' } },
        { targetName: { $regex: s, $options: 'i' } },
        { action: { $regex: s, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort(sort).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  },

  getStats: async () => {
    const counts = await AuditLog.aggregate([
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ]);
    const map = { total: 0 };
    counts.forEach(c => {
      map[c._id] = c.count;
      map.total += c.count;
    });
    return map;
  },

  clearLogs: async () => {
    return AuditLog.deleteMany({});
  },
};

module.exports = auditService;
