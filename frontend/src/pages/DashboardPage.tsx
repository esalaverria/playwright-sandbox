import {
  Card,
  CardActionArea,
  CardContent,
  Paper,
  Stack,
  Typography,
  Box,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { api, formatUsd } from '../api/client';

type Account = {
  id: string;
  type: string;
  nickname: string;
  mask: string;
  balanceCents: number;
};

export function DashboardPage() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  const { data } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: Account[] }>('/accounts');
      return data.accounts;
    },
  });

  const activity = useQuery({
    queryKey: ['dashboard-month', year, month],
    queryFn: async () => {
      const { data } = await api.get<{
        year: number;
        month: number;
        points: { date: string; netCents: number; count: number }[];
      }>('/dashboard/month-activity', { params: { year, month } });
      return data;
    },
  });

  const chartRows =
    activity.data?.points.map((p) => ({
      ...p,
      dayNum: Number(p.date.slice(8, 10)),
      netUsd: p.netCents / 100,
    })) ?? [];

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4" fontWeight={700}>
          Accounts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Balances update after transfers and bill activity.
        </Typography>
      </div>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          This month&apos;s transaction activity (UTC)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Net cash flow per day across all your accounts ({year}-{String(month).padStart(2, '0')}).
        </Typography>
        {chartRows.length > 0 ? (
          <LineChart
            dataset={chartRows}
            xAxis={[
              {
                scaleType: 'band',
                dataKey: 'dayNum',
                label: 'Day',
                valueFormatter: (v) => String(v),
              },
            ]}
            yAxis={[{ label: 'Net (USD)' }]}
            series={[
              {
                type: 'line',
                dataKey: 'netUsd',
                label: 'Daily net',
                showMark: false,
                area: true,
                valueFormatter: (v) => formatUsd(Math.round((v ?? 0) * 100)),
              },
            ]}
            height={320}
            grid={{ horizontal: true, vertical: true }}
            margin={{ left: 72, right: 16 }}
          />
        ) : (
          <Typography color="text.secondary">No activity data yet.</Typography>
        )}
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        }}
      >
        {(data ?? []).map((a) => (
          <Card key={a.id} variant="outlined">
            <CardActionArea component={RouterLink} to={`/accounts/${a.id}`}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {a.type} · {a.mask}
                </Typography>
                <Typography variant="h6">{a.nickname}</Typography>
                <Typography variant="h5" fontWeight={700} sx={{ mt: 1 }}>
                  {formatUsd(a.balanceCents)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }} color="primary">
                  View activity →
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Stack>
  );
}
