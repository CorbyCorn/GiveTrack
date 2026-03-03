import useSWR from 'swr';
import type { UsageSummary, DailyCostRecord, DailyUsageRecord, CreditBalance } from './types';

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error(`API error: ${r.status}`);
  return r.json();
});

export function useUsageSummary() {
  return useSWR<UsageSummary>('/api/usage/summary', fetcher, {
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    revalidateOnFocus: false,
  });
}

export function useCreditBalance() {
  return useSWR<CreditBalance>('/api/credits', fetcher, {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });
}

export function useDailyCosts(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const query = params.toString();
  const url = `/api/costs${query ? `?${query}` : ''}`;

  return useSWR<DailyCostRecord[]>(url, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useDailyUsage(start?: string, end?: string) {
  const params = new URLSearchParams();
  if (start) params.set('start', start);
  if (end) params.set('end', end);
  const query = params.toString();
  const url = `/api/usage${query ? `?${query}` : ''}`;

  return useSWR<DailyUsageRecord[]>(url, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useSync() {
  return {
    trigger: async () => {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
  };
}
