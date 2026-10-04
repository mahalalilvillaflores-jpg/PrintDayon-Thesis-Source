const fs = require('fs');
const Document = require('../models/Document');
const documentRepository = require('../repositories/documentRepository');

const documentCleanupService = {
  scheduleRetention: async (documentId, hours = 24) => {
    try {
      if (!documentId) return null;
      const retentionExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
      return await Document.findByIdAndUpdate(
        documentId,
        { retentionExpiresAt },
        { new: true }
      );
    } catch (err) {
      console.error(`[CleanupService] Failed to schedule retention for doc ${documentId}:`, err.message);
      return null;
    }
  },

  purgePhysicalFile: async (documentId) => {
    try {
      const doc = await Document.findById(documentId);
      if (!doc) return { success: false, message: 'Document not found' };

      if (doc.storagePath && fs.existsSync(doc.storagePath)) {
        try {
          await fs.promises.unlink(doc.storagePath);
          console.log(`[CleanupService] 🗑️ Successfully purged physical file: ${doc.storagePath}`);
        } catch (fileErr) {
          console.warn(`[CleanupService] Warning unlinking file ${doc.storagePath}:`, fileErr.message);
        }
      }

      doc.isDeletedFromStorage = true;
      doc.deletedAt = new Date();
      await doc.save();

      return { success: true, doc };
    } catch (err) {
      console.error(`[CleanupService] Error purging document ${documentId}:`, err.message);
      return { success: false, error: err.message };
    }
  },

  runScheduledCleanup: async () => {
    try {
      const expiredDocs = await documentRepository.findExpiredDocuments();
      if (!expiredDocs.length) return 0;

      console.log(`[CleanupService] 🔒 Found ${expiredDocs.length} expired documents to purge...`);
      let purgedCount = 0;

      for (const doc of expiredDocs) {
        const result = await documentCleanupService.purgePhysicalFile(doc._id);
        if (result.success) purgedCount++;
      }

      console.log(`[CleanupService] ✅ Auto-purged ${purgedCount} expired documents for privacy compliance.`);
      return purgedCount;
    } catch (err) {
      console.error('[CleanupService] Error during scheduled cleanup:', err.message);
      return 0;
    }
  },

  initCleanupScheduler: (intervalMs = 15 * 60 * 1000) => {
    console.log(`[CleanupService] ⏱️ Initialized document retention auto-purge worker (Interval: ${intervalMs / 60000}m)`);

    setTimeout(() => {
      documentCleanupService.runScheduledCleanup();
    }, 5000);

    const timer = setInterval(() => {
      documentCleanupService.runScheduledCleanup();
    }, intervalMs);

    return timer;
  },
};

module.exports = documentCleanupService;
