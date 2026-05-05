import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function ProfilePage() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<{ user: { email: string; fullName: string; phone: string | null } }>(
        '/auth/me',
      );
      return data.user!;
    },
  });

  const patch = useMutation({
    mutationFn: async (payload: { fullName?: string; phone?: string }) => api.patch('/me', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  const pwd = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) =>
      api.post('/me/password', payload),
  });

  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={700}>
        Profile & security
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Contact
        </Typography>
        <Box component="form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            patch.mutate({
              fullName: String(fd.get('fullName') ?? ''),
              phone: String(fd.get('phone') ?? ''),
            });
          }}
        >
          <Stack spacing={2} maxWidth={480}>
            <TextField name="fullName" label="Full name" required defaultValue={me.data?.fullName} />
            <TextField name="phone" label="Phone" defaultValue={me.data?.phone ?? ''} />
            <TextField label="Email" value={me.data?.email ?? ''} disabled fullWidth />
            <Button type="submit" variant="contained" disabled={patch.isPending}>
              Save
            </Button>
            {patch.isSuccess ? <Alert severity="success">Saved.</Alert> : null}
          </Stack>
        </Box>
      </Paper>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Change password
        </Typography>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            pwd.mutate({
              currentPassword: String(fd.get('currentPassword') ?? ''),
              newPassword: String(fd.get('newPassword') ?? ''),
            });
          }}
        >
          <Stack spacing={2} maxWidth={480}>
            <TextField name="currentPassword" type="password" label="Current password" required />
            <TextField name="newPassword" type="password" label="New password (min 8)" required />
            <Button type="submit" variant="outlined" disabled={pwd.isPending}>
              Update password
            </Button>
            {pwd.isSuccess ? <Alert severity="success">Password updated.</Alert> : null}
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}
