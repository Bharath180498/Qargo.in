'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { NavShell } from '../../components/nav-shell';
import { fetcher, postJson } from '../../lib/api';

interface PendingKyc {
  id: string;
  status: string;
  createdAt: string;
  riskSignals: string[] | null;
  user: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function KycReviewsPage() {
  const { data, isLoading, mutate } = useSWR<PendingKyc[]>('/admin/kyc/pending', fetcher);
  const [busyId, setBusyId] = useState<string>();

  const approve = async (verificationId: string) => {
    setBusyId(verificationId);
    await postJson(`/admin/kyc/${verificationId}/approve`, { adminUserId: 'admin-dashboard' });
    setBusyId(undefined);
    await mutate();
  };

  const reject = async (verificationId: string) => {
    setBusyId(verificationId);
    await postJson(`/admin/kyc/${verificationId}/reject`, {
      adminUserId: 'admin-dashboard',
      reason: 'Documents did not pass manual review'
    });
    setBusyId(undefined);
    await mutate();
  };

  return (
    <NavShell>
      <section className="rounded-3xl border border-orange-200 bg-white p-6 shadow-soft">
        <h2 className="font-sora text-2xl text-brand-accent">KYC Manual Review Queue</h2>
        <p className="mt-1 font-manrope text-slate-600">
          Approve inconclusive checks after manual compliance verification.
        </p>

        {isLoading ? <p className="mt-4 font-manrope text-slate-600">Loading queue...</p> : null}

        <div className="mt-6 grid gap-4">
          {(data ?? []).map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4 md:flex md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <p className="font-sora text-lg text-brand-accent">{entry.user.name}</p>
                <p className="font-manrope text-sm text-slate-600">{entry.user.phone}</p>
                <p className="font-manrope text-xs text-slate-500">
                  Status: {entry.status} • Raised: {new Date(entry.createdAt).toLocaleString()}
                </p>
                {entry.riskSignals?.length ? (
                  <p className="font-manrope text-xs text-amber-700">
                    Signals: {entry.riskSignals.join(', ')}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2 md:mt-0">
                <button
                  className="rounded-full bg-brand-secondary px-5 py-2 font-manrope text-sm font-bold text-white transition hover:opacity-90"
                  onClick={() => void approve(entry.id)}
                  disabled={busyId === entry.id}
                >
                  {busyId === entry.id ? 'Saving...' : 'Approve'}
                </button>
                <button
                  className="rounded-full border border-rose-300 bg-rose-100 px-5 py-2 font-manrope text-sm font-bold text-rose-800 transition hover:bg-rose-200"
                  onClick={() => void reject(entry.id)}
                  disabled={busyId === entry.id}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>

        {!isLoading && (data?.length ?? 0) === 0 ? (
          <p className="mt-4 font-manrope text-slate-600">No pending KYC reviews.</p>
        ) : null}
      </section>
    </NavShell>
  );
}

