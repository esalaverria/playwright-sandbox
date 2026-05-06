import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../notifications/ToastProvider';
import { CurrencyTextField } from '../ui/CurrencyTextField';

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
};

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
  const [tab, setTab] = useState(0);
  const [billAmount, setBillAmount] = useState('');
  const [payNowAmount, setPayNowAmount] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: { id: string; nickname: string; type: string }[] }>('/accounts');
      return data.accounts;
    },
  });

  const depositAccounts = (accounts.data ?? []).filter((a) => a.type === 'CHECKING' || a.type === 'SAVINGS');

  const bills = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const { data } = await api.get<{ bills: BillRow[] }>('/bill-payments');
      return data.bills;
    },
  });

  const editing = (bills.data ?? []).find((b) => b.id === editId);

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
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={700}>
        Bill pay
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Schedule payment" />
          <Tab label="Pay now" />
        </Tabs>

        {tab === 0 ? (
          <Stack
            component="form"
            spacing={2}
            maxWidth={520}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              create.mutate({
                billerName: String(fd.get('billerName') ?? ''),
                fromAccountId: String(fd.get('fromAccountId') ?? ''),
                amountCents: Math.round(Number(billAmount) * 100),
                dueDate: String(fd.get('dueDate') ?? ''),
                memo: String(fd.get('memo') ?? '') || undefined,
                mode: 'schedule',
              });
            }}
          >
            <TextField name="billerName" label="Biller" required />
            <TextField select name="fromAccountId" label="Pay from" required defaultValue="">
              <MenuItem value="" disabled>
                Select account
              </MenuItem>
              {depositAccounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.nickname}
                </MenuItem>
              ))}
            </TextField>
            <CurrencyTextField label="Amount" value={billAmount} onChangeValue={setBillAmount} required inputProps={{ min: 0 }} />
            <TextField name="dueDate" label="Due date" type="date" InputLabelProps={{ shrink: true }} required />
            <TextField name="memo" label="Memo" />
            <Button type="submit" variant="contained">
              Schedule
            </Button>
          </Stack>
        ) : (
          <Stack
            component="form"
            spacing={2}
            maxWidth={520}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const today = new Date();
              const iso = today.toISOString().slice(0, 10);
              create.mutate({
                billerName: String(fd.get('billerName') ?? ''),
                fromAccountId: String(fd.get('fromAccountId') ?? ''),
                amountCents: Math.round(Number(payNowAmount) * 100),
                dueDate: iso,
                memo: String(fd.get('memo') ?? '') || undefined,
                mode: 'pay_now',
              });
            }}
          >
            <TextField name="billerName" label="Biller" required />
            <TextField select name="fromAccountId" label="Pay from" required defaultValue="">
              <MenuItem value="" disabled>
                Select account
              </MenuItem>
              {depositAccounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.nickname}
                </MenuItem>
              ))}
            </TextField>
            <CurrencyTextField label="Amount" value={payNowAmount} onChangeValue={setPayNowAmount} required inputProps={{ min: 0 }} />
            <TextField name="memo" label="Memo" />
            <Button type="submit" variant="contained">
              Pay now
            </Button>
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: { xs: 1, sm: 2 }, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Payments
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Biller</TableCell>
              <TableCell>Due</TableCell>
              <TableCell>Pay from</TableCell>
              <TableCell>Memo</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Source</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {(bills.data ?? []).map((b) => (
              <TableRow
                key={b.id}
                sx={(t) => ({
                  bgcolor:
                    b.payFromInvalid && b.status === 'SCHEDULED'
                      ? alpha(t.palette.error.main, t.palette.mode === 'light' ? 0.08 : 0.15)
                      : undefined,
                })}
              >
                <TableCell>{b.billerName}</TableCell>
                <TableCell>{new Date(b.dueDate).toLocaleDateString()}</TableCell>
                <TableCell>{b.fromAccountNickname}</TableCell>
                <TableCell sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.memo ?? '—'}</TableCell>
                <TableCell align="right">{(b.amountCents / 100).toFixed(2)}</TableCell>
                <TableCell>{b.kind === 'INSTANT' ? 'Instant' : 'Scheduled'}</TableCell>
                <TableCell>{b.status}</TableCell>
                <TableCell>
                  {b.payFromInvalid && b.status === 'SCHEDULED' ? (
                    <Chip size="small" color="error" label="Update required" />
                  ) : (
                    <Chip size="small" variant="outlined" label="OK" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                    {b.status === 'SCHEDULED' ? (
                      <>
                        <Button size="small" variant="outlined" onClick={() => setEditId(b.id)}>
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={payNow.isPending || b.payFromInvalid}
                          onClick={() => payNow.mutate(b.id)}
                        >
                          Pay now
                        </Button>
                      </>
                    ) : null}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditId(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit scheduled payment</DialogTitle>
        <DialogContent>
          {editing ? (
            <Stack
              spacing={2}
              sx={{ mt: 1 }}
              component="form"
              id="edit-bill-form"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const memoRaw = String(fd.get('memo') ?? '').trim();
                patchBill.mutate({
                  id: editing.id,
                  billerName: String(fd.get('billerName') ?? ''),
                  fromAccountId: String(fd.get('fromAccountId') ?? ''),
                  amountCents: Math.round(Number(fd.get('amount') ?? 0) * 100),
                  dueDate: String(fd.get('dueDate') ?? ''),
                  memo: memoRaw.length ? memoRaw : '',
                });
              }}
            >
              <TextField name="billerName" label="Biller" required defaultValue={editing.billerName} fullWidth />
              <TextField select name="fromAccountId" label="Pay from" required defaultValue={editing.fromAccountId} fullWidth>
                {depositAccounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.nickname}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                name="amount"
                label="Amount"
                type="number"
                required
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                defaultValue={(editing.amountCents / 100).toFixed(2)}
              />
              <TextField
                name="dueDate"
                label="Due date"
                type="date"
                InputLabelProps={{ shrink: true }}
                required
                fullWidth
                defaultValue={editing.dueDate.slice(0, 10)}
              />
              <TextField name="memo" label="Memo" fullWidth defaultValue={editing.memo ?? ''} />
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditId(null)}>Cancel</Button>
          <Button type="submit" form="edit-bill-form" variant="contained" disabled={patchBill.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
