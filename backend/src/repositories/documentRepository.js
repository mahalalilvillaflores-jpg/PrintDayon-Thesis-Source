const Document = require('../models/Document');

const documentRepository = {
  create: async (data) => {
    const doc = new Document(data);
    return doc.save();
  },

  findById: async (id) => {
    return Document.findById(id);
  },

  findByCustomer: async (customerId) => {
    return Document.find({ customerId }).sort({ uploadedAt: -1 });
  },

  linkToRequest: async (documentId, requestId) => {
    return Document.findByIdAndUpdate(documentId, { requestId }, { new: true });
  },

  deleteById: async (id) => {
    return Document.findByIdAndDelete(id);
  },

  findExpiredDocuments: async () => {
    return Document.find({
      isDeletedFromStorage: false,
      retentionExpiresAt: { $ne: null, $lte: new Date() },
    });
  },

  markAsDeleted: async (id) => {
    return Document.findByIdAndUpdate(
      id,
      { isDeletedFromStorage: true, deletedAt: new Date() },
      { new: true }
    );
  },
};

module.exports = documentRepository;
