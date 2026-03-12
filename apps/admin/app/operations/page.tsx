'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { NavShell } from '../../components/nav-shell';
import { fetcher } from '../../lib/api';
import { mergeQargoAiContext } from '../../lib/qargo-ai-context';

type Scope = 'active' | 'recent' | 'all';

interface OperationsSummary {
  activeBookings: number;
  activeRides: number;
  pendingSupport: number;
  onlineDrivers: number;
  busyDrivers: number;
}

interface DeliveryProof {
  id: string;
  receiverName: string;
  receiverSignature: unknown;
  photoUrl: string;
  photoFileKey: string;
  photoMimeType: string | null;
  signatureCapturedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
    deliveryProof: DeliveryProof | null;
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
  deliveryProof: DeliveryProof | null;
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
  createdAt: string;
  updatedAt: string;
  pickupAddress: string;
  dropAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  vehicleType: string;
  goodsDescription: string;
  goodsType: string | null;
  goodsValue: number;
  estimatedPrice: number;
  finalPrice: number | null;
  waitingCharge: number;
  ewayBillNumber: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  payment: {
    provider: string;
    status: string;
    amount: number;
    providerRef: string | null;
    updatedAt: string;
  } | null;
  trip?: {
    id: string;
    status: string;
    etaMinutes: number | null;
    pickupTime: string | null;
    loadingStart: string | null;
    loadingEnd: string | null;
    deliveryTime: string | null;
    distanceKm: number | null;
    durationMinutes: number | null;
    waitingCharge: number;
    deliveryProof: DeliveryProof | null;
    rating: {
      driverRating: number | null;
      customerRating: number | null;
      review: string | null;
    } | null;
    driver: {
      id: string;
      vehicleType: string;
      vehicleNumber: string;
      licenseNumber: string;
      user: {
        id: string;
        name: string;
        phone: string;
        rating: number | null;
      };
    } | null;
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

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInr(value: unknown) {
  return `INR ${asNumber(value).toFixed(0)}`;
}

interface SignaturePoint {
  x: number;
  y: number;
}

interface ParsedSignature {
  width: number;
  height: number;
  strokes: SignaturePoint[][];
}

function parseSignature(raw: unknown): ParsedSignature | null {
  const payload = (() => {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    return raw;
  })();

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as { width?: unknown; height?: unknown; strokes?: unknown };
  const width = Number(candidate.width);
  const height = Number(candidate.height);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  if (!Array.isArray(candidate.strokes)) {
    return null;
  }

  const strokes = candidate.strokes
    .map((stroke) => {
      if (!Array.isArray(stroke)) {
        return [] as SignaturePoint[];
      }

      return stroke
        .map((point) => {
          if (!point || typeof point !== 'object') {
            return null;
          }

          const row = point as { x?: unknown; y?: unknown };
          const x = Number(row.x);
          const y = Number(row.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
          }

          return { x, y };
        })
        .filter((point): point is SignaturePoint => point !== null);
    })
    .filter((stroke) => stroke.length >= 2);

  if (strokes.length === 0) {
    return null;
  }

  return { width, height, strokes };
}

function SignaturePreview({ signature }: { signature: unknown }) {
  const parsed = useMemo(() => parseSignature(signature), [signature]);

  if (!parsed) {
    return (
      <p className="rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-500">
        Signature not available
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-800 bg-slate-950/70 p-2">
      <svg viewBox={`0 0 ${parsed.width} ${parsed.height}`} className="h-24 w-full" preserveAspectRatio="none">
        {parsed.strokes.map((stroke, strokeIndex) =>
          stroke.slice(1).map((point, pointIndex) => {
            const previous = stroke[pointIndex];
            return (
              <line
                key={`${strokeIndex}-${pointIndex}`}
                x1={previous.x}
                y1={previous.y}
                x2={point.x}
                y2={point.y}
                stroke="#22d3ee"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

export default function OperationsPage() {
  const [bookingScope, setBookingScope] = useState<Scope>('active');
  const [rideScope, setRideScope] = useState<Scope>('active');
  const [selectedOrderId, setSelectedOrderId] = useState<string>();

  useEffect(() => {
    mergeQargoAiContext({
      pagePath: '/operations',
      orderId: selectedOrderId
    });
  }, [selectedOrderId]);

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

  const selectedDeliveryProof = orderDetail?.trip?.deliveryProof ?? null;

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
                              {booking.trip.deliveryProof ? (
                                <span className="mt-1 inline-flex rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-400/30">
                                  Proof captured
                                </span>
                              ) : null}
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
                          {ride.deliveryProof ? (
                            <span className="mt-1 inline-flex rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-400/30">
                              Proof captured
                            </span>
                          ) : null}
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
                  <div className="mt-2 space-y-1 font-manrope text-xs text-slate-300">
                    <p>
                      Status:{' '}
                      <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${statusTone(orderDetail?.status ?? 'UNKNOWN')}`}>
                        {orderDetail?.status ?? '--'}
                      </span>
                    </p>
                    <p className="text-slate-400">Customer: {orderDetail?.customer?.name ?? '--'}</p>
                    <p className="text-slate-400">Customer Phone: {orderDetail?.customer?.phone ?? '--'}</p>
                    <p className="text-slate-400">Pickup: {orderDetail?.pickupAddress ?? '--'}</p>
                    <p className="text-slate-400">Drop: {orderDetail?.dropAddress ?? '--'}</p>
                    <p className="text-slate-400">
                      Coordinates: {asNumber(orderDetail?.pickupLat).toFixed(5)},{' '}
                      {asNumber(orderDetail?.pickupLng).toFixed(5)} → {asNumber(orderDetail?.dropLat).toFixed(5)},{' '}
                      {asNumber(orderDetail?.dropLng).toFixed(5)}
                    </p>
                    <p className="text-slate-400">Vehicle: {orderDetail?.vehicleType ?? '--'}</p>
                    <p className="text-slate-400">Goods: {orderDetail?.goodsDescription ?? '--'}</p>
                    <p className="text-slate-400">Goods Type: {orderDetail?.goodsType ?? '--'}</p>
                    <p className="text-slate-400">Goods Value: {formatInr(orderDetail?.goodsValue)}</p>
                    <p className="text-slate-400">Estimated Fare: {formatInr(orderDetail?.estimatedPrice)}</p>
                    <p className="text-slate-400">Final Fare: {formatInr(orderDetail?.finalPrice ?? orderDetail?.estimatedPrice)}</p>
                    <p className="text-slate-400">Waiting Charge: {formatInr(orderDetail?.waitingCharge)}</p>
                    <p className="text-slate-400">E-way Bill: {orderDetail?.ewayBillNumber ?? '--'}</p>
                    <p className="text-slate-400">Created: {orderDetail?.createdAt ? formatDate(orderDetail.createdAt) : '--'}</p>
                    <p className="text-slate-400">Updated: {orderDetail?.updatedAt ? formatDate(orderDetail.updatedAt) : '--'}</p>
                  </div>
                  <div className="mt-3 space-y-1 rounded-md border border-slate-800 bg-slate-950/70 p-2 font-manrope text-xs text-slate-300">
                    <p className="font-semibold text-slate-200">Trip Execution</p>
                    <p className="text-slate-400">Trip ID: {orderDetail?.trip?.id ?? '--'}</p>
                    <p className="text-slate-400">Trip Status: {orderDetail?.trip?.status ?? '--'}</p>
                    <p className="text-slate-400">ETA Minutes: {orderDetail?.trip?.etaMinutes ?? '--'}</p>
                    <p className="text-slate-400">
                      Distance / Duration: {orderDetail?.trip?.distanceKm ?? '--'} km / {orderDetail?.trip?.durationMinutes ?? '--'} min
                    </p>
                    <p className="text-slate-400">Driver: {orderDetail?.trip?.driver?.user?.name ?? '--'}</p>
                    <p className="text-slate-400">Driver Phone: {orderDetail?.trip?.driver?.user?.phone ?? '--'}</p>
                    <p className="text-slate-400">Vehicle No: {orderDetail?.trip?.driver?.vehicleNumber ?? '--'}</p>
                    <p className="text-slate-400">License: {orderDetail?.trip?.driver?.licenseNumber ?? '--'}</p>
                    <p className="text-slate-400">
                      Pickup Time: {orderDetail?.trip?.pickupTime ? formatDate(orderDetail.trip.pickupTime) : '--'}
                    </p>
                    <p className="text-slate-400">
                      Loading Start: {orderDetail?.trip?.loadingStart ? formatDate(orderDetail.trip.loadingStart) : '--'}
                    </p>
                    <p className="text-slate-400">
                      Loading End: {orderDetail?.trip?.loadingEnd ? formatDate(orderDetail.trip.loadingEnd) : '--'}
                    </p>
                    <p className="text-slate-400">
                      Delivery Time: {orderDetail?.trip?.deliveryTime ? formatDate(orderDetail.trip.deliveryTime) : '--'}
                    </p>
                  </div>
                  <div className="mt-3 space-y-1 rounded-md border border-slate-800 bg-slate-950/70 p-2 font-manrope text-xs text-slate-300">
                    <p className="font-semibold text-slate-200">Payment Snapshot</p>
                    <p className="text-slate-400">Provider: {orderDetail?.payment?.provider ?? '--'}</p>
                    <p className="text-slate-400">Status: {orderDetail?.payment?.status ?? '--'}</p>
                    <p className="text-slate-400">Amount: {formatInr(orderDetail?.payment?.amount ?? orderDetail?.finalPrice)}</p>
                    <p className="text-slate-400">Provider Ref: {orderDetail?.payment?.providerRef ?? '--'}</p>
                    <p className="text-slate-400">
                      Payment Updated: {orderDetail?.payment?.updatedAt ? formatDate(orderDetail.payment.updatedAt) : '--'}
                    </p>
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
                  <p className="font-manrope text-xs uppercase tracking-wide text-slate-500">Delivery Proof</p>
                  {selectedDeliveryProof ? (
                    <div className="mt-2 space-y-2 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3">
                      <p className="font-manrope text-xs text-emerald-200">
                        Receiver: <span className="font-semibold">{selectedDeliveryProof.receiverName}</span>
                      </p>
                      <p className="font-manrope text-xs text-emerald-200">
                        Captured:{' '}
                        {selectedDeliveryProof.signatureCapturedAt
                          ? formatDate(selectedDeliveryProof.signatureCapturedAt)
                          : formatDate(selectedDeliveryProof.createdAt)}
                      </p>
                      <p className="font-manrope text-xs text-emerald-200">
                        File Key: {selectedDeliveryProof.photoFileKey || '--'}
                      </p>
                      <p className="font-manrope text-xs text-emerald-200">
                        MIME: {selectedDeliveryProof.photoMimeType || '--'}
                      </p>
                      {selectedDeliveryProof.photoUrl ? (
                        <img
                          src={selectedDeliveryProof.photoUrl}
                          alt="Delivery proof"
                          className="h-40 w-full rounded-md border border-emerald-400/30 object-cover"
                        />
                      ) : null}
                      <SignaturePreview signature={selectedDeliveryProof.receiverSignature} />
                    </div>
                  ) : (
                    <p className="mt-2 font-manrope text-sm text-slate-500">No delivery proof captured yet.</p>
                  )}
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
