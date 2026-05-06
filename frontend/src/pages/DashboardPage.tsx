import { Card } from '@heroui/react';
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

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-foreground text-3xl font-extrabold tracking-tight">Accounts</h1>
        <p className="text-muted mt-1 text-sm font-medium">
          Balances update after transfers and bill activity.
        </p>
      </div>

      <Card.Root className="rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold">This month&apos;s transaction activity (UTC)</h2>
        <p className="text-muted mb-6 mt-2 text-xs">
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
          <p className="text-muted text-sm font-medium">No activity data yet.</p>
        )}
      </Card.Root>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? [])
          .filter(
            (a) =>
              !a.closedAt &&
              (a.type !== 'CREDIT' || a.cardLifecycle === 'ACTIVE'),
          )
          .map((a) => (
          <Card.Root key={a.id} className="rounded-2xl border border-neutral-200/80 shadow-sm transition-shadow hover:shadow-md">
            <RouterLink className="block p-6" to={`/accounts/${a.id}`}>
              <p className="text-muted mb-3 text-[10px] font-bold uppercase tracking-[0.12em]">
                {a.type} · {a.mask}
              </p>
              <h3 className="text-xl font-semibold">{a.nickname}</h3>
              <p className="tabular-nums mt-4 text-2xl font-extrabold tracking-tight">{formatMoney(a.balanceCents)}</p>
              <p className="text-primary mt-4 text-sm font-semibold text-indigo-600">View activity →</p>
            </RouterLink>
          </Card.Root>
          ))}
      </div>
    </div>
  );
}
