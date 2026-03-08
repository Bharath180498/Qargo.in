export function speakDriverMessage(text: string, enabled: boolean) {
  if (!enabled || !text.trim()) {
    return;
  }

  try {
    const speechModule = require('expo-speech') as {
      speak?: (message: string, options?: Record<string, unknown>) => void;
      stop?: () => void;
    };

    speechModule.stop?.();
    speechModule.speak?.(text, {
      rate: 0.9,
      pitch: 1.0,
      language: undefined
    });
  } catch {
    // Optional dependency. If unavailable, we silently skip voice guidance.
  }
}
