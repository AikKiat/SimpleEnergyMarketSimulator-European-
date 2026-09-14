/**
 * insight.ts — the analyst client.
 *
 * Posts a detected event plus the current fleet state to the Spring backend,
 * which publishes it to Kafka; a consumer calls the model and stores the result.
 * We then poll until it's ready.
 *
 * Deliberately async and optional: the sandbox works with the backend switched
 * off, and the event cards stay useful — you just don't get the analyst.
 */

import type { MarketEvent, Snapshot } from './events'
import { describeFleet } from './events'

export interface Insight {
  /** One-line read of what just happened. */
  headline: string
  /** The economics behind it. */
  why: string
  /** What to watch next. */
  watchNext: string
  /** What a desk would consider doing. */
  action: string
}

export type InsightState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'ready'; insight: Insight }
  | { status: 'error'; message: string }


const API_BASE = import.meta.env.VITE_API_BASE ?? ''

const POLL_INTERVAL_MS = 800
const POLL_TIMEOUT_MS = 45_000
const SESSION_ID = crypto.randomUUID()


//AI Analyst methods --> explain the particular event with memory
export async function explain(event: MarketEvent, snapshot: Snapshot, signal?: AbortSignal): Promise<Insight> {
  let requestId: string
  try {
    const res = await fetch(`${API_BASE}/api/insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        eventType: event.type,
        severity: event.severity,
        headline: event.headline,
        detail: event.detail,
        payloadJson: JSON.stringify(event.payload),
        fleetJson: JSON.stringify(describeFleet(snapshot)),
      }),
      signal,
    })
    if (!res.ok) throw new Error(`[ANALYST] backend returned ${res.status}`)
    requestId = (await res.json()).id
  } catch (e) {
    throw new Error(
      e instanceof Error && e.name === 'AbortError'
        ? "[ANALYST] Cancelled"
        : "[ANALYST] Analyst unavailable - is the Spring backend running, or has the API key been set?",
    )
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    if (signal?.aborted) throw new Error('Cancelled')

    const res = await fetch(`${API_BASE}/api/insight/${requestId}`, { signal })
    if (!res.ok) throw new Error(`backend returned ${res.status}`)
    const body = await res.json()

    if (body.status === "READY") return body.insight as Insight
    if (body.status === "FAILED") throw new Error(body.error || "[ANALYST] The analyst failed to answer")
  }
  throw new Error("[ANALYST]Analyst timed out")
}
