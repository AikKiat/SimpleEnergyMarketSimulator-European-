

import {
  FUELS,
  r0,
  r2,
  type MarketClearingResult,
  type HedgeResult,
  type MarketPriceCategories,
  type PlantDispatchDetails,
  type EntireFleetTotal,
} from './sim'

export type Severity = 'info' | 'warn' | 'critical'

export type EventType =
  | 'PLANT_STARTED'
  | 'PLANT_STOPPED'
  | 'MARGINAL_PLANT_CHANGED'
  | 'MERIT_ORDER_REORDERED'
  | 'PRICE_CHANGED'
  | 'NEGATIVE_PRICE'
  | 'UNSERVED_DEMAND'
  | 'BID_REJECTED'
  | 'CAPACITY_EXHAUSTED'
  | 'RENEWABLE_SURPLUS'
  | 'HEDGE_VS_SPOT'
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
  plantDispatchDetails: PlantDispatchDetails[]
  fleetTotals: EntireFleetTotal
  marketPrice: number
  demandMw: number
  marketPriceCategories: MarketPriceCategories
  marketClearing?: MarketClearingResult
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
    detail: `Price ${money(snapshot.marketPrice)}/MWh · ${snapshot.fleetTotals.runningCount}/${snapshot.fleetTotals.plantCount} online`,
    anchor,
    at: Date.now(),
    payload: { triggerId, reflectionId: snapshot.reflectionId },
    reflecting: body,
  }
}

