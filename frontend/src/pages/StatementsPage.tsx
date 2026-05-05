import { Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api/client';

export function StatementsPage() {
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: { id: string; nickname: string }[] }>('/accounts');
      return data.accounts;
    },
  });

  const [accountId, setAccountId] = useState<string>('');

  useEffect(() => {
    if (!accountId && accounts.data?.length) setAccountId(accounts.data[0]!.id);
  }, [accounts.data, accountId]);

  const periods = useQuery({
    queryKey: ['stmt-periods', accountId],
    queryFn: async () => {
      const { data } = await api.get<{ periods: string[] }>(`/accounts/${accountId}/statements`);
      return data.periods;
    },
    enabled: !!accountId,
  });

  const [period, setPeriod] = useState('');

  useEffect(() => {
    const p = periods.data ?? [];
    if (p.length && !p.includes(period)) setPeriod(p[0]!);
  }, [period, periods.data]);

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={700}>
        Statements
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2} maxWidth={520}>
          <TextField select label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {(accounts.data ?? []).map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.nickname}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Period (YYYY-MM)" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {(periods.data ?? []).map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            component="a"
            href={accountId && period ? `/api/accounts/${accountId}/statements/${period}/export` : undefined}
            disabled={!accountId || !period}
          >
            Download CSV
          </Button>
          <Typography variant="caption" color="text.secondary">
            Uses same-origin cookie auth for download.
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
