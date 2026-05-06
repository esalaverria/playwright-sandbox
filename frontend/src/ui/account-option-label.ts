/** Shape required to build transfer-style account picker labels. */
export type AccountPickRow = {
  nickname: string;
  mask: string;
  type: string;
  balanceCents: number;
  frozen?: boolean;
};

/**
 * Peer “To their account” pattern: nickname, mask, type, formatted balance (with $ via formatMoney).
 */
export function formatAccountOptionLabel(
  a: AccountPickRow,
  formatMoney: (cents: number) => string,
): string {
  const ice = a.frozen ? ' · Frozen' : '';
  return `${a.nickname} ${a.mask} · ${a.type} · ${formatMoney(a.balanceCents)}${ice}`;
}
