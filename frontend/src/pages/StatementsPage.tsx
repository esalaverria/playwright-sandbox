import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { AccountSelect } from '../ui/AccountSelect';
import { AppSelect } from '../ui/AppSelect';
import { formatAccountOptionLabel } from '../ui/account-option-label';

type AccountRow = {
  id: string;
  nickname: string;
  mask: string;
  type: string;
  balanceCents: number;
  frozen?: boolean;
  cardLifecycle?: string | null;
  closedAt?: string | null;
};

export function StatementsPage() {
  const { formatMoney } = usePrivacy();
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: AccountRow[] }>('/accounts');
      return data.accounts;
    },
  });

  const stmtAccounts = useMemo(
    () => (accounts.data ?? []).filter((a) => !a.closedAt && (a.type !== 'CREDIT' || a.cardLifecycle === 'ACTIVE')),
    [accounts.data],
  );

  const accountOptions = useMemo(
    () =>
      stmtAccounts.map((a) => ({
        id: a.id,
        label: formatAccountOptionLabel(
          {
            nickname: a.nickname,
            mask: a.mask,
            type: a.type,
            balanceCents: a.balanceCents,
            frozen: a.type === 'CREDIT' ? false : a.frozen,
          },
          formatMoney,
        ),
        disabled: !!a.frozen && a.type !== 'CREDIT',
      })),
    [stmtAccounts, formatMoney],
  );

  const [accountId, setAccountId] = useState<string>('');

  useEffect(() => {
    if (!accountId && stmtAccounts.length) setAccountId(stmtAccounts[0]!.id);
    if (accountId && stmtAccounts.length && !stmtAccounts.some((a) => a.id === accountId)) {
      setAccountId(stmtAccounts[0]!.id);
    }
  }, [stmtAccounts, accountId]);

  const periods = useQuery({
    queryKey: ['stmt-periods', accountId],
    queryFn: async () => {
      const { data } = await api.get<{ periods: string[] }>(`/accounts/${accountId}/statements`);
      return data.periods;
    },
    enabled: !!accountId,
  });

  const [period, setPeriod] = useState('');

  useEffect(() => {
    const p = periods.data ?? [];
    if (p.length && !p.includes(period)) setPeriod(p[0]!);
  }, [period, periods.data]);

  const periodOptions = useMemo(
    () => (periods.data ?? []).map((p) => ({ id: p, label: p })),
    [periods.data],
  );

  const href = accountId && period ? `/api/accounts/${accountId}/statements/${period}/export` : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Statements</h1>
      <div className="max-w-lg rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <AccountSelect
            label="Account"
            aria-label="Account for statement"
            placeholder="Select account"
            options={accountOptions}
            value={accountId}
            onChange={setAccountId}
          />
          <AppSelect
            label="Period (YYYY-MM)"
            aria-label="Statement period"
            placeholder="Select period"
            options={periodOptions}
            value={period}
            onChange={setPeriod}
            emptySelectionLabel="No periods yet"
          />
          <a
            href={href ?? '#'}
            aria-disabled={!href}
            onClick={(e) => {
              if (!href) e.preventDefault();
            }}
            className={`button button--primary inline-flex w-fit items-center justify-center rounded-xl px-4 py-2.5 text-center text-sm font-semibold no-underline ${!href ? 'pointer-events-none opacity-50' : ''}`}
          >
            Download CSV
          </a>
          <p className="text-xs text-neutral-500">Uses same-origin cookie auth for download.</p>
        </div>
      </div>
    </div>
  );
}
