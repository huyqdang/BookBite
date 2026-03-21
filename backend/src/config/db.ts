import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');
  } catch (error) {
    console.error('[DB] Failed to connect:', error);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await prisma.$disconnect();
  console.log('[DB] Disconnected');
}
