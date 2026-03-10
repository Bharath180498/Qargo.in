'use client';

import useSWR from 'swr';
import { NavShell } from '../components/nav-shell';
import { DispatchChartWithData } from '../components/dispatch-chart';
import { fetcher } from '../lib/api';

interface OverviewResponse {
  fleet: {
    onlineDrivers: number;
    busyDrivers: number;
    pendingApprovals: number;
  };
  demand: {
    tripsToday: number;
    activeOrders: number;
    completedOrders: number;
  };
  economics: {
    deliveredGrossRevenue: number;
  };
}

interface TripAnalyticsResponse {
  series: Array<{
    day: string;
    assignments: number;
    completed: number;
    completionRate: number;
    avgEtaMinutes: number | null;
  }>;
}

interface HeatmapResponse {
  cells: Array<{
    lat: number;
    lng: number;
    demand: number;
    vehicleMix: Record<string, number>;
  }>;
}

interface ComplianceResponse {
  insuranceCoverageOrders: number;
  ewayBillsGenerated: number;
  scheduledDispatchOrders: number;
  activeTripsMonitored: number;
}

interface DispatchAnalyticsResponse {
  window: string;
  offersCreated: number;
  offersAccepted: number;
  offersRejected: number;
  noOfferDecisions: number;
  acceptanceRate: number;
  avgEtaMinutes: number | null;
}

interface PendingKycResponse {
  id: string;
}

export default function DashboardPage() {
  const { data: overview } = useSWR<OverviewResponse>('/admin/overview', fetcher, {
    refreshInterval: 5000
  });
  const { data: analytics } = useSWR<TripAnalyticsResponse>('/admin/analytics/trips', fetcher, {
    refreshInterval: 5000
  });
  const { data: heatmap } = useSWR<HeatmapResponse>('/admin/analytics/heatmap', fetcher, {
    refreshInterval: 5000
  });
  const { data: compliance } = useSWR<ComplianceResponse>('/admin/compliance', fetcher, {
    refreshInterval: 5000
  });
  const { data: dispatch } = useSWR<DispatchAnalyticsResponse>('/admin/analytics/dispatch', fetcher, {
    refreshInterval: 5000
  });
  const { data: pendingKyc } = useSWR<PendingKycResponse[]>('/admin/kyc/pending', fetcher, {
    refreshInterval: 5000
  });

  const kpis = [
    {
      label: 'Online Drivers',
      value: overview?.fleet.onlineDrivers ?? '--',
      sub: `${overview?.fleet.busyDrivers ?? 0} busy`
    },
    {
      label: 'Trips Today',
      value: overview?.demand.tripsToday ?? '--',
      sub: `${overview?.demand.completedOrders ?? 0} completed`
    },
    {
      label: 'Active Orders',
      value: overview?.demand.activeOrders ?? '--',
      sub: `${overview?.fleet.pendingApprovals ?? 0} pending approvals`
    },
    {
      label: 'Delivered Revenue',
      value:
        overview?.economics.deliveredGrossRevenue !== undefined
          ? `INR ${overview.economics.deliveredGrossRevenue.toFixed(0)}`
          : '--',
      sub: 'Delivered trips only'
    }
  ];

  const labels = analytics?.series.map((entry) => entry.day.slice(5)) ?? [];
  const values = analytics?.series.map((entry) => entry.avgEtaMinutes ?? 0) ?? [];

  const complianceRows = [
    ['Insured Orders', compliance?.insuranceCoverageOrders ?? '--'],
    ['E-Way Bills Generated', compliance?.ewayBillsGenerated ?? '--'],
    ['Scheduled Orders', compliance?.scheduledDispatchOrders ?? '--'],
    ['Active Trips Monitored', compliance?.activeTripsMonitored ?? '--']
  ];

  const dispatchRows = [
    ['Offers Created', dispatch?.offersCreated ?? '--'],
    ['Offers Accepted', dispatch?.offersAccepted ?? '--'],
    ['Offers Rejected', dispatch?.offersRejected ?? '--'],
    ['No Offer Decisions', dispatch?.noOfferDecisions ?? '--'],
    ['Offer Acceptance Rate', dispatch ? `${(dispatch.acceptanceRate * 100).toFixed(1)}%` : '--'],
    [
      'Avg Route ETA',
      dispatch?.avgEtaMinutes !== null && dispatch?.avgEtaMinutes !== undefined ? `${dispatch.avgEtaMinutes} min` : '--'
    ],
    ['KYC Pending Review', pendingKyc?.length ?? '--']
  ];

  return (
    <NavShell>
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => (
            <article
              key={kpi.label}
              className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 backdrop-blur"
            >
              <p className="font-manrope text-xs uppercase tracking-wide text-slate-400">{kpi.label}</p>
              <h2 className="mt-1 font-sora text-3xl text-slate-100">{kpi.value}</h2>
              <p className="mt-1 font-manrope text-xs text-slate-500">{kpi.sub}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <DispatchChartWithData labels={labels} values={values} />

          <aside className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur">
            <h3 className="font-sora text-lg text-slate-100">Demand Heat Cells</h3>
            <p className="mt-1 font-manrope text-xs text-slate-400">Top demand coordinates and vehicle mix</p>
            <div className="mt-3 max-h-[320px] overflow-auto">
              <table className="min-w-full text-left font-manrope text-sm">
                <thead className="text-slate-400">
                  <tr>
                    <th className="py-2 font-semibold">Cell</th>
                    <th className="py-2 font-semibold">Demand</th>
                    <th className="py-2 font-semibold">Mix</th>
                  </tr>
                </thead>
                <tbody>
                  {(heatmap?.cells ?? []).slice(0, 12).map((cell) => (
                    <tr key={`${cell.lat}-${cell.lng}`} className="border-t border-slate-800 text-slate-300">
                      <td className="py-2 text-xs text-slate-300">
                        {cell.lat.toFixed(3)}, {cell.lng.toFixed(3)}
                      </td>
                      <td className="py-2">{cell.demand}</td>
                      <td className="py-2 text-xs text-slate-400">
                        {Object.entries(cell.vehicleMix)
                          .map(([type, count]) => `${type}:${count}`)
                          .join(' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(heatmap?.cells?.length ?? 0) === 0 ? (
                <p className="py-3 font-manrope text-sm text-slate-500">No demand data yet.</p>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur">
            <h3 className="font-sora text-lg text-slate-100">Compliance Snapshot</h3>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-left font-manrope text-sm">
                <tbody>
                  {complianceRows.map(([label, value]) => (
                    <tr key={label} className="border-t border-slate-800">
                      <td className="py-2 text-slate-400">{label}</td>
                      <td className="py-2 text-right font-semibold text-slate-100">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur">
            <h3 className="font-sora text-lg text-slate-100">Dispatch Health</h3>
            <div className="mt-3 overflow-auto">
              <table className="min-w-full text-left font-manrope text-sm">
                <tbody>
                  {dispatchRows.map(([label, value]) => (
                    <tr key={label} className="border-t border-slate-800">
                      <td className="py-2 text-slate-400">{label}</td>
                      <td className="py-2 text-right font-semibold text-slate-100">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </NavShell>
  );
}
