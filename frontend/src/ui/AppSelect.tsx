import { Label, ListBox, Select } from '@heroui/react';

export type AppSelectOption = { id: string; label: string; disabled?: boolean };

type Props = {
  label: string;
  'aria-label': string;
  placeholder?: string;
  options: AppSelectOption[];
  value: string;
  onChange: (id: string) => void;
  fullWidth?: boolean;
  name?: string;
  /** Shown when `options` is empty (e.g. “No accounts available”). */
  emptySelectionLabel?: string;
  /** Ellipsis long account labels in the closed trigger (popover list unchanged). */
  truncateTrigger?: boolean;
};

export function AppSelect({
  label,
  'aria-label': ariaLabel,
  placeholder = 'Select',
  options,
  value,
  onChange,
  fullWidth = true,
  name,
  emptySelectionLabel = 'No options',
  truncateTrigger = false,
}: Props) {
  const disabledKeys = new Set(options.filter((o) => o.disabled).map((o) => o.id));

  return (
    <div className="flex flex-col gap-1">
      <Label className="font-medium text-neutral-900">{label}</Label>
      <Select
        name={name}
        fullWidth={fullWidth}
        placeholder={placeholder}
        aria-label={ariaLabel}
        selectedKey={value || undefined}
        onSelectionChange={(k) => onChange(k == null ? '' : String(k))}
        disabledKeys={disabledKeys}
      >
        <Select.Trigger
          aria-label={ariaLabel}
          className={
            truncateTrigger ? 'flex min-w-0 max-w-full items-center gap-2 [&]:justify-between' : undefined
          }
        >
          <span className={truncateTrigger ? 'min-w-0 flex-1 overflow-hidden text-left' : undefined}>
            <Select.Value className={truncateTrigger ? 'block min-w-0 truncate' : undefined} />
          </span>
          <Select.Indicator className={truncateTrigger ? 'shrink-0' : undefined} />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {options.length === 0 ? (
              <ListBox.Item id="__no-options" textValue={emptySelectionLabel} isDisabled>
                {emptySelectionLabel}
              </ListBox.Item>
            ) : (
              options.map((o) => (
                <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                  {o.label}
                </ListBox.Item>
              ))
            )}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
