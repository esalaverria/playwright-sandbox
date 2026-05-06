import { Button, Input, Label, Skeleton } from '@heroui/react';
import type { ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, delay, formatUsd } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { UtcIsoDatePicker } from '../ui/UtcIsoDatePicker';

export function AccountPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { formatMoney } = usePrivacy();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const acc = useQuery({
    queryKey: ['account-meta', id],
    queryFn: async () => {
      await delay(300 + Math.floor(Math.random() * 250));
      const { data } = await api.get<{
        accounts: {
          id: string;
          nickname: string;
          mask: string;
          type: string;
          balanceCents: number;
        }[];
      }>('/accounts');
      return data.accounts.find((a) => a.id === id);
    },
    enabled: !!id,
  });

  const filterKey = useMemo(() => ({ q, from, to }), [q, from, to]);

  const txs = useQuery({
    queryKey: ['tx', id, page, pageSize, filterKey],
    queryFn: async () => {
      await delay(400 + Math.floor(Math.random() * 350));
      const { data } = await api.get<{
        items: {
          id: string;
          occurredAt: string;
          description: string;
          amountCents: number;
          balanceAfterCents: number;
        }[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/accounts/${id}/transactions`, {
        params: {
          page,
          pageSize,
          ...(q.trim() ? { q: q.trim() } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      });
      return data;
    },
    enabled: !!id,
  });

  const total = txs.data?.total ?? 0;
  const totalPages = txs.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  const loading = txs.isFetching || acc.isFetching;
  const ready = !loading && txs.data !== undefined && acc.data !== undefined;

  const searchClass =
    'w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-neutral-900 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-indigo-500';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
            {acc.data?.nickname ?? (acc.isFetching ? <Skeleton className="inline-block h-9 w-44 rounded-md" /> : 'Account')}
          </h1>
          <p className="text-sm font-medium text-neutral-600">{acc.data?.mask}</p>
          {acc.data ? (
            <p className="mt-2 text-base font-semibold text-neutral-800">
              Balance: {formatMoney(acc.data.balanceCents)}
            </p>
          ) : null}
        </div>
        {acc.data ? (
          <div className="shrink-0 pt-1">
            <Button variant="outline" size="md" onPress={() => navigate('/transfer')}>
              Make a transfer
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-12">
          <div className="sm:col-span-12 lg:col-span-5">
            <Label htmlFor="q-desc" className="mb-2 block font-medium text-neutral-800">
              Search description
            </Label>
            <Input
              id="q-desc"
              value={qDraft}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQDraft(e.target.value)}
              placeholder="Describe a transaction…"
              className={searchClass}
            />
          </div>
          <div className="sm:col-span-6 lg:col-span-3">
            <UtcIsoDatePicker
              label="From (UTC date)"
              aria-label="From UTC date filter"
              valueIso={from}
              onChangeIso={(iso) => {
                setFrom(iso);
                setPage(1);
              }}
            />
          </div>
          <div className="sm:col-span-6 lg:col-span-4">
            <UtcIsoDatePicker
              label="To (UTC date)"
              aria-label="To UTC date filter"
              valueIso={to}
              onChangeIso={(iso) => {
                setTo(iso);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 sm:col-span-12 lg:flex-nowrap lg:justify-end xl:col-span-12">
            <Button variant="primary" size="md" onPress={() => { setQ(qDraft); setPage(1); }}>
              Apply filters
            </Button>
            <Button
              variant="ghost"
              size="md"
              onPress={() => {
                setQ('');
                setQDraft('');
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table
            data-testid={ready ? 'transactions-ready' : undefined}
            aria-busy={loading}
            className="w-full min-w-[640px] text-sm"
          >
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-3 py-3 text-left font-semibold text-neutral-700">When</th>
                <th className="px-3 py-3 text-left font-semibold text-neutral-700">Description</th>
                <th className="px-3 py-3 text-right font-semibold text-neutral-700">Amount</th>
                <th className="px-3 py-3 text-right font-semibold text-neutral-700">Balance after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4} className="px-3 py-2">
                        <Skeleton className="h-9 w-full rounded-lg" />
                      </td>
                    </tr>
                  ))
                : (txs.data?.items ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-neutral-800">
                        {new Date(r.occurredAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-800">{r.description}</td>
                      <td className="font-variant-numeric px-3 py-2.5 text-right tabular-nums text-neutral-800">
                        {formatUsd(r.amountCents)}
                      </td>
                      <td className="font-variant-numeric px-3 py-2.5 text-right tabular-nums text-neutral-800">
                        {formatMoney(r.balanceAfterCents)}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-3 py-3">
          <span className="text-sm text-neutral-600">
            {total} transaction{total === 1 ? '' : 's'} · page {page} / {totalPages}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="page-size" className="text-sm font-medium text-neutral-700">
              Rows
            </label>
            <select
              id="page-size"
              aria-label="Rows per page"
              className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm"
              value={pageSize}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" isDisabled={page <= 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              isDisabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
