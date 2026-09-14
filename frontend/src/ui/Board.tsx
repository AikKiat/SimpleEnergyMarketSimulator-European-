/**
 * Board.tsx - the numbers panel.
 */

import {
  FUELS,
  r0,
  r2,
  type MarketClearingResult,
  type CarbonMarketResult,
  type PlantDispatchDetails,
  type HedgeResult,
  type EntireFleetTotal,
} from '../sim'

const money = (v: number) => (v < 0 ? '−' : '') + '£' + Math.abs(v).toFixed(2)
const compactMoney = (v: number) => {
  const abs = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(2)}m`
  if (abs >= 1_000) return `${sign}£${(abs / 1_000).toFixed(1)}k`
  return `${sign}£${abs.toFixed(0)}`
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`}>{value}</div>
    </div>
  )
}

/** One tick of the hedged-vs-unhedged race, recorded as the spot price walks. */
export interface HedgeSample {
  spot: number
  hedged: number
  unhedged: number
}

/** How many ticks of history the hedge chart keeps on screen. */
export const HEDGE_HISTORY_POINTS = 80


function HedgeChart({ history }: { history: HedgeSample[] }) {
  if (history.length < 2) return null

  const W = 260
  const H = 74
  const values = history.flatMap((p) => [p.hedged, p.unhedged])
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1

  const x = (i: number) => (i / (history.length - 1)) * W
  const y = (v: number) => H - ((v - lo) / span) * H
  const points = (pick: (p: HedgeSample) => number) =>
    history.map((p, i) => `${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ')

  // Break-even matters more than any gridline: above it the hour earns, below it loses.
  const zero = lo <= 0 && hi >= 0 ? y(0) : null

  return (
    <svg
      className="hedge-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Hedged and unhedged margin per hour over recent ticks, on a shared scale"
    >
      {zero != null && <line className="hedge-chart-zero" x1={0} x2={W} y1={zero} y2={zero} />}
      <polyline className="hedge-chart-line unhedged" points={points((p) => p.unhedged)} />
      <polyline className="hedge-chart-line hedged" points={points((p) => p.hedged)} />
    </svg>
  )
}

export function Board({
  rows,
  totals,
  powerPrice,
  profitAndLoss,
  marketClearing,
  demandMw,
  hedge,
  hedgeHistory = [],
  liveIntensity,
  carbonPrice,
  carbon,
}: {
  rows: PlantDispatchDetails[]
  totals: EntireFleetTotal
  powerPrice: number
  profitAndLoss: number
  marketClearing?: MarketClearingResult
  demandMw?: number
  hedge?: HedgeResult
  hedgeHistory?: HedgeSample[]
  // Real gCO2/kWh from the Carbon Intensity API, when that feed is synced.
  liveIntensity?: { gramsPerKwh: number; index: string | null } | null
  // The simulated £/tonne from the slider - a different quantity entirely.
  carbonPrice?: number
  // Present only while cap-and-trade is running.
  carbon?: CarbonMarketResult | null
}) {
  const marginalPlant = marketClearing ? rows.find((r) => r.plant.id === marketClearing.marginalPlantId)?.plant : undefined

  // Scale so the price marker, the cheapest offer and the tallest bar all fit -
  // including negative prices, which are a whole lesson of their own.
  const values = rows.flatMap((r) => [r.marginalCost, r.offer ?? r.marginalCost])
  const lo = Math.min(0, powerPrice, ...values)
  const hi = Math.max(10, powerPrice, ...values) * 1.15
  const span = hi - lo || 1
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100))

  return (
    <div className="board">
      <div className="price-card">
        <div className="price-label">{marketClearing ? 'CLEARING PRICE' : 'POWER PRICE'}</div>
        <div className={`price-value ${powerPrice < 0 ? 'bad' : ''}`}>£{r2(powerPrice).toFixed(2)}</div>
        <div className="price-unit">per MWh</div>
        {marginalPlant && <div className="price-note">set by {marginalPlant.name}</div>}
      </div>

      <div className="stats">
        {demandMw != null && <Stat label="Demand" value={`${r0(demandMw)} MW`} />}
        <Stat label="Online" value={`${totals.runningCount}/${totals.plantCount}`} />
        <Stat label="Output" value={`${r0(totals.totalMw)} MW`} />
        {marketClearing && marketClearing.unservedDemandMw > 0 && (
          <Stat label="Unserved" value={`${r0(marketClearing.unservedDemandMw)} MW`} tone="bad" />
        )}
        <Stat
          label="Margin"
          value={`${compactMoney(totals.marginPerHour)}/h`}
          tone={totals.marginPerHour > 0 ? 'good' : 'bad'}
        />
        <Stat label="Earned" value={compactMoney(profitAndLoss)} tone={profitAndLoss >= 0 ? 'good' : 'bad'} />
      </div>

      {carbon && (
        <div className="cap-card">
          <div className="stack-title">CAP-AND-TRADE</div>
          <div className="hedge-row">
            <span>Emissions</span>
            <span className={carbon.emissions > carbon.cap ? 'bad' : 'good'}>
              {r0(carbon.emissions)} t/h
            </span>
          </div>
          <div className="hedge-row">
            <span>Cap</span>
            <span>{r0(carbon.cap)} t/h</span>
          </div>
          <div className="cap-bar">
            <div
              className={`cap-fill ${carbon.emissions > carbon.cap ? 'over' : ''}`}
              style={{ width: `${Math.min(100, carbon.cap > 0 ? (carbon.emissions / carbon.cap) * 100 : 100)}%` }}
            />
          </div>
          <div className="hedge-row strong">
            <span>Permit price</span>
            <span>{money(carbon.carbonPrice)}/t</span>
          </div>
          <div className="hedge-note">
            {!carbon.binding
              ? 'Emissions are already under the cap, so permits are in surplus and the price is zero.'
              : carbon.infeasible
                ? 'No price is high enough to bring this fleet under the cap.'
                : 'The price is whatever forces emissions down to the cap — an output, not a setting.'}
          </div>
        </div>
      )}

      {liveIntensity && (
        <div className="intensity-card">
          <div className="stack-title">CARBON INTENSITY — LIVE</div>
          <div className="intensity-value">
            {liveIntensity.gramsPerKwh} <span className="intensity-unit">gCO₂/kWh</span>
          </div>
          {liveIntensity.index && <div className="intensity-index">{liveIntensity.index}</div>}
          <div className="intensity-note">
            Measured from real GB generation right now. Carbon intensity from Carbon Intensity API.
            {carbonPrice != null && (
              <> — the carbon <b>price</b> driving marginal costs is still simulated at {money(carbonPrice)}/tonne</>
            )}
            .
          </div>
        </div>
      )}

      {hedge && (
        <div className="hedge-card">
          <div className="stack-title">FORWARD CONTRACT</div>
          <div className="hedge-row">
            <span>Unhedged</span>
            <span className={hedge.unhedgedPerHour >= 0 ? 'good' : 'bad'}>
              {compactMoney(hedge.unhedgedPerHour)}/h
            </span>
          </div>
          <div className="hedge-row">
            <span>Contract settles</span>
            <span className={hedge.hedgeDifferenceFromSpotPerHour >= 0 ? 'good' : 'bad'}>
              {hedge.hedgeDifferenceFromSpotPerHour >= 0 ? '+' : '−'}
              {compactMoney(Math.abs(hedge.hedgeDifferenceFromSpotPerHour))}/h
            </span>
          </div>
          <div className="hedge-row strong">
            <span>Hedged</span>
            <span className={hedge.hedgedPerHour >= 0 ? 'good' : 'bad'}>{compactMoney(hedge.hedgedPerHour)}/h</span>
          </div>

          <HedgeChart history={hedgeHistory} />
          <div className="hedge-legend">
            <span className="hedge-key unhedged">Unhedged</span>
            <span className="hedge-key hedged">Hedged</span>
          </div>

          <div className="hedge-row quiet">
            <span>
              Q_produced {r0(hedge.producedMw)} − Q_contracted {r0(hedge.contractedMw)}
            </span>
            <span className={hedge.spotExposureMw === 0 ? 'good' : ''}>{r0(hedge.spotExposureMw)} MW</span>
          </div>

          <div className="hedge-note">
            Q_contracted × (P_fixed − P_spot) = {compactMoney(hedge.hedgeDifferenceFromSpotPerHour)}/h — the whole gap
            between the two lines.
            <br />
            {hedge.spotExposureMw === 0 ? (
              <>
                Production exactly covers the contract, so <b>nothing</b> is left riding on spot - the hedged line is
                flat whatever the price does. This is what a complete hedge looks like.
              </>
            ) : hedge.spotExposureMw > 0 ? (
              <>
                The unhedged line rides the <b>full</b> {r0(hedge.producedMw)} MW; the hedged line rides only the{' '}
                <b>{r0(hedge.spotExposureMw)} MW</b> surplus not sold forward, so it moves less. Match the contract to
                production and it flattens completely.
              </>
            ) : (
              <>
                Generating <b>{r0(hedge.producedMw)} MW</b> against a <b>{r0(hedge.contractedMw)} MW</b> obligation, so 
                {r0(Math.abs(hedge.spotExposureMw))} MW must be bought back at spot every hour.
              </>
            )}
          </div>
        </div>
      )}

      <div className="stack">
        <div className="stack-title">MERIT ORDER — cheapest first</div>

        {rows.map((row) => {
          const fuel = FUELS[row.plant.fuel]
          const bidsAway = row.offer != null && Math.abs(row.offer - row.marginalCost) > 0.5
          return (
            <div key={row.plant.id} className={`stack-row ${row.running ? 'running' : 'off'}`}>
              <div className="stack-head">
                <span className="dot" style={{ background: fuel.css }} />
                <span className="stack-name">{row.plant.name}</span>
                {row.isMarginal && <span className="badge marginal">SETS PRICE</span>}
                <span className={`badge ${row.running ? 'on' : 'offb'}`}>{row.running ? 'RUN' : 'OFF'}</span>
              </div>

              <div className="bar">
                <div className="bar-fill" style={{ width: `${pct(row.marginalCost)}%`, background: fuel.css }} />
                <div className="bar-marker" style={{ left: `${pct(powerPrice)}%` }} />
              </div>

              <div className="stack-nums">
                <span>cost {money(row.marginalCost)}</span>
                {bidsAway ? (
                  <span className="offer">offer {money(row.offer!)}</span>
                ) : (
                  <span className={row.spread >= 0 ? 'good' : 'bad'}>spread {money(row.spread)}</span>
                )}
                <span className="muted">{r0(row.mw)} MW</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
