/**
 * EventFeed.tsx — the running log.
 *
 * Every detected event, newest first. The popups are transient; this is the
 * record, and it's what makes the tool read like a monitoring console rather
 * than a slideshow. Click any row to re-open it as a card.
 */

import type { MarketEvent } from '../events'

const time = (at: number) =>
  new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function EventFeed({ events, onSelect }: { events: MarketEvent[]; onSelect: (e: MarketEvent) => void }) {
  return (
    <div className="feed">
      <div className="stack-title">EVENT LOG</div>
      {events.length === 0 && <div className="feed-empty">No events yet — move a slider or press play.</div>}
      {events.map((e) => (
        <button key={e.id} className={`feed-row sev-${e.severity}`} onClick={() => onSelect(e)}>
          <span className="sev-dot" />
          <span className="feed-body">
            <span className="feed-type">{e.type.replace(/_/g, ' ')}</span>
            <span className="feed-headline">{e.headline}</span>
          </span>
          <span className="feed-time">{time(e.at)}</span>
        </button>
      ))}
    </div>
  )
}
