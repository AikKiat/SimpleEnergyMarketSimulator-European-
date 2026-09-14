

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stage } from './scene/Stage'
import { Board } from './ui/Board'
import { Controls, ReflectionCard, ReflectionNav, type ControlHint } from './ui/ReflectionPanel'
import { ReflectionReader, type ReaderView } from './ui/ReflectionReader'
import { SyncPanel } from './ui/SyncPanel'
import { GithubLink } from './ui/GithubLink'
import { formatSettlement, useLiveMarket } from './market'
import { EventCard } from './ui/EventCard'
import { EventFeed } from './ui/EventFeed'
import { detectEvents, reflectionNote, type MarketEvent, type Snapshot } from './events'
import { REFLECTIONS, reflectionById, type Control, type Reflection, type ReflectionState } from './reflections'
import { CarbonMarketPanel, type CarbonMode } from './ui/CarbonMarketPanel'
import {
  clearAuction,
  clearCarbonMarket,
  defaultMarket,
  dispatchAtPrice,
  makeWalkForward,
  marginalCost,
  settleWithContract,
  totals as computeTotals,
  type CarbonMarketResult,
  type MarketPriceCategories,
  type Plant,
} from './sim'

const TICK_MS = 1500
const TICK_HOURS = TICK_MS / 3_600_000
const CARD_TTL_MS = 14_000
const MAX_CARDS = 2
const MAX_LOG = 40

