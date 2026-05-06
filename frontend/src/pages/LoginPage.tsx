import { Alert, Button, Card, Description, Label, Input, TextField } from '@heroui/react';
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

  const errMsg =
    (login.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Login failed';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f3ff] px-4 py-8">
      <Card.Root className="mx-auto w-full max-w-md shrink-0 rounded-2xl p-6 shadow-lg md:p-8">
        <div className="mb-8">
          <h1 className="text-balance text-2xl font-extrabold tracking-tight text-neutral-900">Sign in</h1>
          <Description className="mt-2 text-sm leading-relaxed text-neutral-600">
            Demo users share password <strong className="font-semibold text-neutral-900">Test123!</strong> — try{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs text-neutral-800">alice@example.com</code> /{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs text-neutral-800">bob@example.com</code>.
          </Description>
        </div>

        {login.isError ? (
          <Alert.Root status="danger" role="alert" className="mb-6">
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>{typeof errMsg === 'string' ? errMsg : 'Login failed'}</Alert.Description>
          </Alert.Root>
        ) : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <TextField name="email" type="email" isRequired autoComplete="username">
            <Label className="mb-2">Email</Label>
            <Input />
          </TextField>

          <TextField name="password" type="password" isRequired autoComplete="current-password">
            <Label className="mb-2">Password</Label>
            <Input />
          </TextField>

          <Button type="submit" size="lg" variant="primary" isDisabled={login.isPending} fullWidth className="mt-2">
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="text-center text-sm text-neutral-600">
            No account?{' '}
            <RouterLink to="/register" className="font-semibold text-indigo-600 underline-offset-4 hover:underline">
              Create one
            </RouterLink>
          </p>
        </form>
      </Card.Root>
    </div>
  );
}
