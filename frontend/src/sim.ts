/**
 * sim.ts — THE MARKET MODEL.
 *
 * Pure logic: no React, no three.js, no DOM. Given some plants and some market
 * conditions, it says who runs, at what price, and who earns what.
 *
 * This mirrors MarginalCostCalculator.java + DispatchEngine.java on the backend.
 * Keeping it pure means it's testable, the 3D scene becomes a dumb renderer of
 * whatever this returns, and we can later swap it for live /api/dispatch data
 * without touching a single component.
 */

export type FuelKey = 'GAS' | 'COAL' | 'NUCLEAR' | 'WIND' | 'SOLAR'

export interface Plant {
  id: string
  name: string
  fuel: FuelKey
  capacityMw: number
  efficiency: number
  co2PerMwh: number
  availability?: number
  subsidyPerMwh?: number
}

export interface MarketPriceCategories {
  gasPrice: number   // euro per MWh of gas energy (thermal input, before efficiency losses).
  coalPrice: number
  nuclearFuelPrice: number //euro per tonne of CO2 emitted.
  carbonPrice: number
}

export interface PlantDispatchDetails {
  plant: Plant
  marginalCost: number
  marketPrice: number
  spread: number // Revenue - marginal cost per MWh. Positive = worth running.
  running: boolean
  mw: number
  profitPerHour: number //euro per hour, since spread is £/MWh and mw is MW (= MWh per hour). 
  isMarginal?: boolean //Auction mode only: this is the plant that set the clearing price. 
  offer?: number //Auction mode only: the price this plant offered. 
}

export interface EntireFleetTotal {
  runningCount: number
  plantCount: number
  totalMw: number
  marginPerHour: number
}

export interface FuelMeta {
  label: string
  /** three.js hex. */
  colour: number
  /** CSS hex, same colour — kept together so the 3D and 2D never disagree. */
  css: string
  thermal: boolean
}

export const FUELS: Record<FuelKey, FuelMeta> = {
  GAS: { label: 'Gas', colour: 0xf59e0b, css: '#f59e0b', thermal: true },
  COAL: { label: 'Coal', colour: 0x94a3b8, css: '#94a3b8', thermal: true },
  NUCLEAR: { label: 'Nuclear', colour: 0xa78bfa, css: '#a78bfa', thermal: true },
  WIND: { label: 'Wind', colour: 0x38bdf8, css: '#38bdf8', thermal: false },
  SOLAR: { label: 'Solar', colour: 0xfacc15, css: '#facc15', thermal: false },
}

export function defaultMarket(): MarketPriceCategories {
  return { gasPrice: 30, coalPrice: 15, nuclearFuelPrice: 8, carbonPrice: 40 }
}

//What one MWh of raw fuel energy costs, before efficiency losses.
export function fuelPricePerThermalMwh(fuel: FuelKey, market: MarketPriceCategories): number {
  switch (fuel) {
    case 'GAS':
      return market.gasPrice
    case 'COAL':
      return market.coalPrice
    case 'NUCLEAR':
      return market.nuclearFuelPrice
    default:
      return 0 // wind & solar burn nothing so no fuel costs
  }
}




/**
 * MARGINAL COST — one plant's euro/MWh break-even price.
 *
 *     marginalCost = (fuelPrice / efficiency) + (co2PerMwh × carbonPrice)
 *
 */
export function marginalCost(plant: Plant, market: MarketPriceCategories): number {
  const thermal = fuelPricePerThermalMwh(plant.fuel, market)
  const fuelCost = plant.efficiency > 0 ? thermal / plant.efficiency : 0
  const carbonCost = plant.co2PerMwh * market.carbonPrice
  return fuelCost + carbonCost
}

// How many MW this plant can actually offer right now. */
export function availableMw(plant: Plant): number {
  return plant.capacityMw * (plant.availability ?? 1)
}



/**
 * The price a plant offers into auction.
 *
 * Without an output-linked subsidy, honest bidding means offering at marginal cost.
 * A subsidy shifts the break-even offer down because it is earned on every MWh generated.
 */
export function offerPrice(plant: Plant, market: MarketPriceCategories, bidsById: Record<string, number> = {}): number {
  const explicit = bidsById[plant.id]
  if (explicit != null) return explicit
  return marginalCost(plant, market) - (plant.subsidyPerMwh ?? 0)
}


