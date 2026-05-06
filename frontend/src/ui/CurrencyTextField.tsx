import { InputGroup, Label } from '@heroui/react';
import type { ComponentPropsWithoutRef } from 'react';

type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'onChange' | 'type' | 'value'>;

type Props = InputProps & {
  label?: React.ReactNode;
  value: string;
  onChangeValue: (rawDollars: string) => void;
};

/** Dollar-prefixed amount; value is a plain decimal string like "12.34". */
export function CurrencyTextField({ label, value, onChangeValue, className, id, ...rest }: Props) {
  const inputId = id ?? 'currency-field';
  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={inputId} className="mb-1.5 inline-block font-medium">
          {label}
        </Label>
      ) : null}
      <InputGroup fullWidth className="gap-0">
        <InputGroup.Prefix className="border-r border-neutral-200 pr-3 pl-3 font-bold text-indigo-700">
          $
        </InputGroup.Prefix>
        <InputGroup.Input
          className="!pl-4"
          id={inputId}
          aria-label={typeof label === 'string' ? label : undefined}
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            let v = e.target.value.replace(/[^0-9.]/g, '');
            const dot = v.indexOf('.');
            if (dot !== -1) {
              v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
            }
            onChangeValue(v);
          }}
          {...rest}
        />
      </InputGroup>
    </div>
  );
}
