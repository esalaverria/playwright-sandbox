import { toast, ToastProvider as HeroToastProvider } from '@heroui/react';
import { createContext, useCallback, useContext, useMemo } from 'react';

export type Severity = 'success' | 'error' | 'info' | 'warning';

type ToastFn = (message: string, severity?: Severity) => void;

const ToastContext = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const pushToast = useCallback((msg: string, sev: Severity = 'success') => {
    if (sev === 'error') {
      toast.danger(msg);
    } else if (sev === 'info') {
      toast.info(msg);
    } else if (sev === 'warning') {
      toast.warning(msg);
    } else {
      toast.success(msg);
    }
  }, []);

  const value = useMemo(() => pushToast, [pushToast]);

  return (
    <>
      <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
      <HeroToastProvider placement="top end" />
    </>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
