import { Label } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { type ChangeEvent, useEffect, useState } from 'react';
import { api } from '../api/client';

const selectClass =
  'bg-field text-field mt-2 w-full max-w-md cursor-pointer rounded-xl border px-4 py-2.5 outline-none transition-[border,color,background] focus-visible:border-accent focus-visible:ring-[2px] focus-visible:ring-focus';

export function StatementsPage() {
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: { id: string; nickname: string }[] }>('/accounts');
      return data.accounts;
    },
  });

  const [accountId, setAccountId] = useState<string>('');

  useEffect(() => {
    if (!accountId && accounts.data?.length) setAccountId(accounts.data[0]!.id);
  }, [accounts.data, accountId]);

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

  const href = accountId && period ? `/api/accounts/${accountId}/statements/${period}/export` : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Statements</h1>
      <div className="max-w-lg rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="stmt-account" className="font-medium text-neutral-800">
              Account
            </Label>
            <select
              id="stmt-account"
              className={selectClass}
              value={accountId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setAccountId(e.target.value)}
              aria-label="Account"
            >
              {(accounts.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nickname}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="stmt-period" className="font-medium text-neutral-800">
              Period (YYYY-MM)
            </Label>
            <select
              id="stmt-period"
              className={selectClass}
              value={period}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setPeriod(e.target.value)}
              aria-label="Period (YYYY-MM)"
            >
              {(periods.data ?? []).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
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
