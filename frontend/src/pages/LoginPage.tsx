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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate, Link as RouterLink } from 'react-router-dom';
import { api } from '../api/client';

export function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const { data } = await api.get<{ user: { id: string } | null }>('/auth/me');
        return data.user;
      } catch {
        return null;
      }
    },
  });

  const login = useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const { data } = await api.post('/auth/login', payload);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
    },
  });

  if (me) {
    return <Navigate to="/" replace />;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    login.mutate({
      email: String(fd.get('email') ?? ''),
      password: String(fd.get('password') ?? ''),
    });
  }

  return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom fontWeight={700}>
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Demo users share password <strong>Test123!</strong> — try{' '}
          <code>alice@example.com</code> / <code>bob@example.com</code>.
        </Typography>
        {login.isError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {(login.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              'Login failed'}
          </Alert>
        ) : null}
        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField name="email" label="Email" type="email" required fullWidth autoComplete="username" />
            <TextField
              name="password"
              label="Password"
              type="password"
              required
              fullWidth
              autoComplete="current-password"
            />
            <Button type="submit" variant="contained" size="large" disabled={login.isPending}>
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
            <Typography variant="body2">
              No account?{' '}
              <Link component={RouterLink} to="/register">
                Create one
              </Link>
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Container>
  );
}
