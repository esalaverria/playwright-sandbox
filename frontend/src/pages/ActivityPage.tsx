import { Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api, delay } from '../api/client';

const LABELS: Record<string, string> = {
  ACCOUNT_CREATED: 'Opened an account',
  ACCOUNT_CLOSED: 'Closed an account',
  CARD_REQUESTED: 'Requested a new card',
  CARD_CANCELLED: 'Cancelled a card',
  CARD_LOST_REPORTED: 'Reported card lost',
  CARD_FROZEN: 'Froze card',
  CARD_UNFROZEN: 'Unfroze card',
  OVERLIMIT_TOGGLED: 'Updated over-limit setting',
  CARD_DETAILS_VIEWED: 'Viewed full card details',
};

export function ActivityPage() {
  const { data, isFetching } = useQuery({
    queryKey: ['activity-log'],
    queryFn: async () => {
      await delay(280 + Math.floor(Math.random() * 220));
      const { data } = await api.get<{
        activities: { id: string; action: string; meta: Record<string, unknown> | null; createdAt: string }[];
      }>('/accounts/activity-log');
      return data.activities;
    },
  });

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h4" fontWeight={800}>
          Account activity
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Security and banking actions on your profile (not transaction ledger).
        </Typography>
      </div>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Table size="small" data-testid={!isFetching && data !== undefined ? 'activity-ready' : undefined}>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip size="small" label={LABELS[row.action] ?? row.action} color="primary" variant="outlined" />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {row.meta ? JSON.stringify(row.meta) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
