import { create } from 'zustand';
import type { OnboardingStatus } from '@porter/shared';
import api, { setAuthToken } from '../services/api';
import type { DriverSessionUser, OtpRequestResponse } from '../types';

interface DriverSessionState {
  token?: string;
  user?: DriverSessionUser;
  onboardingStatus?: OnboardingStatus;
  loading: boolean;
  error?: string;
  lastOtpCode?: string;
  requestOtp: (phone: string, name?: string) => Promise<void>;
  verifyOtp: (payload: { phone: string; code: string; name?: string }) => Promise<void>;
  refreshOnboardingStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

function extractError(error: unknown, fallback: string) {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : fallback;
}

export const useDriverSessionStore = create<DriverSessionState>((set, get) => ({
  loading: false,
  async requestOtp(phone, name) {
    set({ loading: true, error: undefined });

    try {
      const response = await api.post<OtpRequestResponse>('/auth/otp/request', {
        phone,
        role: 'DRIVER',
        name
      });

      set({
        loading: false,
        lastOtpCode: response.data.code
      });
    } catch (error: unknown) {
      set({
        loading: false,
        error: extractError(error, 'Unable to request OTP')
      });
      throw error;
    }
  },
  async verifyOtp(payload) {
    set({ loading: true, error: undefined });

    try {
      const response = await api.post('/auth/otp/verify', {
        phone: payload.phone,
        role: 'DRIVER',
        code: payload.code,
        name: payload.name
      });

      const token = response.data.token as string;
      const user = response.data.user as DriverSessionUser;
      setAuthToken(token);

      set({
        token,
        user,
        loading: false,
        error: undefined
      });

      await get().refreshOnboardingStatus();
    } catch (error: unknown) {
      set({
        loading: false,
        error: extractError(error, 'OTP verification failed')
      });
      throw error;
    }
  },
  async refreshOnboardingStatus() {
    const userId = get().user?.id;
    if (!userId) {
      return;
    }

    const [onboardingResponse, kycResponse] = await Promise.all([
      api.get('/driver-onboarding/me', { params: { userId } }),
      api.get('/kyc/status/me', { params: { userId } })
    ]);

    const onboardingStatus =
      (kycResponse.data?.onboardingStatus as OnboardingStatus | undefined) ??
      (onboardingResponse.data?.status as OnboardingStatus | undefined) ??
      'NOT_STARTED';

    set({ onboardingStatus });
  },
  async logout() {
    const token = get().token;
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } finally {
      setAuthToken(undefined);
      set({ token: undefined, user: undefined, onboardingStatus: undefined, error: undefined });
    }
  }
}));
