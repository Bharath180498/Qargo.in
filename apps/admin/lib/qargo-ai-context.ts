export interface QargoAiContext {
  pagePath?: string;
  supportTicketId?: string;
  kycVerificationId?: string;
  orderId?: string;
  updatedAt?: string;
}

const QARGO_AI_CONTEXT_KEY = 'qargo_ai_context';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function readQargoAiContext(): QargoAiContext {
  if (!isBrowser()) {
    return {};
  }

  const raw = window.localStorage.getItem(QARGO_AI_CONTEXT_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as QargoAiContext;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function mergeQargoAiContext(patch: QargoAiContext) {
  if (!isBrowser()) {
    return;
  }

  const merged: QargoAiContext = {
    ...readQargoAiContext(),
    ...patch,
    updatedAt: new Date().toISOString()
  };

  window.localStorage.setItem(QARGO_AI_CONTEXT_KEY, JSON.stringify(merged));
}
