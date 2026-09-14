

import { FUELS, r0, r2, type AuctionResult, type DispatchRow, type HedgeResult, type Market, type Totals } from './sim'

export type Severity = 'info' | 'warn' | 'critical'

export type EventType =
  | 'PLANT_STARTED'
  | 'PLANT_STOPPED'
  | 'MARGINAL_PLANT_CHANGED'
  | 'MERIT_ORDER_REORDERED'
  | 'PRICE_SPIKE'
  | 'PRICE_COLLAPSE'
  | 'NEGATIVE_PRICE'
  | 'UNSERVED_DEMAND'
  | 'BID_REJECTED'
  | 'CAPACITY_EXHAUSTED'
  | 'RENEWABLE_SURPLUS'
  | 'HEDGE_DIVERGENCE'
  | 'REFLECTION_NOTE'

export interface MarketEvent {
  id: string
  type: EventType
  severity: Severity
  headline: string
  detail: string
  anchor: string
  at: number
  payload: Record<string, unknown>
  reflecting?: string
}

export interface Snapshot {
  rows: DispatchRow[]
  totals: Totals
  price: number
  demandMw: number
  market: Market
  auction?: AuctionResult
  hedge?: HedgeResult
  reflectionId: number
}

const money = (v: number) => (v < 0 ? '−' : '') + '£' + Math.abs(r2(v)).toFixed(2)

let seq = 0
function make(
  type: EventType,
  severity: Severity,
  headline: string,
  detail: string,
  anchor: string,
  payload: Record<string, unknown>,
): MarketEvent {
  return { id: `${type}-${Date.now()}-${seq++}`, type, severity, headline, detail, anchor, at: Date.now(), payload }
}

export function reflectionNote(
  triggerId: string,
  title: string,
  body: string,
  anchor: string,
  snapshot: Snapshot,
): MarketEvent {
  return {
    id: `reflection-${triggerId}-${Date.now()}-${seq++}`,
    type: 'REFLECTION_NOTE',
    severity: 'info',
    headline: title,
    detail: `Price ${money(snapshot.price)}/MWh · ${snapshot.totals.runningCount}/${snapshot.totals.plantCount} online`,
    anchor,
    at: Date.now(),
    payload: { triggerId, reflectionId: snapshot.reflectionId },
    reflecting: body,
  }
}

export function describeFleet(s: Snapshot) {
  return {
    reflectionId: s.reflectionId,
    powerPrice: r2(s.price),
    demandMw: r0(s.demandMw),
    marginalPlant: s.auction?.marginalPlantId ?? null,
    unservedMw: s.auction ? r0(s.auction.unservedMw) : 0,
    fuelPrices: { gas: s.market.gasPrice, coal: s.market.coalPrice, carbon: s.market.carbonPrice },
    plants: s.rows.map((r) => ({
      id: r.plant.id,
      name: r.plant.name,
      fuel: r.plant.fuel,
      capacityMw: r.plant.capacityMw,
      marginalCost: r2(r.marginalCost),
      offer: r.offer != null ? r2(r.offer) : undefined,
      spread: r2(r.spread),
      running: r.running,
      dispatchedMw: r0(r.mw),
    })),
  }
}

