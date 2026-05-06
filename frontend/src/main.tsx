import './index.css';
import { I18nProvider } from '@heroui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './notifications/ToastProvider';
import { PrivacyProvider } from './privacy/PrivacyProvider';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider locale="en-US">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <PrivacyProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </PrivacyProvider>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
);
