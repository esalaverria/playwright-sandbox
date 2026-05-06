import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  AccountType,
  CardBrand,
  CardLifecycleStatus as CLS,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import {
  generateAccountNumber,
  generateCvv,
  generatePan,
  maskFromPan,
} from './card-utils';

const listSelect = {
  id: true,
  type: true,
  nickname: true,
  mask: true,
  currency: true,
  balanceCents: true,
  frozen: true,
  creditLimitCents: true,
  allowOverLimit: true,
  accountNumberFull: true,
  cardBrand: true,
  cardLifecycle: true,
  expMonth: true,
  expYear: true,
  nameOnCard: true,
  createdAt: true,
} satisfies Prisma.AccountSelect;


@Injectable()
export class AccountsService {
  constructor(
    private prisma: PrismaService,
    private transfers: TransfersService,
  ) {}

  async logActivity(userId: string, action: string, meta?: Record<string, unknown>) {
    await this.prisma.userActivity.create({
      data: {
        userId,
        action,
        meta: meta === undefined ? undefined : (meta as Prisma.InputJsonValue),
      },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.account.findMany({
      where: { userId, closedAt: null },
      orderBy: [{ type: 'asc' }, { nickname: 'asc' }],
      select: listSelect,
    });
  }

  async assertOwnAccount(userId: string, accountId: string) {
    const acc = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!acc) throw new ForbiddenException('Account not found');
    return acc;
  }

  async assertOwnOpenAccount(userId: string, accountId: string) {
    const acc = await this.prisma.account.findFirst({
      where: { id: accountId, userId, closedAt: null },
    });
    if (!acc) throw new ForbiddenException('Account not found');
    return acc;
  }

  async createDepositAccount(userId: string, body: { type: AccountType; nickname: string }) {
    if (body.type !== AccountType.CHECKING && body.type !== AccountType.SAVINGS) {
      throw new BadRequestException('Only checking or savings accounts can be opened here');
    }
    const num = generateAccountNumber();
    const mask = `••${num.slice(-4)}`;
    const acc = await this.prisma.account.create({
      data: {
        userId,
        type: body.type,
        nickname: body.nickname.trim(),
        mask,
        accountNumberFull: num,
        balanceCents: 0,
      },
      select: listSelect,
    });
    await this.logActivity(userId, 'ACCOUNT_CREATED', {
      accountId: acc.id,
      type: body.type,
      nickname: acc.nickname,
    });
    return acc;
  }

  async requestCreditCard(userId: string, body: { nickname?: string; brand?: CardBrand }) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const brand = body.brand ?? CardBrand.VISA;
    const pan = generatePan(brand);
    const nickname =
      body.nickname?.trim() || `${brand === CardBrand.VISA ? 'Visa' : 'Mastercard'} · ${maskFromPan(pan)}`;
    const now = new Date();
    const expYear = now.getUTCFullYear() + 3;
    const expMonth = now.getUTCMonth() + 1;
    const acc = await this.prisma.account.create({
      data: {
        userId,
        type: AccountType.CREDIT,
        nickname,
        mask: maskFromPan(pan),
        panFull: pan,
        cvv: generateCvv(),
        expMonth,
        expYear,
        nameOnCard: user.fullName.toUpperCase(),
        cardBrand: brand,
        cardLifecycle: CLS.ACTIVE,
        creditLimitCents: 500000,
        allowOverLimit: false,
        frozen: false,
        balanceCents: 0,
      },
      select: listSelect,
    });
    await this.logActivity(userId, 'CARD_REQUESTED', { accountId: acc.id, brand });
    return acc;
  }

  async closeDepositAccount(userId: string, accountId: string, transferToAccountId?: string) {
    const acc = await this.assertOwnOpenAccount(userId, accountId);
    if (acc.type === AccountType.CREDIT) {
      throw new BadRequestException('Use cancel card for credit accounts');
    }
    const openCount = await this.prisma.account.count({
      where: { userId, closedAt: null },
    });
    if (openCount <= 1) {
      throw new BadRequestException('You cannot close your only open account');
    }
    if (acc.balanceCents > 0) {
      if (!transferToAccountId?.trim()) {
        throw new BadRequestException('Choose an account to receive your remaining balance');
      }
      const to = await this.assertOwnOpenAccount(userId, transferToAccountId);
      if (to.id === acc.id) throw new BadRequestException('Pick a different destination account');
      await this.transfers.internal(userId, {
        fromAccountId: acc.id,
        toAccountId: to.id,
        amountCents: acc.balanceCents,
        memo: 'Closing transfer',
      });
    } else if (acc.balanceCents < 0) {
      throw new BadRequestException('Negative balance must be resolved before closing');
    }
    await this.prisma.account.update({
      where: { id: accountId },
      data: { closedAt: new Date() },
    });
    await this.logActivity(userId, 'ACCOUNT_CLOSED', {
      accountId,
      nickname: acc.nickname,
      transferredTo: transferToAccountId ?? null,
    });
    return { ok: true };
  }

