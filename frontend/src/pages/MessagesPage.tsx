import { Button, Paper, Stack, Typography } from '@mui/material';
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
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        Secure messages
      </Typography>
      {(list.data ?? []).map((m) => (
        <Paper key={m.id} sx={{ p: 2, opacity: m.readAt ? 0.7 : 1 }}>
          <Typography variant="overline" color="text.secondary">
            {new Date(m.createdAt).toLocaleString()} {m.readAt ? '· read' : '· unread'}
          </Typography>
          <Typography variant="h6">{m.subject}</Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {m.body}
          </Typography>
          {!m.readAt ? (
            <Button sx={{ mt: 1 }} size="small" onClick={() => read.mutate(m.id)}>
              Mark as read
            </Button>
          ) : null}
        </Paper>
      ))}
    </Stack>
  );
}
