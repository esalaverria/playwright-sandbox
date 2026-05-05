import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  typography: {
    fontFamily: '"DM Sans", system-ui, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
  palette: {
    mode: 'light',
    primary: { main: '#1e3a5f' },
    secondary: { main: '#c87e4d' },
    background: { default: '#f4f6f9', paper: '#ffffff' },
  },
  shape: { borderRadius: 12 },
});
