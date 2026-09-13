import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { me } from '../controllers/auth.controller';

const router = Router();

// Alias of /api/auth/me kept under /api/users for REST-conventional clients.
router.get('/me', authenticate, me);

export default router;
