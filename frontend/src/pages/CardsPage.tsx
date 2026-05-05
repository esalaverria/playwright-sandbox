import { FormControlLabel, Paper, Stack, Switch, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatUsd } from '../api/client';

export function CardsPage() {
  const qc = useQueryClient();
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{
        accounts: { id: string; type: string; nickname: string; mask: string; balanceCents: number; frozen: boolean }[];
      }>('/accounts');
      return data.accounts.filter((a) => a.type === 'CREDIT');
    },
  });

  const toggle = useMutation({
    mutationFn: async (payload: { id: string; frozen: boolean }) =>
      api.patch(`/accounts/${payload.id}/freeze`, { frozen: payload.frozen }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Cards
      </Typography>
      {(accounts.data ?? []).map((c) => (
        <Paper key={c.id} sx={{ p: 2 }}>
          <Typography variant="h6">
            {c.nickname} {c.mask}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Balance: {formatUsd(c.balanceCents)}
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={c.frozen}
                onChange={(_, v) => toggle.mutate({ id: c.id, frozen: v })}
                inputProps={{ 'aria-label': 'freeze card' }}
              />
            }
            label="Card frozen"
          />
        </Paper>
      ))}
      {accounts.data?.length === 0 ? (
        <Typography color="text.secondary">No credit accounts on file.</Typography>
      ) : null}
    </Stack>
  );
}
