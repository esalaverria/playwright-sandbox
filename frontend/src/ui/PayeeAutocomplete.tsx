import { ComboBox, Input, Label, ListBox } from '@heroui/react';

export type PayeeRow = {
  id: string;
  displayName: string;
  nickname: string | null;
  externalRef: string;
};

/** One-line menu / list label: `displayName · nickname` or `displayName`. */
export function formatPayeeMenuLabel(p: Pick<PayeeRow, 'displayName' | 'nickname'>): string {
  const n = p.nickname?.trim();
  return n ? `${p.displayName} · ${n}` : p.displayName;
}

/** `textValue` substring filter: display name + nickname. */
function payeeFilterText(p: PayeeRow): string {
  return `${p.displayName} ${p.nickname ?? ''}`;
}

export function resolveBillerApiName(
  payees: PayeeRow[],
  selectedPayeeId: string | null,
  billerInput: string,
): string {
  if (selectedPayeeId) {
    const row = payees.find((x) => x.id === selectedPayeeId);
    if (row) return row.displayName;
  }
  return billerInput.trim();
}

export function findMatchedPayeeForHint(
  payees: PayeeRow[],
  selectedPayeeId: string | null,
  billerInput: string,
): PayeeRow | undefined {
  if (selectedPayeeId) return payees.find((p) => p.id === selectedPayeeId);
  const t = billerInput.trim().toLowerCase();
  if (!t) return undefined;
  return payees.find(
    (p) => p.displayName.toLowerCase() === t || (p.nickname ?? '').toLowerCase() === t,
  );
}

type Props = {
  id: string;
  label: string;
  payees: PayeeRow[];
  selectedPayeeId: string | null;
  billerInput: string;
  onSelectedPayeeIdChange: (id: string | null) => void;
  onBillerInputChange: (value: string) => void;
  /** When set, ComboBox submits this value in forms (`allowsCustomValue` + text). */
  name?: string;
  isRequired?: boolean;
};

const menuClass = 'max-h-[min(280px,50vh)] overflow-y-auto outline-none py-1';
const triggerGroupClass =
  'flex w-full min-h-0 items-stretch overflow-hidden rounded-xl border border-neutral-300 bg-white outline-none transition-shadow focus-within:ring-2 focus-within:ring-indigo-500';

export function PayeeAutocomplete({
  id,
  label,
  payees,
  selectedPayeeId,
  billerInput,
  onSelectedPayeeIdChange,
  onBillerInputChange,
  name,
  isRequired,
}: Props) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="font-medium text-neutral-900">
        {label}
      </Label>
      <ComboBox<PayeeRow>
        allowsCustomValue
        formValue="text"
        name={name}
        menuTrigger="focus"
        fullWidth
        selectedKey={selectedPayeeId ?? null}
        inputValue={billerInput}
        onSelectionChange={(key) => {
          const nextId = key == null ? null : String(key);
          onSelectedPayeeIdChange(nextId);
          const row = nextId ? payees.find((x) => x.id === nextId) : undefined;
          if (row) onBillerInputChange(row.displayName);
        }}
        onInputChange={(val) => {
          onBillerInputChange(val);
          if (!selectedPayeeId) return;
          const sel = payees.find((x) => x.id === selectedPayeeId);
          if (sel && val === sel.displayName) return;
          onSelectedPayeeIdChange(null);
        }}
        items={payees}
        defaultFilter={(textValue, input) =>
          input.trim() === '' ? true : textValue.toLowerCase().includes(input.trim().toLowerCase())
        }
        aria-label={label}
        className="w-full"
      >
        <ComboBox.InputGroup className={triggerGroupClass}>
          <Input
            id={id}
            required={isRequired}
            className="min-w-0 flex-1 rounded-none border-0 bg-transparent px-4 py-2.5 text-neutral-900 shadow-none outline-none focus-visible:ring-0 [&]:focus-visible:border-0"
          />
          <ComboBox.Trigger className="shrink-0 rounded-none border-0 border-l border-neutral-200 bg-transparent px-2 text-neutral-600 shadow-none [&]:min-w-9" aria-label={`${label} open suggestions`}>
            {/* Icon only — HeroUI renders chevron */}
          </ComboBox.Trigger>
        </ComboBox.InputGroup>
        <ComboBox.Popover className="w-[var(--trigger-width)] p-0">
          <ListBox className={menuClass}>
            {(item) => {
              const p = item as PayeeRow;
              return (
                <ListBox.Item id={p.id} textValue={payeeFilterText(p)} className="text-sm text-neutral-900">
                  {formatPayeeMenuLabel(p)}
                </ListBox.Item>
              );
            }}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
    </div>
  );
}
