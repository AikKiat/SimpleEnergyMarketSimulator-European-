/**
 * ReflectionReader.tsx — the floating reflection panel.
 *
 * This is our reader panel, and it contains all of the notes of reflection.
 * The notes are initially written in the nice markdown files, so here we use react-markdown to convert,
 * polish and reframe into virtual DOM UI elements!
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Reflection } from '../reflections'

export type ReaderView = 'full' | 'min'

/** Two outward diagonal arrows — the classic maximise glyph, as pure SVG. */
function MaximiseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

export function ReflectionReader({
  reflection,
  count,
  view,
  onView,
  onNavigate,
}: {
  reflection: Reflection
  /** Total number of chapters, for "chapter N of M" and nav bounds. */
  count: number
  view: ReaderView
  onView: (view: ReaderView) => void
  onNavigate: (id: number) => void
}) {
  useEffect(() => {
    if (view !== 'full') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onView('min')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, onView])

  const full = view === 'full'

  return createPortal(
    <div className={`reflection-float ${full ? 'is-full' : 'is-min'}`} role="dialog">
      <div className="float-chrome">
        <span className="reader-chapter-label">
          Reflection chapter {reflection.id}
          {full ? ` of ${count}` : ''}
        </span>
        {full && (
          <button className="btn" onClick={() => onView('min')}>
            Minimise
          </button>
        )}
      </div>

      <div className="float-scroll">
        <h1 className="reader-title">{reflection.title}</h1>
        <p className="reader-subtitle">{reflection.subtitle}</p>

        <div className="reader-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{reflection.content}</ReactMarkdown>
        </div>

        {full && (
          <footer className="reader-nav">
            <button className="btn" disabled={reflection.id <= 1} onClick={() => onNavigate(reflection.id - 1)}>
              Previous chapter
            </button>
            <button className="btn primary" onClick={() => onView('min')}>
              Back to the simulation
            </button>
            <button className="btn" disabled={reflection.id >= count} onClick={() => onNavigate(reflection.id + 1)}>
              Next chapter
            </button>
          </footer>
        )}
      </div>

      {!full && (
        <div className="float-frost" onClick={() => onView('full')}>
          <button
            className="float-expand"
            aria-label="Maximise the reflection"
            onClick={(e) => {
              e.stopPropagation()
              onView('full')
            }}
          >
            <MaximiseIcon />
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
