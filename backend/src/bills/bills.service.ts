import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LedgerStatus, PaymentStatus, Prisma } from '../generated/prisma/client';
import { AccountType, ScheduledPaymentKind } from '../generated/prisma/enums';
import { canUseAsDebitSourceForBanking } from '../accounts/account-policy';
import { PrismaService } from '../prisma/prisma.service';

type BillWithFrom = Prisma.ScheduledPaymentGetPayload<{
  include: {
    fromAccount: {
      select: {
        id: true;
        nickname: true;
        type: true;
        closedAt: true;
        frozen: true;
        balanceCents: true;
        creditLimitCents: true;
        allowOverLimit: true;
        cardLifecycle: true;
      };
    };
  };
}>;

@Injectable()
export class BillsService {
  constructor(private prisma: PrismaService) {}

  private assertPayFromHasCapacity(
    account: {
      type: string;
      balanceCents: number;
      creditLimitCents?: number | null;
      allowOverLimit?: boolean;
    },
    amountCents: number,
  ) {
    if (account.balanceCents >= amountCents) return;
    if (account.type !== AccountType.CREDIT) {
      throw new BadRequestException({ code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds' });
    }
    const nextDebt = Math.max(0, -(account.balanceCents - amountCents));
    if (
      account.creditLimitCents != null &&
      nextDebt > account.creditLimitCents &&
      !account.allowOverLimit
    ) {
      throw new BadRequestException({
        code: 'OVER_CREDIT_LIMIT',
        message: 'Insufficient available credit. Change the payment method.',
      });
    }
  }

  private enrichBill(b: BillWithFrom) {
    const src = canUseAsDebitSourceForBanking(b.fromAccount);
    const insufficient =
      b.status === PaymentStatus.SCHEDULED && b.fromAccount.balanceCents < b.amountCents;
    const payFromInvalid =
      b.status === PaymentStatus.SCHEDULED && (!src.ok || insufficient);
    let payFromIssue: string | undefined;
    if (b.status === PaymentStatus.SCHEDULED) {
      if (!src.ok) payFromIssue = src.reason;
      else if (insufficient) payFromIssue = 'insufficient_funds';
    }

    return {
      id: b.id,
      userId: b.userId,
      billerName: b.billerName,
      fromAccountId: b.fromAccountId,
      amountCents: b.amountCents,
      dueDate: b.dueDate.toISOString(),
      status: b.status,
      memo: b.memo,
      kind: b.kind,
      payFromInvalid,
      payFromIssue: payFromIssue ?? null,
      fromAccountNickname: b.fromAccount.nickname,
      fromAccountType: b.fromAccount.type,
      fromAccountBalanceCents: b.fromAccount.balanceCents,
    };
  }

  async list(userId: string) {
    const items = await this.prisma.scheduledPayment.findMany({
      where: { userId },
      orderBy: { dueDate: 'asc' },
      include: {
        fromAccount: {
          select: {
            id: true,
            nickname: true,
            type: true,
            closedAt: true,
            frozen: true,
            balanceCents: true,
            creditLimitCents: true,
            allowOverLimit: true,
            cardLifecycle: true,
          },
        },
      },
    });
    return { bills: items.map((b) => this.enrichBill(b)) };
  }

  async create(
    userId: string,
    dto: {
      billerName: string;
      fromAccountId: string;
      amountCents: number;
      dueDate: string;
      memo?: string;
      mode?: 'schedule' | 'pay_now';
    },
  ) {
    const acc = await this.prisma.account.findFirst({
      where: { id: dto.fromAccountId, userId },
    });
    if (!acc) throw new BadRequestException('Invalid account');

    const src = canUseAsDebitSourceForBanking(acc);
    if (!src.ok) {
      throw new BadRequestException({
        code: 'INVALID_PAY_FROM',
        message: 'Choose an open account or active card that is not frozen.',
      });
    }

    const mode = dto.mode ?? 'schedule';
    const due = new Date(dto.dueDate);
    if (Number.isNaN(due.getTime())) throw new BadRequestException('Invalid date');

    if (mode === 'schedule') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) {
        throw new BadRequestException({ code: 'PAST_DATE', message: 'Due date must be today or later' });
      }
    }

    if (mode === 'pay_now') {
      this.assertPayFromHasCapacity(acc, dto.amountCents);
      return this.prisma.$transaction(async (tx) => {
        const bill = await tx.scheduledPayment.create({
          data: {
            userId,
            billerName: dto.billerName.trim(),
            fromAccountId: dto.fromAccountId,
            amountCents: dto.amountCents,
            dueDate: due,
            memo: dto.memo?.trim() || null,
            status: PaymentStatus.PAID,
            kind: ScheduledPaymentKind.INSTANT,
          },
        });
        await this.postBillPaymentLedger(tx, dto.fromAccountId, dto.amountCents, dto.billerName.trim());
        const refreshed = await tx.scheduledPayment.findFirstOrThrow({
          where: { id: bill.id },
          include: {
            fromAccount: {
              select: {
                id: true,
                nickname: true,
                type: true,
                closedAt: true,
                frozen: true,
                balanceCents: true,
                creditLimitCents: true,
                allowOverLimit: true,
                cardLifecycle: true,
              },
            },
          },
        });
        return { bill: this.enrichBill(refreshed) };
      });
    }

    const bill = await this.prisma.scheduledPayment.create({
      data: {
        userId,
        billerName: dto.billerName.trim(),
        fromAccountId: dto.fromAccountId,
        amountCents: dto.amountCents,
        dueDate: due,
        memo: dto.memo?.trim() || null,
        status: PaymentStatus.SCHEDULED,
        kind: ScheduledPaymentKind.SCHEDULED,
      },
      include: {
        fromAccount: {
          select: {
            id: true,
            nickname: true,
            type: true,
            closedAt: true,
            frozen: true,
            balanceCents: true,
            creditLimitCents: true,
            allowOverLimit: true,
            cardLifecycle: true,
          },
        },
      },
    });
    return { bill: this.enrichBill(bill) };
  }

