/**
 * Build Daily Feeds CLI
 *
 * Pre-builds personalized story feeds for all users (or a specific user).
 * Each feed contains enough stories ranked by popularity and book tier
 * to last 24 hours of continuous reading.
 *
 * Usage:
 *   npx tsx src/cli/build-feeds.ts                     # All users
 *   npx tsx src/cli/build-feeds.ts --user test@test.com # Specific user
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { dailyFeedBuilder } from '../services/dailyFeedBuilder';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const userFlag = args.indexOf('--user');
  const userEmail = userFlag >= 0 ? args[userFlag + 1] : null;

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║     BookBite — Daily Feed Builder    ║');
  console.log('╚══════════════════════════════════════╝\n');

  const today = new Date();
  console.log(`Date: ${today.toISOString().split('T')[0]}`);

  // Show story stats
  const totalStories = await prisma.story.count();
  const storyByTier = await prisma.$queryRaw<{ tier: number; count: bigint }[]>`
    SELECT b.tier, COUNT(s.id)::bigint as count
    FROM stories s JOIN books b ON s.book_id = b.id
    GROUP BY b.tier ORDER BY b.tier
  `;
  console.log(`Total stories in DB: ${totalStories}`);
  for (const row of storyByTier) {
    const tierLabel = row.tier === 1 ? 'Curated' : row.tier === 3 ? 'AI-Knowledge' : 'Bulk/General';
    console.log(`  Tier ${row.tier} (${tierLabel}): ${row.count}`);
  }
  console.log();

  const startTime = Date.now();

  if (userEmail) {
    // Build for a specific user
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });
    if (!user) {
      console.error(`User not found: ${userEmail}`);
      process.exit(1);
    }
    console.log(`Building feed for: ${userEmail}`);
    const count = await dailyFeedBuilder.buildForUser(user.id);
    if (count > 0) {
      console.log(`\n✓ Feed built: ${count} stories`);
    } else {
      console.log('\n✗ No stories available or onboarding incomplete');
    }
  } else {
    // Build for all users
    console.log('Building feeds for all users...\n');
    const result = await dailyFeedBuilder.buildForAllUsers();
    console.log(`\n════════════════════════════════════`);
    console.log(`  Total users:    ${result.total}`);
    console.log(`  Feeds built:    ${result.built}`);
    console.log(`  Skipped:        ${result.skipped}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Time:           ${elapsed}s`);
  console.log(`════════════════════════════════════\n`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Feed build failed:', error);
  process.exit(1);
});
