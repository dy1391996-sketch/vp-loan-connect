const SECRET_KEY = /password|secret|hash|token|authorization|cookie|database_url/i;

export function redactSecrets<T extends Record<string, unknown>>(meta: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SECRET_KEY.test(key)) {
      out[key] = value ? "[redacted]" : "";
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function looksLikeSecretValue(value: string) {
  return value.length > 24 && (/^\$2[aby]\$/.test(value) || /^[A-Za-z0-9+/=._-]{32,}$/.test(value));
}
