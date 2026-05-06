import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, LedgerStatus } from '../generated/prisma/client';
import { CardLifecycleStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

type CreditCapAccount = {
  type: string;
  creditLimitCents: number | null;
  allowOverLimit: boolean;
};

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  /** Debt owed on a credit line (positive cents). */
  private debtCents(balanceCents: number): number {
    return Math.max(0, -balanceCents);
  }

  private assertWithinCreditLimit(acc: CreditCapAccount, newBalanceCents: number) {
    if (acc.type !== AccountType.CREDIT) return;
    const limit = acc.creditLimitCents;
    if (limit == null) return;
    const newDebt = this.debtCents(newBalanceCents);
    if (newDebt > limit && !acc.allowOverLimit) {
      throw new BadRequestException({
        code: 'OVER_CREDIT_LIMIT',
        message:
          'This would exceed your credit limit. Pay down the balance, raise the limit, or turn on “Allow charges over limit” for this card.',
      });
    }
  }

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
      if (from.closedAt || to.closedAt) {
        throw new BadRequestException({ code: 'ACCOUNT_CLOSED', message: 'Account is closed' });
      }
      if (from.type === AccountType.CREDIT) {
        if (from.cardLifecycle !== CardLifecycleStatus.ACTIVE) {
          throw new BadRequestException({ code: 'CARD_INACTIVE', message: 'Card is no longer active' });
        }
        if (from.frozen) {
          throw new BadRequestException({ code: 'CARD_FROZEN', message: 'Card is frozen' });
        }
      }
      if (
        (from.type === AccountType.CHECKING || from.type === AccountType.SAVINGS) &&
        from.balanceCents < body.amountCents
      ) {
        throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' });
      }

      const memo = body.memo?.trim() || 'Transfer';
      const fromBal = from.balanceCents - body.amountCents;
      const toBal = to.balanceCents + body.amountCents;

      this.assertWithinCreditLimit(from, fromBal);
      this.assertWithinCreditLimit(to, toBal);

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

  /** Pay down a credit card from checking or savings. */
  async payCreditCard(userId: string, creditAccountId: string, fromAccountId: string, amountCents: number) {
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new BadRequestException({ code: 'BAD_AMOUNT', message: 'Amount must be a positive whole number of cents' });
    }
    const credit = await this.prisma.account.findFirst({ where: { id: creditAccountId, userId } });
    if (!credit || credit.type !== AccountType.CREDIT) {
      throw new BadRequestException({ code: 'NOT_CREDIT', message: 'Destination must be a credit card account' });
    }
    if (credit.closedAt) {
      throw new BadRequestException({ code: 'ACCOUNT_CLOSED', message: 'Account is closed' });
    }
    const from = await this.prisma.account.findFirst({ where: { id: fromAccountId, userId } });
    if (!from) throw new NotFoundException('Source account not found');
    if (from.closedAt) {
      throw new BadRequestException({ code: 'ACCOUNT_CLOSED', message: 'Account is closed' });
    }
    if (from.type !== AccountType.CHECKING && from.type !== AccountType.SAVINGS) {
      throw new BadRequestException({ code: 'INVALID_PAY_FROM', message: 'Pay from a checking or savings account' });
    }
    return this.internal(userId, {
      fromAccountId,
      toAccountId: creditAccountId,
      amountCents,
      memo: 'Card payment',
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
    if (toAcc.closedAt) {
      throw new BadRequestException({ code: 'ACCOUNT_CLOSED', message: 'Destination account is closed' });
    }
    if (toAcc.type === AccountType.CREDIT && toAcc.cardLifecycle !== CardLifecycleStatus.ACTIVE) {
      throw new BadRequestException({ code: 'CARD_INACTIVE', message: 'Cannot send to this card' });
    }

    const sender = await this.prisma.user.findUnique({ where: { id: userId } });

    return this.prisma.$transaction(async (tx) => {
      const from = await tx.account.findFirst({ where: { id: body.fromAccountId, userId } });
      if (!from) throw new ForbiddenException('Source account not found');
      if (from.closedAt) {
        throw new BadRequestException({ code: 'ACCOUNT_CLOSED', message: 'Account is closed' });
      }
      if (from.type === AccountType.CREDIT) {
        if (from.cardLifecycle !== CardLifecycleStatus.ACTIVE) {
          throw new BadRequestException({ code: 'CARD_INACTIVE', message: 'Card is no longer active' });
        }
        if (from.frozen) {
          throw new BadRequestException({ code: 'CARD_FROZEN', message: 'Card is frozen' });
        }
      }
      if (
        (from.type === AccountType.CHECKING || from.type === AccountType.SAVINGS) &&
        from.balanceCents < body.amountCents
      ) {
        throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' });
      }

      const memo = body.memo?.trim() || 'Transfer';
      const fromBal = from.balanceCents - body.amountCents;
      const toBal = toAcc.balanceCents + body.amountCents;

      this.assertWithinCreditLimit(from, fromBal);
      this.assertWithinCreditLimit(toAcc, toBal);

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
