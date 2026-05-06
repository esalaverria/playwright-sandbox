import { Button, Chip, Input, Label, Modal, Switch, useOverlayState } from '@heroui/react';
import { Wallet, Plus } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api, delay } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { useToast } from '../notifications/ToastProvider';
import { AppSelect } from '../ui/AppSelect';
import { AccountSelect } from '../ui/AccountSelect';
import { formatAccountOptionLabel } from '../ui/account-option-label';

type AccountRow = {
  id: string;
  type: string;
  nickname: string;
  mask: string;
  balanceCents: number;
  accountNumberFull: string | null;
  cardLifecycle?: string | null;
  closedAt?: string | null;
};

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
  const [showClosed, setShowClosed] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

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
      toast('New credit card on the way — added to your wallet.');
      setOpenCard(false);
      setCardNick('');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Could not request credit card', 'error'),
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
  const sortedAccounts = [...depositAccounts].sort((a, b) => {
    if (!!a.closedAt !== !!b.closedAt) return a.closedAt ? 1 : -1;
    return a.nickname.localeCompare(b.nickname);
  });
  const filteredAccounts = sortedAccounts.filter((a) =>
    a.nickname.toLowerCase().includes(query.toLowerCase()),
  );
  const displayAccounts = filteredAccounts.filter((a) => showClosed || !a.closedAt);
  const pagedAccounts = displayAccounts.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(displayAccounts.length / pageSize));

  const closingRow = closeId ? depositAccounts.find((a) => a.id === closeId) : null;
  const destinations = depositAccounts.filter((a) => a.id !== closeId && !a.closedAt);
  const destinationSelectOptions = destinations.map((d) => ({
    id: d.id,
    label: formatAccountOptionLabel(
      {
        nickname: d.nickname,
        mask: d.mask,
        type: d.type,
        balanceCents: d.balanceCents,
      },
      formatMoney,
    ),
  }));

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
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <Input
            value={query}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by nickname"
            className="max-w-xs rounded-xl border px-3 py-2"
          />
          <Switch isSelected={showClosed} onChange={setShowClosed}>
            <Switch.Content>
              <span className="text-sm text-neutral-700">Show closed</span>
            </Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">Account</th>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">Balance</th>
                <th className="px-4 py-3 text-left font-semibold text-neutral-700">Account number</th>
                <th className="px-4 py-3 text-center font-semibold text-neutral-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pagedAccounts.map((a) => (
                <tr key={a.id} className={`hover:bg-neutral-50/80 ${a.closedAt ? 'opacity-55' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-bold text-neutral-900">{a.nickname}</p>
                    <p className="text-xs font-medium text-neutral-500">{a.mask}</p>
                    {a.closedAt ? (
                      <Chip size="sm" color="default" variant="secondary" className="mt-1">
                        <Chip.Label>Closed</Chip.Label>
                      </Chip>
                    ) : null}
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
                    <div className="flex flex-wrap justify-center gap-2">
                      <RouterLink to={`/accounts/${a.id}`} className={linkOutline}>
                        View transactions
                      </RouterLink>
                      <Button variant="danger-soft" size="sm" onPress={() => setCloseId(a.id)} isDisabled={!!a.closedAt}>
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
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" isDisabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <span className="text-sm text-neutral-600">
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          isDisabled={page >= totalPages}
          onPress={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
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
                <AppSelect
                  label="Type"
                  aria-label="New account type"
                  placeholder="Select type"
                  options={[
                    { id: 'CHECKING', label: 'Checking' },
                    { id: 'SAVINGS', label: 'Savings' },
                  ]}
                  value={newType}
                  onChange={(id) => setNewType(id as 'CHECKING' | 'SAVINGS')}
                />
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
                <AppSelect
                  label="Brand"
                  aria-label="Card brand"
                  placeholder="Select brand"
                  options={[
                    { id: 'VISA', label: 'Visa' },
                    { id: 'MASTERCARD', label: 'Mastercard' },
                  ]}
                  value={cardBrand}
                  onChange={(id) => setCardBrand(id as 'VISA' | 'MASTERCARD')}
                />
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
                    <AccountSelect
                      label="Receive funds"
                      aria-label="Account to receive closing balance"
                      placeholder="Select account…"
                      options={destinationSelectOptions}
                      value={transferTo}
                      onChange={setTransferTo}
                    />
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