//Main Dispatch engine methid --> determines based on the various metrics, whether a plant will be running or not. Returns hence the array of PlantDispatchDetails objects
export function dispatchAtPrice(plants: Plant[], powerPrice: number, market: MarketPriceCategories): PlantDispatchDetails[] {
  return plants
    .map<PlantDispatchDetails>((plant) => {
      const cost = marginalCost(plant, market)
      const spread = powerPrice + (plant.subsidyPerMwh ?? 0) - cost
      const running = spread > 0
      const mw = running ? availableMw(plant) : 0
      return {
        plant,
        marginalCost: cost,
        marketPrice: powerPrice,
        spread,
        running,
        mw,
        profitPerHour: running ? spread * mw : 0,
      }
    })
    .sort((a, b) => a.marginalCost - b.marginalCost)
}

export interface MarketClearingResult {
  plantDispatchDetails: PlantDispatchDetails[]
  clearingPrice: number
  marginalPlantId: string | null
  clearedQuantityMw: number
  unservedDemandMw: number
}


//Auction time
export function clearAuction(
  plants: Plant[],
  demandMw: number,
  market: MarketPriceCategories,
  bidsById: Record<string, number> = {},
): MarketClearingResult {
  const offers = plants
    .map((plant) => ({
      plant,
      marginalCost: marginalCost(plant, market),
      offer: offerPrice(plant, market, bidsById),
      capacity: availableMw(plant),
    }))
    .sort((a, b) => a.offer - b.offer)

  let remaining = demandMw
  let clearingPrice = 0
  let marginalPlantId: string | null = null

  const taken = offers.map((o) => {
    const mwRemaining = Math.max(0, Math.min(o.capacity, remaining)) //clamp to 0. Cannot be negative!
    remaining -= mwRemaining
    if (mwRemaining > 0) {

      // Each plant we take pushes the price up to its offer, so eventually the clearing price is the ask price of the marginal plant. 
      // update the marginal plant as long as mwRemaining (from demand) > 0
      clearingPrice = o.offer
      marginalPlantId = o.plant.id
    }
    return { ...o, mwRemaining, running: mwRemaining > 0 }
  })

  


  const plantDispatchDetails: PlantDispatchDetails[] = taken.map((t) => {
    const spread = clearingPrice + (t.plant.subsidyPerMwh ?? 0) - t.marginalCost
    return {
      plant: t.plant,
      marginalCost: t.marginalCost,
      offer: t.offer,
      marketPrice: clearingPrice,
      spread,
      running: t.running,
      mw: t.mwRemaining,
      profitPerHour: t.running ? spread * t.mwRemaining : 0,
      isMarginal: t.plant.id === marginalPlantId,
    }
  })

  return {
    plantDispatchDetails,
    clearingPrice,
    marginalPlantId,
    clearedQuantityMw: demandMw - Math.max(0, remaining),
    unservedDemandMw: Math.max(0, remaining),
  }
}

export function totals(rows: PlantDispatchDetails[]): EntireFleetTotal {
  const running = rows.filter((r) => r.running)
  return {
    runningCount: running.length,
    plantCount: rows.length,
    totalMw: running.reduce((s, r) => s + r.mw, 0),
    marginPerHour: running.reduce((s, r) => s + r.profitPerHour, 0),
  }
}



//Cap and Trade
//Function that calculates the total overall Tonnes of CO2 potentially produced, from all running plants
export function emissionsTonnesPerHour(rows: PlantDispatchDetails[]): number {
  return rows.filter((r) => r.running).reduce((sum, r) => sum + r.mw * r.plant.co2PerMwh, 0)
}

export interface CarbonMarketResult {
  // The permit price the market settles at, euro/tonne.
  carbonPrice: number
  emissions: number
  cap: number
  // False when emissions are already under the cap at 0 euro — surplus allowances.
  binding: boolean
  // True when even the maximum price cannot get emissions under the cap.
  infeasible: boolean
}

/**
 * Clear the permit market for a given cap.
 *
 * <p>Structurally this is the same move as the electricity auction in chapter 4:
 * a quantity is fixed (there, demand; here, the emissions cap) and the PRICE is
 * whatever makes the system meet it. Emissions fall monotonically as the carbon
 * price rises — dirty plants leave the merit order — so we bisect for the lowest
 * price that brings emissions within the cap.
 *
 * <p>Two real-world outcomes fall straight out. If emissions are already under
 * the cap at £0 the price collapses to zero (the allowance-surplus problem the
 * EU ETS spent years correcting). If no price is high enough, the cap is
 * infeasible for this fleet.
 *
 * @param dispatchAt runs the dispatch at a trial carbon price — passed in so
 *        this works for both price-taker and auction chapters.
 */