export default function App() {
  const [reflectionId, setReflectionId] = useState(1)
  const reflection = useMemo(() => reflectionById(reflectionId), [reflectionId])


  const [readerView, setReaderView] = useState<ReaderView>("full")  //start off maxed out. Want to present my learning which is important.
 
  const [market, setMarket] = useState<MarketPriceCategories>(defaultMarket) //Here we set the default Market Object, which is basically an object containing the default prices for each fuel type -> carbon, gas, coal, nuclear
  const [powerPrice, setPowerPrice] = useState(reflection.initialPrice ?? reflection.walkForward?.base ?? 75)
  const [demand, setDemand] = useState(reflection.demand?.initial ?? 1000)
  const [bids, setBids] = useState<Record<string, number>>({})
  const [availability, setAvailability] = useState<Record<string, number>>({})
  const [contractMw, setContractMw] = useState(reflection.contract?.mw ?? 0)
  const [contractPrice, setContractPrice] = useState(reflection.contract?.price ?? 90)

  // cap-and-trade (chapter 7)
  const [carbonMode, setCarbonMode] = useState<CarbonMode>('tax')
  const [cap, setCap] = useState(reflection.carbonMarket?.initialCapTonnesPerHour ?? 1000)
  
  const [capSecondsPerYear, setCapSecondsPerYear] = useState(5) //How much real time one simulated year of cap decline takes. --> so here we set to 5s --> every 5s simulate a year of decline
  const [capDeclining, setCapDeclining] = useState(false)
  const [capYears, setCapYears] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [profitAndLoss, setprofitAndLoss] = useState(0) //the running total of money made. Key term!

  const [cards, setCards] = useState<MarketEvent[]>([]) //the notif cards
  const [log, setLog] = useState<MarketEvent[]>([]) //the event log

  const walkForward = useRef(makeWalkForward(reflection.walkForward)) //The function based on the random walk hypothesis, to hence simulate a trend of market pricing behaviour that tries to be as close to the real thing
  const prevTrue = useRef<Record<string, boolean>>({})
  const firedOnce = useRef<Record<string, boolean>>({})
  const prevSnapshot = useRef<Snapshot | null>(null)

  const live = useLiveMarket()

  const plants: Plant[] = useMemo(
    () =>
      reflection.plants.map((p) => {
        const shares = live.liveShares
        if (shares && (p.fuel === 'WIND' || p.fuel === 'SOLAR')) {
          const share = shares[p.fuel.toLowerCase()]
          if (share != null) return { ...p, availability: Math.max(0, Math.min(1, share)) }
        }
        return availability[p.id] != null ? { ...p, availability: availability[p.id] } : p
      }),
    [reflection, availability, live.liveShares],
  )

  
  //  Cap-and-trade. When active the carbon price is no longer an input — it is
  //  whatever clears the permit market for the current cap, exactly as the
  //  clearing price that comes out from the bid stack, as explained in chapter 4.
   
  const carbonResult: CarbonMarketResult | null = useMemo(() => {
    if (!reflection.carbonMarket || carbonMode !== 'cap') return null
    return clearCarbonMarket(cap, (carbonPrice) => {
      const trial = { ...market, carbonPrice }
      return reflection.mode === 'auction'
        ? clearAuction(plants, demand, trial, bids).plantDispatchDetails
        : dispatchAtPrice(plants, powerPrice, trial)
    })
  }, [reflection.carbonMarket, reflection.mode, carbonMode, cap, market, plants, demand, bids, powerPrice])





  const effectiveMarket: MarketPriceCategories = useMemo(
    () => (carbonResult ? { ...market, carbonPrice: carbonResult.carbonPrice } : market),
    [market, carbonResult],
  )





  const { rows, marketPrice, marketClearing } = useMemo(() => {
    if (reflection.mode === 'auction') {
      const result = clearAuction(plants, demand, effectiveMarket, bids)
      return { rows: result.plantDispatchDetails, marketPrice: result.clearingPrice, marketClearing: result }
    }
    return { rows: dispatchAtPrice(plants, powerPrice, effectiveMarket), marketPrice: powerPrice, marketClearing: undefined }
  }, [reflection.mode, plants, demand, effectiveMarket, bids, powerPrice])




  const totals = useMemo(() => computeTotals(rows), [rows])





  const hedge = useMemo(
    () => (reflection.contract && rows.length > 0 ? settleWithContract(rows[0], contractMw, contractPrice) : undefined),
    [reflection.contract, rows, contractMw, contractPrice],
  )



  const snapshot: Snapshot = useMemo(
    () => ({
      plantDispatchDetails: rows,
      fleetTotals: totals,
      marketPrice,
      demandMw: demand,
      marketPriceCategories: market,
      marketClearing,
      hedge,
      reflectionId,
    }),
    [rows, totals, marketPrice, demand, market, marketClearing, hedge, reflectionId],
  )




  const earnRate = hedge ? hedge.hedgedPerHour : totals.marginPerHour
  const earnRateRef = useRef(earnRate)
  earnRateRef.current = earnRate




  // The clock closes over state, so the cap settings are a useref to save the value + dont keep triggering re-renders.
  const capCfgRef = useRef({ declining: false, secondsPerYear: 5, initial: 0, lrf: 0 })
  capCfgRef.current = {
    declining: capDeclining && carbonMode === 'cap',
    secondsPerYear: capSecondsPerYear,
    initial: reflection.carbonMarket?.initialCapTonnesPerHour ?? 0,
    lrf: reflection.carbonMarket?.linearReductionFactor ?? 0,
  }




  const push = useCallback((events: MarketEvent[]) => {
    if (events.length === 0) return
    setLog((l) => [...events].reverse().concat(l).slice(0, MAX_LOG))
    const rank = { critical: 0, warn: 1, info: 2 } as const
    const top = [...events].sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, MAX_CARDS)
    setCards((c) => [...c, ...top].slice(-MAX_CARDS))
  }, [])




  const resetReflection = useCallback((next: Reflection) => {
    walkForward.current = makeWalkForward(next.walkForward)
    setMarket(defaultMarket())
    setPowerPrice(next.initialPrice ?? next.walkForward?.base ?? 75)
    setDemand(next.demand?.initial ?? 1000)
    setBids({})
    setAvailability({})
    setContractMw(next.contract?.mw ?? 0)
    setContractPrice(next.contract?.price ?? 90)
    setCarbonMode('tax')
    setCap(next.carbonMarket?.initialCapTonnesPerHour ?? 1000)
    setCapSecondsPerYear(5)
    setCapDeclining(false)
    setCapYears(0)
    setprofitAndLoss(0)
    setCards([])
    setLog([])
    setPlaying(true)
    prevTrue.current = {}
    firedOnce.current = {}
    prevSnapshot.current = null
  }, [])

  const selectReflection = useCallback(
    (id: number) => {
      setReflectionId(id)
      resetReflection(reflectionById(id))
      // Picking a chapter opens --> written reflection full-screen.
      setReaderView('full')
    },
    [resetReflection],
  )

  //For internel clock
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (reflection.priceControl === 'walkForward' && playing) setPowerPrice(walkForward.current.step())
      setprofitAndLoss((p) => p + earnRateRef.current * TICK_HOURS)

      // Ratchet the emissions cap down. Real ETS caps decline over years on a
      // linear trajectory; here a "year" is compressed to a few seconds so the
      // effect is watchable.
      const cfg = capCfgRef.current
      if (cfg.declining && cfg.initial > 0) {
        const yearsPerTick = TICK_MS / 1000 / cfg.secondsPerYear
        setCapYears((y) => y + yearsPerTick)
        setCap((c) => Math.max(0, c - cfg.initial * cfg.lrf * yearsPerTick))
      }

      const cutoff = Date.now() - CARD_TTL_MS
      setCards((cs) => (cs.some((c) => c.at < cutoff) ? cs.filter((c) => c.at >= cutoff) : cs))
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [reflection.priceControl, playing])

  //Get change, raise detections since the previous tick!
  useEffect(() => {
    if (rows.length === 0) return

    const detected = detectEvents(prevSnapshot.current, snapshot)
    prevSnapshot.current = snapshot

    const state: ReflectionState = { rows, totals, marketPrice, market, demandMw: demand, marketClearing, hedge }
    const authored: MarketEvent[] = []
    for (const trigger of reflection.triggers) {
      let condition = false
      try {
        condition = trigger.when(state)
      } catch {
        condition = false
      }
      const wasTrue = prevTrue.current[trigger.id] ?? false
      prevTrue.current[trigger.id] = condition
      if (!condition || wasTrue) continue
      if (trigger.once && firedOnce.current[trigger.id]) continue
      firedOnce.current[trigger.id] = true
      authored.push(reflectionNote(trigger.id, trigger.title, trigger.body, trigger.anchor, snapshot))
    }

    push([...detected, ...authored])
  }, [snapshot, rows, totals, marketPrice, market, demand, marketClearing, hedge, reflection, push])

  //SLider controls here
  const valueOf = useCallback(
    (c: Control): number => {
      switch (c.target) {
        case 'price':
          return powerPrice
        case 'demand':
          return demand
        case 'contractMw':
          return contractMw
        case 'contractPrice':
          return contractPrice
        case 'availability': {
          const plant = reflection.plants.find((p) => p.id === c.plantId)
          const shares = live.liveShares
          if (shares && plant && (plant.fuel === 'WIND' || plant.fuel === 'SOLAR')) {
            const share = shares[plant.fuel.toLowerCase()]
            if (share != null) return Math.max(0, Math.min(1, share))
          }
          return availability[c.plantId ?? ''] ?? plant?.availability ?? 1
        }
        case 'bid': {
          const plant = reflection.plants.find((p) => p.id === c.plantId)
          return bids[c.plantId ?? ''] ?? (plant ? marginalCost(plant, market) : 0)
        }
        default:
          // The carbon-price slider is a special case under cap-and-trade. When we set the cap internally its worked out 
          // what carbon price is needed.
          // However, market.carbonPrice still holds whatever was last set dragged before switching.
          // So we show the computed permit price instead
          if (c.key === 'carbonPrice' && carbonResult) return carbonResult.carbonPrice
          return market[c.key as keyof MarketPriceCategories]
      }
    },
    [powerPrice, demand, contractMw, contractPrice, availability, bids, market, reflection, live.liveShares, carbonResult],
  )





  /** A slider is locked when something else is driving that value. */
  const isLocked = useCallback(
    (c: Control) => {
      // Cap-and-trade takes over the carbon price.
      if (c.target === 'market' && c.key === 'carbonPrice' && carbonResult) return true
      if (c.target !== 'availability' || !live.liveShares) return false
      const plant = reflection.plants.find((p) => p.id === c.plantId)
      return !!plant && (plant.fuel === 'WIND' || plant.fuel === 'SOLAR')
    },
    [live.liveShares, reflection, carbonResult],
  )




  const onControl = useCallback((control: Control, value: number) => {
    switch (control.target) {
      case 'price':
        walkForward.current.set(value)
        setPowerPrice(value)
        break
      case 'demand':
        setDemand(value)
        break
      case 'contractMw':
        setContractMw(value)
        break
      case 'contractPrice':
        setContractPrice(value)
        break
      case 'availability':
        setAvailability((a) => ({ ...a, [control.plantId ?? '']: value }))
        break
      case 'bid':
        setBids((b) => ({ ...b, [control.plantId ?? '']: value }))
        break
      default:
        setMarket((m) => ({ ...m, [control.key]: value }))
    }
  }, [])



  /**
   * Context under the bid slider (chapter 5). Without it the offer is just a
   * number — you cannot tell whether you are withholding or undercutting until
   * you know the plant's honest marginal cost to compare it against.
   */
  const hintForTrueMarginalCost = useCallback(
    (c: Control): ControlHint | null => {
      if (c.target !== 'bid') return null
      const plant = reflection.plants.find((p) => p.id === c.plantId)
      if (!plant) return null

      const cost = marginalCost(plant, effectiveMarket)
      const offer = bids[c.plantId ?? ''] ?? cost
      const delta = offer - cost
      const money = (v: number) => '£' + Math.abs(v).toFixed(2)
      const marker = {
        markerAt: (cost - c.min) / (c.max - c.min),
        markerLabel: `Marginal cost ${money(cost)}/MWh`,
      }

      if (Math.abs(delta) < 0.5) {
        return { ...marker, tone: 'honest', text: `Bidding its honest marginal cost of ${money(cost)}/MWh.` }
      }
      if (delta > 0) {
        return {
          ...marker,
          tone: 'over',
          text: `${money(delta)}/MWh above its ${money(cost)} marginal cost — economic withholding. Only pays off if it still clears.`,
        }
      }
      return {
        ...marker,
        tone: 'under',
        text: `${money(delta)}/MWh below its ${money(cost)} marginal cost. Near-certain to clear — but if it ends up the marginal plant it sets the price below its own cost and runs at a loss.`,
      }
    },
    [reflection, bids, effectiveMarket],
  )

  const dismiss = useCallback((id: string) => setCards((cs) => cs.filter((c) => c.id !== id)), [])
  const reopen = useCallback((e: MarketEvent) => setCards((cs) => [...cs.filter((c) => c.id !== e.id), e].slice(-MAX_CARDS)), [])

  const boardCards = cards.filter((c) => !c.anchor.startsWith('plant:'))

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">⚡</span>
          <div>
            <div className="brand-title">Power Supply & Trading</div>
            <div className="brand-sub">Simple Simulation</div>
          </div>
        </div>
        <GithubLink />
        <br/>
        <div>
          Some concepts learnt:
        </div>
        <br/>

        <ReflectionNav reflections={REFLECTIONS} currentId={reflectionId} onSelect={selectReflection} />
        <ReflectionCard reflection={reflection} onOpen={() => setReaderView('full')} />
        <Controls
          reflection={reflection}
          valueOf={valueOf}
          isLocked={isLocked}
          hintFor={hintForTrueMarginalCost}
          playing={playing}
          onControl={onControl}
          onTogglePlay={() => setPlaying((p) => !p)}
          onReset={() => resetReflection(reflection)}
        />
        {reflection.carbonMarket && (
          <CarbonMarketPanel
            mode={carbonMode}
            onMode={setCarbonMode}
            cap={cap}
            onCap={setCap}
            capMax={reflection.carbonMarket.initialCapTonnesPerHour}
            secondsPerYear={capSecondsPerYear}
            onSecondsPerYear={setCapSecondsPerYear}
            declining={capDeclining}
            onToggleDecline={() => setCapDeclining((d) => !d)}
            onResetCap={() => {
              setCap(reflection.carbonMarket!.initialCapTonnesPerHour)
              setCapYears(0)
              setCapDeclining(false)
            }}
            result={carbonResult}
            penaltyPerTonne={reflection.carbonMarket.penaltyPerTonne}
            yearsElapsed={capYears}
          />
        )}
        <SyncPanel live={live} />
      </aside>

      <main className="stage">
        <Stage plants={reflection.plants} rows={rows} cards={cards} snapshot={snapshot} onDismiss={dismiss} />

        {live.activeLabels.length > 0 && (
          <div className="live-banner">
            <span className="live-dot" />
            <span>
              <strong>LIVE</strong> · {live.activeLabels.join(' + ')}
              <span className="live-source">
                {live.activeSources.join(' · ')}
                {formatSettlement(live.snapshot.settlement)
                  ? ` — settlement ${formatSettlement(live.snapshot.settlement)}`
                  : ''}
              </span>
            </span>
          </div>
        )}

        <div className="board-cards">
          {boardCards.map((c) => (
            <EventCard key={c.id} event={c} snapshot={snapshot} onDismiss={dismiss} />
          ))}
        </div>

        <div className="hint">drag to orbit · scroll to zoom</div>
      </main>

      <aside className="panel">
        <Board
          rows={rows}
          totals={totals}
          powerPrice={marketPrice}
          profitAndLoss={profitAndLoss}
          marketClearing={marketClearing}
          demandMw={reflection.mode === 'auction' ? demand : undefined}
          hedge={hedge}
          liveIntensity={live.liveIntensity}
          carbonPrice={effectiveMarket.carbonPrice}
          carbon={carbonResult}
        />
        <EventFeed events={log} onSelect={reopen} />
      </aside>

      <ReflectionReader
        reflection={reflection}
        count={REFLECTIONS.length}
        view={readerView}
        onView={setReaderView}
        onNavigate={selectReflection}
      />
    </div>
  )
}
