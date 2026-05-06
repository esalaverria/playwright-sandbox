import { Alert, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { CurrencyTextField } from '../ui/CurrencyTextField';

export function BillsPage() {
  const qc = useQueryClient();
  const [billAmount, setBillAmount] = useState('');
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: { id: string; nickname: string }[] }>('/accounts');
      return data.accounts;
    },
  });

  const bills = useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const { data } = await api.get<{
        bills: {
          id: string;
          billerName: string;
          amountCents: number;
          dueDate: string;
          status: string;
          memo: string | null;
        }[];
      }>('/bill-payments');
      return data.bills;
    },
  });

  const create = useMutation({
    mutationFn: async (payload: {
      billerName: string;
      fromAccountId: string;
      amountCents: number;
      dueDate: string;
      memo?: string;
    }) => api.post('/bill-payments', payload),
    onSuccess: () => {
      setBillAmount('');
      qc.invalidateQueries({ queryKey: ['bills'] });
    },
  });

  const payNow = useMutation({
    mutationFn: async (id: string) => api.post(`/bill-payments/${id}/pay-now`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={700}>
        Bill pay
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Schedule payment
        </Typography>
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
            });
          }}
        >
          <TextField name="billerName" label="Biller" required />
          <TextField select name="fromAccountId" label="Pay from" required defaultValue="">
            <MenuItem value="" disabled>
              Select account
            </MenuItem>
            {(accounts.data ?? []).map((a) => (
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
          {create.isError ? <Alert severity="error">Check due date is not in the past.</Alert> : null}
        </Stack>
      </Paper>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Biller</TableCell>
              <TableCell>Due</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(bills.data ?? []).map((b) => (
              <TableRow key={b.id}>
                <TableCell>{b.billerName}</TableCell>
                <TableCell>{new Date(b.dueDate).toLocaleDateString()}</TableCell>
                <TableCell align="right">{(b.amountCents / 100).toFixed(2)}</TableCell>
                <TableCell>{b.status}</TableCell>
                <TableCell>
                  {b.status === 'SCHEDULED' ? (
                    <Button size="small" onClick={() => payNow.mutate(b.id)}>
                      Pay now
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
