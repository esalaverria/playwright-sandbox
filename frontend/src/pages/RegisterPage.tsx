import {
  Alert,
  Box,
  Button,
  Container,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export function RegisterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const reg = useMutation({
    mutationFn: async (payload: { email: string; password: string; fullName: string; phone?: string }) => {
      const { data } = await api.post('/auth/register', payload);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
    },
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    const confirm = String(fd.get('confirm') ?? '');
    if (password !== confirm) {
      alert('Passwords do not match');
      return;
    }
    reg.mutate({
      email: String(fd.get('email') ?? ''),
      password,
      fullName: String(fd.get('fullName') ?? ''),
      phone: String(fd.get('phone') ?? '') || undefined,
    });
  }

  const errMsg =
    (reg.error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;

  return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom fontWeight={700}>
          Create account
        </Typography>
        {reg.isError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {typeof errMsg === 'string' ? errMsg : 'Registration failed'}
          </Alert>
        ) : null}
        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField name="fullName" label="Full name" required fullWidth />
            <TextField name="email" label="Email" type="email" required fullWidth autoComplete="email" />
            <TextField name="phone" label="Phone (optional)" fullWidth />
            <TextField
              name="password"
              label="Password (min 8)"
              type="password"
              required
              fullWidth
              autoComplete="new-password"
            />
            <TextField
              name="confirm"
              label="Confirm password"
              type="password"
              required
              fullWidth
              autoComplete="new-password"
            />
            <Button type="submit" variant="contained" size="large" disabled={reg.isPending}>
              {reg.isPending ? 'Creating…' : 'Register'}
            </Button>
            <Typography variant="body2">
              Already have an account?{' '}
              <Link component={RouterLink} to="/login">
                Sign in
              </Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
