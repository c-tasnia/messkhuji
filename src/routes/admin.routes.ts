import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  listAllUsers,
  setUserActive,
  promoteUserRole,
  moderateListing,
  platformStats,
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate, authorize(Role.ADMIN));

router.get('/users', listAllUsers);
router.patch('/users/:id/active', setUserActive);
router.patch('/users/:id/role', promoteUserRole);
router.patch('/listings/:id/moderate', moderateListing);
router.get('/stats', platformStats);

export default router;
