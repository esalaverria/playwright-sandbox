import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LedgerStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  async internal(
    userId: string,
    body: { fromAccountId: string; toAccountId: string; amountCents: number; memo?: string },
  ) {
    if (body.fromAccountId === body.toAccountId) {
      throw new BadRequestException({ code: 'SAME_ACCOUNT', message: 'Choose two different accounts' });
    }
    if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) {
      throw new BadRequestException({ code: 'BAD_AMOUNT', message: 'Amount must be a positive whole number of cents' });
    }

    return this.prisma.$transaction(async (tx) => {
      const from = await tx.account.findFirst({ where: { id: body.fromAccountId, userId } });
      const to = await tx.account.findFirst({ where: { id: body.toAccountId, userId } });
      if (!from || !to) throw new ForbiddenException('Accounts must belong to you');
      if (from.balanceCents < body.amountCents) {
        throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' });
      }

      const memo = body.memo?.trim() || 'Transfer';
      const fromBal = from.balanceCents - body.amountCents;
      const toBal = to.balanceCents + body.amountCents;

      await tx.account.update({ where: { id: from.id }, data: { balanceCents: fromBal } });
      await tx.account.update({ where: { id: to.id }, data: { balanceCents: toBal } });

      await tx.ledgerEntry.create({
        data: {
          accountId: from.id,
          description: `${memo} → ${to.nickname}`,
          amountCents: -body.amountCents,
          balanceAfterCents: fromBal,
          status: LedgerStatus.POSTED,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          accountId: to.id,
          description: `${memo} ← ${from.nickname}`,
          amountCents: body.amountCents,
          balanceAfterCents: toBal,
          status: LedgerStatus.POSTED,
        },
      });

      return { ok: true, fromBalanceCents: fromBal, toBalanceCents: toBal };
    });
  }

  async peer(
    userId: string,
    body: {
      fromAccountId: string;
      recipientEmail: string;
      toAccountId: string;
      amountCents: number;
      memo?: string;
    },
  ) {
    if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) {
      throw new BadRequestException({ code: 'BAD_AMOUNT', message: 'Amount must be a positive whole number of cents' });
    }

    const email = body.recipientEmail.toLowerCase().trim();
    const recipient = await this.prisma.user.findUnique({ where: { email } });
    if (!recipient) throw new NotFoundException({ code: 'UNKNOWN_USER', message: 'Recipient not found' });
    if (recipient.id === userId) {
      throw new BadRequestException({ code: 'SELF_PEER', message: 'Use internal transfer between your accounts' });
    }

    const toAcc = await this.prisma.account.findFirst({
      where: { id: body.toAccountId, userId: recipient.id },
    });
    if (!toAcc) throw new NotFoundException({ code: 'UNKNOWN_ACCOUNT', message: 'Destination account not found for recipient' });

    const sender = await this.prisma.user.findUnique({ where: { id: userId } });

    return this.prisma.$transaction(async (tx) => {
      const from = await tx.account.findFirst({ where: { id: body.fromAccountId, userId } });
      if (!from) throw new ForbiddenException('Source account not found');
      if (from.balanceCents < body.amountCents) {
        throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' });
      }

      const memo = body.memo?.trim() || 'Transfer';
      const fromBal = from.balanceCents - body.amountCents;
      const toBal = toAcc.balanceCents + body.amountCents;

      await tx.account.update({ where: { id: from.id }, data: { balanceCents: fromBal } });
      await tx.account.update({ where: { id: toAcc.id }, data: { balanceCents: toBal } });

      await tx.ledgerEntry.create({
        data: {
          accountId: from.id,
          description: `${memo} → ${recipient.email}`,
          amountCents: -body.amountCents,
          balanceAfterCents: fromBal,
          status: LedgerStatus.POSTED,
        },
      });
      await tx.ledgerEntry.create({
        data: {
          accountId: toAcc.id,
          description: `${memo} ← ${sender!.email}`,
          amountCents: body.amountCents,
          balanceAfterCents: toBal,
          status: LedgerStatus.POSTED,
        },
      });

      return { ok: true, recipientCreditCents: body.amountCents, toBalanceCents: toBal };
    });
  }
}
