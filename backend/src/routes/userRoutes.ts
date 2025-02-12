import { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../controllers/userController';
import { getCurrentMatchState, joinMatchingPool, leaveMatchingPool } from '../controllers/matchController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

// Protect all routes with authentication
router.use(authenticateUser);

router.get('/:userId', getUserProfile);
router.put('/:userId', updateUserProfile);
router.get('/:userId/match-state', getCurrentMatchState);
router.post('/:userId/match/join', joinMatchingPool);
router.post('/:userId/match/leave', leaveMatchingPool);

export { router as userRoutes }; 