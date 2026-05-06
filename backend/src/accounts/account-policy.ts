import { AccountType, CardLifecycleStatus } from '../generated/prisma/enums';

export type AccountPolicyFields = {
  type: string;
  closedAt: Date | null;
  frozen: boolean;
  balanceCents: number;
  /** Present on credit accounts; optional when only deposit fields are loaded. */
  cardLifecycle?: string;
};

export function isDeposit(a: AccountPolicyFields): boolean {
  return a.type === AccountType.CHECKING || a.type === AccountType.SAVINGS;
}

export function isOpen(a: AccountPolicyFields): boolean {
  return a.closedAt == null;
}

/** Whether this account can be debited for bill pay, transfers from deposit, etc. */
export function canUseAsDebitSourceForBanking(a: AccountPolicyFields): { ok: boolean; reason?: string } {
  if (a.closedAt) return { ok: false, reason: 'closed' };
  if (!isDeposit(a)) return { ok: false, reason: 'not_deposit' };
  if (a.frozen) return { ok: false, reason: 'frozen' };
  return { ok: true };
}

export function canCreditCardTransact(a: AccountPolicyFields): boolean {
  if (a.closedAt) return false;
  if (a.type !== AccountType.CREDIT) return false;
  if (a.cardLifecycle !== CardLifecycleStatus.ACTIVE) return false;
  if (a.frozen) return false;
  return true;
}

/** Receiving side for transfers / deposits — checking/savings or active credit. */
export function canReceiveTransferCredit(to: AccountPolicyFields): { ok: boolean; reason?: string } {
  if (to.closedAt) return { ok: false, reason: 'closed' };
  if (to.type === AccountType.CREDIT) {
    if (to.cardLifecycle !== CardLifecycleStatus.ACTIVE) return { ok: false, reason: 'card_inactive' };
    if (to.frozen) return { ok: false, reason: 'frozen' };
    return { ok: true };
  }
  if (isDeposit(to)) {
    if (to.frozen) return { ok: false, reason: 'frozen' };
    return { ok: true };
  }
  return { ok: false, reason: 'unknown_type' };
}
