'use client';

import { useState } from 'react';
import { useSync } from '@/lib/hooks';

export default function Header({ title }: { title: string }) {
  const { trigger } = useSync();
  const [syncing, setSyncing] = useState(false);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await trigger();
      // Force SWR revalidation
      window.location.reload();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-navy-700/50 bg-navy-950/50 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        {/* Mobile hamburger */}
        <button className="lg:hidden p-1.5 rounded-md hover:bg-navy-800 text-navy-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h2 className="text-lg font-display font-semibold text-white">{title}</h2>
      </div>

      <button
        onClick={handleRefresh}
        disabled={syncing}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <svg
          className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
        </svg>
        {syncing ? 'Syncing...' : 'Refresh'}
      </button>
    </header>
  );
}
