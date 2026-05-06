import { Chip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { api, delay } from '../api/client';

const LABELS: Record<string, string> = {
  ACCOUNT_CREATED: 'Opened an account',
  ACCOUNT_CLOSED: 'Closed an account',
  CARD_REQUESTED: 'Requested a new card',
  CARD_CANCELLED: 'Cancelled a card',
  CARD_LOST_REPORTED: 'Reported card lost',
  CARD_LOST_REPLACED: 'Replaced lost card',
  CARD_FROZEN: 'Froze card',
  CARD_UNFROZEN: 'Unfroze card',
  OVERLIMIT_TOGGLED: 'Updated over-limit setting',
  CARD_DETAILS_VIEWED: 'Viewed full card details',
};

function humanMeta(meta: Record<string, unknown> | null): string {
  if (!meta || Object.keys(meta).length === 0) return '—';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    const label =
      k === 'accountId'
        ? 'Account'
        : k === 'newAccountId'
          ? 'New card'
          : k === 'lostAccountId'
            ? 'Previous card'
            : k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    parts.push(`${label}: ${String(v)}`);
  }
  return parts.join(' · ');
}

export function ActivityPage() {
  const { data, isFetching } = useQuery({
    queryKey: ['activity-log'],
    queryFn: async () => {
      await delay(280 + Math.floor(Math.random() * 220));
      const { data } = await api.get<{
        activities: { id: string; action: string; meta: Record<string, unknown> | null; createdAt: string }[];
      }>('/accounts/activity-log');
      return data.activities;
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Account activity</h1>
        <p className="mt-2 text-sm font-medium text-neutral-600">
          Security and banking actions on your profile (not transaction ledger).
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table
            data-testid={!isFetching && data !== undefined ? 'activity-ready' : undefined}
            className="w-full min-w-[560px] text-sm"
          >
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="rounded-tl-lg px-3 py-3 text-left font-semibold text-neutral-700">When</th>
                <th className="px-3 py-3 text-left font-semibold text-neutral-700">Action</th>
                <th className="rounded-tr-lg px-3 py-3 text-left font-semibold text-neutral-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(data ?? []).map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50/90">
                  <td className="align-top whitespace-nowrap px-3 py-3 text-neutral-800">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="align-top px-3 py-3">
                    <Chip variant="secondary" color="accent" size="sm">
                      {LABELS[row.action] ?? row.action}
                    </Chip>
                  </td>
                  <td className="align-top px-3 py-3 text-[13px] font-medium leading-relaxed text-neutral-600 md:max-w-xl">
                    {humanMeta(row.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