  async setCardLifecycle(
    userId: string,
    accountId: string,
    lifecycle: typeof CLS.CANCELLED | typeof CLS.LOST_REPORTED,
  ) {
    const acc = await this.assertOwnOpenAccount(userId, accountId);
    if (acc.type !== AccountType.CREDIT) {
      throw new BadRequestException('Not a credit card account');
    }
    await this.prisma.account.update({
      where: { id: accountId },
      data: { cardLifecycle: lifecycle, frozen: true },
    });
    await this.logActivity(
      userId,
      lifecycle === CLS.CANCELLED ? 'CARD_CANCELLED' : 'CARD_LOST_REPORTED',
      { accountId },
    );
    return { ok: true, cardLifecycle: lifecycle };
  }

  async getSensitiveCardDetails(userId: string, accountId: string) {
    const acc = await this.assertOwnOpenAccount(userId, accountId);
    if (acc.type !== AccountType.CREDIT) {
      throw new BadRequestException('Not a credit card account');
    }
    await this.logActivity(userId, 'CARD_DETAILS_VIEWED', { accountId });
    return {
      panFull: acc.panFull,
      cvv: acc.cvv,
      expMonth: acc.expMonth,
      expYear: acc.expYear,
      nameOnCard: acc.nameOnCard,
      brand: acc.cardBrand,
    };
  }

  async transactions(
    userId: string,
    accountId: string,
    opts: {
      page: number;
      pageSize: number;
      q?: string;
      from?: string;
      to?: string;
    },
  ) {
    await this.assertOwnOpenAccount(userId, accountId);
    const where: Prisma.LedgerEntryWhereInput = { accountId };
    if (opts.q?.trim()) {
      where.description = { contains: opts.q.trim(), mode: 'insensitive' };
    }
    const occurred: Prisma.DateTimeFilter = {};
    if (opts.from) {
      occurred.gte = new Date(opts.from + 'T00:00:00.000Z');
    }
    if (opts.to) {
      occurred.lte = new Date(opts.to + 'T23:59:59.999Z');
    }
    if (Object.keys(occurred).length) {
      where.occurredAt = occurred;
    }

    const skip = (opts.page - 1) * opts.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip,
        take: opts.pageSize,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / opts.pageSize));
    return {
      items,
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages,
    };
  }

  async setFrozen(userId: string, accountId: string, frozen: boolean) {
    const acc = await this.assertOwnOpenAccount(userId, accountId);
    if (acc.type !== AccountType.CREDIT) {
      throw new BadRequestException('Freeze applies to credit accounts only');
    }
    if (acc.cardLifecycle !== CLS.ACTIVE) {
      throw new BadRequestException('Card is no longer active');
    }
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { frozen },
      select: { id: true, frozen: true },
    });
    await this.logActivity(userId, frozen ? 'CARD_FROZEN' : 'CARD_UNFROZEN', { accountId });
    return updated;
  }

  async setAllowOverLimit(userId: string, accountId: string, allowOverLimit: boolean) {
    const acc = await this.assertOwnOpenAccount(userId, accountId);
    if (acc.type !== AccountType.CREDIT) {
      throw new BadRequestException('Only credit accounts support this setting');
    }
    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: { allowOverLimit },
      select: { id: true, allowOverLimit: true },
    });
    await this.logActivity(userId, 'OVERLIMIT_TOGGLED', { accountId, allowOverLimit });
    return updated;
  }

  async statementMonths(userId: string, accountId: string) {
    await this.assertOwnAccount(userId, accountId);
    const months = new Set<string>();
    for (const row of await this.prisma.ledgerEntry.findMany({
      where: { accountId },
      select: { occurredAt: true },
    })) {
      const d = row.occurredAt;
      months.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    return { periods: [...months].sort().reverse() };
  }

  async exportCsv(userId: string, accountId: string, period: string) {
    await this.assertOwnAccount(userId, accountId);
    const [y, m] = period.split('-').map(Number);
    if (!y || !m) throw new BadRequestException('Invalid period');
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    const rows = await this.prisma.ledgerEntry.findMany({
      where: {
        accountId,
        occurredAt: { gte: start, lte: end },
      },
      orderBy: { occurredAt: 'asc' },
    });
    const header = 'date,description,amountCents,balanceAfterCents,status\n';
    const body = rows
      .map((r) =>
        [
          r.occurredAt.toISOString(),
          JSON.stringify(r.description),
          r.amountCents,
          r.balanceAfterCents,
          r.status,
        ].join(','),
      )
      .join('\n');
    return { filename: `statement-${accountId}-${period}.csv`, content: header + body };
  }

  async listActivity(userId: string) {
    return this.prisma.userActivity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
