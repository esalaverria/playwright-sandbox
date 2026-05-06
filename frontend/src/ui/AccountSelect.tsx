import { AppSelect, type AppSelectOption } from './AppSelect';

export type AccountSelectOption = AppSelectOption;

type Props = {
  label: string;
  'aria-label': string;
  placeholder?: string;
  options: AccountSelectOption[];
  value: string;
  onChange: (id: string) => void;
  fullWidth?: boolean;
  name?: string;
  emptySelectionLabel?: string;
  truncateTrigger?: boolean;
};

export function AccountSelect({ emptySelectionLabel = 'No accounts available', ...props }: Props) {
  return <AppSelect emptySelectionLabel={emptySelectionLabel} {...props} />;
}
