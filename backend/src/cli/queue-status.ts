import { bookQueue } from '../pipeline/queue';

async function status() {
  console.log('\n=== BookBite Processing Queue ===\n');

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    bookQueue.getWaiting(),
    bookQueue.getActive(),
    bookQueue.getCompleted(0, 10),
    bookQueue.getFailed(0, 10),
    bookQueue.getDelayed(),
  ]);

  console.log(`Waiting (${waiting.length}):`);
  if (waiting.length === 0) console.log('  (none)');
  for (const j of waiting) {
    console.log(`  - ${j.data.fileName}`);
  }

  console.log(`\nActive (${active.length}):`);
  if (active.length === 0) console.log('  (none)');
  for (const j of active) {
    console.log(`  - ${j.data.fileName} (progress: ${j.progress}%)`);
  }

  console.log(`\nCompleted (showing last ${completed.length}):`);
  if (completed.length === 0) console.log('  (none)');
  for (const j of completed) {
    console.log(
      `  - ${j.data.fileName} → ${j.returnvalue?.storiesExtracted ?? '?'} stories`
    );
  }

  console.log(`\nFailed (${failed.length}):`);
  if (failed.length === 0) console.log('  (none)');
  for (const j of failed) {
    console.log(`  - ${j.data.fileName}: ${j.failedReason}`);
  }

  console.log(`\nDelayed (${delayed.length}):`);
  if (delayed.length === 0) console.log('  (none)');
  for (const j of delayed) {
    console.log(`  - ${j.data.fileName}`);
  }

  console.log('');
  process.exit(0);
}

status().catch((err) => {
  console.error('Failed to get queue status:', err.message);
  process.exit(1);
});
