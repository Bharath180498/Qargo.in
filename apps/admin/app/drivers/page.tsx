'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { NavShell } from '../../components/nav-shell';
import { fetcher, postJson } from '../../lib/api';

interface PendingDriver {
  id: string;
  vehicleType: string;
  vehicleNumber: string;
  licenseNumber: string;
  user: {
    name: string;
    phone: string;
  };
}

export default function DriverApprovalsPage() {
  const { data, isLoading, mutate } = useSWR<PendingDriver[]>('/drivers/admin/pending-approvals', fetcher);
  const [busyId, setBusyId] = useState<string>();

  const approve = async (driverId: string) => {
    setBusyId(driverId);
    await postJson(`/drivers/${driverId}/approve`, {});
    setBusyId(undefined);
    await mutate();
  };

  const reject = async (driverId: string) => {
    setBusyId(driverId);
    await postJson(`/drivers/${driverId}/reject`, {});
    setBusyId(undefined);
    await mutate();
  };

  return (
    <NavShell>
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
        <h2 className="font-sora text-2xl text-slate-100">Driver Verification Queue</h2>
        <p className="mt-1 font-manrope text-sm text-slate-400">Approve verified drivers and activate fleet capacity.</p>

        {isLoading ? <p className="mt-4 font-manrope text-slate-400">Loading queue...</p> : null}

        <div className="mt-6 grid gap-4">
          {(data ?? []).map((driver) => (
            <article
              key={driver.id}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 md:flex md:items-center md:justify-between"
            >
              <div className="space-y-1">
                <p className="font-sora text-lg text-slate-100">{driver.user.name}</p>
                <p className="font-manrope text-sm text-slate-400">{driver.user.phone}</p>
                <p className="font-manrope text-sm text-slate-300">
                  {driver.vehicleType} · {driver.vehicleNumber}
                </p>
                <p className="font-manrope text-xs text-slate-500">License: {driver.licenseNumber}</p>
              </div>

              <div className="mt-3 flex gap-2 md:mt-0">
                <button
                  className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 font-manrope text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                  onClick={() => void approve(driver.id)}
                  disabled={busyId === driver.id}
                >
                  {busyId === driver.id ? 'Saving...' : 'Approve'}
                </button>
                <button
                  className="rounded-md border border-rose-500/40 bg-rose-500/15 px-4 py-2 font-manrope text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
                  onClick={() => void reject(driver.id)}
                  disabled={busyId === driver.id}
                >
                  Reject
                </button>
              </div>
            </article>
          ))}

          {!isLoading && (data?.length ?? 0) === 0 ? (
            <p className="font-manrope text-slate-400">No pending approvals right now.</p>
          ) : null}
        </div>
      </section>
    </NavShell>
  );
}