export function describeFleet(s: Snapshot) {
  return {
    reflectionId: s.reflectionId,
    marketPrice: r2(s.marketPrice),
    demandMw: r0(s.demandMw),
    marginalPlant: s.marketClearing?.marginalPlantId ?? null,
    unservedDemandMw: s.marketClearing ? r0(s.marketClearing.unservedDemandMw) : 0,
    fuelPrices: {
      gas: s.marketPriceCategories.gasPrice,
      coal: s.marketPriceCategories.coalPrice,
      carbon: s.marketPriceCategories.carbonPrice,
    },
    plants: s.plantDispatchDetails.map((r) => ({
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

  const prevById = new Map(prev.plantDispatchDetails.map((r) => [r.plant.id, r]))

  //loop through per plant
  for (const row of next.plantDispatchDetails) {
    const before = prevById.get(row.plant.id)
    if (!before) continue

    if (row.running !== before.running) {
      const started = row.running
      out.push(
        make(
          started ? 'PLANT_STARTED' : 'PLANT_STOPPED',
          'info',
          `${row.plant.name} ${started ? 'entered' : 'left'} dispatch`,
          `Price ${money(row.marketPrice)}/MWh; marginal cost ${money(row.marginalCost)}/MWh; margin ${money(row.spread)}/MWh`,
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
          `${row.plant.name}'s offer did not clear`,
          `Offer ${money(row.offer)}/MWh; marginal cost ${money(row.marginalCost)}/MWh.`,
          `plant:${row.plant.id}`,
          { plant: row.plant.name, offer: r2(row.offer), marginalCost: r2(row.marginalCost) },
        ),
      )
    }
  }

  // the marginal clearing price set by marginal plant
  const prevMarginal = prev.marketClearing?.marginalPlantId
  const nextMarginal = next.marketClearing?.marginalPlantId
  if (nextMarginal && prevMarginal && nextMarginal !== prevMarginal) {
    const plant = next.plantDispatchDetails.find((r) => r.plant.id === nextMarginal)?.plant
    out.push(
      make(
        'MARGINAL_PLANT_CHANGED',
        'info',
        `${plant?.name ?? nextMarginal} set the clearing price`,
        `Clearing price ${money(next.marketPrice)}/MWh at ${r0(next.demandMw)} MW demand`,
        `plant:${nextMarginal}`,
        { from: prevMarginal, to: nextMarginal, clearingPrice: r2(next.marketPrice), demandMw: r0(next.demandMw) },
      ),
    )
  }

  // merit order reordering
  const prevOrder = prev.plantDispatchDetails.map((r) => r.plant.id).join('>')
  const nextOrder = next.plantDispatchDetails.map((r) => r.plant.id).join('>')
  if (prevOrder !== nextOrder && prev.plantDispatchDetails.length === next.plantDispatchDetails.length) {
    const moved = next.plantDispatchDetails
      .filter((r, index) => prev.plantDispatchDetails[index]?.plant.id !== r.plant.id)
      .map((r) => r.plant.name)
    if (moved.length >= 2) {
      out.push(
        make(
          'MERIT_ORDER_REORDERED',
          'info',
          `Merit order changed: ${moved[0]} and ${moved[1]} moved`,
          `Carbon price ${money(next.marketPriceCategories.carbonPrice)}/t; gas price ${money(next.marketPriceCategories.gasPrice)}/MWh`,
          'board',
          {
            newOrder: next.plantDispatchDetails.map((r) => r.plant.name),
            carbonPrice: next.marketPriceCategories.carbonPrice,
            gasPrice: next.marketPriceCategories.gasPrice,
          },
        ),
      )
    }
  }

  //price regime
  const delta = next.marketPrice - prev.marketPrice
  const moved = Math.abs(delta) > 12 && Math.abs(delta) > Math.abs(prev.marketPrice) * 0.2
  if (moved) {
    const up = delta > 0
    out.push(
      make(
        'PRICE_CHANGED',
        'warn',
        `Price ${up ? 'rose' : 'fell'} to ${money(next.marketPrice)}/MWh`,
        `Change ${money(delta)}/MWh from ${money(prev.marketPrice)}/MWh`,
        'board',
        { from: r2(prev.marketPrice), to: r2(next.marketPrice), delta: r2(delta) },
      ),
    )
  }

  if (next.marketPrice < 0 && prev.marketPrice >= 0) {
    out.push(
      make(
        'NEGATIVE_PRICE',
        'critical',
        `Clearing price is negative: ${money(next.marketPrice)}/MWh`,
        `Demand ${r0(next.demandMw)} MW`,
        'board',
        { clearingPrice: r2(next.marketPrice), demandMw: r0(next.demandMw) },
      ),
    )
  }

  // system stress
  const unserved = next.marketClearing?.unservedDemandMw ?? 0
  if (unserved > 0 && (prev.marketClearing?.unservedDemandMw ?? 0) === 0) {
    out.push(
      make(
        'UNSERVED_DEMAND',
        'critical',
        `Unserved demand: ${r0(unserved)} MW`,
        `Demand ${r0(next.demandMw)} MW; dispatched output ${r0(next.fleetTotals.totalMw)} MW`,
        'board',
        { unservedMw: r0(unserved), demandMw: r0(next.demandMw) },
      ),
    )
  }

  const allOn = next.fleetTotals.runningCount === next.fleetTotals.plantCount && next.fleetTotals.plantCount > 1
  if (allOn && prev.fleetTotals.runningCount !== prev.fleetTotals.plantCount) {
    out.push(
      make(
        'CAPACITY_EXHAUSTED',
        'warn',
        'All simulated plants are dispatched',
        `Simulated fleet output ${r0(next.fleetTotals.totalMw)} MW`,
        'board',
        { totalMw: r0(next.fleetTotals.totalMw), plants: next.fleetTotals.plantCount },
      ),
    )
  }

  //renewables plants
  const zeroCostOnly =
    next.fleetTotals.runningCount > 0 && next.plantDispatchDetails.filter((r) => r.running).every((r) => r.marginalCost < 1)
  const wasZeroCostOnly =
    prev.fleetTotals.runningCount > 0 && prev.plantDispatchDetails.filter((r) => r.running).every((r) => r.marginalCost < 1)
  if (zeroCostOnly && !wasZeroCostOnly) {
    out.push(
      make(
        'RENEWABLE_SURPLUS',
        'info',
        'Running plants have near-zero marginal cost',
        `Price ${money(next.marketPrice)}/MWh; ${next.fleetTotals.runningCount} plants running`,
        'board',
        { clearingPrice: r2(next.marketPrice), runningPlants: next.fleetTotals.runningCount },
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
          'HEDGE_VS_SPOT',
          'info',
          `Hedged margin is ${money(Math.abs(gap))}/h ${gap > 0 ? 'above' : 'below'} unhedged`,
          `Spot ${money(next.marketPrice)}/MWh; hedged ${money(next.hedge.hedgedPerHour)}/h; unhedged ${money(next.hedge.unhedgedPerHour)}/h`,
          'board',
          {
            hedgedPerHour: r2(next.hedge.hedgedPerHour),
            unhedgedPerHour: r2(next.hedge.unhedgedPerHour),
            spotPrice: r2(next.marketPrice),
          },
        ),
      )
    }
  }

  return out
}
