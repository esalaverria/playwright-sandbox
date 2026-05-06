import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { api, formatUsd } from '../api/client';

export function AccountPage() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

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

  const filterKey = useMemo(() => ({ q, from, to }), [q, from, to]);

  const txs = useQuery({
    queryKey: ['tx', id, page, pageSize, filterKey],
    queryFn: async () => {
      const { data } = await api.get<{
        items: {
          id: string;
          occurredAt: string;
          description: string;
          amountCents: number;
          balanceAfterCents: number;
        }[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(`/accounts/${id}/transactions`, {
        params: {
          page,
          pageSize,
          ...(q.trim() ? { q: q.trim() } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      });
      return data;
    },
    enabled: !!id,
  });

  const total = txs.data?.total ?? 0;

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

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap" alignItems="flex-end">
          <TextField
            label="Search description"
            size="small"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <TextField
            label="From (UTC date)"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            sx={{ width: 160 }}
          />
          <TextField
            label="To (UTC date)"
            type="date"
            size="small"
            InputLabelProps={{ shrink: true }}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            onClick={() => {
              setQ(qDraft);
              setPage(1);
            }}
          >
            Apply filters
          </Button>
          <Button
            variant="text"
            onClick={() => {
              setQ('');
              setQDraft('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        </Stack>
      </Paper>

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
            {(txs.data?.items ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.occurredAt).toLocaleString()}</TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell align="right">{formatUsd(r.amountCents)}</TableCell>
                <TableCell align="right">{formatUsd(r.balanceAfterCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TablePagination
                count={total}
                page={page - 1}
                onPageChange={(_, next) => setPage(next + 1)}
                rowsPerPage={pageSize}
                onRowsPerPageChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                rowsPerPageOptions={[10, 15, 25, 50]}
                colSpan={4}
              />
            </TableRow>
          </TableFooter>
        </Table>
      </Paper>
      <Button component={RouterLink} to="/transfer" variant="text">
        Make a transfer
      </Button>
    </Stack>
  );
}
