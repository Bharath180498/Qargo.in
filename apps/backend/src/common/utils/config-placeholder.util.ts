const PLACEHOLDER_VALUES = new Set([
  'replace-me',
  'changeme',
  'change-me',
  'your-key',
  'your-secret',
  'xxxx'
]);

export function isUnsetOrPlaceholder(value?: string | null) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (PLACEHOLDER_VALUES.has(normalized)) {
    return true;
  }

  return normalized.includes('replace-me') || normalized.includes('change-me');
}