  async update(
    userId: string,
    id: string,
    dto: {
      billerName?: string;
      fromAccountId?: string;
      amountCents?: number;
      dueDate?: string;
      memo?: string;
    },
  ) {
    const existing = await this.prisma.scheduledPayment.findFirst({
      where: { id, userId },
      include: {
        fromAccount: {
          select: {
            id: true,
            nickname: true,
            type: true,
            closedAt: true,
            frozen: true,
            balanceCents: true,
            creditLimitCents: true,
            allowOverLimit: true,
            cardLifecycle: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Bill payment not found');
    if (existing.status !== PaymentStatus.SCHEDULED) {
      throw new BadRequestException({ code: 'NOT_EDITABLE', message: 'Only scheduled payments can be edited' });
    }

    let nextFromId = existing.fromAccountId;
    if (dto.fromAccountId != null && dto.fromAccountId !== existing.fromAccountId) {
      const acc = await this.prisma.account.findFirst({
        where: { id: dto.fromAccountId, userId },
      });
      if (!acc) throw new BadRequestException('Invalid account');
      const ok = canUseAsDebitSourceForBanking(acc);
      if (!ok.ok) {
        throw new BadRequestException({
          code: 'INVALID_PAY_FROM',
          message: 'Choose an open account or active card that is not frozen.',
        });
      }
      nextFromId = dto.fromAccountId;
    }

    const accForFunds =
      dto.fromAccountId != null && dto.fromAccountId !== existing.fromAccountId
        ? await this.prisma.account.findFirstOrThrow({ where: { id: nextFromId, userId } })
        : existing.fromAccount;

    const nextAmount = dto.amountCents ?? existing.amountCents;
    this.assertPayFromHasCapacity(accForFunds, nextAmount);

    let nextDue = existing.dueDate;
    if (dto.dueDate != null) {
      const due = new Date(dto.dueDate);
      if (Number.isNaN(due.getTime())) throw new BadRequestException('Invalid date');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) throw new BadRequestException({ code: 'PAST_DATE', message: 'Due date must be today or later' });
      nextDue = due;
    }

    const updated = await this.prisma.scheduledPayment.update({
      where: { id },
      data: {
        billerName: dto.billerName?.trim() ?? undefined,
        fromAccountId: dto.fromAccountId != null ? nextFromId : undefined,
        amountCents: dto.amountCents ?? undefined,
        dueDate: dto.dueDate != null ? nextDue : undefined,
        memo:
          dto.memo === undefined
            ? undefined
            : dto.memo.trim() === ''
              ? null
              : dto.memo.trim(),
      },
      include: {
        fromAccount: {
          select: {
            id: true,
            nickname: true,
            type: true,
            closedAt: true,
            frozen: true,
            balanceCents: true,
            creditLimitCents: true,
            allowOverLimit: true,
            cardLifecycle: true,
          },
        },
      },
    });

    return { bill: this.enrichBill(updated) };
  }

  async payNow(userId: string, id: string) {
    const bill = await this.prisma.scheduledPayment.findFirst({
      where: { id, userId },
      include: {
        fromAccount: {
          select: {
            id: true,
            nickname: true,
            type: true,
            closedAt: true,
            frozen: true,
            balanceCents: true,
            creditLimitCents: true,
            allowOverLimit: true,
            cardLifecycle: true,
          },
        },
      },
    });
    if (!bill) throw new NotFoundException('Bill payment not found');
    if (bill.status !== PaymentStatus.SCHEDULED) {
      throw new BadRequestException({ code: 'ALREADY_PAID', message: 'This payment is not scheduled' });
    }

    const src = canUseAsDebitSourceForBanking(bill.fromAccount);
    if (!src.ok) {
      throw new BadRequestException({
        code: 'UPDATE_PAY_FROM',
        message: 'Update the pay-from account before paying — it is closed or unavailable.',
      });
    }
    this.assertPayFromHasCapacity(bill.fromAccount, bill.amountCents);

    return this.prisma.$transaction(async (tx) => {
      await this.postBillPaymentLedger(tx, bill.fromAccountId, bill.amountCents, bill.billerName);
      const updated = await tx.scheduledPayment.update({
        where: { id },
        data: { status: PaymentStatus.PAID },
        include: {
          fromAccount: {
            select: {
              id: true,
              nickname: true,
              type: true,
              closedAt: true,
              frozen: true,
              balanceCents: true,
              creditLimitCents: true,
              allowOverLimit: true,
              cardLifecycle: true,
            },
          },
        },
      });
      return { bill: this.enrichBill(updated) };
    });
  }

  private async postBillPaymentLedger(
    tx: Prisma.TransactionClient,
    fromAccountId: string,
    amountCents: number,
    billerName: string,
  ) {
    const from = await tx.account.findUniqueOrThrow({ where: { id: fromAccountId } });
    this.assertPayFromHasCapacity(from, amountCents);
    const nextBal = from.balanceCents - amountCents;
    await tx.account.update({
      where: { id: from.id },
      data: { balanceCents: nextBal },
    });
    await tx.ledgerEntry.create({
      data: {
        accountId: from.id,
        description: `Bill pay · ${billerName}`,
        amountCents: -amountCents,
        balanceAfterCents: nextBal,
        status: LedgerStatus.POSTED,
      },
    });
  }
}
