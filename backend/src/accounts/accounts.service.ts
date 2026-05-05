import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LedgerStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async listForUser(userId: string) {
    return this.prisma.account.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { nickname: 'asc' }],
      select: {
        id: true,
        type: true,
        nickname: true,
        mask: true,
        currency: true,
        balanceCents: true,
        frozen: true,
      },
    });
  }

  async assertOwnAccount(userId: string, accountId: string) {
    const acc = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!acc) throw new ForbiddenException('Account not found');
    return acc;
  }

  async transactions(
    userId: string,
    accountId: string,
    opts: { take: number; cursor?: string; q?: string },
  ) {
    await this.assertOwnAccount(userId, accountId);
    const where: Prisma.LedgerEntryWhereInput = { accountId };
    if (opts.q?.trim()) {
      where.description = { contains: opts.q.trim(), mode: 'insensitive' };
    }
    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: opts.take + 1,
      ...(opts.cursor
        ? {
            cursor: { id: opts.cursor },
            skip: 1,
          }
        : {}),
    });
    let nextCursor: string | null = null;
    let items = entries;
    if (entries.length > opts.take) {
      const next = entries.pop()!;
      nextCursor = next.id;
      items = entries;
    }
    return { items, nextCursor };
  }

  async setFrozen(userId: string, accountId: string, frozen: boolean) {
    const acc = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!acc) throw new NotFoundException();
    if (acc.type !== 'CREDIT') {
      throw new BadRequestException('Freeze applies to credit accounts only');
    }
    return this.prisma.account.update({
      where: { id: accountId },
      data: { frozen },
      select: { id: true, frozen: true },
    });
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
}
