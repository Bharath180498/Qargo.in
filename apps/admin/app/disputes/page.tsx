'use client';

import useSWR from 'swr';
import { NavShell } from '../../components/nav-shell';
import { fetcher } from '../../lib/api';

interface FraudAlerts {
  count: number;
  alerts: Array<{
    tripId: string;
    orderId: string;
    driverId: string;
    driverName: string;
    createdAt: string;
    riskSignals: string[];
    severity: 'HIGH' | 'MEDIUM';
  }>;
}

export default function DisputesPage() {
  const { data, isLoading } = useSWR<FraudAlerts>('/admin/fraud-alerts', fetcher);

  return (
    <NavShell>
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
        <h2 className="font-sora text-2xl text-slate-100">Disputes & Fraud Monitoring</h2>
        <p className="mt-1 font-manrope text-slate-400">
          Real-time risk queue based on waiting-charge anomalies, speed anomalies, and quality score.
        </p>

        {isLoading ? <p className="mt-4 font-manrope text-slate-400">Loading alerts...</p> : null}

        <div className="mt-6 grid gap-4">
          {(data?.alerts ?? []).map((item) => (
            <article
              key={item.tripId}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 md:flex md:items-start md:justify-between"
            >
              <div>
                <p className="font-sora text-lg text-slate-100">Trip {item.tripId.slice(0, 8)}</p>
                <p className="font-manrope text-sm text-slate-300">Order {item.orderId.slice(0, 8)}</p>
                <p className="font-manrope text-sm text-slate-400">Driver: {item.driverName}</p>
                <p className="font-manrope text-xs text-slate-500">{item.riskSignals.join(' • ')}</p>
              </div>
              <span
                className={`mt-3 inline-flex rounded-md px-3 py-1 font-manrope text-xs font-bold md:mt-0 ${
                  item.severity === 'HIGH'
                    ? 'border border-rose-500/40 bg-rose-500/15 text-rose-200'
                    : 'border border-amber-500/40 bg-amber-500/15 text-amber-200'
                }`}
              >
                {item.severity}
              </span>
            </article>
          ))}

          {!isLoading && (data?.alerts?.length ?? 0) === 0 ? (
            <p className="font-manrope text-slate-400">No risk alerts right now.</p>
          ) : null}
        </div>
      </section>
    </NavShell>
  );
}
