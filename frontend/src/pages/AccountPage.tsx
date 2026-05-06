import {
  Button,
  Paper,
  Skeleton,
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
import { api, delay, formatUsd } from '../api/client';
import { usePrivacy } from '../privacy/PrivacyProvider';

export function AccountPage() {
  const { id } = useParams();
  const { formatMoney } = usePrivacy();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [q, setQ] = useState('');
  const [qDraft, setQDraft] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const acc = useQuery({
    queryKey: ['account-meta', id],
    queryFn: async () => {
      await delay(300 + Math.floor(Math.random() * 250));
      const { data } = await api.get<{
        accounts: {
          id: string;
          nickname: string;
          mask: string;
          type: string;
          balanceCents: number;
        }[];
      }>('/accounts');
      return data.accounts.find((a) => a.id === id);
    },
    enabled: !!id,
  });

  const filterKey = useMemo(() => ({ q, from, to }), [q, from, to]);

  const txs = useQuery({
    queryKey: ['tx', id, page, pageSize, filterKey],
    queryFn: async () => {
      await delay(400 + Math.floor(Math.random() * 350));
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
  const loading = txs.isFetching || acc.isFetching;
  const ready = !loading && txs.data !== undefined && acc.data !== undefined;

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h4" fontWeight={800}>
          {acc.data?.nickname ?? (acc.isFetching ? <Skeleton width={180} /> : 'Account')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {acc.data?.mask}
        </Typography>
        {acc.data ? (
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Balance: {formatMoney(acc.data.balanceCents)}
          </Typography>
        ) : null}
      </div>

      <Paper sx={{ p: 2, borderRadius: 3 }}>
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

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Table size="small" data-testid={ready ? 'transactions-ready' : undefined} aria-busy={loading}>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell align="right">Balance after</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton variant="rounded" height={36} animation="wave" />
                    </TableCell>
                  </TableRow>
                ))
              : (txs.data?.items ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{new Date(r.occurredAt).toLocaleString()}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell align="right">{formatUsd(r.amountCents)}</TableCell>
                    <TableCell align="right">{formatMoney(r.balanceAfterCents)}</TableCell>
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
