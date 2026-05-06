import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { formatUsd } from '../api/client';

const STORAGE_KEY = 'northpeak-hide-balances';

function loadInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

type PrivacyCtx = {
  hideBalances: boolean;
  setHideBalances: (v: boolean) => void;
  toggleHideBalances: () => void;
  formatMoney: (cents: number) => string;
};

const PrivacyContext = createContext<PrivacyCtx | null>(null);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hideBalances, setHideBalancesState] = useState(loadInitial);

  const setHideBalances = useCallback((v: boolean) => {
    setHideBalancesState(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleHideBalances = useCallback(() => {
    setHideBalances(!hideBalances);
  }, [hideBalances, setHideBalances]);

  const formatMoney = useCallback(
    (cents: number) => (hideBalances ? '••••' : formatUsd(cents)),
    [hideBalances],
  );

  const value = useMemo(
    () => ({ hideBalances, setHideBalances, toggleHideBalances, formatMoney }),
    [hideBalances, setHideBalances, toggleHideBalances, formatMoney],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error('usePrivacy requires PrivacyProvider');
  return ctx;
}
