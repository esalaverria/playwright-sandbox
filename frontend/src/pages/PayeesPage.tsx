import { Button, IconButton, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function PayeesPage() {
  const qc = useQueryClient();
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payees'] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/payees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payees'] }),
  });

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
      <Paper>
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
                  <IconButton aria-label="delete" onClick={() => remove.mutate(p.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
