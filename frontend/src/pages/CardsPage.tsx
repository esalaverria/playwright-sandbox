import { Button, Chip, Input, Label, Modal, ProgressBar, Switch, useOverlayState } from '@heroui/react';
import { AlertTriangle, CreditCard, Plus } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../notifications/ToastProvider';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { CurrencyTextField } from '../ui/CurrencyTextField';

type CreditAccount = {
  id: string;
  type: string;
  nickname: string;
  mask: string;
  balanceCents: number;
  frozen: boolean;
  creditLimitCents: number | null;
  allowOverLimit: boolean;
  cardBrand: string | null;
  cardLifecycle: string;
  expMonth: number | null;
  expYear: number | null;
  nameOnCard: string | null;
};

type CardSensitive = {
  panFull: string | null;
  cvv: string | null;
  expMonth: number | null;
  expYear: number | null;
  nameOnCard: string | null;
  brand: string | null;
};

function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const m = e.response?.data?.message;
  if (Array.isArray(m)) return m[0] ?? fallback;
  if (typeof m === 'string') return m;
  return fallback;
}

function formatExp(m?: number | null, y?: number | null): string {
  if (m == null || y == null) return '—';
  return `${String(m).padStart(2, '0')}/${y}`;
}

const paySelect =
  'bg-field text-field mt-2 flex-1 min-w-[200px] cursor-pointer rounded-xl border px-4 py-2.5 outline-none transition-[border,color,background] focus-visible:border-accent focus-visible:ring-[2px] focus-visible:ring-focus';

