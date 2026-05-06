import { Button, Chip, Input, Label, Modal, useOverlayState } from '@heroui/react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../notifications/ToastProvider';
import { CurrencyTextField } from '../ui/CurrencyTextField';
import { AccountSelect } from '../ui/AccountSelect';

type BillRow = {
  id: string;
  billerName: string;
  fromAccountId: string;
  amountCents: number;
  dueDate: string;
  status: string;
  memo: string | null;
  kind: 'SCHEDULED' | 'INSTANT';
  payFromInvalid: boolean;
  payFromIssue: string | null;
  fromAccountNickname: string;
  fromAccountType?: string;
  fromAccountBalanceCents?: number;
};

type BillTab = 'schedule' | 'paynow';

function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string | string[]; code?: string } } };
  const m = e.response?.data?.message;
  if (Array.isArray(m)) return m[0] ?? fallback;
  if (typeof m === 'string') return m;
  return fallback;
}

export function BillsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<BillTab>('schedule');
  const [billAmount, setBillAmount] = useState('');
  const [payNowAmount, setPayNowAmount] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const editModal = useOverlayState({
    isOpen: editId !== null,
    onOpenChange: (open: boolean) => {
      if (!open) setEditId(null);
    },
  });

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{
        accounts: {
          id: string;
          nickname: string;
          type: string;
          balanceCents: number;
          closedAt?: string | null;
          frozen?: boolean;
          cardLifecycle?: string;
        }[];
      }>('/accounts');
      return data.accounts;
    },
  });

  const payFromAccounts = (accounts.data ?? []).filter((a) => {
    if (a.closedAt) return false;
    if (a.type === 'CHECKING' || a.type === 'SAVINGS') return true;
    return a.type === 'CREDIT' && a.cardLifecycle === 'ACTIVE';
  });
  const payFromSelectOptions = payFromAccounts.map((a) => ({
    id: a.id,
    label: `${a.nickname} (${(a.balanceCents / 100).toFixed(2)}) ${a.frozen ? '· Frozen' : ''}`.trim(),
    disabled: !!a.frozen,
  }));

  const [scheduleFromAccountId, setScheduleFromAccountId] = useState('');
  const [payNowFromAccountId, setPayNowFromAccountId] = useState('');
  const [editFromAccountId, setEditFromAccountId] = useState('');

  useEffect(() => {
    const list = payFromAccounts;
    const resolve = (cur: string) => {
      if (cur && list.some((a) => a.id === cur && !a.frozen)) return cur;
      return list.find((a) => !a.frozen)?.id ?? '';
    };
    setScheduleFromAccountId((c) => resolve(c));
    setPayNowFromAccountId((c) => resolve(c));
  }, [accounts.data]);

  const payees = useQuery({
    queryKey: ['payees'],
    queryFn: async () => {
      const { data } = await api.get<{
        payees: { id: string; displayName: string; nickname: string | null; externalRef: string }[];
      }>('/payees');
      return data.payees;
    },
  });
  const [biller, setBiller] = useState('');
  const [payNowBiller, setPayNowBiller] = useState('');
  const matchedPayee = (payees.data ?? []).find((p) => {
    const t = biller.trim().toLowerCase();
    return t && (p.displayName.toLowerCase() === t || (p.nickname ?? '').toLowerCase() === t);
  });
  const matchedPayeePayNow = (payees.data ?? []).find((p) => {
    const t = payNowBiller.trim().toLowerCase();
    return t && (p.displayName.toLowerCase() === t || (p.nickname ?? '').toLowerCase() === t);
  });

  const bills = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const { data } = await api.get<{ bills: BillRow[] }>('/bill-payments');
      return data.bills;
    },
  });

  const editing = (bills.data ?? []).find((b) => b.id === editId);

  useEffect(() => {
    const row = (bills.data ?? []).find((b) => b.id === editId);
    if (row) setEditFromAccountId(row.fromAccountId);
  }, [editId, bills.data]);

  const create = useMutation({
    mutationFn: async (payload: {
      billerName: string;
      fromAccountId: string;
      amountCents: number;
      dueDate: string;
      memo?: string;
      mode: 'schedule' | 'pay_now';
    }) => api.post('/bill-payments', payload),
    onSuccess: (_, variables) => {
      setBillAmount('');
      setPayNowAmount('');
      toast(variables.mode === 'pay_now' ? 'Payment sent.' : 'Payment scheduled.');
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => toast(apiErrorMessage(e, 'Could not create bill payment.'), 'error'),
  });

  const patchBill = useMutation({
    mutationFn: async (payload: {
      id: string;
      billerName?: string;
      fromAccountId?: string;
      amountCents?: number;
      dueDate?: string;
      memo?: string | null;
    }) => api.patch(`/bill-payments/${payload.id}`, payload),
    onSuccess: () => {
      toast('Scheduled payment updated.');
      setEditId(null);
      qc.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (e) => toast(apiErrorMessage(e, 'Could not update payment.'), 'error'),
  });

  const payNow = useMutation({
    mutationFn: async (id: string) => api.post(`/bill-payments/${id}/pay-now`),
    onSuccess: () => {
      toast('Bill paid.');
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e) => toast(apiErrorMessage(e, 'Payment blocked — fix pay-from account or funds.'), 'error'),
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Bill pay</h1>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="w-full max-w-xl">
          <div role="tablist" aria-label="Bill payment mode" className="relative flex gap-1 border-b border-neutral-200">
            <button
              type="button"
              role="tab"
              id="bill-tab-schedule"
              aria-selected={tab === 'schedule'}
              aria-controls="bill-panel-schedule"
              className={`cursor-pointer border-b-2 pb-3 pr-6 text-base font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                tab === 'schedule' ? 'border-indigo-600 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
              onClick={() => setTab('schedule')}
            >
              Schedule payment
            </button>
            <button
              type="button"
              role="tab"
              id="bill-tab-paynow"
              aria-selected={tab === 'paynow'}
              aria-controls="bill-panel-paynow"
              className={`cursor-pointer border-b-2 pb-3 pr-6 text-base font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                tab === 'paynow' ? 'border-indigo-600 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-800'
              }`}
              onClick={() => setTab('paynow')}
            >
              Pay now
            </button>
          </div>

          {tab === 'schedule' ? (
            <div role="tabpanel" id="bill-panel-schedule" aria-labelledby="bill-tab-schedule" className="pt-6">
            <form
              className="flex max-w-lg flex-col gap-4"
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                create.mutate({
                  billerName: biller,
                  fromAccountId: scheduleFromAccountId,
                  amountCents: Math.round(Number(billAmount) * 100),
                  dueDate: String(fd.get('dueDate') ?? ''),
                  memo: String(fd.get('memo') ?? '') || undefined,
                  mode: 'schedule',
                });
              }}
            >
              <TextLike
                name="billerName"
                label="Biller"
                required
                value={biller}
                onChange={(v) => setBiller(v)}
                listId="payee-options-main"
              />
              <datalist id="payee-options-main">
                {(payees.data ?? []).map((p) => (
                  <option key={`main-${p.id}`} value={p.displayName} />
                ))}
                {(payees.data ?? [])
                  .filter((p) => p.nickname)
                  .map((p) => (
                    <option key={`main-nick-${p.id}`} value={p.nickname ?? ''} />
                  ))}
              </datalist>
              {matchedPayee ? (
                <p className="text-xs text-neutral-600">
                  Matched payee: {matchedPayee.displayName} · {matchedPayee.nickname ?? 'No nickname'} ·{' '}
                  {matchedPayee.externalRef}
                </p>
              ) : null}
              <AccountSelect
                label="Pay from"
                aria-label="Pay from"
                placeholder="Select account"
                options={payFromSelectOptions}
                value={scheduleFromAccountId}
                onChange={setScheduleFromAccountId}
                name="fromAccountId"
              />
              <CurrencyTextField label="Amount" value={billAmount} onChangeValue={setBillAmount} required />
              <div>
                <Label htmlFor="due-date" className="font-medium">
                  Due date
                </Label>
                <Input id="due-date" type="date" name="dueDate" required className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" />
              </div>
              <InputLike name="memo" label="Memo" />
              <Button type="submit" variant="primary">
                Schedule
              </Button>
            </form>
            </div>
          ) : null}

          {tab === 'paynow' ? (
            <div role="tabpanel" id="bill-panel-paynow" aria-labelledby="bill-tab-paynow" className="pt-6">
            <form
              className="flex max-w-lg flex-col gap-4"
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const today = new Date();
                const iso = today.toISOString().slice(0, 10);
                create.mutate({
                  billerName: payNowBiller,
                  fromAccountId: payNowFromAccountId,
                  amountCents: Math.round(Number(payNowAmount) * 100),
                  dueDate: iso,
                  memo: String(fd.get('pn_memo') ?? '') || undefined,
                  mode: 'pay_now',
                });
              }}
            >
              <TextLike
                idSuffix="pay"
                name="pn_billerName"
                label="Biller"
                required
                value={payNowBiller}
                onChange={(v) => setPayNowBiller(v)}
                listId="payee-options-now"
              />
              <datalist id="payee-options-now">
                {(payees.data ?? []).map((p) => (
                  <option key={`now-${p.id}`} value={p.displayName} />
                ))}
                {(payees.data ?? [])
                  .filter((p) => p.nickname)
                  .map((p) => (
                    <option key={`now-nick-${p.id}`} value={p.nickname ?? ''} />
                  ))}
              </datalist>
              {matchedPayeePayNow ? (
                <p className="text-xs text-neutral-600">
                  Matched payee: {matchedPayeePayNow.displayName} · {matchedPayeePayNow.nickname ?? 'No nickname'} ·{' '}
                  {matchedPayeePayNow.externalRef}
                </p>
              ) : null}
              <AccountSelect
                label="Pay from"
                aria-label="Pay from"
                placeholder="Select account"
                options={payFromSelectOptions}
                value={payNowFromAccountId}
                onChange={setPayNowFromAccountId}
                name="pn_fromAccountId"
              />
              <CurrencyTextField label="Amount" value={payNowAmount} onChangeValue={setPayNowAmount} required />
              <InputLike idSuffix="pay" name="pn_memo" label="Memo" />
              <Button type="submit" variant="primary">
                Pay now
              </Button>
            </form>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-2 shadow-sm sm:p-4">
        <h2 className="mb-3 px-1 text-base font-bold text-neutral-900">Payments</h2>
        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-2 py-2 text-left font-semibold text-neutral-700">Biller</th>
                <th className="px-2 py-2 text-left font-semibold text-neutral-700">Due</th>
                <th className="px-2 py-2 text-left font-semibold text-neutral-700">Pay from</th>
                <th className="px-2 py-2 text-left font-semibold text-neutral-700">Memo</th>
                <th className="px-2 py-2 text-right font-semibold text-neutral-700">Amount</th>
                <th className="px-2 py-2 text-left font-semibold text-neutral-700">Type</th>
                <th className="px-2 py-2 text-left font-semibold text-neutral-700">Status</th>
                <th className="px-2 py-2 text-left font-semibold text-neutral-700">Source</th>
                <th className="px-2 py-2 text-right font-semibold text-neutral-700" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(bills.data ?? []).map((b) => (
                <tr
                  key={b.id}
                  className={
                    b.payFromInvalid && b.status === 'SCHEDULED' ? 'bg-red-50/90' : undefined
                  }
                >
                  <td className="px-2 py-2 font-medium text-neutral-900">{b.billerName}</td>
                  <td className="px-2 py-2 text-neutral-800">{new Date(b.dueDate).toLocaleDateString()}</td>
                  <td className="px-2 py-2 text-neutral-800">{b.fromAccountNickname}</td>
                  <td className="max-w-[160px] truncate px-2 py-2 text-neutral-700">{b.memo ?? '—'}</td>
                  <td className="px-2 py-2 text-right font-variant-numeric tabular-nums text-neutral-800">
                    {(b.amountCents / 100).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-neutral-800">{b.kind === 'INSTANT' ? 'Instant' : 'Scheduled'}</td>
                  <td className="px-2 py-2 text-neutral-800">{b.status}</td>
                  <td className="px-2 py-2">
                    {b.payFromInvalid && b.status === 'SCHEDULED' ? (
                      <Chip color="danger" variant="soft" size="sm">
                        <Chip.Label>Update required</Chip.Label>
                      </Chip>
                    ) : (
                      <Chip variant="secondary" color="accent" size="sm">
                        <Chip.Label>OK</Chip.Label>
                      </Chip>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {b.status === 'SCHEDULED' ? (
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" onPress={() => setEditId(b.id)}>
                          Edit
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          isDisabled={payNow.isPending || b.payFromInvalid}
                          onPress={() => payNow.mutate(b.id)}
                        >
                          Pay now
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal state={editModal}>
        <Modal.Backdrop>
          <Modal.Container size="md" scroll="inside">
            <Modal.Dialog>
              {({ close }) => (
                <>
                  <Modal.CloseTrigger aria-label="Close dialog" />
                  <Modal.Header>
                    <Modal.Heading>Edit scheduled payment</Modal.Heading>
                  </Modal.Header>
                  {editing ? (
                    <form
                      id="edit-bill-form"
                      key={editing.id}
                      onSubmit={(e: FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const memoRaw = String(fd.get('memo') ?? '').trim();
                        patchBill.mutate({
                          id: editing.id,
                          billerName: String(fd.get('billerName') ?? ''),
                          fromAccountId: editFromAccountId,
                          amountCents: Math.round(Number(fd.get('amount') ?? 0) * 100),
                          dueDate: String(fd.get('dueDate') ?? ''),
                          memo: memoRaw.length ? memoRaw : '',
                        });
                      }}
                    >
                      <Modal.Body className="flex flex-col gap-4">
                        <div>
                          <Label htmlFor="edit-biller" className="font-medium">
                            Biller
                          </Label>
                          <Input
                            id="edit-biller"
                            name="billerName"
                            required
                            defaultValue={editing.billerName}
                            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          />
                        </div>
                        <AccountSelect
                          label="Pay from"
                          aria-label="Pay from"
                          placeholder="Select account"
                          options={payFromSelectOptions}
                          value={editFromAccountId}
                          onChange={setEditFromAccountId}
                          name="fromAccountId"
                        />
                        <div>
                          <Label htmlFor="edit-amt" className="font-medium">
                            Amount
                          </Label>
                          <Input
                            id="edit-amt"
                            name="amount"
                            type="number"
                            required
                            min={0}
                            step={0.01}
                            defaultValue={(editing.amountCents / 100).toFixed(2)}
                            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 font-variant-numeric tabular-nums text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-due" className="font-medium">
                            Due date
                          </Label>
                          <Input
                            id="edit-due"
                            name="dueDate"
                            type="date"
                            required
                            defaultValue={editing.dueDate.slice(0, 10)}
                            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-memo" className="font-medium">
                            Memo
                          </Label>
                          <Input
                            id="edit-memo"
                            name="memo"
                            defaultValue={editing.memo ?? ''}
                            className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          />
                        </div>
                      </Modal.Body>
                      <Modal.Footer className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          type="button"
                          onPress={() => {
                            close();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" variant="primary" isDisabled={patchBill.isPending}>
                          Save
                        </Button>
                      </Modal.Footer>
                    </form>
                  ) : null}
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function TextLike(props: {
  idSuffix?: string;
  name: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  listId?: string;
}) {
  const { idSuffix = '', name, label, required, value, onChange, listId } = props;
  const id = `fld-${name}${idSuffix}`;
  return (
    <div>
      <Label htmlFor={id} className="font-medium">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        list={listId}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      />
    </div>
  );
}

function InputLike(props: { idSuffix?: string; name: string; label: string }) {
  const { idSuffix = '', name, label } = props;
  const id = `fld-${name}${idSuffix}`;
  return (
    <div>
      <Label htmlFor={id} className="font-medium">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      />
    </div>
  );
}
