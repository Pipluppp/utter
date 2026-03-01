const runtimeEnv = new Map<string, unknown>();

export function setRuntimeEnv(bindings: Record<string, unknown>) {
  runtimeEnv.clear();
  for (const [key, value] of Object.entries(bindings)) {
    runtimeEnv.set(key, value);
  }
}

export function envGet(name: string): string | undefined {
  const value = runtimeEnv.get(name);
  return typeof value === "string" ? value : undefined;
}

export function envBinding<T>(name: string): T | undefined {
  return runtimeEnv.get(name) as T | undefined;
}

export function envRequire(name: string): string {
  const value = envGet(name)?.trim();
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}