export function detectEvents(prev: Snapshot | null, next: Snapshot): MarketEvent[] {
  if (!prev) return []
  const out: MarketEvent[] = []

  const prevById = new Map(prev.rows.map((r) => [r.plant.id, r]))

  //loop through per plant
  for (const row of next.rows) {
    const before = prevById.get(row.plant.id)
    if (!before) continue

    if (row.running !== before.running) {
      const started = row.running
      out.push(
        make(
          started ? 'PLANT_STARTED' : 'PLANT_STOPPED',
          'info',
          `${row.plant.name} ${started ? 'came online' : 'went offline'}`,
          `Spread ${money(row.spread)}/MWh · cost ${money(row.marginalCost)} vs price ${money(row.powerPrice)}`,
          `plant:${row.plant.id}`,
          {
            plant: row.plant.name,
            fuel: FUELS[row.plant.fuel].label,
            marginalCost: r2(row.marginalCost),
            spread: r2(row.spread),
            dispatchedMw: r0(row.mw),
          },
        ),
      )
    }

    // Bidding above cost
    if (row.offer != null && row.offer > row.marginalCost + 0.5 && before.running && !row.running) {
      out.push(
        make(
          'BID_REJECTED',
          'warn',
          `${row.plant.name} was priced out`,
          `Offered ${money(row.offer)} against a cost of ${money(row.marginalCost)} — cleared nothing`,
          `plant:${row.plant.id}`,
          { plant: row.plant.name, offer: r2(row.offer), marginalCost: r2(row.marginalCost) },
        ),
      )
    }
  }

  // the marginal clearing price set by marginal plant
  const prevMarginal = prev.auction?.marginalPlantId
  const nextMarginal = next.auction?.marginalPlantId
  if (nextMarginal && prevMarginal && nextMarginal !== prevMarginal) {
    const plant = next.rows.find((r) => r.plant.id === nextMarginal)?.plant
    out.push(
      make(
        'MARGINAL_PLANT_CHANGED',
        'info',
        `${plant?.name ?? nextMarginal} now sets the price`,
        `Clearing price ${money(next.price)}/MWh at ${r0(next.demandMw)} MW demand`,
        `plant:${nextMarginal}`,
        { from: prevMarginal, to: nextMarginal, clearingPrice: r2(next.price), demandMw: r0(next.demandMw) },
      ),
    )
  }

  // merit order reordering
  const prevOrder = prev.rows.map((r) => r.plant.id).join('>')
  const nextOrder = next.rows.map((r) => r.plant.id).join('>')
  if (prevOrder !== nextOrder && prev.rows.length === next.rows.length) {
    const moved = next.rows.filter((r, i) => prev.rows[i]?.plant.id !== r.plant.id).map((r) => r.plant.name)
    if (moved.length >= 2) {
      out.push(
        make(
          'MERIT_ORDER_REORDERED',
          'info',
          `Merit order changed: ${moved[0]} ↔ ${moved[1]}`,
          `Carbon ${money(next.market.carbonPrice)}/t · gas ${money(next.market.gasPrice)}/MWh`,
          'board',
          { newOrder: next.rows.map((r) => r.plant.name), carbonPrice: next.market.carbonPrice, gasPrice: next.market.gasPrice },
        ),
      )
    }
  }

  //price regime
  const delta = next.price - prev.price
  const moved = Math.abs(delta) > 12 && Math.abs(delta) > Math.abs(prev.price) * 0.2
  if (moved) {
    const up = delta > 0
    out.push(
      make(
        up ? 'PRICE_SPIKE' : 'PRICE_COLLAPSE',
        'warn',
        `Price ${up ? 'spiked' : 'collapsed'} to ${money(next.price)}/MWh`,
        `Moved ${money(delta)} in one tick from ${money(prev.price)}`,
        'board',
        { from: r2(prev.price), to: r2(next.price), delta: r2(delta) },
      ),
    )
  }

  if (next.price < 0 && prev.price >= 0) {
    out.push(
      make(
        'NEGATIVE_PRICE',
        'critical',
        `Clearing price went negative: ${money(next.price)}/MWh`,
        `Generators are now paying to supply · demand ${r0(next.demandMw)} MW`,
        'board',
        { clearingPrice: r2(next.price), demandMw: r0(next.demandMw) },
      ),
    )
  }

  // system stress
  const unserved = next.auction?.unservedMw ?? 0
  if (unserved > 0 && (prev.auction?.unservedMw ?? 0) === 0) {
    out.push(
      make(
        'UNSERVED_DEMAND',
        'critical',
        `${r0(unserved)} MW of demand cannot be served`,
        `Every plant is dispatched — total capacity exhausted`,
        'board',
        { unservedMw: r0(unserved), demandMw: r0(next.demandMw) },
      ),
    )
  }

  const allOn = next.totals.runningCount === next.totals.plantCount && next.totals.plantCount > 1
  if (allOn && prev.totals.runningCount !== prev.totals.plantCount) {
    out.push(
      make(
        'CAPACITY_EXHAUSTED',
        'warn',
        'Entire fleet is dispatched',
        `${r0(next.totals.totalMw)} MW online — no spare capacity left`,
        'board',
        { totalMw: r0(next.totals.totalMw), plants: next.totals.plantCount },
      ),
    )
  }

  //renewables plants
  const zeroCostOnly =
    next.totals.runningCount > 0 && next.rows.filter((r) => r.running).every((r) => r.marginalCost < 1)
  const wasZeroCostOnly =
    prev.totals.runningCount > 0 && prev.rows.filter((r) => r.running).every((r) => r.marginalCost < 1)
  if (zeroCostOnly && !wasZeroCostOnly) {
    out.push(
      make(
        'RENEWABLE_SURPLUS',
        'info',
        'Only zero-fuel generation is running',
        `Price ${money(next.price)}/MWh — nothing burning fuel is needed`,
        'board',
        { clearingPrice: r2(next.price), runningPlants: next.totals.runningCount },
      ),
    )
  }

  // hedging
  if (next.hedge && prev.hedge) {
    const gap = next.hedge.hedgedPerHour - next.hedge.unhedgedPerHour
    const prevGap = prev.hedge.hedgedPerHour - prev.hedge.unhedgedPerHour
    if (Math.abs(gap) > 20000 && Math.sign(gap) !== Math.sign(prevGap)) {
      out.push(
        make(
          'HEDGE_DIVERGENCE',
          'info',
          gap > 0 ? 'The hedge is now paying off' : 'The hedge is now costing you',
          `Hedged ${money(next.hedge.hedgedPerHour)}/h vs unhedged ${money(next.hedge.unhedgedPerHour)}/h`,
          'board',
          {
            hedgedPerHour: r2(next.hedge.hedgedPerHour),
            unhedgedPerHour: r2(next.hedge.unhedgedPerHour),
            spotPrice: r2(next.price),
          },
        ),
      )
    }
  }

  return out
}
