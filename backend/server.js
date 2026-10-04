const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const autoSeed = require('./src/config/autoSeed');
const { initSocket } = require('./src/sockets/socketManager');
const documentCleanupService = require('./src/services/documentCleanupService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await autoSeed();

    documentCleanupService.initCleanupScheduler();

    const server = http.createServer(app);

    initSocket(server);

    server.listen(PORT, () => {
      console.log(`🚀 PrintDayon server running on port ${PORT}`);
      console.log(`📡 Socket.IO initialized`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`📋 API Docs: http://localhost:${PORT}/api/health`);
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
