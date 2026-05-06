import { Button, Chip, Input, Label, Modal, useOverlayState } from '@heroui/react';
import { Wallet, Plus } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api, delay } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { useToast } from '../notifications/ToastProvider';

type AccountRow = {
  id: string;
  type: string;
  nickname: string;
  mask: string;
  balanceCents: number;
  accountNumberFull: string | null;
  cardLifecycle?: string | null;
};

const selectFull =
  'bg-field text-field mt-2 w-full cursor-pointer rounded-xl border px-4 py-2.5 outline-none transition-[border,color,background] focus-visible:border-accent focus-visible:ring-[2px] focus-visible:ring-focus';

const linkOutline =
  'inline-flex items-center justify-center rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50';

export function AccountsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { formatMoney } = usePrivacy();
  const [openNew, setOpenNew] = useState(false);
  const [openCard, setOpenCard] = useState(false);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [newNickname, setNewNickname] = useState('');
  const [newType, setNewType] = useState<'CHECKING' | 'SAVINGS'>('CHECKING');
  const [cardNick, setCardNick] = useState('');
  const [cardBrand, setCardBrand] = useState<'VISA' | 'MASTERCARD'>('VISA');
  const [transferTo, setTransferTo] = useState('');
  const [revealAcct, setRevealAcct] = useState<Record<string, boolean>>({});

  const newModal = useOverlayState({ isOpen: openNew, onOpenChange: setOpenNew });
  const cardModal = useOverlayState({ isOpen: openCard, onOpenChange: setOpenCard });
  const closeModal = useOverlayState({
    isOpen: closeId !== null,
    onOpenChange: (open: boolean) => {
      if (!open) {
        setCloseId(null);
        setTransferTo('');
      }
    },
  });

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      await delay(320 + Math.floor(Math.random() * 200));
      const { data } = await api.get<{ accounts: AccountRow[] }>('/accounts');
      return data.accounts;
    },
  });

  const createDep = useMutation({
    mutationFn: async () =>
      api.post('/accounts', {
        type: newType,
        nickname: newNickname.trim() || `${newType === 'CHECKING' ? 'Checking' : 'Savings'} account`,
      }),
    onSuccess: async () => {
      toast('Account opened!');
      setOpenNew(false);
      setNewNickname('');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Could not create account', 'error'),
  });

  const requestCard = useMutation({
    mutationFn: async () =>
      api.post('/accounts/credit-cards', {
        nickname: cardNick.trim() || undefined,
        brand: cardBrand,
      }),
    onSuccess: async () => {
      toast('New card on the way — added to your wallet.');
      setOpenCard(false);
      setCardNick('');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Could not request card', 'error'),
  });

  const closeAcc = useMutation({
    mutationFn: async () => {
      const id = closeId!;
      const row = (accounts.data ?? []).find((a) => a.id === id);
      const payload =
        row && row.balanceCents > 0 && transferTo ? { transferToAccountId: transferTo } : {};
      return api.patch(`/accounts/${id}/close`, payload);
    },
    onSuccess: async () => {
      toast('Account closed.');
      setCloseId(null);
      setTransferTo('');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Could not close account — check balance transfer.', 'error'),
  });

  const depositAccounts = (accounts.data ?? []).filter((a) => a.type === 'CHECKING' || a.type === 'SAVINGS');

  const closingRow = closeId ? depositAccounts.find((a) => a.id === closeId) : null;
  const destinations = depositAccounts.filter((a) => a.id !== closeId);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Accounts</h1>
          <p className="mt-2 max-w-xl text-sm font-medium text-neutral-600">
            Manage deposits, routing-style numbers, and request new cards.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onPress={() => setOpenNew(true)}>
            <Plus aria-hidden className="mr-2 size-4 shrink-0" strokeWidth={2.25} />
            New account
          </Button>
          <Button variant="outline" onPress={() => setOpenCard(true)}>
            <Wallet aria-hidden className="mr-2 size-4 shrink-0" strokeWidth={2} />
            Request credit card
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">Account</th>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">Balance</th>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">Account number</th>
                <th className="px-4 py-3 text-right font-semibold text-neutral-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {depositAccounts.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-50/80">
                  <td className="px-4 py-3">
                    <p className="font-bold text-neutral-900">{a.nickname}</p>
                    <p className="text-xs font-medium text-neutral-500">{a.mask}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Chip variant="secondary" color="default" size="sm">
                      <Chip.Label>{a.type}</Chip.Label>
                    </Chip>
                  </td>
                  <td className="font-variant-numeric px-4 py-3 tabular-nums font-semibold text-neutral-800">
                    {formatMoney(a.balanceCents)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs tracking-wide text-neutral-800">
                        {revealAcct[a.id] && a.accountNumberFull
                          ? a.accountNumberFull.replace(/(\d{4})/g, '$1 ').trim()
                          : a.accountNumberFull
                            ? `•••• •••• •••• ${a.accountNumberFull.slice(-4)}`
                            : '—'}
                      </span>
                      <Button variant="ghost" size="sm" className="min-h-8 px-2 text-xs" onPress={() => setRevealAcct((m) => ({ ...m, [a.id]: !m[a.id] }))}>
                        {revealAcct[a.id] ? 'Hide' : 'Reveal'}
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <RouterLink to={`/accounts/${a.id}`} className={linkOutline}>
                        Activity
                      </RouterLink>
                      <Button variant="danger-soft" size="sm" onPress={() => setCloseId(a.id)}>
                        Close
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal state={newModal}>
        <Modal.Backdrop>
          <Modal.Container size="xs" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Close dialog" />
              <Modal.Header>
                <Modal.Heading>Open new account</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="acct-type" className="mb-2 block font-medium">
                    Type
                  </Label>
                  <select
                    id="acct-type"
                    value={newType}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setNewType(e.target.value as 'CHECKING' | 'SAVINGS')
                    }
                    className={selectFull}
                  >
                    <option value="CHECKING">Checking</option>
                    <option value="SAVINGS">Savings</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="new-nickname" className="mb-2 inline-block font-medium">
                    Nickname
                  </Label>
                  <Input
                    id="new-nickname"
                    value={newNickname}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setNewNickname(e.target.value)}
                    placeholder="Optional nickname"
                    className="mt-0 w-full rounded-xl border px-4 py-2.5 outline-none"
                  />
                </div>
              </Modal.Body>
              <Modal.Footer className="flex gap-2 justify-end">
                <Button variant="ghost" onPress={() => newModal.close()}>
                  Cancel
                </Button>
                <Button variant="primary" onPress={() => createDep.mutate()} isDisabled={createDep.isPending}>
                  Open (starts at $0)
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={cardModal}>
        <Modal.Backdrop>
          <Modal.Container size="xs" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Close dialog" />
              <Modal.Header>
                <Modal.Heading>Request a credit card</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="card-brand" className="mb-2 block font-medium">
                    Brand
                  </Label>
                  <select
                    id="card-brand"
                    value={cardBrand}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setCardBrand(e.target.value as 'VISA' | 'MASTERCARD')
                    }
                    className={selectFull}
                  >
                    <option value="VISA">Visa</option>
                    <option value="MASTERCARD">Mastercard</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="card-nick-open" className="mb-2 inline-block font-medium">
                    Card nickname (optional)
                  </Label>
                  <Input
                    id="card-nick-open"
                    value={cardNick}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCardNick(e.target.value)}
                    className="mt-0 w-full rounded-xl border px-4 py-2.5 outline-none"
                  />
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" onPress={() => cardModal.close()}>
                  Cancel
                </Button>
                <Button variant="secondary" onPress={() => requestCard.mutate()} isDisabled={requestCard.isPending}>
                  Request card
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={closeModal}>
        <Modal.Backdrop>
          <Modal.Container size="md" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Close dialog" />
              <Modal.Header>
                <Modal.Heading>Close account</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {closingRow && closingRow.balanceCents > 0 ? (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-neutral-700">
                      Transfer <strong>{(closingRow.balanceCents / 100).toFixed(2)}</strong> to another open account,
                      then we&apos;ll close this one.
                    </p>
                    <div>
                      <Label htmlFor="recv-funds" className="mb-2 block font-medium">
                        Receive funds
                      </Label>
                      <select
                        id="recv-funds"
                        required
                        value={transferTo}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setTransferTo(e.target.value)}
                        className={selectFull}
                      >
                        <option value="">Select account…</option>
                        {destinations.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nickname}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-700">This account has a $0 balance and can be closed.</p>
                )}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" onPress={() => closeModal.close()}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onPress={() => closeAcc.mutate()}
                  isDisabled={
                    closeAcc.isPending || (!!(closingRow && closingRow.balanceCents > 0) && !transferTo)
                  }
                >
                  Confirm close
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
