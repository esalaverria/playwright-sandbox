import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  typography: {
    fontFamily: '"Plus Jakarta Sans", "DM Sans", system-ui, sans-serif',
    h4: { fontWeight: 800 },
    h5: { fontWeight: 800 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  palette: {
    mode: 'light',
    primary: { main: '#6366f1', dark: '#4f46e5', light: '#a5b4fc' },
    secondary: { main: '#ec4899', dark: '#db2777', light: '#f9a8d4' },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    background: {
      default: '#f5f3ff',
      paper: '#ffffff',
    },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
});