export function clearCarbonMarket(
  cap: number,
  dispatchAt: (carbonPrice: number) => PlantDispatchDetails[],
  maxPrice = 300,
): CarbonMarketResult {
  const emissionsAt = (p: number) => emissionsTonnesPerHour(dispatchAt(p))

  const atZero = emissionsAt(0)
  if (atZero <= cap) {
    return { carbonPrice: 0, emissions: atZero, cap, binding: false, infeasible: false }
  }

  const atMax = emissionsAt(maxPrice)
  if (atMax > cap) {
    return { carbonPrice: maxPrice, emissions: atMax, cap, binding: true, infeasible: true }
  }

  let lo = 0
  let hi = maxPrice
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (emissionsAt(mid) <= cap) hi = mid
    else lo = mid
  }
  return { carbonPrice: hi, emissions: emissionsAt(hi), cap, binding: true, infeasible: false }
}


//Hedging
export interface HedgeResult {
  //What you'd earn with no forward contract at all — swings with the price. 
  unhedgedPerHour: number
  //What you actually earn once the contract is settled — much steadier. 
  hedgedPerHour: number
  //Revenue from the volume sold at the agreed fixed price. 
  fixedContractRevenuePerHour: number
  //Hedged margin less unhedged margin; positive when fixed price exceeds spot. 
  hedgeDifferenceFromSpotPerHour: number
  spotRevenuePerHour: number
  costPerHour: number
  spotExposureMw: number //Q_produced - Q_contracted: the volume still linked to spot price
  producedMw: number //Q_produced: what the plant actually generated this hour
  contractedMw: number //Q_contracted: what was pre-sold, generated or not
}

/**
 * Calculate a plant's hour with a physical fixed-price forward contract.
 *
 *   Profit = (Q_spot - Q_contract) × P_spot
 *          +  Q_contract × P_contract
 *          −  Cost(Q_spot)
 *
 * Read it as: you pre-sold Q_contract MWh at a locked price, so only the
 * DIFFERENCE between what you actually generated and what you pre-sold is
 * exposed to the volatile spot price. The contracted chunk earns the agreed
 * price no matter what happens.
 *
 * The non-obvious consequence: once you're heavily hedged, a rising spot price
 * stops helping you — you already sold that volume at a fixed price. Forward
 * contracts quietly discipline generators into bidding competitively.
 **/
 
export function settleWithContract(
  row: PlantDispatchDetails,
  contractMw: number,
  contractPrice: number,
): HedgeResult {
  const produced = row.mw
  const spot = row.marketPrice
  const costPerHour = row.marginalCost * produced

  const spotRevenuePerHour = (produced - contractMw) * spot
  const fixedContractRevenuePerHour = contractMw * contractPrice
  const hedgeDifferenceFromSpotPerHour = contractMw * (contractPrice - spot)

  return {
    unhedgedPerHour: produced * spot - costPerHour,
    hedgedPerHour: spotRevenuePerHour + fixedContractRevenuePerHour - costPerHour,
    fixedContractRevenuePerHour,
    hedgeDifferenceFromSpotPerHour,
    spotRevenuePerHour,
    costPerHour,
    spotExposureMw: produced - contractMw,
    producedMw: produced,
    contractedMw: contractMw,
  }
}






// Helper functions for more realistic simulation --> Stochastic helpers to make the feed 
// wander realistically rather than jump randomly just through math.random()

//Box Muller transform
// https://en.wikipedia.org/wiki/Box%E2%80%93Muller_transform
function gaussian(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export interface WalkOptions {
  base?: number
  reversion?: number
  volatility?: number
  floor?: number
  ceiling?: number
}

export interface Walk {
  get(): number
  set(v: number): void
  step(): number
}


//  Mean-reverting random walk. Important algorithm and declaration that prices will over time eventually converge to the avg price.
//  Each step will drift back then takes a random shock. Better than just random up and down without a pattern of previous trends.
// https://en.wikipedia.org/wiki/Mean_reversion_(finance)
 
export function makeWalkForward({
  base = 75,
  reversion = 0.08,
  volatility = 7,
  floor = -50,
  ceiling = 250,
}: WalkOptions = {}): Walk {
  let value = base
  return {
    get: () => value,
    set: (v: number) => {
      value = clamp(v, floor, ceiling)
    },
    step: () => {
      value = clamp(value + (base - value) * reversion + gaussian() * volatility, floor, ceiling)
      return value
    },
  }
}

export const r2 = (v: number) => Math.round(v * 100) / 100
export const r0 = (v: number) => Math.round(v)
