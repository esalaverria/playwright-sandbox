import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
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
      api.post('/accounts', { type: newType, nickname: newNickname.trim() || `${newType === 'CHECKING' ? 'Checking' : 'Savings'} account` }),
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

  const depositAccounts = (accounts.data ?? []).filter(
    (a) => a.type === 'CHECKING' || a.type === 'SAVINGS',
  );

  const closingRow = closeId ? depositAccounts.find((a) => a.id === closeId) : null;
  const destinations = depositAccounts.filter((a) => a.id !== closeId);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
        <div>
          <Typography variant="h4" fontWeight={800}>
            Accounts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage deposits, routing-style numbers, and request new cards.
          </Typography>
        </div>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setOpenNew(true)}>
            New account
          </Button>
          <Button variant="outlined" color="primary" startIcon={<AccountBalanceWalletIcon />} onClick={() => setOpenCard(true)}>
            Request credit card
          </Button>
        </Stack>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Table size="medium">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell>Account</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Balance</TableCell>
              <TableCell>Account number</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {depositAccounts.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>
                  <Typography fontWeight={700}>{a.nickname}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {a.mask}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={a.type} size="small" />
                </TableCell>
                <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(a.balanceCents)}</TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                      {revealAcct[a.id] && a.accountNumberFull
                        ? a.accountNumberFull.replace(/(\d{4})/g, '$1 ').trim()
                        : a.accountNumberFull
                          ? `•••• •••• •••• ${a.accountNumberFull.slice(-4)}`
                          : '—'}
                    </Typography>
                    <Button size="small" onClick={() => setRevealAcct((m) => ({ ...m, [a.id]: !m[a.id] }))}>
                      {revealAcct[a.id] ? 'Hide' : 'Reveal'}
                    </Button>
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                    <Button component={RouterLink} to={`/accounts/${a.id}`} size="small" variant="outlined">
                      Activity
                    </Button>
                    <Button size="small" color="warning" variant="outlined" onClick={() => setCloseId(a.id)}>
                      Close
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={openNew} onClose={() => setOpenNew(false)} fullWidth maxWidth="xs">
        <DialogTitle>Open new account</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'CHECKING' | 'SAVINGS')}
              >
                <MenuItem value="CHECKING">Checking</MenuItem>
                <MenuItem value="SAVINGS">Savings</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Nickname" value={newNickname} onChange={(e) => setNewNickname(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNew(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => createDep.mutate()} disabled={createDep.isPending}>
            Open (starts at $0)
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCard} onClose={() => setOpenCard(false)} fullWidth maxWidth="xs">
        <DialogTitle>Request a credit card</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Brand</InputLabel>
              <Select label="Brand" value={cardBrand} onChange={(e) => setCardBrand(e.target.value as 'VISA' | 'MASTERCARD')}>
                <MenuItem value="VISA">Visa</MenuItem>
                <MenuItem value="MASTERCARD">Mastercard</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Card nickname (optional)" value={cardNick} onChange={(e) => setCardNick(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCard(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={() => requestCard.mutate()} disabled={requestCard.isPending}>
            Request card
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!closeId} onClose={() => setCloseId(null)} fullWidth maxWidth="sm">
        <DialogTitle>Close account</DialogTitle>
        <DialogContent>
          {closingRow && closingRow.balanceCents > 0 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography>
                Transfer <strong>{(closingRow.balanceCents / 100).toFixed(2)}</strong> to another open account, then we&apos;ll close this one.
              </Typography>
              <FormControl fullWidth required>
                <InputLabel>Receive funds</InputLabel>
                <Select label="Receive funds" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                  {destinations.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.nickname}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          ) : (
            <Typography sx={{ mt: 1 }}>This account has a $0 balance and can be closed.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseId(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => closeAcc.mutate()}
            disabled={
              closeAcc.isPending ||
              (!!(closingRow && closingRow.balanceCents > 0) && !transferTo)
            }
          >
            Confirm close
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
