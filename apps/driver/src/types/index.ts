export type AuthStackParamList = {
  DriverPhone: undefined;
  DriverOtp: { phone: string; role: 'DRIVER'; name?: string };
};

export type OnboardingStackParamList = {
  OnboardingProfile: undefined;
  OnboardingVehicle: undefined;
  OnboardingBank: undefined;
  OnboardingDocuments: undefined;
  OnboardingStatus: undefined;
};

export type DriverTabParamList = {
  Home: undefined;
  Earnings: undefined;
  History: undefined;
  Profile: undefined;
};

export interface DriverSessionUser {
  id: string;
  name: string;
  phone: string;
  role: 'DRIVER';
}

export interface OtpRequestResponse {
  otpSessionId: string;
  expiresAt: string;
  code?: string;
  provider?: 'mock' | 'twilio';
  deliveryStatus?: 'SENT' | 'FALLBACK';
}
