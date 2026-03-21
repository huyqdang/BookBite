import bcrypt from 'bcryptjs';
import { prisma } from '../config/db';
import { generateTokenPair, TokenPayload } from '../utils/jwt';
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
} from '../utils/errors';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SocialAuthInput {
  provider: 'apple' | 'google';
  providerId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export class AuthService {
  async register(input: RegisterInput) {
    const { email, password, displayName } = input;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user with default preferences
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        preferences: {
          create: {
            bookCategories: [],
            preferredReadingTimes: [3],
            onboardingCompleted: false,
          },
        },
      },
      include: { preferences: true },
    });

    const payload: TokenPayload = { userId: user.id, role: user.role };
    const tokens = generateTokenPair(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        onboardingCompleted: user.preferences?.onboardingCompleted ?? false,
      },
      ...tokens,
    };
  }

  async login(input: LoginInput) {
    const { email, password } = input;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { preferences: true },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload: TokenPayload = { userId: user.id, role: user.role };
    const tokens = generateTokenPair(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        onboardingCompleted: user.preferences?.onboardingCompleted ?? false,
      },
      ...tokens,
    };
  }

  async socialAuth(input: SocialAuthInput) {
    const { provider, providerId, email, displayName, avatarUrl } = input;

    const whereClause =
      provider === 'apple'
        ? { appleId: providerId }
        : { googleId: providerId };

    // Check if user exists by provider ID
    let user = await prisma.user.findUnique({
      where: whereClause,
      include: { preferences: true },
    });

    if (!user) {
      // Check if email exists (link accounts)
      if (email) {
        user = await prisma.user.findUnique({
          where: { email },
          include: { preferences: true },
        });

        if (user) {
          // Link social account to existing user
          const updateData =
            provider === 'apple'
              ? { appleId: providerId }
              : { googleId: providerId };

          user = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
            include: { preferences: true },
          });
        }
      }

      if (!user) {
        // Create new user
        const createData: any = {
          email,
          displayName: displayName || email?.split('@')[0] || 'User',
          avatarUrl,
          preferences: {
            create: {
              bookCategories: [],
              preferredReadingTimes: [3],
              onboardingCompleted: false,
            },
          },
        };

        if (provider === 'apple') {
          createData.appleId = providerId;
        } else {
          createData.googleId = providerId;
        }

        user = await prisma.user.create({
          data: createData,
          include: { preferences: true },
        });
      }
    }

    const payload: TokenPayload = { userId: user.id, role: user.role };
    const tokens = generateTokenPair(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        onboardingCompleted: user.preferences?.onboardingCompleted ?? false,
      },
      ...tokens,
    };
  }
}

export const authService = new AuthService();
