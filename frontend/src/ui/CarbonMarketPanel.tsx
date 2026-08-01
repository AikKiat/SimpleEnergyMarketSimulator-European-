/**
 * CarbonMarketPanel.tsx — switching between the two carbon policies.
 *
 * Under a **tax** the government sets the price and you drag it directly.
 * Under **cap-and-trade** you set the quantity instead, and the price is
 * whatever clears the permit market — so the carbon-price slider goes
 * read-only and starts reporting rather than controlling.
 *
 * The cap also ratchets down over time, as it does in the real EU ETS. Real
 * caps decline over years; here that is compressed to seconds so the effect is
 * watchable, with a slider for how compressed.
 */

import { r0, r2, type CarbonMarketResult } from '../sim'

export type CarbonMode = 'tax' | 'cap'

export function CarbonMarketPanel({
  mode,
  onMode,
  cap,
  onCap,
  capMax,
  secondsPerYear,
  onSecondsPerYear,
  declining,
  onToggleDecline,
  onResetCap,
  result,
  penaltyPerTonne,
  yearsElapsed,
}: {
  mode: CarbonMode
  onMode: (m: CarbonMode) => void
  cap: number
  onCap: (v: number) => void
  capMax: number
  secondsPerYear: number
  onSecondsPerYear: (v: number) => void
  declining: boolean
  onToggleDecline: () => void
  onResetCap: () => void
  result: CarbonMarketResult | null
  penaltyPerTonne: number
  yearsElapsed: number
}) {
  return (
    <div className="carbon-panel">
      <div className="stack-title">CARBON POLICY</div>

      <div className="carbon-modes">
        <button className={`sync-btn ${mode === 'tax' ? 'on' : ''}`} onClick={() => onMode('tax')}>
          Carbon tax
        </button>
        <button className={`sync-btn ${mode === 'cap' ? 'on' : ''}`} onClick={() => onMode('cap')}>
          Cap-and-trade
        </button>
      </div>

      {mode === 'tax' ? (
        <p className="carbon-note">
          The government sets a fixed price per tonne. Drag the <strong>carbon price</strong> slider
          above and every plant pays that rate on what it emits.
        </p>
      ) : (
        <>
          <p className="carbon-note">
            A limit is placed on total emissions and firms buy permits to cover what they emit.
            The <strong>price is no longer set</strong> — it emerges from how scarce the permits are,
            so the carbon-price slider is now read-only.
          </p>

          <div className="control">
            <label className="control-label">
              Emissions cap
              <span className="control-value">{r0(cap)} t/h</span>
            </label>
            <input
              className="slider"
              type="range"
              min={0}
              max={capMax}
              step={10}
              value={cap}
              onChange={(e) => onCap(parseFloat(e.target.value))}
            />
          </div>

          <div className="control">
            <label className="control-label">
              Cap decline speed
              <span className="control-value">{secondsPerYear}s / year</span>
            </label>
            <input
              className="slider"
              type="range"
              min={1}
              max={5}
              step={1}
              value={secondsPerYear}
              onChange={(e) => onSecondsPerYear(parseFloat(e.target.value))}
            />
          </div>

          <p className="carbon-note small">
            Cap decline, adjusted for the sake of simulating in real time — in reality this
            trajectory runs over <strong>years</strong>, not seconds. The cap falls linearly, as
            the EU ETS does under its linear reduction factor.
          </p>

          <div className="button-row">
            <button className="btn primary" onClick={onToggleDecline}>
              {declining ? 'Pause decline' : 'Start decline'}
            </button>
            <button className="btn" onClick={onResetCap}>
              Reset cap
            </button>
          </div>

          {result && (
            <div className="carbon-result">
              <div className="carbon-row">
                <span>Simulated year</span>
                <span>{yearsElapsed.toFixed(1)}</span>
              </div>
              <div className="carbon-row">
                <span>Emissions</span>
                <span className={result.emissions > result.cap ? 'bad' : 'good'}>
                  {r0(result.emissions)} / {r0(result.cap)} t/h
                </span>
              </div>
              <div className="carbon-row strong">
                <span>Permit price</span>
                <span>£{r2(result.carbonPrice).toFixed(2)}/t</span>
              </div>

              {!result.binding && (
                <div className="carbon-flag">
                  Cap is <strong>not binding</strong> — emissions are already below it, so permits
                  are in surplus and the price collapses to zero. This is the oversupply problem the
                  EU ETS had to correct.
                </div>
              )}
              {result.infeasible && (
                <div className="carbon-flag bad">
                  <strong>Infeasible</strong> — no price is high enough to bring this fleet under the
                  cap.
                </div>
              )}
              {result.binding && !result.infeasible && result.carbonPrice > penaltyPerTonne && (
                <div className="carbon-flag">
                  The clearing price is now above the <strong>£{penaltyPerTonne}/tonne</strong>{' '}
                  statutory penalty. Note that in the real EU ETS paying the penalty does not
                  discharge the obligation — the allowances must still be surrendered.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
