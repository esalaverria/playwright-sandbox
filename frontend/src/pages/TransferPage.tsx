import { Button, Input, Label, Tabs, TextField } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { useToast } from '../notifications/ToastProvider';
import { CurrencyTextField } from '../ui/CurrencyTextField';

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

type TabKey = 'internal' | 'peer';

export function TransferPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { formatMoney } = usePrivacy();
  const [kind, setKind] = useState<TabKey>('internal');
  const [intAmount, setIntAmount] = useState('');
  const [peerAmount, setPeerAmount] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: Account[] }>('/accounts');
      return data.accounts;
    },
  });

  const fromAccounts = (accounts ?? []).filter(
    (a) =>
      (a.type === 'CHECKING' || a.type === 'SAVINGS') &&
      !a.closedAt,
  );
  const internalToAccounts = (accounts ?? []).filter(
    (a) =>
      (a.type === 'CHECKING' || a.type === 'SAVINGS') &&
      !a.closedAt &&
      !a.frozen,
  );

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

  const inputSelect =
    'bg-field text-field mt-2 w-full cursor-pointer rounded-xl border px-4 py-2.5 outline-none transition-[border,color,background] focus-visible:border-accent focus-visible:ring-[2px] focus-visible:ring-focus';

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Transfer</h1>

      <p className="text-muted text-sm leading-relaxed">
        Transfers can only come from checking or savings. Credit cards are for payments (Pay card, Bill pay), not
        moving money to yourself or others.
      </p>

      <Tabs.Root
        selectedKey={kind}
        onSelectionChange={(k) => setKind(k as TabKey)}
        aria-label="Transfer type"
        className="w-full max-w-xl"
      >
        <Tabs.ListContainer className="border-b border-neutral-300">
          <Tabs.List className="relative flex gap-1">
            <Tabs.Tab id="internal" className="cursor-pointer pb-3 pr-6 text-base font-semibold">
              Between my accounts
            </Tabs.Tab>
            <Tabs.Tab id="peer" className="cursor-pointer pb-3 pr-6 text-base font-semibold">
              Send to someone
            </Tabs.Tab>
            <Tabs.Indicator className="bg-primary h-1 rounded-full data-[selected]:bg-indigo-700" />
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="internal" className="pt-8 outline-none [&:focus-visible]:ring-2 [&:focus-visible]:ring-transparent">
          <form
            data-transfer-kind="internal"
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const amt = Number(intAmount);
              internal.mutate({
                fromAccountId: String(fd.get('from')),
                toAccountId: String(fd.get('to')),
                amountCents: Math.round(amt * 100),
                memo: String(fd.get('memo') ?? '') || undefined,
              });
            }}
          >
            <div>
              <Label htmlFor="int-from">From</Label>
              <select id="int-from" name="from" required aria-label="From" className={inputSelect} defaultValue="">
                <option value="" disabled>
                  Select account
                </option>
                {fromAccounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={!!a.frozen}>
                    {a.nickname} ({formatMoney(a.balanceCents)}) {a.frozen ? '· Frozen' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="int-to">To</Label>
              <select id="int-to" name="to" required aria-label="To" className={inputSelect} defaultValue="">
                <option value="" disabled>
                  Select account
                </option>
                {internalToAccounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={!!a.frozen}>
                    {a.nickname} ({formatMoney(a.balanceCents)}) {a.frozen ? '· Frozen' : ''}
                  </option>
                ))}
              </select>
            </div>
            <CurrencyTextField label="Amount (USD)" value={intAmount} onChangeValue={setIntAmount} required />
            <TextField name="memo">
              <Label className="mb-2">Memo</Label>
              <Input />
            </TextField>
            <Button type="submit" variant="primary" fullWidth size="lg" isDisabled={internal.isPending}>
              Submit internal transfer
            </Button>
          </form>
        </Tabs.Panel>

        <Tabs.Panel id="peer" className="pt-8 outline-none [&:focus-visible]:ring-2 [&:focus-visible]:ring-transparent">
          <form
            data-transfer-kind="peer"
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const amt = Number(peerAmount);
              peer.mutate({
                fromAccountId: String(fd.get('from')),
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
                className="mt-2 w-full rounded-xl border px-4 py-2.5 outline-none"
              />
            </div>
            <div>
              <Label htmlFor="peer-from">From your account</Label>
              <select id="peer-from" name="from" required aria-label="From your account" className={inputSelect} defaultValue="">
                <option value="" disabled>
                  Select account
                </option>
                {fromAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname} ({formatMoney(a.balanceCents)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="peer-to">To their account</Label>
              <select
                id="peer-to"
                aria-label="To their account"
                value={peerTo}
                required
                onChange={(e) => setPeerTo(e.target.value)}
                className={inputSelect}
              >
                {peerAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname} {a.mask} · {a.type} · {formatMoney(a.balanceCents)}
                  </option>
                ))}
              </select>
            </div>
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
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}