export function CardsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { formatMoney } = usePrivacy();
  const [openNewCard, setOpenNewCard] = useState(false);
  const [cardNick, setCardNick] = useState('');
  const [cardBrand, setCardBrand] = useState<'VISA' | 'MASTERCARD'>('VISA');

  const newCardModal = useOverlayState({ isOpen: openNewCard, onOpenChange: setOpenNewCard });

  const [lostDialog, setLostDialog] = useState<string | null>(null);
  const lostModal = useOverlayState({
    isOpen: lostDialog !== null,
    onOpenChange: (open: boolean) => {
      if (!open) setLostDialog(null);
    },
  });

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: CreditAccount[] }>('/accounts');
      return data.accounts;
    },
  });

  const creditCards = (accounts.data ?? []).filter((a) => a.type === 'CREDIT');
  const fundingAccounts = (accounts.data ?? []).filter((a) => a.type === 'CHECKING' || a.type === 'SAVINGS');

  const requestCard = useMutation({
    mutationFn: async () =>
      api.post('/accounts/credit-cards', {
        nickname: cardNick.trim() || undefined,
        brand: cardBrand,
      }),
    onSuccess: async () => {
      toast('New card added to your wallet.');
      setOpenNewCard(false);
      setCardNick('');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: (e) => toast(apiErrorMessage(e, 'Could not add card.'), 'error'),
  });

  const toggleFreeze = useMutation({
    mutationFn: async (payload: { id: string; frozen: boolean }) =>
      api.patch(`/accounts/${payload.id}/freeze`, { frozen: payload.frozen }),
    onSuccess: async (_, v) => {
      toast(v.frozen ? 'Card frozen.' : 'Card unfrozen.');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Could not update card.', 'error'),
  });

  const toggleOverLimit = useMutation({
    mutationFn: async (payload: { id: string; allowOverLimit: boolean }) =>
      api.patch(`/accounts/${payload.id}/credit-settings`, { allowOverLimit: payload.allowOverLimit }),
    onSuccess: async (_, v) => {
      toast(v.allowOverLimit ? 'Charges over limit are now allowed.' : 'Over-limit charges turned off.');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Could not update settings.', 'error'),
  });

  const payCard = useMutation({
    mutationFn: async (payload: { creditAccountId: string; fromAccountId: string; amountCents: number }) =>
      api.post('/transfers/pay-card', payload),
    onSuccess: async (_, variables) => {
      setPayAmountByCard((m) => ({ ...m, [variables.creditAccountId]: '' }));
      toast('Payment posted to your card.');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['tx'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-month'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Payment failed — check funds or card status.', 'error'),
  });

  const cancelCard = useMutation({
    mutationFn: async (id: string) => api.patch(`/accounts/${id}/card-lifecycle`, { lifecycle: 'CANCELLED' }),
    onSuccess: async () => {
      toast('Card cancelled.');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: (e) => toast(apiErrorMessage(e, 'Could not cancel card.'), 'error'),
  });

  const reportLostReplace = useMutation({
    mutationFn: async (id: string) => api.post(`/accounts/${id}/report-lost-replace`),
    onSuccess: async () => {
      toast('Replacement card issued — balances and history moved.');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
      await qc.invalidateQueries({ queryKey: ['tx'] });
    },
    onError: (e) => toast(apiErrorMessage(e, 'Could not replace card.'), 'error'),
  });

  const [payFromByCard, setPayFromByCard] = useState<Record<string, string>>({});
  const [payAmountByCard, setPayAmountByCard] = useState<Record<string, string>>({});
  const [revealDetails, setRevealDetails] = useState<Record<string, CardSensitive | undefined>>({});

  async function fetchSensitive(id: string) {
    const { data } = await api.get<{ details: CardSensitive }>(`/accounts/${id}/sensitive-card`);
    setRevealDetails((m) => ({ ...m, [id]: data.details }));
    toast('Full card details loaded (demo numbers).', 'info');
    await qc.invalidateQueries({ queryKey: ['activity-log'] });
  }

  function hideSensitive(id: string) {
    setRevealDetails((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Cards</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-neutral-600">
            Pay balances, manage limits, and view demo card numbers safely in this sandbox.
          </p>
        </div>
        <Button variant="primary" className="shrink-0 self-stretch sm:self-center" onPress={() => setOpenNewCard(true)}>
          <Plus aria-hidden className="mr-2 size-5" strokeWidth={2.25} />
          Add new card
        </Button>
      </div>

      {creditCards.map((c) => {
        const limit = c.creditLimitCents;
        const debtCents = Math.max(0, -c.balanceCents);
        const util = limit != null && limit > 0 ? Math.min(100, Math.round((debtCents / limit) * 100)) : 0;
        const payFrom = payFromByCard[c.id] ?? fundingAccounts[0]?.id ?? '';
        const payAmt = payAmountByCard[c.id] ?? '';
        const isActive = c.cardLifecycle === 'ACTIVE';
        const brand = c.cardBrand === 'MASTERCARD' ? 'Mastercard' : 'Visa';
        const sens = revealDetails[c.id];

        return (
          <article
            key={c.id}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div className="flex flex-row gap-4">
                <CreditCard aria-hidden className="size-10 shrink-0 text-indigo-600" strokeWidth={1.75} />
                <div>
                  <h2 className="text-xl font-extrabold text-neutral-900">{c.nickname}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Chip variant="secondary" color="default" size="sm">
                      <Chip.Label>{brand}</Chip.Label>
                    </Chip>
                    <Chip
                      variant={isActive ? 'soft' : 'secondary'}
                      color={isActive ? 'success' : 'default'}
                      size="sm"
                    >
                      <Chip.Label>{c.cardLifecycle.replace(/_/g, ' ')}</Chip.Label>
                    </Chip>
                    <span className="text-xs font-medium text-neutral-500">{c.mask}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm font-semibold text-neutral-600 md:text-right">{c.nameOnCard}</p>
            </div>

            <p className="mt-4 text-sm text-neutral-800">
              Balance owed:{' '}
              <strong className="tabular-nums">{formatMoney(c.balanceCents)}</strong>
            </p>

            {limit != null ? (
              <>
                <p className="mt-2 text-sm text-neutral-700">
                  Limit: {formatMoney(limit)} · Utilization {util}%
                </p>
                <ProgressBar.Root
                  value={util}
                  minValue={0}
                  maxValue={100}
                  aria-label="Credit utilization"
                  className="mt-3"
                >
                  <ProgressBar.Track className="h-2 rounded-full bg-neutral-200">
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar.Root>
              </>
            ) : (
              <p className="mt-4 block text-xs text-neutral-500">No credit limit on file.</p>
            )}

            <p className="mt-4 text-sm text-neutral-600">Expires {formatExp(c.expMonth, c.expYear)}</p>

            <div className="mt-4 flex flex-wrap gap-8">
              <Switch
                isSelected={c.frozen}
                isDisabled={!isActive}
                onChange={(next: boolean) => toggleFreeze.mutate({ id: c.id, frozen: next })}
              >
                <Switch.Content className="flex cursor-pointer items-center gap-3">
                  <Switch.Control className="">
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm font-medium text-neutral-800">Freeze card</span>
                </Switch.Content>
              </Switch>
              <Switch
                isSelected={c.allowOverLimit}
                isDisabled={!isActive}
                onChange={(next: boolean) => toggleOverLimit.mutate({ id: c.id, allowOverLimit: next })}
              >
                <Switch.Content className="flex cursor-pointer items-center gap-3">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-sm font-medium text-neutral-800">Allow over limit</span>
                </Switch.Content>
              </Switch>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                isDisabled={!isActive || cancelCard.isPending}
                onPress={() => cancelCard.mutate(c.id)}
              >
                Cancel card
              </Button>
              <Button
                size="sm"
                variant="danger-soft"
                isDisabled={!isActive || reportLostReplace.isPending}
                onPress={() => setLostDialog(c.id)}
              >
                <AlertTriangle aria-hidden className="mr-1.5 inline size-4" />
                Report lost
              </Button>
              {!sens ? (
                <Button size="sm" variant="ghost" onPress={() => fetchSensitive(c.id)}>
                  Reveal card numbers
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onPress={() => hideSensitive(c.id)}>
                  Hide card numbers
                </Button>
              )}
            </div>

            {sens ? (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Card number</p>
                  <p className="font-mono text-base tracking-wide text-neutral-900">
                    {sens.panFull?.replace(/(\d{4})/g, '$1 ').trim()}
                  </p>
                  <div className="flex flex-wrap gap-8 pt-2">
                    <div>
                      <p className="text-xs font-medium text-neutral-500">CVV</p>
                      <p className="text-base font-bold text-neutral-900">{sens.cvv ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-neutral-500">Exp date</p>
                      <p className="text-base font-bold text-neutral-900">{formatExp(sens.expMonth, sens.expYear)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <h3 className="mb-3 mt-6 text-base font-bold text-neutral-900">Pay from your account</h3>
            <form
              className="max-w-3xl"
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const dollars = Number(payAmt);
                if (!payFrom || !Number.isFinite(dollars) || dollars <= 0) return;
                payCard.mutate({
                  creditAccountId: c.id,
                  fromAccountId: payFrom,
                  amountCents: Math.round(dollars * 100),
                });
              }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[200px] flex-1">
                  <Label htmlFor={`pay-from-${c.id}`}>Pay from</Label>
                  <select
                    id={`pay-from-${c.id}`}
                    required
                    aria-label={`Pay ${c.nickname} from account`}
                    className={paySelect}
                    value={payFrom}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setPayFromByCard((m) => ({ ...m, [c.id]: e.target.value }))
                    }
                  >
                    {fundingAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nickname} ({formatMoney(a.balanceCents)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[160px] flex-1">
                  <CurrencyTextField
                    label="Amount"
                    required
                    value={payAmt}
                    onChangeValue={(v) => setPayAmountByCard((m) => ({ ...m, [c.id]: v }))}
                  />
                </div>
                <Button type="submit" variant="primary" size="lg" className="min-w-[140px]" isDisabled={payCard.isPending || !isActive}>
                  Pay card
                </Button>
              </div>
            </form>
          </article>
        );
      })}

      <Modal state={lostModal}>
        <Modal.Backdrop>
          <Modal.Container size="sm" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Close dialog" />
              <Modal.Header>
                <Modal.Heading>Replace lost card?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-neutral-700">
                  We&apos;ll issue a new card with new numbers, move your balance and transaction history to it, and
                  close the lost card.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" onPress={() => lostModal.close()}>
                  Back
                </Button>
                <Button
                  variant="danger"
                  isDisabled={reportLostReplace.isPending}
                  onPress={async () => {
                    if (!lostDialog) return;
                    try {
                      await reportLostReplace.mutateAsync(lostDialog);
                      setLostDialog(null);
                    } catch {
                      /* toast handles error */
                    }
                  }}
                >
                  Confirm replacement
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={newCardModal}>
        <Modal.Backdrop>
          <Modal.Container size="xs" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Close dialog" />
              <Modal.Header>
                <Modal.Heading>Add new card</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="new-card-nick" className="font-medium">
                    Nickname (optional)
                  </Label>
                  <Input
                    id="new-card-nick"
                    value={cardNick}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCardNick(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-4 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <Label htmlFor="new-card-brand" className="font-medium">
                    Brand
                  </Label>
                  <select
                    id="new-card-brand"
                    value={cardBrand}
                    className={`${paySelect} mt-2 w-full`}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setCardBrand(e.target.value as 'VISA' | 'MASTERCARD')
                    }
                  >
                    <option value="VISA">Visa</option>
                    <option value="MASTERCARD">Mastercard</option>
                  </select>
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" onPress={() => newCardModal.close()}>
                  Cancel
                </Button>
                <Button variant="primary" isDisabled={requestCard.isPending} onPress={() => requestCard.mutate()}>
                  Add card
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {creditCards.length === 0 ? (
        <p className="text-sm font-medium text-neutral-600">
          No credit accounts yet — use Add new card above or open one under Accounts.
        </p>
      ) : null}
    </div>
  );
}
