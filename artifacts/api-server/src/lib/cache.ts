/**
 * Simple in-memory TTL cache.
 */
export class TTLCache<V> {
  private store = new Map<string, { value: V; expiry: number }>();

  constructor() {}

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number): void {
    const expiry = Date.now() + ttlMs;
    this.store.set(key, { value, expiry });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.store.clear();
  }
}