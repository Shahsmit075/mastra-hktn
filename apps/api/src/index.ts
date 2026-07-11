import 'dotenv/config';
import './lib/otel'; // MUST be first — initializes OTel before any imports
import { createApp } from './server';

const PORT = parseInt(process.env.PORT || '3001', 10);

const app = createApp();
app.listen(PORT, () => {
  console.log(`Runbook Sentinel API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
