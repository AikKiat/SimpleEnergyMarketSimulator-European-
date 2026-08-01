/**
 * EventCard.tsx — "something happened" first, "here's why" on demand.
 *
 * The card states the detected event as fact. The explanation is a separate,
 * deliberate step: read the numbers and reason it out yourself, or ask the
 * analyst. That separation is the whole point of the redesign — the tool stops
 * lecturing and starts reporting.
 */

import { useCallback, useRef, useState } from 'react'
import type { MarketEvent, Snapshot } from '../events'
import { explain, type InsightState } from '../insight'

export function EventCard({
  event,
  snapshot,
  onDismiss,
}: {
  event: MarketEvent
  snapshot: Snapshot
  onDismiss: (id: string) => void
}) {
  const [state, setState] = useState<InsightState>({ status: 'idle' })
  const [showReflecting, setShowReflecting] = useState(false)
  const abort = useRef<AbortController | null>(null)

  const ask = useCallback(async () => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setState({ status: 'pending' })
    try {
      const insight = await explain(event, snapshot, controller.signal)
      setState({ status: 'ready', insight })
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Unknown error' })
    }
  }, [event, snapshot])

  return (
    <div className={`event-card sev-${event.severity}`}>
      <button className="event-close" onClick={() => onDismiss(event.id)} aria-label="Dismiss">
        ×
      </button>

      <div className="event-type">
        <span className="sev-dot" />
        {event.type.replace(/_/g, ' ')}
      </div>
      <div className="event-headline">{event.headline}</div>
      <div className="event-detail">{event.detail}</div>

      <div className="event-actions">
        {event.reflecting && (
          <button className="chip" onClick={() => setShowReflecting((v) => !v)}>
            {showReflecting ? 'Hide note' : 'Reflection note'}
          </button>
        )}
        {/* <button className="chip primary" onClick={ask} disabled={state.status === 'pending'}>
          {state.status === 'pending' ? '⋯ Analysing' : 'Ask the analyst'}
        </button> */}
      </div>

      {showReflecting && event.reflecting && (
        <div className="event-Reflecting" dangerouslySetInnerHTML={{ __html: event.reflecting }} />
      )}

      {state.status === 'error' && <div className="event-error">{state.message}</div>}

      {state.status === 'ready' && (
        <div className="event-insight">
          <div className="insight-headline">{state.insight.headline}</div>
          <InsightRow label="Why" text={state.insight.why} />
          <InsightRow label="Watch" text={state.insight.watchNext} />
          <InsightRow label="Action" text={state.insight.action} />
        </div>
      )}
    </div>
  )
}

function InsightRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="insight-row">
      <span className="insight-label">{label}</span>
      <span>{text}</span>
    </div>
  )
}
