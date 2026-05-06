import { Alert, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Severity = 'success' | 'error' | 'info';

type ToastFn = (message: string, severity?: Severity) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<Severity>('success');

  const toast = useCallback((msg: string, sev: Severity = 'success') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={5000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return;
          setOpen(false);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={severity} variant="filled" onClose={() => setOpen(false)} sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
