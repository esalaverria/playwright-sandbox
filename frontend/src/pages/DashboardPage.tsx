import { Card } from '@heroui/react';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link as RouterLink } from 'react-router-dom';
import { api, formatUsd } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';

type Account = {
  id: string;
  type: string;
  nickname: string;
  mask: string;
  balanceCents: number;
  closedAt?: string | null;
  cardLifecycle?: string;
};

export function DashboardPage() {
  const { formatMoney } = usePrivacy();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const { data } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: Account[] }>('/accounts');
      return data.accounts;
    },
  });

  const activity = useQuery({
    queryKey: ['dashboard-month', year, month],
    queryFn: async () => {
      const { data } = await api.get<{
        year: number;
        month: number;
        points: { date: string; netCents: number; count: number }[];
      }>('/dashboard/month-activity', { params: { year, month } });
      return data;
    },
  });

  const chartRows =
    activity.data?.points.map((p) => ({
      ...p,
      dayNum: Number(p.date.slice(8, 10)),
      netUsd: p.netCents / 100,
    })) ?? [];

  const activeAccounts = useMemo(
    () =>
      (data ?? []).filter(
        (a) => !a.closedAt && (a.type !== 'CREDIT' || a.cardLifecycle === 'ACTIVE'),
      ),
    [data],
  );

  const netWorthCents = useMemo(
    () => activeAccounts.reduce((sum, a) => sum + a.balanceCents, 0),
    [activeAccounts],
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Accounts</h1>
        <p className="mt-1 text-sm font-medium text-neutral-600">
          Balances update after transfers and bill activity.
        </p>
        <div className="mt-4 rounded-2xl border border-indigo-200/80 bg-white/90 px-5 py-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Total net worth</p>
          <p className="mt-1 tabular-nums text-3xl font-extrabold tracking-tight text-neutral-900">
            {formatMoney(netWorthCents)}
          </p>
          <p className="mt-1 text-xs font-medium text-neutral-500">
            Open checking/savings and active cards only (credit balances owed reduce this total).
          </p>
        </div>
      </div>

      <Card.Root className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-neutral-900">This month&apos;s transaction activity (UTC)</h2>
        <p className="mb-6 mt-2 text-xs text-neutral-600">
          Net cash flow per day across all your accounts ({year}-{String(month).padStart(2, '0')}).
        </p>
        {chartRows.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartRows}>
              <CartesianGrid strokeDasharray="4 8" opacity={0.35} vertical={false} />
              <XAxis dataKey="dayNum" tickLine={false} label={{ value: 'Day', position: 'insideBottom', offset: -4 }} />
              <YAxis tickLine={false} label={{ value: 'Net (USD)', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                formatter={(v) => formatUsd(Math.round(Number(v) * 100))}
                labelFormatter={(_, pts) =>
                  pts.length ? `Day ${(pts[0] as unknown as { payload?: { date?: string } }).payload?.date}` : ''
                }
              />
              <Line type="monotone" dataKey="netUsd" stroke="#6366f1" strokeWidth={3} dot={false} fill="#6366f133" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm font-medium text-neutral-600">No activity data yet.</p>
        )}
      </Card.Root>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {activeAccounts.map((a) => (
          <Card.Root key={a.id} className="rounded-2xl border border-neutral-200/80 shadow-sm transition-shadow hover:shadow-md">
            <RouterLink className="block p-6" to={`/accounts/${a.id}`}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                {a.type} · {a.mask}
              </p>
              <h3 className="text-xl font-semibold text-neutral-900">{a.nickname}</h3>
              <p className="mt-4 tabular-nums text-2xl font-extrabold tracking-tight text-neutral-900">
                {formatMoney(a.balanceCents)}
              </p>
              <p className="text-primary mt-4 text-sm font-semibold text-indigo-600">View activity →</p>
            </RouterLink>
          </Card.Root>
        ))}
      </div>
    </div>
  );
}
