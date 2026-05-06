import { Button, Input, Label, TextField } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { useToast } from '../notifications/ToastProvider';
import { CurrencyTextField } from '../ui/CurrencyTextField';
import { AccountSelect } from '../ui/AccountSelect';

type TransferTabKey = 'internal' | 'peer';

type Account = {
  id: string;
  nickname: string;
  mask: string;
  type: string;
  balanceCents: number;
  closedAt?: string | null;
  frozen?: boolean;
  cardLifecycle?: string;
};

function firstUsableDepositId(rows: Pick<Account, 'id' | 'frozen'>[]): string {
  const u = rows.find((a) => !a.frozen);
  return u?.id ?? rows[0]?.id ?? '';
}

export function TransferPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { formatMoney } = usePrivacy();
  const [tab, setTab] = useState<TransferTabKey>('internal');
  const [intAmount, setIntAmount] = useState('');
  const [peerAmount, setPeerAmount] = useState('');
  const [intFrom, setIntFrom] = useState('');
  const [intTo, setIntTo] = useState('');
  const [peerFrom, setPeerFrom] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: Account[] }>('/accounts');
      return data.accounts;
    },
  });

  const fromAccounts = (accounts ?? []).filter(
    (a) => (a.type === 'CHECKING' || a.type === 'SAVINGS') && !a.closedAt,
  );
  const internalToAccounts = (accounts ?? []).filter(
    (a) =>
      (a.type === 'CHECKING' || a.type === 'SAVINGS') && !a.closedAt && !a.frozen,
  );

  useEffect(() => {
    const list = (accounts ?? []).filter(
      (a) => (a.type === 'CHECKING' || a.type === 'SAVINGS') && !a.closedAt,
    );
    if (!list.length) return;
    setIntFrom((cur) => (cur && list.some((a) => a.id === cur) ? cur : firstUsableDepositId(list)));
    setPeerFrom((cur) => (cur && list.some((a) => a.id === cur) ? cur : firstUsableDepositId(list)));
  }, [accounts]);

  useEffect(() => {
    const list = (accounts ?? []).filter(
      (a) =>
        (a.type === 'CHECKING' || a.type === 'SAVINGS') && !a.closedAt && !a.frozen,
    );
    if (!list.length) return;
    setIntTo((cur) => (cur && list.some((a) => a.id === cur) ? cur : list[0]!.id));
  }, [accounts]);

  const internal = useMutation({
    mutationFn: async (payload: {
      fromAccountId: string;
      toAccountId: string;
      amountCents: number;
      memo?: string;
    }) => api.post('/transfers/internal', payload),
    onSuccess: async () => {
      toast('Transfer posted!');
      setIntAmount('');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['tx'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-month'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Transfer failed.', 'error'),
  });

  const peer = useMutation({
    mutationFn: async (payload: {
      fromAccountId: string;
      recipientEmail: string;
      toAccountId: string;
      amountCents: number;
      memo?: string;
    }) => api.post('/transfers/peer', payload),
    onSuccess: async () => {
      toast('Sent.');
      setPeerAmount('');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['tx'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-month'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Peer transfer failed.', 'error'),
  });

  const [peerEmail, setPeerEmail] = useState('bob@example.com');
  const preview = useQuery({
    queryKey: ['preview', peerEmail],
    queryFn: async () => {
      const { data } = await api.get<{
        userExists: boolean;
        accounts: { id: string; mask: string; type: string; nickname: string; balanceCents: number }[];
      }>('/recipients/preview', { params: { email: peerEmail } });
      return data;
    },
    enabled: peerEmail.includes('@'),
  });

  const peerAccounts = preview.data?.accounts ?? [];
  const [peerTo, setPeerTo] = useState('');

  useEffect(() => {
    if (!peerAccounts.length) return;
    setPeerTo((cur) => (peerAccounts.some((a) => a.id === cur) ? cur : peerAccounts[0]!.id));
  }, [peerAccounts]);

  const fromOptions = fromAccounts.map((a) => ({
    id: a.id,
    label: `${a.nickname} (${formatMoney(a.balanceCents)})${a.frozen ? ' · Frozen' : ''}`,
    disabled: !!a.frozen,
  }));
  const internalToOptions = internalToAccounts.map((a) => ({
    id: a.id,
    label: `${a.nickname} (${formatMoney(a.balanceCents)})${a.frozen ? ' · Frozen' : ''}`,
    disabled: !!a.frozen,
  }));
  const peerToOptions = peerAccounts.map((a) => ({
    id: a.id,
    label: `${a.nickname} ${a.mask} · ${a.type} · ${formatMoney(a.balanceCents)}`,
  }));

  const inputClass = 'mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Transfer</h1>

      <p className="text-muted text-sm leading-relaxed">
        Transfers can only come from checking or savings. Credit cards are for payments (Pay card, Bill pay), not
        moving money to yourself or others.
      </p>

      <div className="w-full max-w-xl">
        <div role="tablist" aria-label="Transfer type" className="relative flex gap-1 border-b border-neutral-300">
          <button
            type="button"
            role="tab"
            id="transfer-tab-internal"
            aria-selected={tab === 'internal'}
            aria-controls="transfer-panel-internal"
            className={`cursor-pointer border-b-2 pb-3 pr-6 text-base font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              tab === 'internal' ? 'border-indigo-700 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
            onClick={() => setTab('internal')}
          >
            Between my accounts
          </button>
          <button
            type="button"
            role="tab"
            id="transfer-tab-peer"
            aria-selected={tab === 'peer'}
            aria-controls="transfer-panel-peer"
            className={`cursor-pointer border-b-2 pb-3 pr-6 text-base font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              tab === 'peer' ? 'border-indigo-700 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
            onClick={() => setTab('peer')}
          >
            Send to someone
          </button>
        </div>

        {tab === 'internal' ? (
          <div
            role="tabpanel"
            id="transfer-panel-internal"
            aria-labelledby="transfer-tab-internal"
            className="pt-8 outline-none [&:focus-visible]:ring-2 [&:focus-visible]:ring-transparent"
          >
          <form
            data-transfer-kind="internal"
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!intFrom || !intTo) return;
              const fd = new FormData(e.currentTarget);
              const amt = Number(intAmount);
              internal.mutate({
                fromAccountId: intFrom,
                toAccountId: intTo,
                amountCents: Math.round(amt * 100),
                memo: String(fd.get('memo') ?? '') || undefined,
              });
            }}
          >
            <AccountSelect
              label="From"
              aria-label="From"
              placeholder="Select account"
              options={fromOptions}
              value={intFrom}
              onChange={setIntFrom}
              name="from"
            />
            <AccountSelect
              label="To"
              aria-label="To"
              placeholder="Select account"
              options={internalToOptions}
              value={intTo}
              onChange={setIntTo}
              name="to"
            />
            <CurrencyTextField label="Amount (USD)" value={intAmount} onChangeValue={setIntAmount} required />
            <TextField name="memo">
              <Label className="mb-2">Memo</Label>
              <Input />
            </TextField>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              isDisabled={internal.isPending || !intFrom || !intTo}
            >
              Submit internal transfer
            </Button>
          </form>
          </div>
        ) : null}

        {tab === 'peer' ? (
          <div
            role="tabpanel"
            id="transfer-panel-peer"
            aria-labelledby="transfer-tab-peer"
            className="pt-8 outline-none [&:focus-visible]:ring-2 [&:focus-visible]:ring-transparent"
          >
          <form
            data-transfer-kind="peer"
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!peerFrom || !peerTo) return;
              const fd = new FormData(e.currentTarget);
              const amt = Number(peerAmount);
              peer.mutate({
                fromAccountId: peerFrom,
                recipientEmail: peerEmail.trim(),
                toAccountId: peerTo,
                amountCents: Math.round(amt * 100),
                memo: String(fd.get('memo') ?? '') || undefined,
              });
            }}
          >
            <div>
              <Label htmlFor="peer-email">Recipient email</Label>
              <Input
                id="peer-email"
                value={peerEmail}
                onChange={(e) => setPeerEmail(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <AccountSelect
              label="From your account"
              aria-label="From your account"
              placeholder="Select account"
              options={fromAccounts.map((a) => ({
                id: a.id,
                label: `${a.nickname} (${formatMoney(a.balanceCents)})`,
              }))}
              value={peerFrom}
              onChange={setPeerFrom}
              name="from"
            />
            <AccountSelect
              label="To their account"
              aria-label="To their account"
              placeholder="Select account"
              options={peerToOptions}
              value={peerTo}
              onChange={setPeerTo}
            />
            {!preview.data?.userExists ? (
              <p className="text-muted text-xs leading-relaxed">Enter an email that belongs to another NorthPeak user.</p>
            ) : null}
            <CurrencyTextField label="Amount (USD)" value={peerAmount} onChangeValue={setPeerAmount} required />
            <TextField name="memo">
              <Label className="mb-2">Memo</Label>
              <Input />
            </TextField>
            <Button type="submit" variant="primary" fullWidth size="lg" isDisabled={peer.isPending || !peerTo}>
              Send money
            </Button>
          </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
