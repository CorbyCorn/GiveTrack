'use client';

import { useState, useEffect, FormEvent } from 'react';
import Header from '@/components/layout/header';
import { useSync } from '@/lib/hooks';
import { formatDate } from '@/lib/format';
import type { AlertThreshold } from '@/lib/types';

interface SettingsData {
  apiKey: string;
  orgId: string;
  lastSync: string | null;
  thresholds: AlertThreshold[];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const { trigger } = useSync();

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  // Alert thresholds
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setThresholds(data.thresholds || []);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await trigger();
      setSyncResult(`Synced ${result.synced.costDays} days of cost data, ${result.synced.usageDays} days of usage data.`);
      fetchSettings();
    } catch {
      setSyncResult('Sync failed. Check your API key and try again.');
    } finally {
      setSyncing(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordMsg('');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setPasswordMsg(data.message);
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setPasswordMsg(data.error);
      }
    } catch {
      setPasswordMsg('Request failed.');
    }
  }

  function addThreshold() {
    const newThreshold: AlertThreshold = {
      id: Date.now().toString(),
      metric: 'daily_spend',
      operator: 'gt',
      value: 1000,
      enabled: true,
    };
    setThresholds([...thresholds, newThreshold]);
  }

  function updateThreshold(id: string, updates: Partial<AlertThreshold>) {
    setThresholds((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }

  function removeThreshold(id: string) {
    setThresholds((prev) => prev.filter((t) => t.id !== id));
  }

  async function saveThresholds() {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thresholds }),
      });
    } catch (error) {
      console.error('Failed to save thresholds:', error);
    }
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <Header title="Settings" />
        <div className="p-6 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 w-32 bg-navy-700 rounded mb-4" />
              <div className="h-10 bg-navy-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Header title="Settings" />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* API Configuration */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">API Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-navy-400 mb-1">OpenAI Admin API Key</label>
              <div className="flex items-center gap-3">
                <code className="flex-1 px-3 py-2 bg-navy-800 rounded-lg text-sm font-mono text-navy-200 border border-navy-700">
                  {settings?.apiKey || 'Not configured'}
                </code>
              </div>
              <p className="text-[10px] text-navy-500 mt-1">Set via OPENAI_ADMIN_KEY environment variable</p>
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Organization ID</label>
              <code className="block px-3 py-2 bg-navy-800 rounded-lg text-sm font-mono text-navy-200 border border-navy-700">
                {settings?.orgId || 'Not configured'}
              </code>
            </div>
          </div>
        </div>

        {/* Data Sync */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Data Sync</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-navy-200">Last synced</p>
                <p className="text-xs text-navy-400">
                  {settings?.lastSync ? formatDate(settings.lastSync) : 'Never'}
                </p>
              </div>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="btn-primary flex items-center gap-2"
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
                {syncing ? 'Syncing...' : 'Manual Sync'}
              </button>
            </div>
            {syncResult && (
              <div className={`text-sm px-3 py-2 rounded-lg ${
                syncResult.includes('failed')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-green-500/10 text-green-400 border border-green-500/20'
              }`}>
                {syncResult}
              </div>
            )}
            <p className="text-[10px] text-navy-500">
              Data is automatically synced daily at 2:00 AM UTC via Vercel cron.
            </p>
          </div>
        </div>

        {/* Password Change */}
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Change Password</h3>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field text-sm"
                minLength={6}
                required
              />
            </div>
            {passwordMsg && (
              <div className={`text-sm px-3 py-2 rounded-lg ${
                passwordMsg.includes('incorrect') || passwordMsg.includes('failed')
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              }`}>
                {passwordMsg}
              </div>
            )}
            <button type="submit" className="btn-primary text-sm">Update Password</button>
          </form>
        </div>

        {/* Alert Thresholds */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Alert Thresholds</h3>
            <button onClick={addThreshold} className="btn-secondary text-xs py-1.5">
              + Add Threshold
            </button>
          </div>

          {thresholds.length === 0 ? (
            <p className="text-sm text-navy-400">No alert thresholds configured.</p>
          ) : (
            <div className="space-y-3">
              {thresholds.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3 bg-navy-800/50 rounded-lg">
                  <select
                    value={t.metric}
                    onChange={(e) => updateThreshold(t.id, { metric: e.target.value as AlertThreshold['metric'] })}
                    className="input-field text-xs py-1.5 w-36"
                  >
                    <option value="daily_spend">Daily Spend</option>
                    <option value="weekly_spend">Weekly Spend</option>
                    <option value="monthly_spend">Monthly Spend</option>
                    <option value="remaining_pct">Remaining %</option>
                  </select>
                  <select
                    value={t.operator}
                    onChange={(e) => updateThreshold(t.id, { operator: e.target.value as 'gt' | 'lt' })}
                    className="input-field text-xs py-1.5 w-20"
                  >
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                  </select>
                  <input
                    type="number"
                    value={t.value}
                    onChange={(e) => updateThreshold(t.id, { value: Number(e.target.value) })}
                    className="input-field text-xs py-1.5 w-28 font-mono"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-navy-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={t.enabled}
                      onChange={(e) => updateThreshold(t.id, { enabled: e.target.checked })}
                      className="rounded border-navy-600"
                    />
                    On
                  </label>
                  <button
                    onClick={() => removeThreshold(t.id)}
                    className="text-navy-500 hover:text-red-400 transition-colors ml-auto"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              ))}
              <button onClick={saveThresholds} className="btn-primary text-sm mt-2">
                Save Thresholds
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
