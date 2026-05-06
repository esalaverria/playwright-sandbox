import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../notifications/ToastProvider';

export function PayeesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['payees'],
    queryFn: async () => {
      const { data } = await api.get<{ payees: { id: string; displayName: string; nickname: string | null; externalRef: string }[] }>(
        '/payees',
      );
      return data.payees;
    },
  });

  const create = useMutation({
    mutationFn: async (payload: { displayName: string; nickname?: string; externalRef: string }) =>
      api.post('/payees', payload),
    onSuccess: () => {
      toast('Payee added.');
      qc.invalidateQueries({ queryKey: ['payees'] });
    },
    onError: () => toast('Could not add payee.', 'error'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/payees/${id}`),
    onSuccess: () => {
      toast('Payee removed.');
      qc.invalidateQueries({ queryKey: ['payees'] });
      setDeleteId(null);
    },
    onError: () => toast('Could not remove payee.', 'error'),
  });

  const pendingDelete = (list.data ?? []).find((p) => p.id === deleteId);

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={700}>
        Payees
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Add payee
        </Typography>
        <Stack
          component="form"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            create.mutate({
              displayName: String(fd.get('displayName') ?? ''),
              nickname: String(fd.get('nickname') ?? '') || undefined,
              externalRef: String(fd.get('externalRef') ?? ''),
            });
            e.currentTarget.reset();
          }}
        >
          <TextField name="displayName" label="Display name" required />
          <TextField name="nickname" label="Nickname" />
          <TextField name="externalRef" label="Reference / mask" required />
          <Button type="submit" variant="contained">
            Add
          </Button>
        </Stack>
      </Paper>
      <Paper sx={{ p: { xs: 1, sm: 2 }, borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Nickname</TableCell>
              <TableCell>Ref</TableCell>
              <TableCell width={80} />
            </TableRow>
          </TableHead>
          <TableBody>
            {(list.data ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.displayName}</TableCell>
                <TableCell>{p.nickname ?? '—'}</TableCell>
                <TableCell>{p.externalRef}</TableCell>
                <TableCell>
                  <IconButton aria-label="delete" onClick={() => setDeleteId(p.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={!!pendingDelete} onClose={() => setDeleteId(null)}>
        <DialogTitle>Remove payee?</DialogTitle>
        <DialogContent>
          {pendingDelete ? (
            <Typography>
              Remove <strong>{pendingDelete.displayName}</strong> from your payees? This cannot be undone.
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={remove.isPending}
            onClick={() => {
              if (deleteId) remove.mutate(deleteId);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
