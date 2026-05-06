import { Calendar, DateField, DatePicker, Description, Label } from '@heroui/react';
import type { DateValue } from '@internationalized/date';
import { parseDate } from '@internationalized/date';

type Props = {
  label: string;
  'aria-label'?: string;
  valueIso: string;
  /** Emits yyyy-mm-dd or empty string */
  onChangeIso: (iso: string) => void;
};

/** Date-only filter wired to yyyy-mm-dd strings (UTC-calendar semantics for API filters). */
export function UtcIsoDatePicker(props: Props) {
  const { label, valueIso, onChangeIso, 'aria-label': ariaLabel } = props;
  const pickerValue = valueIso ? parseDate(valueIso) : null;

  const handleChange = (next: DateValue | null) => {
    if (!next) {
      onChangeIso('');
      return;
    }
    onChangeIso(next.toString());
  };

  return (
    <DatePicker
      className="w-full min-w-0 gap-2"
      granularity="day"
      value={pickerValue}
      onChange={handleChange}
      aria-label={ariaLabel}
    >
      <Label className="mb-2 block font-medium text-neutral-800">{label}</Label>
      <Description className="-mt-1 mb-0 text-xs font-medium text-neutral-500">
        yyyy-mm-dd (segments show below)
      </Description>
      <DateField.Group
        fullWidth
        variant="secondary"
        className="mt-2 w-full min-w-[210px] rounded-xl border border-neutral-300 bg-white shadow-sm outline-none [&:focus-within]:ring-2 [&:focus-within]:ring-indigo-400/60"
      >
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} className="text-neutral-900" />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger aria-label={`Open calendar: ${ariaLabel ?? label}`}>
            <DatePicker.TriggerIndicator className="text-neutral-600" />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover>
        <Calendar aria-label={`Calendar: ${ariaLabel ?? label}`}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid weekdayStyle="short">
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
