import { beforeEach, describe, expect, it } from "vitest";

import { RATE_LIMITS, resetRateLimits, takeRateLimit } from "@/lib/rate-limit";

describe("takeRateLimit", () => {
  beforeEach(() => resetRateLimits());
  const rule = { limit: 2, windowMs: 60_000 };

  it("allows calls up to the limit, then refuses with the wait", () => {
    expect(takeRateLimit("a", rule, 0).ok).toBe(true);
    expect(takeRateLimit("a", rule, 10_000).ok).toBe(true);
    expect(takeRateLimit("a", rule, 20_000)).toEqual({ ok: false, retryAfterMs: 40_000 });
  });

  it("frees a slot once the oldest call leaves the window", () => {
    takeRateLimit("a", rule, 0);
    takeRateLimit("a", rule, 10_000);
    expect(takeRateLimit("a", rule, 60_000).ok).toBe(true);
  });

  it("doesn't count refused calls", () => {
    takeRateLimit("a", rule, 0);
    takeRateLimit("a", rule, 0);
    for (let t = 1; t < 50; t++) takeRateLimit("a", rule, t * 1000);
    expect(takeRateLimit("a", rule, 60_000).ok).toBe(true);
  });

  it("counts each user and action separately", () => {
    takeRateLimit("submitDocument:u1", rule, 0);
    takeRateLimit("submitDocument:u1", rule, 0);
    expect(takeRateLimit("submitDocument:u2", rule, 0).ok).toBe(true);
    expect(takeRateLimit("askAssistant:u1", rule, 0).ok).toBe(true);
  });

  it("lets the shared demo reset only once every two minutes", () => {
    expect(RATE_LIMITS.resetDemo).toEqual({ limit: 1, windowMs: 120_000 });
  });
});
