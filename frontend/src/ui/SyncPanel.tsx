/**
 * SyncPanel.tsx — the honest data-source panel.
 *
 * Every channel the simulator could take from the real world, listed with what
 * it costs, whether it is actually available, and a per-channel switch. Locked
 * rows say why they are locked rather than just being greyed out.
 *
 * This doubles as documentation: it shows at a glance which parts of the
 * simulation are real measurements and which are my own assumptions.
 */

import { FEED_CATALOGUE, type FeedStatus, type LiveMarket } from '../market'

const STATUS_LABEL: Record<FeedStatus, string> = {
  AVAILABLE: 'Available',
  NOT_WIRED: 'Not wired',
  UNAVAILABLE: 'No free feed',
  OFFLINE: 'Backend offline',
}

export function SyncPanel({ live }: { live: LiveMarket }) {
  const anyLive = live.activeLabels.length > 0

  return (
    <div className="sync-panel">
      <div className="stack-title">DATA SOURCES</div>
      <p className="sync-intro">
        Each channel can run on <strong>live</strong> measurements or on the in-browser{' '}
        <strong>simulation</strong>. Locked rows have no free feed available.
      </p>

      {FEED_CATALOGUE.map(({ id, label, drives }) => {
        const feed = live.snapshot.feeds[id]
        const status = feed?.status ?? 'OFFLINE'
        const selectable = status === 'AVAILABLE'
        const mode = selectable && live.isLive(id) ? 'live' : 'simulated'

        return (
          <div key={id} className={`sync-row status-${status.toLowerCase()}`}>
            <div className="sync-head">
              <span className="sync-label">{label}</span>
              <span className={`sync-status s-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>
            </div>

            <div className="sync-meta">
              {feed?.source} · {feed?.cost} · drives {drives}
            </div>
            {feed?.endpoint && (
              <div className="sync-origin">
                <code>{feed.endpoint}</code>
                {feed.region && feed.region !== '—' ? ` · ${feed.region}` : ''}
              </div>
            )}

            {selectable ? (
              <div className="sync-toggle">
                <button
                  className={`sync-btn ${mode === 'live' ? 'on' : ''}`}
                  onClick={() => live.setMode(id, 'live')}
                >
                  Live
                </button>
                <button
                  className={`sync-btn ${mode === 'simulated' ? 'on' : ''}`}
                  onClick={() => live.setMode(id, 'simulated')}
                >
                  Simulated
                </button>
              </div>
            ) : (
              <div className="sync-note">{feed?.note ?? 'Unavailable.'}</div>
            )}
          </div>
        )
      })}

      {live.snapshot.settlement && (
        <div className="sync-footer">Settlement window {live.snapshot.settlement}</div>
      )}
      {anyLive && (
        <div className="sync-footer live">Live: {live.activeLabels.join(', ')}</div>
      )}
    </div>
  )
}
