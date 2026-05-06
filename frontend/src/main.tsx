import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './notifications/ToastProvider';
import { PrivacyProvider } from './privacy/PrivacyProvider';
import { theme } from './theme';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <PrivacyProvider>
            <CssBaseline />
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </PrivacyProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
