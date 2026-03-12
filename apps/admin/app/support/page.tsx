'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { NavShell } from '../../components/nav-shell';
import { fetcher, postJson } from '../../lib/api';

type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED';
type UserRole = 'CUSTOMER' | 'DRIVER' | 'ADMIN';

interface TicketListRow {
  id: string;
  subject: string;
  status: SupportTicketStatus;
  requesterRole: UserRole;
  orderId?: string | null;
  tripId?: string | null;
  updatedAt: string;
  requesterUser: {
    id: string;
    name: string;
    phone: string;
  };
  messages: Array<{
    id: string;
    message: string;
    translatedEnglish?: string | null;
    createdAt: string;
  }>;
}

interface TicketDetail {
  id: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  descriptionSourceLanguage?: string | null;
  descriptionTranslatedEnglish?: string | null;
  descriptionTranslationProvider?: string | null;
  requesterRole: UserRole;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  order?: {
    id: string;
    status: string;
  } | null;
  trip?: {
    id: string;
    status: string;
  } | null;
  requesterUser: {
    id: string;
    name: string;
    phone: string;
  };
  messages: Array<{
    id: string;
    message: string;
    senderType: 'USER' | 'ADMIN' | 'SYSTEM';
    sourceLanguage?: string | null;
    translatedEnglish?: string | null;
    translationProvider?: string | null;
    createdAt: string;
    attachments?: Array<{
      id: string;
      fileUrl: string;
      fileName?: string | null;
      contentType?: string | null;
      fileSizeBytes?: number | null;
    }>;
    senderUser?: {
      id: string;
      name: string;
      phone: string;
      role: UserRole;
    } | null;
  }>;
}

function hasDifferentTranslation(original: string, translated?: string | null) {
  if (!translated) {
    return false;
  }
  return original.trim().toLowerCase() !== translated.trim().toLowerCase();
}

const STATUS_OPTIONS: Array<{ label: string; value: SupportTicketStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Waiting User', value: 'WAITING_FOR_USER' },
  { label: 'Resolved', value: 'RESOLVED' }
];

