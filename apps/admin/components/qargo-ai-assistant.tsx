'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { fetcher, postJson } from '../lib/api';
import { readQargoAiContext } from '../lib/qargo-ai-context';

interface AiSessionRow {
  id: string;
  title: string | null;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: 'ADMIN' | 'ASSISTANT' | 'SYSTEM';
    content: string;
    createdAt: string;
  }>;
  _count: {
    messages: number;
    runs: number;
  };
}

interface AiMessage {
  id: string;
  runId?: string | null;
  role: 'ADMIN' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

type AiRunStatus = 'RUNNING' | 'WAITING_CONFIRMATION' | 'COMPLETED' | 'FAILED';
type AiActionStatus = 'PROPOSED' | 'CONFIRMED' | 'EXECUTED' | 'REJECTED' | 'FAILED';

interface AiAction {
  id: string;
  toolName: string;
  argsSummary?: string | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  status: AiActionStatus;
  errorMessage?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}

interface AiTraceStep {
  assistantContent?: string;
  toolCalls?: Array<{
    id?: string;
    name?: string;
  }>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    currentTotalTokens?: number;
  };
}

interface AiRun {
  id: string;
  status: AiRunStatus;
  model?: string | null;
  totalTokens?: number | null;
  toolCallsCount: number;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  trace?: {
    steps?: AiTraceStep[];
  } | null;
  actions: AiAction[];
}

interface AiSessionDetailResponse {
  session: {
    id: string;
    title?: string | null;
  };
  messages: AiMessage[];
  runs: AiRun[];
}

interface AiRunResponse extends AiRun {
  proposedActions: AiAction[];
}

interface AiMetrics {
  runCount: number;
  proposalCount: number;
  confirmRate: number;
  executionFailures: number;
  avgRunLatencySeconds: number;
  tokenUsageTotal: number;
}

function formatDate(value: string) {
  return new Date(value).toLocaleTimeString();
}

function runTone(status: AiRunStatus) {
  if (status === 'COMPLETED') {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30';
  }

  if (status === 'FAILED') {
    return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30';
  }

  if (status === 'WAITING_CONFIRMATION') {
    return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30';
  }

  return 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30';
}

function traceSteps(run: AiRun) {
  if (!run.trace || !Array.isArray(run.trace.steps)) {
    return [];
  }

  return run.trace.steps;
}

function actionTone(status: AiActionStatus) {
  if (status === 'EXECUTED') {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30';
  }

  if (status === 'FAILED' || status === 'REJECTED') {
    return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30';
  }

  if (status === 'PROPOSED' || status === 'CONFIRMED') {
    return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30';
  }

  return 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30';
}

