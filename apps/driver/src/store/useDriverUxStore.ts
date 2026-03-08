import { create } from 'zustand';
import type { DriverLanguage } from '../i18n/translations';

interface DriverUxState {
  language: DriverLanguage;
  simpleMode: boolean;
  voiceGuidanceEnabled: boolean;
  guidedHintsEnabled: boolean;
  setLanguage: (language: DriverLanguage) => void;
  setSimpleMode: (enabled: boolean) => void;
  setVoiceGuidanceEnabled: (enabled: boolean) => void;
  setGuidedHintsEnabled: (enabled: boolean) => void;
}

function detectDefaultLanguage(): DriverLanguage {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (locale.startsWith('kn')) {
      return 'kn';
    }
    if (locale.startsWith('hi')) {
      return 'hi';
    }
    return 'en';
  } catch {
    return 'en';
  }
}

export const useDriverUxStore = create<DriverUxState>((set) => ({
  language: detectDefaultLanguage(),
  simpleMode: true,
  voiceGuidanceEnabled: true,
  guidedHintsEnabled: true,
  setLanguage(language) {
    set({ language });
  },
  setSimpleMode(enabled) {
    set({ simpleMode: enabled });
  },
  setVoiceGuidanceEnabled(enabled) {
    set({ voiceGuidanceEnabled: enabled });
  },
  setGuidedHintsEnabled(enabled) {
    set({ guidedHintsEnabled: enabled });
  }
}));
