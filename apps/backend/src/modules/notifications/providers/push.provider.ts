export interface PushMessageInput {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface PushProvider {
  send(message: PushMessageInput): Promise<{ success: boolean; providerRef?: string; error?: string }>;
}

