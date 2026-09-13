import { Router } from 'express';
import { register, login, refresh, me } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate.middleware';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.validator';
import { authLimiter } from '../middleware/rateLimiter.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.post('/refresh', authLimiter, validateBody(refreshSchema), refresh);
router.get('/me', authenticate, me);

export default router;
