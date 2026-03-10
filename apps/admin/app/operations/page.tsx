'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { NavShell } from '../../components/nav-shell';
import { fetcher } from '../../lib/api';

type Scope = 'active' | 'recent' | 'all';

interface OperationsSummary {
  activeBookings: number;
  activeRides: number;
  pendingSupport: number;
  onlineDrivers: number;
  busyDrivers: number;
}

interface BookingRow {
  id: string;
  status: string;
  vehicleType: string;
  goodsDescription: string;
  estimatedPrice: number;
  finalPrice: number | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  trip: {
    id: string;
    status: string;
    driver: {
      id: string;
      user: {
        name: string;
        phone: string;
      };
    };
  } | null;
}

interface RideRow {
  id: string;
  orderId: string;
  status: string;
  etaMinutes: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  driver: {
    id: string;
    user: {
      name: string;
      phone: string;
    };
  };
  order: {
    id: string;
    status: string;
    pickupAddress: string;
    dropAddress: string;
    customer: {
      id: string;
      name: string;
      phone: string;
    };
  };
}

interface OrderDetailResponse {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  goodsDescription: string;
  trip?: {
    id: string;
    status: string;
  } | null;
}

interface TimelineResponse {
  timeline: Array<{
    key: string;
    status: string;
    timestamp: string;
  }>;
}

