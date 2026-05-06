import { Alert, Button, Card, Description, Input, Label, TextField } from '@heroui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../notifications/ToastProvider';

export function RegisterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

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
      toast('Passwords do not match', 'warning');
      return;
    }
    reg.mutate({
      email: String(fd.get('email') ?? ''),
      password,
      fullName: String(fd.get('fullName') ?? ''),
      phone: String(fd.get('phone') ?? '') || undefined,
    });
  }

  const errMsgRaw =
    (reg.error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  const errMsg = typeof errMsgRaw === 'string' ? errMsgRaw : Array.isArray(errMsgRaw) ? errMsgRaw[0] : 'Registration failed';

  return (
    <div className="flex min-h-screen justify-center bg-[#f5f3ff] px-4 py-16">
      <Card.Root className="max-w-md flex-1 p-8 shadow-lg">
        <h1 className="text-foreground mb-8 text-balance text-2xl font-extrabold tracking-tight">Create account</h1>

        {reg.isError ? (
          <Alert.Root status="danger" role="alert" className="mb-6">
            <Alert.Title>Error</Alert.Title>
            <Alert.Description>{errMsg}</Alert.Description>
          </Alert.Root>
        ) : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <TextField name="fullName" isRequired autoComplete="name">
            <Label className="mb-2">Full name</Label>
            <Input />
          </TextField>

          <TextField name="email" type="email" isRequired autoComplete="email">
            <Label className="mb-2">Email</Label>
            <Input />
          </TextField>

          <TextField name="phone">
            <Label className="mb-2">Phone (optional)</Label>
            <Input />
          </TextField>

          <TextField name="password" type="password" isRequired autoComplete="new-password">
            <Label className="mb-2">Password (min 8)</Label>
            <Input />
          </TextField>

          <TextField name="confirm" type="password" isRequired autoComplete="new-password">
            <Label className="mb-2">Confirm password</Label>
            <Input />
          </TextField>

          <Button type="submit" size="lg" variant="secondary" fullWidth className="mt-2" isDisabled={reg.isPending}>
            {reg.isPending ? 'Creating…' : 'Register'}
          </Button>

          <Description className="text-center">
            Already have an account?{' '}
            <RouterLink to="/login" className="font-semibold text-indigo-600 underline-offset-4 hover:underline">
              Sign in
            </RouterLink>
          </Description>
        </form>
      </Card.Root>
    </div>
  );
}
