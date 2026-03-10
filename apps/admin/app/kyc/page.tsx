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
    await postJson(`/admin/kyc/${verificationId}/approve`, {});
    setBusyId(undefined);
    await mutate();
  };

  const reject = async (verificationId: string) => {
    setBusyId(verificationId);
    await postJson(`/admin/kyc/${verificationId}/reject`, {
      reason: 'Documents did not pass manual review'
    });
    setBusyId(undefined);
    await mutate();
  };

  return (
    <NavShell>
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
        <h2 className="font-sora text-2xl text-slate-100">KYC Manual Review Queue</h2>
        <p className="mt-1 font-manrope text-slate-400">
          Approve inconclusive checks after manual compliance verification.
        </p>

        {isLoading ? <p className="mt-4 font-manrope text-slate-400">Loading queue...</p> : null}

        <div className="mt-6 grid gap-4">
          {(data ?? []).map((entry) => (
            <article
              key={entry.id}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 md:flex md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <p className="font-sora text-lg text-slate-100">{entry.user.name}</p>
                <p className="font-manrope text-sm text-slate-400">{entry.user.phone}</p>
                <p className="font-manrope text-xs text-slate-500">
                  Status: {entry.status} • Raised: {new Date(entry.createdAt).toLocaleString()}
                </p>
                {entry.riskSignals?.length ? (
                  <p className="font-manrope text-xs text-amber-300">
                    Signals: {entry.riskSignals.join(', ')}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 flex gap-2 md:mt-0">
                <button
                  className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 font-manrope text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                  onClick={() => void approve(entry.id)}
                  disabled={busyId === entry.id}
                >
                  {busyId === entry.id ? 'Saving...' : 'Approve'}
                </button>
                <button
                  className="rounded-md border border-rose-500/40 bg-rose-500/15 px-4 py-2 font-manrope text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
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
          <p className="mt-4 font-manrope text-slate-400">No pending KYC reviews.</p>
        ) : null}
      </section>
    </NavShell>
  );
}
