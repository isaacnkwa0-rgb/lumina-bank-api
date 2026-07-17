import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { ErrorCodes } from '../../shared/utils/api-response';

const UK_BANKS: Record<string, string> = {
  LMN:  'Lumina Bank',
  BARC: 'Barclays',
  HSBC: 'HSBC UK',
  LOYD: 'Lloyds Bank',
  NWBK: 'NatWest',
  SCBL: 'Standard Chartered',
  MONZ: 'Monzo',
  RVLT: 'Revolut',
  STRL: 'Starling Bank',
  SANT: 'Santander UK',
};

// Deterministic mock name for external banks (last digit → fixed name pool)
function mockAccountName(accountNumber: string): string {
  const names = [
    'James Thompson',
    'Emma Williams',
    'Oliver Johnson',
    'Sophie Davies',
    'Harry Wilson',
    'Charlotte Evans',
    'Jack Brown',
    'Amelia Taylor',
    'George Robinson',
    'Isabella Clarke',
  ];
  const index = parseInt(accountNumber.slice(-1), 10);
  return names[index] ?? 'Account Holder';
}

export interface CreateBeneficiaryData {
  nickname: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  iban?: string;
  swiftCode?: string;
  country?: string;
  currency?: string;
  isFavorite?: boolean;
}

export interface UpdateBeneficiaryData {
  nickname?: string;
  isFavorite?: boolean;
}

export class BeneficiariesService {
  async list(userId: string) {
    return prisma.beneficiary.findMany({
      where: { userId },
      orderBy: [{ isFavorite: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(id: string, userId: string) {
    const beneficiary = await prisma.beneficiary.findFirst({ where: { id, userId } });
    if (!beneficiary) throw new AppError('Beneficiary not found', 404, ErrorCodes.NOT_FOUND);
    return beneficiary;
  }

  async create(userId: string, data: CreateBeneficiaryData) {
    // Prevent duplicate account numbers for the same user
    const existing = await prisma.beneficiary.findFirst({
      where: { userId, accountNumber: data.accountNumber, bankCode: data.bankCode },
    });
    if (existing) throw new AppError('Beneficiary already exists', 409, ErrorCodes.CONFLICT);

    return prisma.beneficiary.create({
      data: {
        userId,
        nickname: data.nickname,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        bankCode: data.bankCode,
        iban: data.iban,
        swiftCode: data.swiftCode,
        country: data.country ?? 'GB',
        currency: data.currency ?? 'GBP',
        isFavorite: data.isFavorite ?? false,
      },
    });
  }

  async update(id: string, userId: string, data: UpdateBeneficiaryData) {
    await this.get(id, userId);
    return prisma.beneficiary.update({
      where: { id },
      data: {
        ...(data.nickname !== undefined && { nickname: data.nickname }),
        ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.get(id, userId);
    await prisma.beneficiary.delete({ where: { id } });
  }

  async verifyAccount(accountNumber: string, bankCode: string) {
    const bankName = UK_BANKS[bankCode];
    if (!bankName) throw new AppError('Bank code not recognised', 400, ErrorCodes.VAL_001);

    // Lumina accounts: real DB lookup returns the actual account holder's name
    if (bankCode === 'LMN') {
      const account = await prisma.account.findFirst({
        where: { accountNumber },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (!account) throw new AppError('Account not found', 404, ErrorCodes.NOT_FOUND);
      const accountName = `${account.user.firstName} ${account.user.lastName}`;
      return { accountName, accountNumber, bankName, bankCode };
    }

    // External UK banks: deterministic mock (simulates Confirmation of Payee)
    const accountName = mockAccountName(accountNumber);
    return { accountName, accountNumber, bankName, bankCode };
  }
}

export const beneficiariesService = new BeneficiariesService();
