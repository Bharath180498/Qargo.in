import { create } from 'zustand';
import type { VehicleType } from '@porter/shared';
import api from '../services/api';
import { useDriverSessionStore } from './useDriverSessionStore';

interface OnboardingState {
  status?: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  vehicleType: VehicleType;
  vehicleNumber: string;
  licenseNumber: string;
  aadhaarNumber: string;
  rcNumber: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  uploadedDocs: string[];
  loading: boolean;
  error?: string;
  load: () => Promise<void>;
  updateProfile: (payload: Partial<Pick<OnboardingState, 'fullName' | 'phone' | 'email' | 'city'>>) => Promise<void>;
  updateVehicle: (payload: Partial<Pick<OnboardingState, 'vehicleType' | 'vehicleNumber' | 'licenseNumber' | 'aadhaarNumber' | 'rcNumber'>>) => Promise<void>;
  updateBank: (payload: Partial<Pick<OnboardingState, 'accountHolderName' | 'bankName' | 'accountNumber' | 'ifscCode' | 'upiId'>>) => Promise<void>;
  uploadDoc: (type: string) => Promise<void>;
  submit: () => Promise<void>;
}

const defaultState = {
  fullName: '',
  phone: '',
  email: '',
  city: '',
  vehicleType: 'MINI_TRUCK' as VehicleType,
  vehicleNumber: '',
  licenseNumber: '',
  aadhaarNumber: '',
  rcNumber: '',
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  upiId: '',
  uploadedDocs: []
};

function currentUserId() {
  const userId = useDriverSessionStore.getState().user?.id;
  if (!userId) {
    throw new Error('Driver session not available');
  }
  return userId;
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null) {
    return fallback;
  }

  if ('response' in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;

    if (typeof data === 'string' && data.trim()) {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      if ('message' in data) {
        const message = (data as { message?: unknown }).message;
        if (Array.isArray(message)) {
          return message.join(', ');
        }
        if (typeof message === 'string' && message.trim()) {
          return message;
        }
      }

      if ('error' in data && typeof (data as { error?: unknown }).error === 'string') {
        return (data as { error: string }).error;
      }
    }
  }

  if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }

  return fallback;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...defaultState,
  loading: false,
  async load() {
    const userId = currentUserId();
    set({ loading: true, error: undefined });

    try {
      const [onboardingResponse, kycResponse] = await Promise.all([
        api.get('/driver-onboarding/me', { params: { userId } }),
        api.get('/kyc/status/me', { params: { userId } })
      ]);

      const onboarding = onboardingResponse.data as Record<string, unknown>;
      const docs = (kycResponse.data?.documents ?? []) as Array<{ type: string }>;

      set({
        loading: false,
        status: String(onboarding.status ?? 'NOT_STARTED'),
        fullName: String(onboarding.fullName ?? ''),
        phone: String(onboarding.phone ?? ''),
        email: String(onboarding.email ?? ''),
        city: String(onboarding.city ?? ''),
        vehicleType: (String(onboarding.vehicleType ?? 'MINI_TRUCK') as VehicleType),
        vehicleNumber: String(onboarding.vehicleNumber ?? ''),
        licenseNumber: String(onboarding.licenseNumber ?? ''),
        aadhaarNumber: String(onboarding.aadhaarNumber ?? ''),
        rcNumber: String(onboarding.rcNumber ?? ''),
        accountHolderName: String(onboarding.accountHolderName ?? ''),
        bankName: String(onboarding.bankName ?? ''),
        accountNumber: String(onboarding.accountNumber ?? ''),
        ifscCode: String(onboarding.ifscCode ?? ''),
        upiId: String(onboarding.upiId ?? ''),
        uploadedDocs: docs.map((doc) => doc.type),
        error: undefined
      });
    } catch (error: unknown) {
      set({
        loading: false,
        error:
          typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message?: unknown }).message ?? 'Unable to load onboarding state')
            : 'Unable to load onboarding state'
      });
    }
  },
  async updateProfile(payload) {
    const userId = currentUserId();
    const next = { ...get(), ...payload };

    set({ loading: true, error: undefined });

    try {
      await api.post('/driver-onboarding/profile', {
        userId,
        fullName: next.fullName,
        phone: next.phone,
        email: next.email,
        city: next.city
      });

      set({ ...payload, loading: false, error: undefined });
    } catch (error: unknown) {
      set({
        loading: false,
        error: extractErrorMessage(error, 'Unable to save profile details')
      });
      throw error;
    }
  },
  async updateVehicle(payload) {
    const userId = currentUserId();
    const next = { ...get(), ...payload };

    set({ loading: true, error: undefined });

    try {
      await api.post('/driver-onboarding/vehicle', {
        userId,
        vehicleType: next.vehicleType,
        vehicleNumber: next.vehicleNumber,
        licenseNumber: next.licenseNumber,
        aadhaarNumber: next.aadhaarNumber,
        rcNumber: next.rcNumber
      });

      set({ ...payload, loading: false, error: undefined });
    } catch (error: unknown) {
      set({
        loading: false,
        error: extractErrorMessage(error, 'Unable to save vehicle details')
      });
      throw error;
    }
  },
  async updateBank(payload) {
    const userId = currentUserId();
    const next = { ...get(), ...payload };

    set({ loading: true, error: undefined });

    try {
      await api.post('/driver-onboarding/bank', {
        userId,
        accountHolderName: next.accountHolderName,
        bankName: next.bankName,
        accountNumber: next.accountNumber,
        ifscCode: next.ifscCode,
        upiId: next.upiId
      });

      set({ ...payload, loading: false, error: undefined });
    } catch (error: unknown) {
      set({
        loading: false,
        error: extractErrorMessage(error, 'Unable to save payout details')
      });
      throw error;
    }
  },
  async uploadDoc(type) {
    const userId = currentUserId();
    set({ loading: true, error: undefined });

    try {
      const upload = await api.post('/kyc/upload-url', {
        userId,
        type,
        fileName: `${type.toLowerCase()}.jpg`,
        contentType: 'image/jpeg'
      });

      await api.post('/kyc/documents', {
        userId,
        type,
        fileKey: upload.data.fileKey,
        fileUrl: upload.data.fileUrl,
        mimeType: 'image/jpeg',
        fileSizeBytes: 123456
      });

      set((state) => ({
        uploadedDocs: state.uploadedDocs.includes(type)
          ? state.uploadedDocs
          : [...state.uploadedDocs, type],
        loading: false
      }));

      await get().load();
    } catch (error: unknown) {
      set({
        loading: false,
        error: extractErrorMessage(error, 'Document upload failed')
      });
      throw error;
    }
  },
  async submit() {
    const userId = currentUserId();
    set({ loading: true, error: undefined });

    try {
      await api.post('/driver-onboarding/submit', { userId });
      await api.post('/kyc/verify/idfy', { userId });

      await useDriverSessionStore.getState().refreshOnboardingStatus();
      await get().load();
      set({ loading: false });
    } catch (error: unknown) {
      set({
        loading: false,
        error: extractErrorMessage(error, 'Unable to submit onboarding')
      });
      throw error;
    }
  }
}));
