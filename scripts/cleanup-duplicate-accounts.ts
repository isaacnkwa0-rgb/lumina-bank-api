/**
 * Cleanup script: close duplicate same-type accounts per user.
 *
 * Strategy:
 *   - Keep the OLDEST non-closed account of each type per user.
 *   - For every newer duplicate:
 *       1. Reassign all linked records (transactions, transfers, cards,
 *          goals, loans, standing orders, direct debits, crypto orders).
 *       2. Merge balance into the kept account.
 *       3. Mark the duplicate CLOSED.
 *
 * Usage:
 *   npx tsx scripts/cleanup-duplicate-accounts.ts          # dry-run (safe)
 *   npx tsx scripts/cleanup-duplicate-accounts.ts --execute # apply changes
 */

import { PrismaClient, AccountStatus } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--execute');

// ─── helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(msg);
}

function fmt(val: unknown) {
  return String(val);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  log(DRY_RUN ? '\n=== DRY RUN (no changes will be made) ===' : '\n=== EXECUTING CLEANUP ===');

  // Fetch all non-closed accounts grouped by user and type
  const accounts = await prisma.account.findMany({
    where: { status: { not: AccountStatus.CLOSED } },
    orderBy: { createdAt: 'asc' }, // oldest first
    select: {
      id: true,
      userId: true,
      type: true,
      accountNumber: true,
      balance: true,
      availableBalance: true,
      isDefault: true,
      createdAt: true,
    },
  });

  // Group by userId + type
  const groups = new Map<string, typeof accounts>();
  for (const acct of accounts) {
    const key = `${acct.userId}::${acct.type}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(acct);
  }

  // Find groups with duplicates
  const duplicateGroups = [...groups.values()].filter((g) => g.length > 1);

  if (duplicateGroups.length === 0) {
    log('\nNo duplicate accounts found. Nothing to do.');
    return;
  }

  log(`\nFound ${duplicateGroups.length} duplicate group(s):\n`);

  let totalMerged = 0;

  for (const group of duplicateGroups) {
    const kept = group[0]; // oldest
    const duplicates = group.slice(1);

    log(`User ${kept.userId} | Type: ${kept.type}`);
    log(`  KEEP    → ${kept.accountNumber} (created ${kept.createdAt.toISOString()}, balance: ${fmt(kept.balance)})`);

    for (const dup of duplicates) {
      log(`  CLOSE   → ${dup.accountNumber} (created ${dup.createdAt.toISOString()}, balance: ${fmt(dup.balance)})`);

      if (DRY_RUN) continue;

      await prisma.$transaction(async (tx) => {
        // 1. Reassign transactions
        await tx.transaction.updateMany({
          where: { accountId: dup.id },
          data: { accountId: kept.id },
        });

        // 2. Reassign transfers (from and to)
        await tx.transfer.updateMany({
          where: { fromAccountId: dup.id },
          data: { fromAccountId: kept.id },
        });
        await tx.transfer.updateMany({
          where: { toAccountId: dup.id },
          data: { toAccountId: kept.id },
        });

        // 3. Reassign cards
        await tx.card.updateMany({
          where: { accountId: dup.id },
          data: { accountId: kept.id },
        });

        // 4. Reassign savings goals
        await tx.savingsGoal.updateMany({
          where: { accountId: dup.id },
          data: { accountId: kept.id },
        });

        // 5. Reassign loans
        await tx.loan.updateMany({
          where: { accountId: dup.id },
          data: { accountId: kept.id },
        });

        // 6. Reassign standing orders
        await tx.standingOrder.updateMany({
          where: { fromAccountId: dup.id },
          data: { fromAccountId: kept.id },
        });

        // 7. Reassign direct debits
        await tx.directDebit.updateMany({
          where: { accountId: dup.id },
          data: { accountId: kept.id },
        });

        // 8. Reassign crypto orders
        await tx.cryptoOrder.updateMany({
          where: { accountId: dup.id },
          data: { accountId: kept.id },
        });

        // 9. Merge balance into kept account
        const dupBalance = Number(dup.balance);
        const dupAvailable = Number(dup.availableBalance);
        if (dupBalance !== 0 || dupAvailable !== 0) {
          await tx.account.update({
            where: { id: kept.id },
            data: {
              balance: { increment: dupBalance },
              availableBalance: { increment: dupAvailable },
            },
          });
          log(`    Merged balance ${fmt(dup.balance)} into ${kept.accountNumber}`);
        }

        // 10. Zero out and close the duplicate
        await tx.account.update({
          where: { id: dup.id },
          data: {
            balance: 0,
            availableBalance: 0,
            status: AccountStatus.CLOSED,
            isDefault: false,
          },
        });
      });

      totalMerged++;
    }

    log('');
  }

  if (DRY_RUN) {
    log(`\nDry run complete. ${duplicateGroups.reduce((n, g) => n + g.length - 1, 0)} account(s) would be closed.`);
    log('Run with --execute to apply changes.\n');
  } else {
    log(`\nDone. ${totalMerged} duplicate account(s) closed.\n`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
