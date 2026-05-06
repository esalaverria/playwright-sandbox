import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, formatUsd } from '../api/client';

type CreditAccount = {
  id: string;
  type: string;
  nickname: string;
  mask: string;
  balanceCents: number;
  frozen: boolean;
  creditLimitCents: number | null;
  allowOverLimit: boolean;
};

export function CardsPage() {
  const qc = useQueryClient();
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: CreditAccount[] }>('/accounts');
      return data.accounts;
    },
  });

  const creditCards = (accounts.data ?? []).filter((a) => a.type === 'CREDIT');
  const fundingAccounts = (accounts.data ?? []).filter((a) => a.type === 'CHECKING' || a.type === 'SAVINGS');

  const toggleFreeze = useMutation({
    mutationFn: async (payload: { id: string; frozen: boolean }) =>
      api.patch(`/accounts/${payload.id}/freeze`, { frozen: payload.frozen }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const toggleOverLimit = useMutation({
    mutationFn: async (payload: { id: string; allowOverLimit: boolean }) =>
      api.patch(`/accounts/${payload.id}/credit-settings`, { allowOverLimit: payload.allowOverLimit }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const payCard = useMutation({
    mutationFn: async (payload: { creditAccountId: string; fromAccountId: string; amountCents: number }) =>
      api.post('/transfers/pay-card', payload),
    onSuccess: async (_, variables) => {
      setPayAmountByCard((m) => ({ ...m, [variables.creditAccountId]: '' }));
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['tx'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-month'] });
    },
  });

  const [payFromByCard, setPayFromByCard] = useState<Record<string, string>>({});
  const [payAmountByCard, setPayAmountByCard] = useState<Record<string, string>>({});

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Cards
      </Typography>
      {creditCards.map((c) => {
        const limit = c.creditLimitCents;
        const debtCents = Math.max(0, -c.balanceCents);
        const util =
          limit != null && limit > 0 ? Math.min(100, Math.round((debtCents / limit) * 100)) : 0;
        const payFrom = payFromByCard[c.id] ?? fundingAccounts[0]?.id ?? '';
        const payAmt = payAmountByCard[c.id] ?? '';

        return (
          <Paper key={c.id} sx={{ p: 2 }}>
            <Typography variant="h6">
              {c.nickname} {c.mask}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Balance: {formatUsd(c.balanceCents)} (negative is amount owed)
            </Typography>
            {limit != null ? (
              <>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Credit limit: {formatUsd(limit)}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Utilization: {util}% of limit ({formatUsd(debtCents)} owed)
                </Typography>
                <LinearProgress variant="determinate" value={util} sx={{ mt: 1, height: 8, borderRadius: 1 }} />
              </>
            ) : (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                No credit limit on file.
              </Typography>
            )}
            <FormControlLabel
              sx={{ mt: 2, display: 'flex' }}
              control={
                <Switch
                  checked={c.frozen}
                  onChange={(_, v) => toggleFreeze.mutate({ id: c.id, frozen: v })}
                  inputProps={{ 'aria-label': 'freeze card' }}
                />
              }
              label="Card frozen"
            />
            <FormControlLabel
              sx={{ display: 'flex' }}
              control={
                <Switch
                  checked={c.allowOverLimit}
                  onChange={(_, v) => toggleOverLimit.mutate({ id: c.id, allowOverLimit: v })}
                  inputProps={{ 'aria-label': 'allow over limit' }}
                />
              }
              label="Allow charges over credit limit"
            />

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Pay card from your account
            </Typography>
            <Box
              component="form"
              onSubmit={(e) => {
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
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start" maxWidth={560}>
                <TextField
                  select
                  label="Pay from"
                  size="small"
                  required
                  fullWidth
                  value={payFrom}
                  onChange={(e) => setPayFromByCard((m) => ({ ...m, [c.id]: e.target.value }))}
                >
                  {fundingAccounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.nickname} ({formatUsd(a.balanceCents)})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Amount (USD)"
                  type="number"
                  size="small"
                  required
                  inputProps={{ step: '0.01', min: 0 }}
                  value={payAmt}
                  onChange={(e) => setPayAmountByCard((m) => ({ ...m, [c.id]: e.target.value }))}
                />
                <Button type="submit" variant="contained" disabled={payCard.isPending}>
                  Pay card
                </Button>
              </Stack>
            </Box>
            {payCard.isError && payCard.variables?.creditAccountId === c.id ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                Could not process payment. Check funds and limits.
              </Alert>
            ) : null}
            {payCard.isSuccess && payCard.variables?.creditAccountId === c.id ? (
              <Alert severity="success" sx={{ mt: 1 }}>
                Payment posted.
              </Alert>
            ) : null}
          </Paper>
        );
      })}
      {creditCards.length === 0 ? (
        <Typography color="text.secondary">No credit accounts on file.</Typography>
      ) : null}
    </Stack>
  );
}
