/** Shape required to build transfer-style account picker labels. */
export type AccountPickRow = {
  nickname: string;
  mask: string;
  type: string;
  balanceCents: number;
  frozen?: boolean;
};

/** Peer transfer destination row (no balance). */
export type PeerDestinationRow = {
  nickname: string;
  mask: string;
  type: string;
};

/** Label for peer “To their account”: `nickname mask · type` (no cents / formatMoney). */
export function formatPeerDestinationLabel(a: PeerDestinationRow): string {
  return `${a.nickname} ${a.mask} · ${a.type}`;
}

/**
 * Standard account picker: nickname, mask, type, formatted balance (with $ via formatMoney).
 */
export function formatAccountOptionLabel(
  a: AccountPickRow,
  formatMoney: (cents: number) => string,
): string {
  const ice = a.frozen ? ' · Frozen' : '';
  return `${a.nickname} ${a.mask} · ${a.type} · ${formatMoney(a.balanceCents)}${ice}`;
}
