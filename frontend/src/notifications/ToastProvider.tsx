import { toast, ToastProvider as HeroToastProvider } from '@heroui/react';
import { createContext, useCallback, useContext, useMemo } from 'react';

export type Severity = 'success' | 'error' | 'info' | 'warning';

type ToastFn = (message: string, severity?: Severity) => void;

const ToastContext = createContext<ToastFn>(() => {});

const TOAST_TIMEOUT_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const pushToast = useCallback((msg: string, sev: Severity = 'success') => {
    const opts = { timeout: TOAST_TIMEOUT_MS };
    if (sev === 'error') {
      toast.danger(msg, opts);
    } else if (sev === 'info') {
      toast.info(msg, opts);
    } else if (sev === 'warning') {
      toast.warning(msg, opts);
    } else {
      toast.success(msg, opts);
    }
  }, []);

  const value = useMemo(() => pushToast, [pushToast]);

  return (
    <>
      <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
      <HeroToastProvider placement="bottom end" className="!z-[160]" />
    </>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
