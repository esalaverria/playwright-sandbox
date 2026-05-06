import { InputAdornment, TextField, type TextFieldProps } from '@mui/material';

type Props = Omit<TextFieldProps, 'onChange'> & {
  value: string;
  onChangeValue: (rawDollars: string) => void;
};

/** Dollar-prefixed amount; value is a plain decimal string like "12.34". */
export function CurrencyTextField({ value, onChangeValue, InputProps, ...rest }: Props) {
  return (
    <TextField
      {...rest}
      value={value}
      onChange={(e) => {
        let v = e.target.value.replace(/[^0-9.]/g, '');
        const dot = v.indexOf('.');
        if (dot !== -1) {
          v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
        }
        onChangeValue(v);
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start" sx={{ fontWeight: 700, color: 'secondary.dark' }}>
            $
          </InputAdornment>
        ),
        ...InputProps,
      }}
    />
  );
}
