import { Button, Card } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export function MessagesPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data } = await api.get<{
        messages: { id: string; subject: string; body: string; readAt: string | null; createdAt: string }[];
      }>('/messages');
      return data.messages;
    },
  });

  const read = useMutation({
    mutationFn: async (id: string) => api.patch(`/messages/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['messages-unread'] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Secure messages</h1>
      {(list.data ?? []).map((m) => (
        <Card.Root key={m.id} className={`p-4 shadow-sm ${m.readAt ? 'opacity-70' : ''}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {new Date(m.createdAt).toLocaleString()} {m.readAt ? '· read' : '· unread'}
          </p>
          <h2 className="mt-1 text-lg font-bold text-neutral-900">{m.subject}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{m.body}</p>
          {!m.readAt ? (
            <Button className="mt-3" size="sm" variant="secondary" onPress={() => read.mutate(m.id)}>
              Mark as read
            </Button>
          ) : null}
        </Card.Root>
      ))}
    </div>
  );
}
