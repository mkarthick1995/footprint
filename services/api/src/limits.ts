// Shared rate limiting for paid / write endpoints (SEC-02, SEC-03).

/** Sliding one-minute window counter per key. In memory: per instance (max 2 instances, ADR noted in ARCHITECTURE). */
export class MinuteLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly limit: number) {}
  allow(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.hits.clear(); // memory guard under abuse; limits reset, cap below still holds
    return true;
  }
}
