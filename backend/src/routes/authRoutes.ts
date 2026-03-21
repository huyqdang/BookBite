import { Router } from 'express';
import { authController } from '../controllers/authController';

const router = Router();

router.post('/register', (req, res, next) => authController.register(req, res, next));
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.post('/apple', (req, res, next) => authController.appleAuth(req, res, next));
router.post('/google', (req, res, next) => authController.googleAuth(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));

export default router;
