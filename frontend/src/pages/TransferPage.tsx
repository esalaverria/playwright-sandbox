import {
  Box,
  Button,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';
import { useToast } from '../notifications/ToastProvider';
import { CurrencyTextField } from '../ui/CurrencyTextField';

type Account = { id: string; nickname: string; mask: string; type: string; balanceCents: number };

export function TransferPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { formatMoney } = usePrivacy();
  const [tab, setTab] = useState(0);
  const [intAmount, setIntAmount] = useState('');
  const [peerAmount, setPeerAmount] = useState('');

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: Account[] }>('/accounts');
      return data.accounts;
    },
  });

  const fromAccounts = (accounts ?? []).filter((a) => a.type === 'CHECKING' || a.type === 'SAVINGS');

  const internal = useMutation({
    mutationFn: async (payload: { fromAccountId: string; toAccountId: string; amountCents: number; memo?: string }) =>
      api.post('/transfers/internal', payload),
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
      const { data } = await api.get<{ userExists: boolean; accounts: { id: string; mask: string; type: string; nickname: string }[] }>(
        '/recipients/preview',
        { params: { email: peerEmail } },
      );
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

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={800}>
        Transfer
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Between my accounts" data-transfer-kind="internal" />
        <Tab label="Send to someone" data-transfer-kind="peer" />
      </Tabs>
      <Typography variant="body2" color="text.secondary" maxWidth={560}>
        Transfers can only come from checking or savings. Credit cards are for payments (Pay card, Bill pay), not moving money to yourself or others.
      </Typography>

      {tab === 0 ? (
        <Box
          component="form"
          data-transfer-kind="internal"
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
          <Stack spacing={2} maxWidth={480}>
            <TextField select name="from" label="From" required defaultValue="">
              <MenuItem value="" disabled>
                Select account
              </MenuItem>
              {fromAccounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.nickname} ({formatMoney(a.balanceCents)})
                </MenuItem>
              ))}
            </TextField>
            <TextField select name="to" label="To" required defaultValue="">
              <MenuItem value="" disabled>
                Select account
              </MenuItem>
              {(accounts ?? []).map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.nickname}
                </MenuItem>
              ))}
            </TextField>
            <CurrencyTextField
              name="amount"
              label="Amount"
              value={intAmount}
              onChangeValue={setIntAmount}
              required
              inputProps={{ min: 0 }}
            />
            <TextField name="memo" label="Memo" />
            <Button type="submit" variant="contained" disabled={internal.isPending}>
              Submit internal transfer
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box
          component="form"
          data-transfer-kind="peer"
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
          <Stack spacing={2} maxWidth={480}>
            <TextField
              label="Recipient email"
              value={peerEmail}
              onChange={(e) => setPeerEmail(e.target.value)}
              required
            />
            <TextField select name="from" label="From your account" required defaultValue="">
              <MenuItem value="" disabled>
                Select account
              </MenuItem>
              {fromAccounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.nickname} ({formatMoney(a.balanceCents)})
                </MenuItem>
              ))}
            </TextField>
            <TextField select label="To their account" value={peerTo} onChange={(e) => setPeerTo(e.target.value)} required>
              {peerAccounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.nickname} {a.mask} · {a.type}
                </MenuItem>
              ))}
            </TextField>
            {!preview.data?.userExists ? (
              <Typography variant="caption" color="text.secondary">
                Enter an email that belongs to another NorthPeak user.
              </Typography>
            ) : null}
            <CurrencyTextField
              label="Amount"
              value={peerAmount}
              onChangeValue={setPeerAmount}
              required
              inputProps={{ min: 0 }}
            />
            <TextField name="memo" label="Memo" />
            <Button type="submit" variant="contained" disabled={peer.isPending || !peerTo}>
              Send money
            </Button>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