interface LocationHistoryResponse {
  points: Array<{
    lat: number;
    lng: number;
    timestamp: string;
  }>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function queryPath(base: string, params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const encoded = query.toString();
  return encoded ? `${base}?${encoded}` : base;
}

function statusTone(status: string) {
  const normalized = status.toUpperCase();

  if (normalized.includes('COMPLETE') || normalized.includes('DELIVER')) {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30';
  }

  if (normalized.includes('CANCEL') || normalized.includes('FAILED') || normalized.includes('REJECT')) {
    return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30';
  }

  if (normalized.includes('TRANSIT') || normalized.includes('PROGRESS') || normalized.includes('ACTIVE')) {
    return 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30';
  }

  return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30';
}

export default function OperationsPage() {
  const [bookingScope, setBookingScope] = useState<Scope>('active');
  const [rideScope, setRideScope] = useState<Scope>('active');
  const [selectedOrderId, setSelectedOrderId] = useState<string>();

  const bookingsPath = useMemo(
    () => queryPath('/admin/operations/bookings', { scope: bookingScope, limit: '80' }),
    [bookingScope]
  );
  const ridesPath = useMemo(
    () => queryPath('/admin/operations/rides', { scope: rideScope, limit: '80' }),
    [rideScope]
  );

  const { data: summary } = useSWR<OperationsSummary>('/admin/operations/summary', fetcher, {
    refreshInterval: 5000
  });
  const { data: bookings, isLoading: bookingsLoading } = useSWR<BookingRow[]>(bookingsPath, fetcher, {
    refreshInterval: 5000
  });
  const { data: rides, isLoading: ridesLoading } = useSWR<RideRow[]>(ridesPath, fetcher, {
    refreshInterval: 5000
  });

  const { data: orderDetail } = useSWR<OrderDetailResponse>(
    selectedOrderId ? `/orders/${selectedOrderId}` : null,
    fetcher,
    {
      refreshInterval: 5000
    }
  );
  const { data: orderTimeline } = useSWR<TimelineResponse>(
    selectedOrderId ? `/orders/${selectedOrderId}/timeline` : null,
    fetcher,
    {
      refreshInterval: 5000
    }
  );
  const { data: locationHistory } = useSWR<LocationHistoryResponse>(
    selectedOrderId ? `/orders/${selectedOrderId}/location-history` : null,
    fetcher,
    {
      refreshInterval: 5000
    }
  );

  const cards = [
    {
      label: 'Active Bookings',
      value: summary?.activeBookings ?? '--',
      note: 'Live demand load'
    },
    {
      label: 'Active Rides',
      value: summary?.activeRides ?? '--',
      note: 'Trips in progress'
    },
    {
      label: 'Pending Support',
      value: summary?.pendingSupport ?? '--',
      note: 'Needs triage'
    },
    {
      label: 'Online / Busy Drivers',
      value:
        summary?.onlineDrivers !== undefined && summary?.busyDrivers !== undefined
          ? `${summary.onlineDrivers} / ${summary.busyDrivers}`
          : '--',
      note: 'Availability ratio'
    }
  ];

  return (
    <NavShell>
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article
              key={card.label}
              className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 backdrop-blur"
            >
              <p className="font-manrope text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
              <h2 className="mt-1 font-sora text-3xl text-slate-100">{card.value}</h2>
              <p className="mt-1 font-manrope text-xs text-slate-500">{card.note}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
          <div className="space-y-5">
            <article className="rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                <div>
                  <h3 className="font-sora text-lg text-slate-100">Bookings Feed</h3>
                  <p className="font-manrope text-xs text-slate-400">Auto-refreshing every 5 seconds</p>
                </div>
                <select
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-sm text-slate-200"
                  value={bookingScope}
                  onChange={(event) => setBookingScope(event.target.value as Scope)}
                >
                  <option value="active">Active</option>
                  <option value="recent">Recent 48h</option>
                  <option value="all">All</option>
                </select>
              </header>

              <div className="max-h-[430px] overflow-auto">
                <table className="min-w-full border-collapse text-left font-manrope text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Booking</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Trip</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bookings ?? []).map((booking) => (
                      <tr key={booking.id} className="border-t border-slate-800 text-slate-300">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-100">#{shortId(booking.id)}</p>
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${statusTone(booking.status)}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-100">{booking.customer.name}</p>
                          <p className="text-xs text-slate-400">{booking.customer.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          {booking.trip ? (
                            <>
                              <span
                                className={`inline-flex rounded-md px-2 py-0.5 text-xs ${statusTone(booking.trip.status)}`}
                              >
                                {booking.trip.status}
                              </span>
                              <p className="mt-1 text-xs text-slate-400">{booking.trip.driver.user.name}</p>
                            </>
                          ) : (
                            <p className="text-xs text-slate-500">Not assigned</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{formatDate(booking.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200"
                            onClick={() => setSelectedOrderId(booking.id)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bookingsLoading ? <p className="px-4 py-3 text-sm text-slate-400">Loading bookings...</p> : null}
                {!bookingsLoading && (bookings?.length ?? 0) === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">No bookings found for this filter.</p>
                ) : null}
              </div>
            </article>

            <article className="rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                <div>
                  <h3 className="font-sora text-lg text-slate-100">Rides Feed</h3>
                  <p className="font-manrope text-xs text-slate-400">Active and recent ride execution</p>
                </div>
                <select
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-sm text-slate-200"
                  value={rideScope}
                  onChange={(event) => setRideScope(event.target.value as Scope)}
                >
                  <option value="active">Active</option>
                  <option value="recent">Recent 48h</option>
                  <option value="all">All</option>
                </select>
              </header>

              <div className="max-h-[430px] overflow-auto">
                <table className="min-w-full border-collapse text-left font-manrope text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Ride</th>
                      <th className="px-4 py-3 font-semibold">Driver</th>
                      <th className="px-4 py-3 font-semibold">Booking</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rides ?? []).map((ride) => (
                      <tr key={ride.id} className="border-t border-slate-800 text-slate-300">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-100">#{shortId(ride.id)}</p>
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${statusTone(ride.status)}`}>
                            {ride.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-100">{ride.driver.user.name}</p>
                          <p className="text-xs text-slate-400">{ride.driver.user.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${statusTone(ride.order.status)}`}>
                            {ride.order.status}
                          </span>
                          <p className="mt-1 text-xs text-slate-400">{ride.order.customer.name}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{formatDate(ride.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200"
                            onClick={() => setSelectedOrderId(ride.orderId)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ridesLoading ? <p className="px-4 py-3 text-sm text-slate-400">Loading rides...</p> : null}
                {!ridesLoading && (rides?.length ?? 0) === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">No rides found for this filter.</p>
                ) : null}
              </div>
            </article>
          </div>

          <aside className="h-fit rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur 2xl:sticky 2xl:top-20">
            <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div>
                <h3 className="font-sora text-lg text-slate-100">Live Detail Panel</h3>
                <p className="font-manrope text-xs text-slate-400">Timeline and location history</p>
              </div>
              {selectedOrderId ? (
                <button
                  type="button"
                  className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 font-manrope text-xs font-semibold text-slate-200"
                  onClick={() => setSelectedOrderId(undefined)}
                >
                  Clear
                </button>
              ) : null}
            </header>

            {!selectedOrderId ? (
              <p className="px-4 py-4 font-manrope text-sm text-slate-400">
                Select a booking or ride to inspect order status, timeline, and location ping stream.
              </p>
            ) : (
              <div className="space-y-5 px-4 py-4">
                <section>
                  <p className="font-manrope text-xs uppercase tracking-wide text-slate-500">Booking Snapshot</p>
                  <p className="mt-1 font-sora text-lg text-slate-100">#{shortId(orderDetail?.id ?? selectedOrderId)}</p>
                  <div className="mt-2 space-y-1 font-manrope text-sm text-slate-300">
                    <p>Status: {orderDetail?.status ?? '--'}</p>
                    <p className="text-xs text-slate-400">Pickup: {orderDetail?.pickupAddress ?? '--'}</p>
                    <p className="text-xs text-slate-400">Drop: {orderDetail?.dropAddress ?? '--'}</p>
                    <p className="text-xs text-slate-400">Goods: {orderDetail?.goodsDescription ?? '--'}</p>
                  </div>
                </section>

                <section>
                  <p className="font-manrope text-xs uppercase tracking-wide text-slate-500">Timeline</p>
                  <ul className="mt-2 space-y-2 font-manrope text-sm text-slate-300">
                    {(orderTimeline?.timeline ?? []).map((entry) => (
                      <li key={`${entry.key}-${entry.timestamp}`} className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1.5">
                        <p className="font-semibold text-slate-100">{entry.status}</p>
                        <p className="text-xs text-slate-400">{formatDate(entry.timestamp)}</p>
                      </li>
                    ))}
                    {(orderTimeline?.timeline?.length ?? 0) === 0 ? (
                      <li className="text-sm text-slate-500">No timeline data yet.</li>
                    ) : null}
                  </ul>
                </section>

                <section>
                  <p className="font-manrope text-xs uppercase tracking-wide text-slate-500">Latest Location Pings</p>
                  <ul className="mt-2 max-h-64 space-y-2 overflow-auto font-manrope text-sm text-slate-300">
                    {(locationHistory?.points ?? []).slice(0, 12).map((point, index) => (
                      <li
                        key={`${point.timestamp}-${index}`}
                        className="rounded-md border border-slate-800 bg-slate-950/70 px-2 py-1.5"
                      >
                        <p className="text-slate-100">
                          {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(point.timestamp)}</p>
                      </li>
                    ))}
                    {(locationHistory?.points?.length ?? 0) === 0 ? (
                      <li className="text-sm text-slate-500">No location points yet.</li>
                    ) : null}
                  </ul>
                </section>
              </div>
            )}
          </aside>
        </div>
      </section>
    </NavShell>
  );
}
