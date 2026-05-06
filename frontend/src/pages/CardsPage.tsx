import CreditCardIcon from '@mui/icons-material/CreditCard';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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

export function CardsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { formatMoney } = usePrivacy();
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

  const lifecycleMut = useMutation({
    mutationFn: async (payload: { id: string; lifecycle: 'CANCELLED' | 'LOST_REPORTED' }) =>
      api.patch(`/accounts/${payload.id}/card-lifecycle`, { lifecycle: payload.lifecycle }),
    onSuccess: async (_, v) => {
      toast(v.lifecycle === 'CANCELLED' ? 'Card cancelled.' : 'Card reported lost — we froze it.');
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
    onError: () => toast('Could not update card.', 'error'),
  });

  const [payFromByCard, setPayFromByCard] = useState<Record<string, string>>({});
  const [payAmountByCard, setPayAmountByCard] = useState<Record<string, string>>({});
  const [revealDetails, setRevealDetails] = useState<Record<string, CardSensitive | undefined>>({});
  const [lostDialog, setLostDialog] = useState<string | null>(null);

  async function fetchSensitive(id: string) {
    const { data } = await api.get<{ details: CardSensitive }>(`/accounts/${id}/sensitive-card`);
    setRevealDetails((m) => ({ ...m, [id]: data.details }));
    toast('Full card details loaded (demo numbers).', 'info');
    await qc.invalidateQueries({ queryKey: ['activity-log'] });
  }


  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4" fontWeight={800}>
          Cards
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pay balances, manage limits, and view demo card numbers safely in this sandbox.
        </Typography>
      </div>

      {creditCards.map((c) => {
        const limit = c.creditLimitCents;
        const debtCents = Math.max(0, -c.balanceCents);
        const util =
          limit != null && limit > 0 ? Math.min(100, Math.round((debtCents / limit) * 100)) : 0;
        const payFrom = payFromByCard[c.id] ?? fundingAccounts[0]?.id ?? '';
        const payAmt = payAmountByCard[c.id] ?? '';
        const isActive = c.cardLifecycle === 'ACTIVE';
        const brand = c.cardBrand === 'MASTERCARD' ? 'Mastercard' : 'Visa';
        const sens = revealDetails[c.id];

        return (
          <Paper
            key={c.id}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              background: (t) =>
                `linear-gradient(135deg, ${t.palette.primary.light}22 0%, ${t.palette.secondary.light}18 100%)`,
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CreditCardIcon color="primary" sx={{ fontSize: 40 }} />
                <div>
                  <Typography variant="h6" fontWeight={800}>
                    {c.nickname}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    <Chip size="small" label={brand} color="primary" variant="filled" />
                    <Chip
                      size="small"
                      label={c.cardLifecycle.replace('_', ' ')}
                      color={isActive ? 'success' : 'default'}
                      variant="outlined"
                    />
                    <Typography variant="caption" color="text.secondary">
                      {c.mask}
                    </Typography>
                  </Stack>
                </div>
              </Stack>
              <Typography variant="body2" fontWeight={600} color="text.secondary">
                {c.nameOnCard}
              </Typography>
            </Stack>

            <Typography variant="body2" sx={{ mt: 1.5 }}>
              Balance owed:{' '}
              <strong>{formatMoney(c.balanceCents)}</strong>
            </Typography>

            {limit != null ? (
              <>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Limit: {formatMoney(limit)} · Utilization {util}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={util}
                  sx={{
                    mt: 1.5,
                    height: 10,
                    borderRadius: 999,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 999,
                      background: (t) =>
                        `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
                    },
                  }}
                />
              </>
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }} display="block">
                No credit limit on file.
              </Typography>
            )}

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }} display="block">
              Expires {c.expMonth != null && c.expYear != null ? `${String(c.expMonth).padStart(2, '0')}/${c.expYear}` : '—'}
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              <FormControlLabel
                control={
                  <Switch
                    checked={c.frozen}
                    disabled={!isActive}
                    onChange={(_, v) => toggleFreeze.mutate({ id: c.id, frozen: v })}
                  />
                }
                label="Freeze card"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={c.allowOverLimit}
                    disabled={!isActive}
                    onChange={(_, v) => toggleOverLimit.mutate({ id: c.id, allowOverLimit: v })}
                  />
                }
                label="Allow over limit"
              />
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2 }}>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                disabled={!isActive}
                onClick={() => lifecycleMut.mutate({ id: c.id, lifecycle: 'CANCELLED' })}
              >
                Cancel card
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<WarningAmberIcon />}
                disabled={!isActive}
                onClick={() => setLostDialog(c.id)}
              >
                Report lost
              </Button>
              <Button size="small" variant="text" onClick={() => fetchSensitive(c.id)}>
                Reveal card numbers
              </Button>
            </Stack>

            {sens ? (
              <Alert severity="info" sx={{ mt: 2 }} variant="outlined">
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  {sens.panFull?.replace(/(\d{4})/g, '$1 ').trim()}
                </Typography>
                <Typography variant="body2">CVV {sens.cvv}</Typography>
              </Alert>
            ) : null}

            <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
              Pay from your account
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
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'stretch' }}
                sx={{ maxWidth: 720 }}
              >
                <TextField
                  select
                  label="Pay from"
                  size="small"
                  required
                  sx={{ flex: 1, minWidth: 200 }}
                  value={payFrom}
                  onChange={(e) => setPayFromByCard((m) => ({ ...m, [c.id]: e.target.value }))}
                >
                  {fundingAccounts.map((a) => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.nickname} ({formatMoney(a.balanceCents)})
                    </MenuItem>
                  ))}
                </TextField>
                <CurrencyTextField
                  label="Amount"
                  size="small"
                  required
                  sx={{ flex: 1, minWidth: 160 }}
                  value={payAmt}
                  onChangeValue={(v) => setPayAmountByCard((m) => ({ ...m, [c.id]: v }))}
                  inputProps={{ inputMode: 'decimal' }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={payCard.isPending || !isActive}
                  sx={{
                    px: 4,
                    py: 1.25,
                    minWidth: { sm: 160 },
                    whiteSpace: 'nowrap',
                    alignSelf: { xs: 'stretch', sm: 'auto' },
                  }}
                >
                  Pay card
                </Button>
              </Stack>
            </Box>
          </Paper>
        );
      })}

      <Dialog open={!!lostDialog} onClose={() => setLostDialog(null)}>
        <DialogTitle>Report card lost?</DialogTitle>
        <DialogContent>
          <Typography>We&apos;ll freeze this card and mark it as lost. You can request a replacement from Accounts.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLostDialog(null)}>Back</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (lostDialog) lifecycleMut.mutate({ id: lostDialog, lifecycle: 'LOST_REPORTED' });
              setLostDialog(null);
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {creditCards.length === 0 ? (
        <Typography color="text.secondary">No credit accounts yet — request one under Accounts.</Typography>
      ) : null}
    </Stack>
  );
}
