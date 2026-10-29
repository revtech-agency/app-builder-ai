// Rate limits on the actions that cost money or reach outside the app (LLM calls, HubSpot writes,
// emails, Reset demo). They matter most for the two shared demo accounts, which anyone can open
// from the landing page: every visitor shares one user ID, so they share one budget.
//
// Best effort: counts live in server memory, so each server instance counts on its own and a
// restart clears them. That slows down a visitor spamming the demo; it isn't a hard guarantee.
import { createMiddleware } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MINUTE = 60_000;

export const RATE_LIMITS = {
  submitDocument: { limit: 10, windowMs: 10 * MINUTE },
  sendDemoInvoice: { limit: 6, windowMs: 10 * MINUTE },
  receiveEfactura: { limit: 10, windowMs: 10 * MINUTE },
  askAssistant: { limit: 30, windowMs: 10 * MINUTE },
  resetDemo: { limit: 1, windowMs: 2 * MINUTE },
  sendChat: { limit: 30, windowMs: 10 * MINUTE },
  placeOrder: { limit: 10, windowMs: 10 * MINUTE },
} as const;

export type RateLimitedAction = keyof typeof RATE_LIMITS;

const hits = new Map<string, number[]>();

// Records one call and says whether it is within the limit; a refused call isn't counted.
export function takeRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterMs: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterMs: windowMs - (now - recent[0]!) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true };
}

export function resetRateLimits() {
  hits.clear();
}

const waitText = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return s < 90 ? `${s} seconds` : `${Math.ceil(s / 60)} minutes`;
};

export const rateLimit = (action: RateLimitedAction) =>
  createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const r = takeRateLimit(`${action}:${context.userId}`, RATE_LIMITS[action]);
      if (!r.ok) {
        throw new Error(
          `Too many requests for now. Please try again in ${waitText(r.retryAfterMs)}.`,
        );
      }
      return next();
    });
