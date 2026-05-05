import {
  Card,
  CardActionArea,
  CardContent,
  Stack,
  Typography,
  Box,
} from '@mui/material';
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
  const { data } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: Account[] }>('/accounts');
      return data.accounts;
    },
  });

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
