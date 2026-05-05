import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { api, formatUsd } from '../api/client';

export function AccountPage() {
  const { id } = useParams();

  const acc = useQuery({
    queryKey: ['account-meta', id],
    queryFn: async () => {
      const { data } = await api.get<{ accounts: { id: string; nickname: string; mask: string }[] }>(
        '/accounts',
      );
      return data.accounts.find((a) => a.id === id);
    },
    enabled: !!id,
  });

  const txs = useQuery({
    queryKey: ['tx', id],
    queryFn: async () => {
      const { data } = await api.get<{
        items: {
          id: string;
          occurredAt: string;
          description: string;
          amountCents: number;
          balanceAfterCents: number;
        }[];
      }>(`/accounts/${id}/transactions`, { params: { take: 50 } });
      return data.items;
    },
    enabled: !!id,
  });

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h4" fontWeight={700}>
          {acc.data?.nickname ?? 'Account'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {acc.data?.mask}
        </Typography>
      </div>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Balance after</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(txs.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.occurredAt).toLocaleString()}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell align="right">{formatUsd(r.amountCents)}</TableCell>
                <TableCell align="right">{formatUsd(r.balanceAfterCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      <Button component={RouterLink} to="/transfer" variant="text">
        Make a transfer
      </Button>
    </Stack>
  );
}