const ROLE_OPTIONS: Array<{ label: string; value: UserRole | 'ALL' }> = [
  { label: 'All Roles', value: 'ALL' },
  { label: 'Customers', value: 'CUSTOMER' },
  { label: 'Drivers', value: 'DRIVER' }
];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function shortId(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function statusTone(status: SupportTicketStatus) {
  if (status === 'RESOLVED') {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30';
  }

  if (status === 'IN_PROGRESS') {
    return 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30';
  }

  if (status === 'WAITING_FOR_USER') {
    return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30';
  }

  return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30';
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

export default function SupportInboxPage() {
  const [statusFilter, setStatusFilter] = useState<SupportTicketStatus | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string>();
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  const listPath = useMemo(
    () =>
      queryPath('/admin/support/tickets', {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        requesterRole: roleFilter === 'ALL' ? undefined : roleFilter,
        search: search.trim() || undefined,
        limit: '120'
      }),
    [roleFilter, search, statusFilter]
  );

  const {
    data: tickets,
    isLoading: listLoading,
    mutate: mutateTickets
  } = useSWR<TicketListRow[]>(listPath, fetcher, {
    refreshInterval: 5000
  });

  useEffect(() => {
    if (!selectedTicketId && tickets?.length) {
      setSelectedTicketId(tickets[0].id);
    }

    if (selectedTicketId && tickets && !tickets.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(tickets[0]?.id);
    }
  }, [selectedTicketId, tickets]);

  const {
    data: selectedTicket,
    isLoading: detailLoading,
    mutate: mutateSelected
  } = useSWR<TicketDetail>(
    selectedTicketId ? `/admin/support/tickets/${selectedTicketId}` : null,
    fetcher,
    {
      refreshInterval: 5000
    }
  );

  const sendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) {
      return;
    }

    setBusy(true);
    try {
      await postJson(`/admin/support/tickets/${selectedTicketId}/reply`, {
        message: replyText.trim()
      });
      setReplyText('');
      await Promise.all([mutateTickets(), mutateSelected()]);
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (nextStatus: SupportTicketStatus) => {
    if (!selectedTicketId) {
      return;
    }

    setBusy(true);
    try {
      await postJson(`/admin/support/tickets/${selectedTicketId}/status`, {
        status: nextStatus
      });
      await Promise.all([mutateTickets(), mutateSelected()]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <NavShell>
      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-[calc(100vh-170px)] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur">
          <div className="border-b border-slate-800 px-4 py-4">
            <h2 className="font-sora text-xl text-slate-100">Support Queue</h2>
            <p className="mt-1 font-manrope text-xs text-slate-400">Customer and driver support tickets</p>

            <div className="mt-3 grid gap-2">
              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-sm text-slate-200"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as SupportTicketStatus | 'ALL')}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-sm text-slate-200"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as UserRole | 'ALL')}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-sm text-slate-200"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search"
                />
                <button
                  type="button"
                  className="rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-3 py-2 font-manrope text-sm font-semibold text-cyan-200"
                  onClick={() => setSearch(searchInput)}
                >
                  Go
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {(tickets ?? []).map((ticket) => {
              const active = ticket.id === selectedTicketId;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  className={`w-full border-b border-slate-800 px-4 py-3 text-left transition ${
                    active ? 'bg-slate-800/90' : 'bg-transparent hover:bg-slate-800/60'
                  }`}
                  onClick={() => setSelectedTicketId(ticket.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-manrope text-xs uppercase tracking-wide text-slate-500">{ticket.requesterRole}</p>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] ${statusTone(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-sora text-sm text-slate-100">{ticket.subject}</p>
                  <p className="mt-1 truncate font-manrope text-xs text-slate-400">{ticket.requesterUser.name}</p>
                  <p className="mt-1 font-manrope text-[11px] text-slate-500">{formatDate(ticket.updatedAt)}</p>
                </button>
              );
            })}

            {listLoading ? <p className="px-4 py-4 font-manrope text-sm text-slate-400">Loading tickets...</p> : null}
            {!listLoading && (tickets?.length ?? 0) === 0 ? (
              <p className="px-4 py-4 font-manrope text-sm text-slate-400">No tickets match the current filters.</p>
            ) : null}
          </div>
        </aside>

        <article className="flex min-h-[calc(100vh-170px)] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur">
          {!selectedTicket ? (
            <p className="px-4 py-4 font-manrope text-sm text-slate-400">
              {detailLoading ? 'Loading ticket...' : 'Select a ticket from the queue.'}
            </p>
          ) : (
            <>
              <header className="border-b border-slate-800 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-manrope text-xs uppercase tracking-wide text-slate-500">
                      Ticket #{shortId(selectedTicket.id)}
                    </p>
                    <h3 className="mt-1 font-sora text-xl text-slate-100">{selectedTicket.subject}</h3>
                    <p className="mt-1 font-manrope text-sm text-slate-300">
                      {selectedTicket.requesterUser.name} • {selectedTicket.requesterUser.phone}
                    </p>
                    <p className="mt-1 font-manrope text-xs text-slate-400">
                      Role: {selectedTicket.requesterRole} • Updated: {formatDate(selectedTicket.updatedAt)}
                    </p>
                    <p className="mt-1 font-manrope text-xs text-slate-500">
                      Order: {selectedTicket.order?.id ?? '--'} • Trip: {selectedTicket.trip?.id ?? '--'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void updateStatus('IN_PROGRESS')}
                      disabled={busy}
                      className="rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 font-manrope text-xs font-semibold text-cyan-200 disabled:opacity-50"
                    >
                      In Progress
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus('WAITING_FOR_USER')}
                      disabled={busy}
                      className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 font-manrope text-xs font-semibold text-amber-200 disabled:opacity-50"
                    >
                      Waiting User
                    </button>
                    <button
                      type="button"
                      onClick={() => void updateStatus('RESOLVED')}
                      disabled={busy}
                      className="rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-manrope text-xs font-semibold text-emerald-200 disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </header>

              <section className="flex-1 space-y-3 overflow-auto px-4 py-4">
                <article className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                  <p className="font-manrope text-xs uppercase tracking-wide text-slate-500">Ticket Description</p>
                  {hasDifferentTranslation(
                    selectedTicket.description,
                    selectedTicket.descriptionTranslatedEnglish
                  ) ? (
                    <>
                      <p className="mt-2 font-manrope text-[11px] uppercase tracking-wide text-cyan-300">
                        Support View (English)
                      </p>
                      <p className="mt-1 whitespace-pre-wrap font-manrope text-sm text-slate-100">
                        {selectedTicket.descriptionTranslatedEnglish}
                      </p>
                      <p className="mt-3 font-manrope text-[11px] uppercase tracking-wide text-slate-500">
                        Original ({selectedTicket.descriptionSourceLanguage ?? 'auto'})
                      </p>
                      <p className="mt-1 whitespace-pre-wrap font-manrope text-sm text-slate-300">
                        {selectedTicket.description}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap font-manrope text-sm text-slate-200">
                      {selectedTicket.description}
                    </p>
                  )}
                </article>

                {selectedTicket.messages.map((message) => {
                  const showTranslation =
                    message.senderType === 'USER' &&
                    hasDifferentTranslation(message.message, message.translatedEnglish);

                  return (
                    <article key={message.id} className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-manrope text-xs uppercase tracking-wide text-slate-500">
                          {message.senderType}
                          {message.senderUser?.name ? ` • ${message.senderUser.name}` : ''}
                        </p>
                        <p className="font-manrope text-xs text-slate-500">{formatDate(message.createdAt)}</p>
                      </div>

                      {showTranslation ? (
                        <>
                          <p className="mt-2 font-manrope text-[11px] uppercase tracking-wide text-cyan-300">
                            Support View (English)
                          </p>
                          <p className="mt-1 whitespace-pre-wrap font-manrope text-sm text-slate-100">
                            {message.translatedEnglish}
                          </p>
                          <p className="mt-3 font-manrope text-[11px] uppercase tracking-wide text-slate-500">
                            Original ({message.sourceLanguage ?? 'auto'})
                          </p>
                          <p className="mt-1 whitespace-pre-wrap font-manrope text-sm text-slate-300">
                            {message.message}
                          </p>
                        </>
                      ) : (
                        <p className="mt-2 whitespace-pre-wrap font-manrope text-sm text-slate-200">{message.message}</p>
                      )}

                      {(message.attachments?.length ?? 0) > 0 ? (
                        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                          {message.attachments?.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-md border border-slate-700 bg-slate-900/70"
                            >
                              <img src={attachment.fileUrl} alt={attachment.fileName ?? 'Support attachment'} className="h-28 w-full object-cover" />
                              <p className="truncate px-2 py-1 font-manrope text-[11px] text-slate-400">
                                {attachment.fileName ?? 'Image'}
                              </p>
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}

                {selectedTicket.messages.length === 0 ? (
                  <p className="font-manrope text-sm text-slate-500">No messages yet.</p>
                ) : null}
              </section>

              <section className="border-t border-slate-800 px-4 py-4">
                <textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  rows={4}
                  placeholder="Write an update for customer/driver"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-sm text-slate-200 outline-none ring-cyan-600/40 focus:ring"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={busy || !replyText.trim()}
                    onClick={() => void sendReply()}
                    className="rounded-md border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 font-manrope text-sm font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Sending...' : 'Send Reply'}
                  </button>
                </div>
              </section>
            </>
          )}
        </article>
      </section>
    </NavShell>
  );
}
