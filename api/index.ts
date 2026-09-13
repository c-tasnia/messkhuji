import serverless from 'serverless-http';
import { createApp } from '../src/app';

const app = createApp();

// Vercel invokes this default export as the serverless function handler for
// every request rewritten to /api/index (see vercel.json).
export default serverless(app);
