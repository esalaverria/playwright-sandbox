import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export function formatUsd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** Small delay so loaders / skeletons are visible (E2E-friendly). */
export function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
