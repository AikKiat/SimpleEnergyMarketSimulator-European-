/**
 * sync the simulator to live backend data.
 *
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''
const POLL_INTERVAL_MS = 30_000

export type FeedId = 'generationMix' | 'carbonIntensity' | 'powerPrice' | 'fuelPrices'

export type FeedStatus = 'AVAILABLE' | 'NOT_WIRED' | 'UNAVAILABLE' | 'OFFLINE'

export type FeedMode = 'live' | 'simulated'

export interface FeedView {
  status: FeedStatus
  source: string
  endpoint: string
  region: string
  access: string
  note: string | null
  data: unknown
}

export interface MarketSnapshot {
  at: string
  settlement: string | null
  feeds: Record<FeedId, FeedView>
}

export const FEED_CATALOGUE: { id: FeedId; label: string; drives: string }[] = [
  { id: 'generationMix', label: 'Generation mix', drives: 'wind & solar availability' },
  { id: 'carbonIntensity', label: 'Carbon intensity', drives: 'live gCO₂/kWh readout' },
  { id: 'powerPrice', label: 'Day-ahead power price', drives: 'the power price' },
  { id: 'fuelPrices', label: 'Fuel & carbon prices', drives: 'gas, coal and carbon price' },
]

const OFFLINE_FEED: FeedView = {
  status: 'OFFLINE',
  source: 'Spring backend',
  endpoint: '/api/market/live',
  region: '—',
  access: 'UNKNOWN',
  note: 'Backend unreachable. Everything is running on the in-browser simulation.',
  data: null,
}

/**
 * Turn "2026-08-02T13:30Z -> 2026-08-02T14:00Z" into something readable.
 * Falls back to the raw string rather than guessing if parsing fails.
 */
export function formatSettlement(raw: string | null): string | null {
  if (!raw) return null
  const [from, to] = raw.split(' -> ')
  const a = new Date(from)
  const b = new Date(to)
  if (!from || !to || isNaN(a.getTime()) || isNaN(b.getTime())) return raw
  const hhmm = (d: Date) => d.toISOString().slice(11, 16)
  return `${hhmm(a)}–${hhmm(b)} UTC, ${a.toISOString().slice(0, 10)}`
}

function offlineSnapshot(): MarketSnapshot {
  return {
    at: new Date().toISOString(),
    settlement: null,
    feeds: {
      generationMix: OFFLINE_FEED,
      carbonIntensity: OFFLINE_FEED,
      powerPrice: OFFLINE_FEED,
      fuelPrices: OFFLINE_FEED,
    },
  }
}

export type GenerationShares = Record<string, number>

export interface CarbonIntensityReading {
  gramsPerKwh: number
  index: string | null
}

interface GenerationMixFeedData {
  shares: GenerationShares
}

export interface LiveMarket {
  snapshot: MarketSnapshot
  //Which channels the user has switched on.
  modes: Record<FeedId, FeedMode>
  setMode: (id: FeedId, mode: FeedMode) => void
  //True when a channel is both switched on + actually carrying data.
  isLive: (id: FeedId) => boolean
  liveShares: GenerationShares | null
  liveIntensity: CarbonIntensityReading | null
  activeLabels: string[]
  activeSources: string[]
  refresh: () => void
}

export function useLiveMarket(): LiveMarket {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(offlineSnapshot)
  // Default is all-simulated, so we choose which one to sync with frontend (not all available as described in backend code as well)
  const [modes, setModes] = useState<Record<FeedId, FeedMode>>({
    generationMix: 'simulated',
    carbonIntensity: 'simulated',
    powerPrice: 'simulated',
    fuelPrices: 'simulated',
  })

  const timer = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/market/live`)
      if (!res.ok) throw new Error(String(res.status))
      setSnapshot((await res.json()) as MarketSnapshot)
    } catch {
      setSnapshot(offlineSnapshot())
    }
  }, [])

  useEffect(() => {
    void load()
    timer.current = window.setInterval(() => void load(), POLL_INTERVAL_MS)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [load])

  const setMode = useCallback((id: FeedId, mode: FeedMode) => {
    setModes((m) => ({ ...m, [id]: mode }))
  }, [])

  const isLive = useCallback(
    (id: FeedId) => modes[id] === 'live' && snapshot.feeds[id]?.status === 'AVAILABLE',
    [modes, snapshot],
  )

  const liveShares = useMemo(() => {
    if (!isLive('generationMix')) return null
    return (snapshot.feeds.generationMix.data as GenerationMixFeedData | null)?.shares ?? null
  }, [isLive, snapshot])

  const liveIntensity = useMemo(() => {
    if (!isLive('carbonIntensity')) return null
    return (snapshot.feeds.carbonIntensity.data as CarbonIntensityReading) ?? null
  }, [isLive, snapshot])

  const activeLabels = useMemo(
    () => FEED_CATALOGUE.filter((f) => isLive(f.id)).map((f) => f.label),
    [isLive],
  )

  // Attribution comes from the backend's own descriptors, so the banner names
  // the real provider rather than a vague phrase we made up here. Deduplicated
  // because both live channels currently share one API.
  const activeSources = useMemo(() => {
    const seen = new Set<string>()
    for (const f of FEED_CATALOGUE) {
      if (!isLive(f.id)) continue
      const feed = snapshot.feeds[f.id]
      if (feed) seen.add(`${feed.source} (${feed.endpoint}, ${feed.region})`)
    }
    return [...seen]
  }, [isLive, snapshot])

  return {
    snapshot,
    modes,
    setMode,
    isLive,
    liveShares,
    liveIntensity,
    activeLabels,
    activeSources,
    refresh: () => void load(),
  }
}