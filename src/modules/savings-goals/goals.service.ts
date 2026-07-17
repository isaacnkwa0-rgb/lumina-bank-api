import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { TransactionType, TransactionStatus, GoalStatus, TransactionCategory } from '@prisma/client';
import { generateTransactionReference } from '../../shared/utils/transaction-ref';

export class GoalsService {
  async getGoals(userId: string) {
    return prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGoal(id: string, userId: string) {
    const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new AppError('Goal not found', 404);
    return goal;
  }

  async createGoal(
    userId: string,
    data: {
      name: string;
      targetAmount: number;
      targetDate?: string;
      emoji?: string;
      accountId?: string;
    },
  ) {
    const { name, targetAmount, targetDate, emoji, accountId } = data;
    return prisma.savingsGoal.create({
      data: {
        userId,
        name,
        targetAmount,
        currentAmount: 0,
        targetDate: targetDate ? new Date(targetDate) : undefined,
        emoji,
        accountId,
        status: GoalStatus.ACTIVE,
      },
    });
  }

  async updateGoal(
    id: string,
    userId: string,
    data: {
      name?: string;
      targetAmount?: number;
      targetDate?: string;
      emoji?: string;
    },
  ) {
    await this.getGoal(id, userId);
    const { targetDate, ...rest } = data;
    return prisma.savingsGoal.update({
      where: { id },
      data: {
        ...rest,
        ...(targetDate ? { targetDate: new Date(targetDate) } : {}),
      },
    });
  }

  async deleteGoal(id: string, userId: string) {
    await this.getGoal(id, userId);
    await prisma.savingsGoal.delete({ where: { id } });
    return { message: 'Goal deleted' };
  }

  async contribute(
    id: string,
    userId: string,
    data: { amount: number; fromAccountId: string },
  ) {
    const { amount, fromAccountId } = data;
    const goal = await this.getGoal(id, userId);

    const account = await prisma.account.findFirst({
      where: { id: fromAccountId, userId },
    });
    if (!account) throw new AppError('Source account not found', 404);
    if (account.balance.toNumber() < amount) {
      throw new AppError('Insufficient funds', 400);
    }

    const newAmount = goal.currentAmount.toNumber() + amount;
    const isAchieved = newAmount >= goal.targetAmount.toNumber();
    const reference = generateTransactionReference();

    const [updatedGoal] = await prisma.$transaction([
      prisma.savingsGoal.update({
        where: { id },
        data: {
          currentAmount: newAmount,
          status: isAchieved ? GoalStatus.ACHIEVED : GoalStatus.ACTIVE,
        },
      }),
      prisma.account.update({
        where: { id: fromAccountId },
        data: { balance: { decrement: amount } },
      }),
      prisma.transaction.create({
        data: {
          accountId: fromAccountId,
          type: TransactionType.DEBIT,
          amount,
          currency: account.currency,
          balanceBefore: account.balance.toNumber(),
          balanceAfter: account.balance.toNumber() - amount,
          category: TransactionCategory.GOAL_CONTRIBUTION,
          description: `Contribution to goal: ${goal.name}`,
          reference,
          status: TransactionStatus.COMPLETED,
        },
      }),
    ]);

    return { goal: updatedGoal, contributed: amount, achieved: isAchieved };
  }

  async withdraw(
    id: string,
    userId: string,
    data: { amount: number; toAccountId: string },
  ) {
    const { amount, toAccountId } = data;
    const goal = await this.getGoal(id, userId);

    if (goal.currentAmount.toNumber() < amount) {
      throw new AppError('Withdrawal exceeds goal balance', 400);
    }

    const account = await prisma.account.findFirst({
      where: { id: toAccountId, userId },
    });
    if (!account) throw new AppError('Destination account not found', 404);

    const newAmount = goal.currentAmount.toNumber() - amount;
    const reference = generateTransactionReference();

    const [updatedGoal] = await prisma.$transaction([
      prisma.savingsGoal.update({
        where: { id },
        data: { currentAmount: newAmount },
      }),
      prisma.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      }),
      prisma.transaction.create({
        data: {
          accountId: toAccountId,
          type: TransactionType.CREDIT,
          amount,
          currency: account.currency,
          balanceBefore: account.balance.toNumber(),
          balanceAfter: account.balance.toNumber() + amount,
          category: TransactionCategory.GOAL_WITHDRAWAL,
          description: `Withdrawal from goal: ${goal.name}`,
          reference,
          status: TransactionStatus.COMPLETED,
        },
      }),
    ]);

    return { goal: updatedGoal, withdrawn: amount };
  }
}

export default new GoalsService();

export const goalsService = new GoalsService();
