import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { verifyRefreshToken, generateTokenPair } from '../utils/jwt';
import { BadRequestError } from '../utils/errors';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, displayName } = req.body;

      if (!email || !password || !displayName) {
        throw new BadRequestError('Email, password, and display name are required');
      }
      if (password.length < 8) {
        throw new BadRequestError('Password must be at least 8 characters');
      }

      const result = await authService.register({ email, password, displayName });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new BadRequestError('Email and password are required');
      }

      const result = await authService.login({ email, password });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async appleAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { identityToken, email, fullName } = req.body;

      if (!identityToken) {
        throw new BadRequestError('Identity token is required');
      }

      // In production, validate the Apple identity token here
      // For now, we use it as the provider ID
      const result = await authService.socialAuth({
        provider: 'apple',
        providerId: identityToken,
        email,
        displayName: fullName,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async googleAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const { idToken, email, displayName, avatarUrl } = req.body;

      if (!idToken) {
        throw new BadRequestError('ID token is required');
      }

      // In production, validate the Google ID token here
      const result = await authService.socialAuth({
        provider: 'google',
        providerId: idToken,
        email,
        displayName,
        avatarUrl,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new BadRequestError('Refresh token is required');
      }

      const payload = verifyRefreshToken(refreshToken);
      const tokens = generateTokenPair({
        userId: payload.userId,
        role: payload.role,
      });

      res.json(tokens);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
