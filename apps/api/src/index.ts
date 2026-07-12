import 'dotenv/config';
import './lib/otel.js'; // MUST be first — initializes OTel before any imports
import { createApp } from './server.js';

// Global error handlers — prevent crash on unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] Uncaught Exception:', err);
});

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = createApp();
app.listen(PORT, () => {
  console.log(`Runbook Sentinel API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
