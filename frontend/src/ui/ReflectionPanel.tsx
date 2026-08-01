/**
 * ReflectionPanel.tsx — chapter picker, the compact chapter card, and the sliders.
 *
 * The full written reflection lives in the ReflectionReader (full-screen);
 * the sidebar card here only shows the chapter heading and opens the reader.
 * The sliders are declared by each reflection (see reflections.ts), so this
 * component never needs to know what a "carbon price" is — it just renders
 * what it's told.
 */

import { r0 } from '../sim'
import type { Control, Reflection } from '../reflections'

export function ReflectionNav({
  reflections,
  currentId,
  onSelect,
}: {
  reflections: Reflection[]
  currentId: number
  onSelect: (id: number) => void
}) {
  return (
    <nav className="reflection-nav">
      {reflections.map((r) => (
        <button
          key={r.id}
          className={`pill ${r.id === currentId ? 'active' : ''}`}
          onClick={() => onSelect(r.id)}
          title={r.subtitle}
        >
          <span className="pill-num">{r.id}</span>
          {r.title}
        </button>
      ))}
    </nav>
  )
}

export function ReflectionCard({ reflection, onOpen }: { reflection: Reflection; onOpen: () => void }) {
  return (
    <div className="reflection-card">
      <div className="reflection-chapter">Reflection chapter {reflection.id}</div>
      <h1 className="reflection-title">{reflection.title}</h1>
      <p className="reflection-subtitle">{reflection.subtitle}</p>
      <button className="btn primary" onClick={onOpen}>
        Open reflection
      </button>
    </div>
  )
}

/** Extra context under a slider — e.g. how an offer compares to honest cost. */
export interface ControlHint {
  text: string
  tone?: 'over' | 'under' | 'honest'
  /** 0..1 position on the track to mark, e.g. where marginal cost sits. */
  markerAt?: number
  markerLabel?: string
}

export function Controls({
  reflection,
  valueOf,
  isLocked,
  hintFor,
  playing,
  onControl,
  onTogglePlay,
  onReset,
}: {
  reflection: Reflection
  /** Resolves a slider's current value from whichever state it drives. */
  valueOf: (control: Control) => number
  /** True when live backend data is driving this value, so the slider is read-only. */
  isLocked?: (control: Control) => boolean
  /** Optional explanatory caption + track marker for a slider. */
  hintFor?: (control: Control) => ControlHint | null
  playing: boolean
  onControl: (control: Control, value: number) => void
  onTogglePlay: () => void
  onReset: () => void
}) {
  return (
    <div className="controls">
      {reflection.controls.map((c) => {
        const value = valueOf(c)
        const locked = isLocked?.(c) ?? false
        const hint = hintFor?.(c) ?? null
        // Fractional sliders (like availability) need decimals; the rest don't.
        const shown = c.step < 1 ? value.toFixed(2) : r0(value)
        return (
          <div className={`control ${locked ? 'locked' : ''}`} key={c.key}>
            <label className="control-label">
              {c.label}
              {locked && <span className="control-live">live</span>}
              <span className="control-value">
                {shown} {c.unit}
              </span>
            </label>

            <div className="slider-wrap">
              <input
                className="slider"
                type="range"
                min={c.min}
                max={c.max}
                step={c.step}
                value={value}
                disabled={locked}
                onChange={(e) => onControl(c, parseFloat(e.target.value))}
              />
              {/* A fixed reference point on the track — for a bid slider this is
                  the plant's honest marginal cost, so you can see at a glance
                  whether you are bidding above or below it. */}
              {hint?.markerAt != null && (
                <span
                  className="slider-marker"
                  // Inset by half a thumb width at each end so the marker lines
                  // up with where the thumb actually sits, not the raw track.
                  style={{ left: `calc(11px + (100% - 22px) * ${Math.max(0, Math.min(1, hint.markerAt))})` }}
                  title={hint.markerLabel}
                />
              )}
            </div>

            {hint && <div className={`control-hint ${hint.tone ?? ''}`}>{hint.text}</div>}
          </div>
        )
      })}

      <div className="button-row">
        {reflection.priceControl === 'walkForward' && (
          <button className="btn primary" onClick={onTogglePlay}>
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
        <button className="btn" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  )
}
