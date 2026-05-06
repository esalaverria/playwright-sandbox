import { Alert, Button, Input, Label, TextField } from '@heroui/react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function ProfilePage() {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<{
        user: {
          email: string;
          fullName: string;
          phone: string | null;
          defaultCardLimitCents: number;
        };
      }>(
        '/auth/me',
      );
      return data.user!;
    },
  });

  const patch = useMutation({
    mutationFn: async (payload: { fullName?: string; phone?: string; defaultCardLimitCents?: number }) =>
      api.patch('/me', payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['activity-log'] });
    },
  });

  const pwd = useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) =>
      api.post('/me/password', payload),
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Profile & security</h1>
      <div className="max-w-xl rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900">Contact</h2>
        <form
          className="mt-4 flex max-w-md flex-col gap-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            patch.mutate({
              phone: String(fd.get('phone') ?? ''),
              defaultCardLimitCents: Math.round(Number(fd.get('defaultCardLimit') ?? 5000) * 100),
            });
          }}
        >
          <TextField name="fullName" isRequired defaultValue={me.data?.fullName}>
            <Label className="mb-2">Full name</Label>
            <Input />
          </TextField>
          <TextField name="phone" defaultValue={me.data?.phone ?? ''}>
            <Label className="mb-2">Phone</Label>
            <Input />
          </TextField>
          <div>
            <Label className="mb-2 inline-block font-medium">Email</Label>
            <Input value={me.data?.email ?? ''} readOnly className="mt-0 w-full rounded-xl border px-4 py-2.5 opacity-80" />
          </div>
          <div>
            <Label htmlFor="default-card-limit" className="mb-2 inline-block font-medium">
              New card limit (USD)
            </Label>
            <Input
              id="default-card-limit"
              name="defaultCardLimit"
              type="number"
              min={100}
              step={100}
              defaultValue={((me.data?.defaultCardLimitCents ?? 500000) / 100).toFixed(0)}
              className="mt-0 w-full rounded-xl border px-4 py-2.5"
            />
          </div>
          <Button type="submit" variant="primary" isDisabled={patch.isPending}>
            Save
          </Button>
          {patch.isSuccess ? (
            <Alert.Root status="success" role="alert">
              <Alert.Title>Saved.</Alert.Title>
            </Alert.Root>
          ) : null}
        </form>
      </div>
      <div className="max-w-xl rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900">Change password</h2>
        <form
          className="mt-4 flex max-w-md flex-col gap-4"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            pwd.mutate({
              currentPassword: String(fd.get('currentPassword') ?? ''),
              newPassword: String(fd.get('newPassword') ?? ''),
            });
          }}
        >
          <TextField name="currentPassword" type="password" isRequired>
            <Label className="mb-2">Current password</Label>
            <Input />
          </TextField>
          <TextField name="newPassword" type="password" isRequired minLength={8}>
            <Label className="mb-2">New password (min 8)</Label>
            <Input />
          </TextField>
          <Button type="submit" variant="outline" isDisabled={pwd.isPending}>
            Update password
          </Button>
          {pwd.isSuccess ? (
            <Alert.Root status="success" role="alert">
              <Alert.Title>Password updated.</Alert.Title>
            </Alert.Root>
          ) : null}
        </form>
      </div>
    </div>
  );
}
