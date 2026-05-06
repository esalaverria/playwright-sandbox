import {
  Alert,
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
import { api, formatUsd } from '../api/client';

type Account = { id: string; nickname: string; mask: string; type: string; balanceCents: number };

export function TransferPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: Account[] }>('/accounts');
      return data.accounts;
    },
  });

  const internal = useMutation({
    mutationFn: async (payload: { fromAccountId: string; toAccountId: string; amountCents: number; memo?: string }) =>
      api.post('/transfers/internal', payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['tx'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-month'] });
    },
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
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['tx'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-month'] });
    },
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
      <Typography variant="h4" fontWeight={700}>
        Transfer
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Between my accounts" data-transfer-kind="internal" />
        <Tab label="Send to someone" data-transfer-kind="peer" />
      </Tabs>

      {tab === 0 ? (
        <Box component="form"
          data-transfer-kind="internal"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            internal.mutate({
              fromAccountId: String(fd.get('from')),
              toAccountId: String(fd.get('to')),
              amountCents: Math.round(Number(fd.get('amount')) * 100),
              memo: String(fd.get('memo') ?? '') || undefined,
            });
          }}
        >
          <Stack spacing={2} maxWidth={480}>
            {internal.isError ? <Alert severity="error">Could not complete transfer</Alert> : null}
            {internal.isSuccess ? <Alert severity="success">Transfer posted.</Alert> : null}
            <TextField select name="from" label="From" required defaultValue="">
              <MenuItem value="" disabled>
                Select account
              </MenuItem>
              {(accounts ?? []).map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.nickname} ({formatUsd(a.balanceCents)})
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
            <TextField name="amount" label="Amount (USD)" type="number" inputProps={{ step: '0.01', min: 0 }} required />
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
            peer.mutate({
              fromAccountId: String(fd.get('from')),
              recipientEmail: peerEmail.trim(),
              toAccountId: peerTo,
              amountCents: Math.round(Number(fd.get('amount')) * 100),
              memo: String(fd.get('memo') ?? '') || undefined,
            });
          }}
        >
          <Stack spacing={2} maxWidth={480}>
            {peer.isError ? <Alert severity="error">Peer transfer failed</Alert> : null}
            {peer.isSuccess ? <Alert severity="success">Sent.</Alert> : null}
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
              {(accounts ?? []).map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.nickname} ({formatUsd(a.balanceCents)})
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
            <TextField name="amount" label="Amount (USD)" type="number" inputProps={{ step: '0.01', min: 0 }} required />
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
