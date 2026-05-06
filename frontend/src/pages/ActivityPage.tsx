import { Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api, delay } from '../api/client';

const LABELS: Record<string, string> = {
  ACCOUNT_CREATED: 'Opened an account',
  ACCOUNT_CLOSED: 'Closed an account',
  CARD_REQUESTED: 'Requested a new card',
  CARD_CANCELLED: 'Cancelled a card',
  CARD_LOST_REPORTED: 'Reported card lost',
  CARD_LOST_REPLACED: 'Replaced lost card',
  CARD_FROZEN: 'Froze card',
  CARD_UNFROZEN: 'Unfroze card',
  OVERLIMIT_TOGGLED: 'Updated over-limit setting',
  CARD_DETAILS_VIEWED: 'Viewed full card details',
};

function humanMeta(meta: Record<string, unknown> | null): string {
  if (!meta || Object.keys(meta).length === 0) return '—';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    const label =
      k === 'accountId'
        ? 'Account'
        : k === 'newAccountId'
          ? 'New card'
          : k === 'lostAccountId'
            ? 'Previous card'
            : k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    parts.push(`${label}: ${String(v)}`);
  }
  return parts.join(' · ');
}

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
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          p: { xs: 1.5, sm: 2 },
        }}
      >
        <Table size="small" data-testid={!isFetching && data !== undefined ? 'activity-ready' : undefined}>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ py: 1.5 }}>When</TableCell>
              <TableCell sx={{ py: 1.5 }}>Action</TableCell>
              <TableCell sx={{ py: 1.5 }}>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data ?? []).map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ py: 1.5, verticalAlign: 'top' }}>{new Date(row.createdAt).toLocaleString()}</TableCell>
                <TableCell sx={{ py: 1.5, verticalAlign: 'top' }}>
                  <Chip size="small" label={LABELS[row.action] ?? row.action} color="primary" variant="outlined" />
                </TableCell>
                <TableCell sx={{ py: 1.5, verticalAlign: 'top', fontSize: 13, color: 'text.secondary', maxWidth: 480 }}>
                  {humanMeta(row.meta)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
