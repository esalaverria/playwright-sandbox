import { Button, Input, Label, Modal, useOverlayState } from '@heroui/react';
import { Trash2 } from 'lucide-react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../notifications/ToastProvider';

export function PayeesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [editRef, setEditRef] = useState('');

  const deleteModal = useOverlayState({
    isOpen: deleteId !== null,
    onOpenChange: (open: boolean) => {
      if (!open) setDeleteId(null);
    },
  });
  const editModal = useOverlayState({
    isOpen: editId !== null,
    onOpenChange: (open: boolean) => {
      if (!open) setEditId(null);
    },
  });

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
  const update = useMutation({
    mutationFn: async (payload: { id: string; nickname: string; externalRef: string }) =>
      api.patch(`/payees/${payload.id}`, {
        nickname: payload.nickname,
        externalRef: payload.externalRef,
      }),
    onSuccess: () => {
      toast('Payee updated.');
      qc.invalidateQueries({ queryKey: ['payees'] });
      setEditId(null);
    },
    onError: () => toast('Could not update payee.', 'error'),
  });

  const pendingDelete = (list.data ?? []).find((p) => p.id === deleteId);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Payees</h1>

      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-3 text-lg font-bold text-neutral-900">Add payee</h2>
        <form
          className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
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
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="payee-display" className="font-medium">
              Display name
            </Label>
            <Input
              id="payee-display"
              name="displayName"
              required
              className="mt-2 w-full rounded-xl border px-4 py-2.5 outline-none"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Label htmlFor="payee-nick" className="font-medium">
              Nickname
            </Label>
            <Input id="payee-nick" name="nickname" className="mt-2 w-full rounded-xl border px-4 py-2.5 outline-none" />
          </div>
          <div className="min-w-[160px] flex-1">
            <Label htmlFor="payee-ref" className="font-medium">
              Reference / mask
            </Label>
            <Input
              id="payee-ref"
              name="externalRef"
              required
              className="mt-2 w-full rounded-xl border px-4 py-2.5 outline-none"
            />
          </div>
          <Button type="submit" variant="primary">
            Add
          </Button>
        </form>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-2 shadow-sm sm:p-4">
        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-3 py-3 text-left font-semibold text-neutral-700">Name</th>
                <th className="px-3 py-3 text-left font-semibold text-neutral-700">Nickname</th>
                <th className="px-3 py-3 text-left font-semibold text-neutral-700">Ref</th>
                <th className="w-16 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(list.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-3 font-medium text-neutral-900">{p.displayName}</td>
                  <td className="px-3 py-3 text-neutral-800">{p.nickname ?? '—'}</td>
                  <td className="px-3 py-3 font-mono text-xs text-neutral-800">{p.externalRef}</td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${p.displayName}`}
                        onPress={() => {
                          setEditId(p.id);
                          setEditNickname(p.nickname ?? '');
                          setEditRef(p.externalRef);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        isIconOnly
                        variant="ghost"
                        aria-label={`Delete ${p.displayName}`}
                        onPress={() => setDeleteId(p.id)}
                      >
                        <Trash2 className="size-5 text-neutral-600" aria-hidden strokeWidth={2} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal state={deleteModal}>
        <Modal.Backdrop>
          <Modal.Container size="sm" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Close dialog" />
              <Modal.Header>
                <Modal.Heading>Remove payee?</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                {pendingDelete ? (
                  <p className="text-sm text-neutral-700">
                    Remove <strong>{pendingDelete.displayName}</strong> from your payees? This cannot be undone.
                  </p>
                ) : null}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" onPress={() => deleteModal.close()}>
                  Cancel
                </Button>
                <Button variant="danger" isDisabled={remove.isPending} onPress={() => deleteId && remove.mutate(deleteId)}>
                  Delete
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Modal state={editModal}>
        <Modal.Backdrop>
          <Modal.Container size="sm" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger aria-label="Close dialog" />
              <Modal.Header>
                <Modal.Heading>Edit payee</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="edit-payee-nick">Nickname</Label>
                  <Input
                    id="edit-payee-nick"
                    value={editNickname}
                    onChange={(e) => setEditNickname(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-4 py-2.5 outline-none"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-payee-ref">Reference / mask</Label>
                  <Input
                    id="edit-payee-ref"
                    value={editRef}
                    onChange={(e) => setEditRef(e.target.value)}
                    className="mt-2 w-full rounded-xl border px-4 py-2.5 outline-none"
                  />
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button variant="ghost" onPress={() => editModal.close()}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  isDisabled={update.isPending || !editId || !editRef.trim()}
                  onPress={() => {
                    if (!editId) return;
                    update.mutate({
                      id: editId,
                      nickname: editNickname,
                      externalRef: editRef,
                    });
                  }}
                >
                  Save
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