export function QargoAiAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<AiSessionRow[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [sessionData, setSessionData] = useState<AiSessionDetailResponse>();
  const [metrics, setMetrics] = useState<AiMetrics>();
  const [showTechnical, setShowTechnical] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const activeRuns = useMemo(
    () => (sessionData?.runs ?? []).filter((run) => run.status === 'RUNNING' || run.status === 'WAITING_CONFIRMATION'),
    [sessionData?.runs]
  );

  const refreshSessions = async () => {
    const next = await fetcher<AiSessionRow[]>('/admin/ai/sessions');
    setSessions(next);

    if (!activeSessionId && next.length > 0) {
      setActiveSessionId(next[0].id);
    }

    if (activeSessionId && !next.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(next[0]?.id);
    }
  };

  const refreshSessionDetail = async (sessionId: string) => {
    const data = await fetcher<AiSessionDetailResponse>(`/admin/ai/sessions/${sessionId}/messages`);
    setSessionData(data);
  };

  const refreshMetrics = async () => {
    const data = await fetcher<AiMetrics>('/admin/ai/metrics?hours=24');
    setMetrics(data);
  };

  const ensureSession = async () => {
    if (activeSessionId) {
      return activeSessionId;
    }

    const created = await postJson<{ id: string }>('/admin/ai/sessions', {
      title: `QargoAI ${new Date().toLocaleString()}`
    });

    setActiveSessionId(created.id);
    await refreshSessions();
    return created.id;
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    void refreshSessions().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load QargoAI sessions');
    });
    void refreshMetrics().catch(() => {
      // no-op metrics failure
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !activeSessionId) {
      return;
    }

    void refreshSessionDetail(activeSessionId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load QargoAI conversation');
    });
  }, [open, activeSessionId]);

  useEffect(() => {
    if (!open || !activeSessionId || activeRuns.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshSessionDetail(activeSessionId).catch(() => {
        // no-op polling failure
      });
    }, 3000);

    return () => window.clearInterval(timer);
  }, [open, activeRuns.length, activeSessionId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshMetrics().catch(() => {
        // no-op polling failure
      });
    }, 15000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createSession = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const created = await postJson<{ id: string }>('/admin/ai/sessions', {
        title: `QargoAI ${new Date().toLocaleString()}`
      });
      setActiveSessionId(created.id);
      await refreshSessions();
      await refreshSessionDetail(created.id);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'Failed to create session');
    } finally {
      setBusy(false);
    }
  };

  const sendPrompt = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    setBusy(true);
    setError(undefined);

    try {
      const sessionId = await ensureSession();
      const context = {
        ...readQargoAiContext(),
        pagePath: pathname,
        sentAt: new Date().toISOString()
      };

      await postJson<AiRunResponse>(`/admin/ai/sessions/${sessionId}/messages`, {
        message: trimmedPrompt,
        context
      });

      setPrompt('');
      await Promise.all([refreshSessions(), refreshSessionDetail(sessionId)]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Failed to send prompt');
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async (actionId: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await postJson(`/admin/ai/actions/${actionId}/confirm`, {});
      if (activeSessionId) {
        await refreshSessionDetail(activeSessionId);
      }
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Failed to confirm action');
    } finally {
      setBusy(false);
    }
  };

  const rejectAction = async (actionId: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await postJson(`/admin/ai/actions/${actionId}/reject`, {
        reason: 'Rejected by admin from QargoAI panel'
      });
      if (activeSessionId) {
        await refreshSessionDetail(activeSessionId);
      }
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Failed to reject action');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-orange-400/40 bg-orange-500/20 px-5 py-3 font-manrope text-sm font-semibold text-orange-100 shadow-lg shadow-orange-950/40 transition hover:bg-orange-500/30"
      >
        {open ? 'Close QargoAI' : 'QargoAI'}
      </button>

      {open ? (
        <div className="fixed inset-0 z-30 flex justify-end bg-slate-950/55 backdrop-blur-[1px]">
          <aside className="h-full w-full max-w-[460px] border-l border-slate-800 bg-slate-950/95 shadow-2xl shadow-black/60">
            <header className="border-b border-slate-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-manrope text-[11px] uppercase tracking-[0.2em] text-orange-300">QargoAI</p>
                  <h3 className="font-sora text-lg text-slate-100">Agentic Ops Assistant</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTechnical((previous) => !previous)}
                    className={`rounded-md border px-3 py-1.5 font-manrope text-xs font-semibold ${
                      showTechnical
                        ? 'border-slate-600 bg-slate-800 text-slate-200'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {showTechnical ? 'Hide Technical' : 'Show Technical'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void createSession()}
                    className="rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 font-manrope text-xs font-semibold text-cyan-200 disabled:opacity-60"
                  >
                    New Session
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-manrope text-sm text-slate-100"
                  value={activeSessionId ?? ''}
                  onChange={(event) => setActiveSessionId(event.target.value || undefined)}
                >
                  {sessions.length === 0 ? <option value="">No sessions yet</option> : null}
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {(session.title || 'Untitled Session').slice(0, 56)}
                    </option>
                  ))}
                </select>
              </div>

              {metrics ? (
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-800 bg-slate-900/70 p-2">
                  <div>
                    <p className="font-manrope text-[10px] uppercase tracking-wide text-slate-500">Runs</p>
                    <p className="font-manrope text-sm font-semibold text-slate-100">{metrics.runCount}</p>
                  </div>
                  <div>
                    <p className="font-manrope text-[10px] uppercase tracking-wide text-slate-500">Confirm</p>
                    <p className="font-manrope text-sm font-semibold text-slate-100">
                      {(metrics.confirmRate * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="font-manrope text-[10px] uppercase tracking-wide text-slate-500">Tokens</p>
                    <p className="font-manrope text-sm font-semibold text-slate-100">
                      {metrics.tokenUsageTotal.toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : null}
            </header>

            <div className="grid h-[calc(100%-154px)] grid-rows-[1fr_auto]">
              <div className="overflow-y-auto px-4 py-3">
                {(sessionData?.messages ?? []).map((message) => {
                  const isAdmin = message.role === 'ADMIN';
                  const isSystem = message.role === 'SYSTEM';
                  return (
                    <article
                      key={message.id}
                      className={`mb-3 rounded-lg border p-3 ${
                        isAdmin
                          ? 'ml-10 border-orange-500/40 bg-orange-500/10'
                          : isSystem
                            ? 'border-rose-500/40 bg-rose-500/10'
                            : 'mr-8 border-slate-700 bg-slate-900/70'
                      }`}
                    >
                      <p className="mb-1 font-manrope text-[11px] uppercase tracking-wide text-slate-400">
                        {message.role} • {formatDate(message.createdAt)}
                      </p>
                      <p className="whitespace-pre-wrap font-manrope text-sm text-slate-100">{message.content}</p>
                    </article>
                  );
                })}

                {(sessionData?.runs ?? []).map((run) => (
                  (() => {
                    const visibleActions = showTechnical
                      ? run.actions
                      : run.actions.filter((action) => action.status === 'PROPOSED');
                    const shouldShowRun = showTechnical || visibleActions.length > 0 || run.status === 'WAITING_CONFIRMATION';

                    if (!shouldShowRun) {
                      return null;
                    }

                    return (
                      <section key={run.id} className="mb-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-manrope text-xs text-slate-400">
                            Run {run.id.slice(0, 8).toUpperCase()} • {run.model ?? 'model'}
                          </p>
                          <span className={`rounded-md px-2 py-0.5 text-[11px] ${runTone(run.status)}`}>{run.status}</span>
                        </div>
                        {showTechnical ? (
                          <p className="mt-1 font-manrope text-[11px] text-slate-500">
                            Tool calls: {run.toolCallsCount} • Tokens: {run.totalTokens ?? '--'}
                          </p>
                        ) : null}
                        {run.errorMessage ? (
                          <p className="mt-2 rounded-md bg-rose-500/10 px-2 py-1 font-manrope text-xs text-rose-200">
                            {run.errorMessage}
                          </p>
                        ) : null}

                        <div className="mt-2 space-y-2">
                          {showTechnical
                            ? traceSteps(run).map((step, index) => (
                                <article
                                  key={`${run.id}-trace-${index}`}
                                  className="rounded-md border border-slate-800 bg-slate-950/80 p-2"
                                >
                                  <p className="font-manrope text-[11px] uppercase tracking-wide text-slate-500">
                                    Step {index + 1}
                                  </p>
                                  {step.assistantContent ? (
                                    <p className="mt-1 font-manrope text-xs text-slate-300">{step.assistantContent}</p>
                                  ) : null}
                                  {(step.toolCalls ?? []).length > 0 ? (
                                    <p className="mt-1 font-manrope text-xs text-cyan-300">
                                      Tools: {(step.toolCalls ?? []).map((tool) => tool.name || 'unknown').join(', ')}
                                    </p>
                                  ) : null}
                                </article>
                              ))
                            : null}

                          {visibleActions.map((action) => (
                            <article key={action.id} className="rounded-md border border-slate-800 bg-slate-950/80 p-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-manrope text-xs font-semibold text-slate-200">{action.toolName}</p>
                                <span className={`rounded px-2 py-0.5 text-[10px] ${actionTone(action.status)}`}>
                                  {action.status}
                                </span>
                              </div>
                              <p className="mt-1 font-manrope text-xs text-slate-400">
                                {action.argsSummary || 'No summary'}
                              </p>
                              <p className="mt-1 font-manrope text-[11px] text-slate-500">Risk: {action.riskLevel}</p>

                              {action.status === 'PROPOSED' ? (
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void confirmAction(action.id)}
                                    className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-manrope text-xs font-semibold text-emerald-200 disabled:opacity-60"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void rejectAction(action.id)}
                                    className="rounded border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 font-manrope text-xs font-semibold text-rose-200 disabled:opacity-60"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : null}

                              {action.errorMessage ? (
                                <p className="mt-2 font-manrope text-xs text-rose-300">{action.errorMessage}</p>
                              ) : null}
                              {action.rejectionReason ? (
                                <p className="mt-2 font-manrope text-xs text-rose-300">{action.rejectionReason}</p>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })()
                ))}
              </div>

              <footer className="border-t border-slate-800 p-4">
                {error ? <p className="mb-2 font-manrope text-xs text-rose-300">{error}</p> : null}
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ask QargoAI to fetch data or prepare admin actions..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-manrope text-sm text-slate-100 outline-none focus:border-cyan-500"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="font-manrope text-[11px] text-slate-500">
                    Page context attached automatically ({pathname}).
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendPrompt()}
                    className="rounded-md border border-orange-500/40 bg-orange-500/15 px-3 py-1.5 font-manrope text-sm font-semibold text-orange-100 disabled:opacity-60"
                  >
                    {busy ? 'Working...' : 'Send'}
                  </button>
                </div>
              </footer>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
