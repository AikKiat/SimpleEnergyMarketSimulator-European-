import type { AuctionResult, DispatchRow, HedgeResult, Market, Plant, Totals, WalkOptions } from './sim'

// The written reflections live as markdown files in ./reflections/, one per
// chapter, pulled in at build time by Vite (same pipeline as my web portfolio).
// Images referenced inside them live in public/reflections/img/.
const chapterSources = import.meta.glob('./reflections/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const chapterContent = (n: number) =>
  chapterSources[`./reflections/chapter-${String(n).padStart(2, '0')}.md`] ?? ''

export interface ReflectionState {
  rows: DispatchRow[]
  totals: Totals
  //In auction chapters powerPrice is the clearing price — an output, not an input.
  powerPrice: number
  market: Market
  demandMw: number
  auction?: AuctionResult
  hedge?: HedgeResult
}

export interface Trigger {
  id: string
  when: (s: ReflectionState) => boolean
  once?: boolean
  anchor: string
  title: string
  body: string
}

export interface Control {
  /** A Market key, or one of the pseudo-keys below depending on `target`. */
  key: string
  target: 'market' | 'price' | 'demand' | 'bid' | 'availability' | 'contractMw' | 'contractPrice'
  /** Required for 'bid' and 'availability'. */
  plantId?: string
  label: string
  min: number
  max: number
  step: number
  unit: string
}

export interface Reflection {
  id: number
  title: string
  subtitle: string
  /** The written reflection for this chapter, as markdown. */
  content: string
  //'price'--> based on a set price that is given then each plant reacts (how long it should stay on, for now) --> chapters 1-3, 6, 7
  //'auction' --> based on the demand given, the final price emerges from clearing --> chapters 4, 5, 8
  mode: 'price' | 'auction'
  priceControl: 'manual' | 'walkForward'
  initialPrice?: number
  walkForward?: WalkOptions
  //for auction
  demand?: { initial: number; walk?: WalkOptions }
  //for hedging
  contract?: { mw: number; price: number }
  //for cap-and-trade: present = this chapter offers the tax/cap toggle
  carbonMarket?: {
    //starting cap in tonnes CO2 per hour
    initialCapTonnesPerHour: number
    //linear reduction factor: share of the STARTING cap removed per simulated year
    linearReductionFactor: number
    //the statutory penalty level, marked on the readout for reference
    penaltyPerTonne: number
  }
  plants: Plant[]
  controls: Control[]
  triggers: Trigger[]
}

export const REFLECTIONS: Reflection[] = [
  {
    id: 1,
    title: 'Spark Spread, and how it determines the running schedule of power plants',
    subtitle: 'To balance cost of running the plant with the revenue returned from electricity contracts',
    content: chapterContent(1),
    mode: 'price',
    priceControl: 'manual',
    initialPrice: 95,
    plants: [{ id: 'ccgt', name: 'Modern CCGT Exp', fuel: 'GAS', capacityMw: 800, efficiency: 0.55, co2PerMwh: 0.35 }],
    controls: [
      { key: 'powerPrice', target: 'price', label: 'Power price', min: 0, max: 200, step: 1, unit: '£/MWh' },
      { key: 'gasPrice', target: 'market', label: 'Gas price', min: 5, max: 100, step: 1, unit: '£/MWh' },
    ],
    triggers: [
      {
        id: 'profitable',
        when: (s) => s.rows[0].running,
        once: true,
        anchor: 'plant:ccgt',
        title: 'The spread is positive here',
        body: 'From my learning, this means the electricity sells for more than the gas and carbon cost of making it. Each MWh earns the difference, which is the <b>spark spread</b> I read about.',
      },
      {
        id: 'unprofitable',
        when: (s) => !s.rows[0].running,
        anchor: 'plant:ccgt',
        title: 'The spread has gone negative',
        body: 'The price has fallen below what this plant costs to produce a MWh, so running would lose money on every unit. The chimney stops smoking — from my understanding, this on/off call is what the dispatch decision actually is.',
      },
      {
        id: 'expensive-gas',
        when: (s) => s.market.gasPrice > 60,
        once: true,
        anchor: 'board',
        title: 'What a higher gas price does',
        body: 'Raising gas makes the break-even cost climb faster than I first expected. From my reading this is because the plant has to buy roughly <b>two</b> MWh of gas for every one MWh of electricity it sells.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 2,
    title: 'Efficiency and how it is central to a plant\'s economic viability',
    subtitle: 'A less efficient plant that burns more gas per unit of electricity produced, naturally cannot produce \
    as much returns compared to a plant that is much more fuel efficient. That is why turning to renewable methods is also the next step forward.',
    content: chapterContent(2),
    mode: 'price',
    priceControl: 'manual',
    initialPrice: 85,
    plants: [
      { id: 'modern', name: 'Modern CCGT Exp', fuel: 'GAS', capacityMw: 900, efficiency: 0.58, co2PerMwh: 0.33 },
      { id: 'old', name: 'Old CCGT Exp', fuel: 'GAS', capacityMw: 500, efficiency: 0.36, co2PerMwh: 0.52 },
    ],
    controls: [
      { key: 'powerPrice', target: 'price', label: 'Power price', min: 0, max: 200, step: 1, unit: '£/MWh' },
      { key: 'gasPrice', target: 'market', label: 'Gas price', min: 5, max: 100, step: 1, unit: '£/MWh' },
      { key: 'carbonPrice', target: 'market', label: 'Carbon price', min: 0, max: 150, step: 5, unit: '£/t' },
    ],
    triggers: [
      {
        id: 'split',
        when: (s) => s.totals.runningCount === 1,
        anchor: 'plant:old',
        title: 'The less efficient plant drops out first',
        body: 'Both face identical fuel and carbon prices, yet the old plant’s break-even is far higher. It seems this is because it wastes more gas per MWh sold <i>and</i> emits more CO₂ per MWh, so efficiency appears to decide which plant survives a squeeze.',
      },
      {
        id: 'both-dead',
        when: (s) => s.totals.runningCount === 0,
        anchor: 'board',
        title: 'Neither plant is running',
        body: 'The price is below <i>every</i> plant’s cost here. From what I have read, in a real market this would signal that demand is being met by something cheaper — usually wind, solar or nuclear, which I look at in chapter 3.',
      },
      {
        id: 'carbon-bites',
        when: (s) => s.market.carbonPrice > 90,
        once: true,
        anchor: 'board',
        title: 'Raising the carbon price',
        body: 'Carbon cost works out as <code>tonnes CO₂/MWh × carbon price</code>. Since the dirtier plant emits more per MWh, raising the carbon price appears to penalise it more heavily, which from my reading is the intended effect of the policy.',
      },
    ],
  },

  {
    id: 3,
    title: 'The merit order',
    subtitle: 'From what I have learnt, merit order is sketching out a precedence plan, for which plants to run based on their marginal costs.',
    content: chapterContent(3),
    mode: 'price',
    priceControl: 'walkForward',
    walkForward: { base: 80, reversion: 0.04, volatility: 22, floor: -20, ceiling: 260 },
    plants: [
      { id: 'wind', name: 'Wind Farm 1', fuel: 'WIND', capacityMw: 600, efficiency: 1, co2PerMwh: 0, availability: 0.6 },
      { id: 'solar', name: 'Solar Farm 1', fuel: 'SOLAR', capacityMw: 300, efficiency: 1, co2PerMwh: 0, availability: 0.5 },
      { id: 'nuclear', name: 'Nuclear Plant 1', fuel: 'NUCLEAR', capacityMw: 1200, efficiency: 0.34, co2PerMwh: 0 },
      { id: 'ccgt', name: 'Modern CCGT Exp', fuel: 'GAS', capacityMw: 900, efficiency: 0.58, co2PerMwh: 0.33 },
      { id: 'peaker', name: 'OCGT Exp', fuel: 'GAS', capacityMw: 250, efficiency: 0.3, co2PerMwh: 0.62 },
    ],
    controls: [
      { key: 'gasPrice', target: 'market', label: 'Gas price', min: 5, max: 100, step: 1, unit: '£/MWh' },
      { key: 'carbonPrice', target: 'market', label: 'Carbon price', min: 0, max: 150, step: 5, unit: '£/t' },
    ],
    triggers: [
      {
        id: 'zero-cost-only',
        when: (s) => s.totals.runningCount > 0 && s.rows.filter((r) => r.running).every((r) => r.marginalCost < 1),
        anchor: 'board',
        title: 'Only the zero-fuel plants are running',
        body: 'Wind and solar buy no fuel, so their marginal cost is around £0 and they run whenever the weather allows, almost regardless of price. From my reading this is what pushes market prices <b>down</b> — the Merit Order Effect.',
      },
      {
        id: 'peaker-on',
        when: (s) => s.rows.find((r) => r.plant.id === 'peaker')?.running ?? false,
        anchor: 'plant:peaker',
        title: 'The peaker has come online',
        body: 'This plant is inefficient and emits heavily, so it only seems to earn its keep when prices are extreme. I read that peakers may run only a few dozen hours a year and still be worth owning, so seeing one run suggests the system is tight.',
      },
      {
        id: 'full-stack',
        when: (s) => s.totals.runningCount === s.rows.length,
        once: true,
        anchor: 'board',
        title: 'Every plant in the fleet is running',
        body: 'What I notice here is that the cheaper plants earn a <i>much</i> larger margin than the expensive ones at the same price. Being cheap appears to be rewarded with margin rather than just with volume, which I assume is the incentive to build efficient, clean capacity.',
      },
      {
        id: 'all-off',
        when: (s) => s.totals.runningCount === 0,
        once: true,
        anchor: 'board',
        title: 'No plant is running',
        body: 'The price has fallen below even the cheapest plant. Sustained, I understand this indicates more supply than the system can use, which leads towards the negative prices I explore in chapter 8.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 4,
    title: 'Price Auctions at the European Energy Market',
    subtitle: 'Auctions in such markets work in the pay-as-clear fashion, where participants pay a uniform price accorded to all at the auction\'s conclusion.  \
     This is opposed to pay-as-bid auctions where participants are paid the prices specified in their successful bid.',
    content: chapterContent(4),
    mode: 'auction',
    priceControl: 'manual',
    demand: { initial: 1000 },
    plants: [
      { id: 'wind', name: 'Wind Farm 1', fuel: 'WIND', capacityMw: 200, efficiency: 1, co2PerMwh: 0 },
      { id: 'nuclear', name: 'Nuclear Plant 1', fuel: 'NUCLEAR', capacityMw: 300, efficiency: 0.34, co2PerMwh: 0 },
      { id: 'effccgt', name: 'Modern CCGT Exp', fuel: 'GAS', capacityMw: 400, efficiency: 0.58, co2PerMwh: 0.33 },
      { id: 'oldccgt', name: 'Old CCGT Exp', fuel: 'GAS', capacityMw: 300, efficiency: 0.36, co2PerMwh: 0.52 },
      { id: 'peaker', name: 'OCGT Exp', fuel: 'GAS', capacityMw: 200, efficiency: 0.3, co2PerMwh: 0.62 },
    ],
    controls: [
      { key: 'demand', target: 'demand', label: 'Demand (how much the country needs)', min: 0, max: 1600, step: 25, unit: 'MW' },
      { key: 'gasPrice', target: 'market', label: 'Gas price', min: 5, max: 100, step: 1, unit: '£/MWh' },
      { key: 'carbonPrice', target: 'market', label: 'Carbon price', min: 0, max: 150, step: 5, unit: '£/t' },
    ],
    triggers: [
      {
        id: 'uniform-price',
        when: (s) => s.totals.runningCount > 1,
        once: true,
        anchor: 'board',
        title: 'All cleared plants receive the same price',
        body: 'Every plant that cleared is paid the same clearing price regardless of what it offered. The cheaper ones therefore earn a large margin while the marginal one earns close to nothing, and from my reading that gap is the reward for being efficient.',
      },
      {
        id: 'free-wind',
        when: (s) => (s.rows.find((r) => r.plant.id === 'wind')?.spread ?? 0) > 50,
        once: true,
        anchor: 'plant:wind',
        title: 'Wind offered £0 but is paid the clearing price',
        body: 'It offers zero because it has no fuel to buy, so it clears first. But it still collects the full clearing price set by a gas plant further up the stack. This seems to explain why cheap renewables are so profitable when gas is setting the price.',
      },
      {
        id: 'peaker-sets-price',
        when: (s) => s.auction?.marginalPlantId === 'peaker',
        anchor: 'plant:peaker',
        title: 'The peaker is now the marginal plant',
        body: 'We have moved into the steep end of the stack, so this plant’s offer is what the whole market pays. A small rise in demand has produced a large rise in price, which from my reading is what a price spike on a cold, still evening looks like.',
      },
      {
        id: 'blackout',
        when: (s) => (s.auction?.unservedMw ?? 0) > 0,
        anchor: 'board',
        title: 'Demand exceeds the whole fleet',
        body: 'There is nothing left to switch on. I read that in a real system the price would rise to the cap and the operator would begin paying industrial users to reduce consumption, since supply and demand must match and supply can no longer rise.',
      },
      {
        id: 'cheap-only',
        when: (s) => s.powerPrice < 30 && s.totals.runningCount > 0,
        anchor: 'board',
        title: 'A low-priced period',
        body: 'Demand is low enough to be met entirely by the zero and low-cost plants, so the marginal plant is a cheap one and the clearing price falls with it. No gas plant is needed here, so no gas plant sets the price.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 5,
    title: 'Bidding & market power',
    subtitle: ' ',
    content: chapterContent(5),
    mode: 'auction',
    priceControl: 'manual',
    demand: { initial: 1000 },
    plants: [
      { id: 'wind', name: 'Wind Farm 1', fuel: 'WIND', capacityMw: 200, efficiency: 1, co2PerMwh: 0 },
      { id: 'nuclear', name: 'Nuclear Plant 1', fuel: 'NUCLEAR', capacityMw: 300, efficiency: 0.34, co2PerMwh: 0 },
      { id: 'effccgt', name: 'Modern CCGT Exp (Ours)', fuel: 'GAS', capacityMw: 400, efficiency: 0.58, co2PerMwh: 0.33 },
      { id: 'oldccgt', name: 'Old CCGT Exp', fuel: 'GAS', capacityMw: 300, efficiency: 0.36, co2PerMwh: 0.52 },
      { id: 'peaker', name: 'OCGT Exp', fuel: 'GAS', capacityMw: 200, efficiency: 0.3, co2PerMwh: 0.62 },
    ],
    controls: [
      { key: 'bid', target: 'bid', plantId: 'effccgt', label: 'Our offer price', min: 0, max: 250, step: 1, unit: '£/MWh' },
      { key: 'demand', target: 'demand', label: 'Demand', min: 0, max: 1600, step: 25, unit: 'MW' },
    ],
    triggers: [
      {
        id: 'greedy-win',
        when: (s) => {
          const me = s.rows.find((r) => r.plant.id === 'effccgt')
          return !!me && me.running && (me.offer ?? 0) > me.marginalCost + 5
        },
        anchor: 'plant:effccgt',
        title: 'The offer cleared above cost',
        body: 'Demand needed this plant, so the higher offer still cleared and the difference went to margin. What I also notice is that it may have raised the clearing price for everyone, competitors included.',
      },
      {
        id: 'priced-out',
        when: (s) => {
          const me = s.rows.find((r) => r.plant.id === 'effccgt')
          return !!me && !me.running && (me.offer ?? 0) > me.marginalCost + 5
        },
        anchor: 'plant:effccgt',
        title: 'The offer did not clear',
        body: 'Cheaper plants covered demand without us, so this plant earns nothing at all this period — not a smaller margin, zero. I suspect this risk is the discipline that stops everyone bidding very high.',
      },
      {
        id: 'you-are-marginal',
        when: (s) => s.auction?.marginalPlantId === 'effccgt',
        anchor: 'plant:effccgt',
        title: 'This plant is setting the price',
        body: 'Our plant is the marginal one, so its offer is what the whole market pays. From my reading this seems to be the position with the most influence and the least margin, since it earns only the gap between its offer and its own cost.',
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: 6,
    title: 'Futures contracts',
    subtitle: 'The Day Ahead is a solid platform that systematically settles prices and power supply contractual guarantees for the following day. \
    However, it is still exposed to spot-price volatility. \
    Therefore, forward and futures contracts establish the next level of certainty through long term deals, enabling resiliency and forecasting.',
    content: chapterContent(6),
    mode: 'price',
    priceControl: 'walkForward',
    walkForward: { base: 85, reversion: 0.04, volatility: 26, floor: -20, ceiling: 260 },
    contract: { mw: 600, price: 90 },
    plants: [{ id: 'ccgt', name: 'Modern CCGT Exp', fuel: 'GAS', capacityMw: 800, efficiency: 0.55, co2PerMwh: 0.35 }],
    controls: [
      { key: 'contractMw', target: 'contractMw', label: 'Volume sold forward', min: 0, max: 800, step: 25, unit: 'MW' },
      { key: 'contractPrice', target: 'contractPrice', label: 'Agreed forward price', min: 40, max: 150, step: 1, unit: '£/MWh' },
      { key: 'gasPrice', target: 'market', label: 'Gas price', min: 5, max: 100, step: 1, unit: '£/MWh' },
    ],
    triggers: [
      {
        id: 'hedge-saved',
        when: (s) => !!s.hedge && s.hedge.hedgedPerHour > s.hedge.unhedgedPerHour + 2000,
        anchor: 'board',
        title: 'The contract is paying out',
        body: 'Spot has fallen below the agreed forward price, so the contract makes up the difference. Unhedged the position would be losing; hedged it stays steady. From my understanding this is the point of hedging.',
      },
      {
        id: 'gave-up-upside',
        when: (s) => !!s.hedge && s.hedge.unhedgedPerHour > s.hedge.hedgedPerHour + 2000,
        anchor: 'board',
        title: 'The contract has capped the upside',
        body: 'Spot has risen above the agreed forward price, and that volume was already sold at the lower price. This looks like the cost of certainty, and suggests hedging is a risk decision rather than a profit-maximising one.',
      },
      {
        id: 'paid-not-to-run',
        when: (s) => !!s.hedge && !s.rows[0].running && s.hedge.hedgedPerHour > 0,
        anchor: 'plant:ccgt',
        title: 'Earning while the plant is off',
        body: 'The plant is not worth running so it sits idle, yet the position still profits. The power was pre-sold at a good price and can be bought back more cheaply to fulfil the contract. I found this counterintuitive — a hedged generator can earn by not generating.',
      },
    ],
  },


  {
    id: 7,
    title: 'Carbon pricing, and how it internalises pollution as a market cost',
    subtitle: 'Pollution has long been treated as a negative externality. Carbon pricing appears to be the mechanism that brings that cost back inside the market, steering both dispatch and longer-term capital expenditure towards cleaner solutions.',
    content: chapterContent(7),
    mode: 'price',
    priceControl: 'manual',
    initialPrice: 100,
    // Starts just above this fleet's uncapped 1,247 t/h, so the cap begins
    // NON-binding (permit price £0) and only bites as it ratchets down.
    // 0.043 is the EU 'Fit for 55' linear reduction factor.
    carbonMarket: {
      initialCapTonnesPerHour: 1400,
      linearReductionFactor: 0.043,
      penaltyPerTonne: 100,
    },
    plants: [
      { id: 'wind', name: 'Wind Farm 1', fuel: 'WIND', capacityMw: 400, efficiency: 1, co2PerMwh: 0 },
      { id: 'coal', name: 'Coal Plant 1', fuel: 'COAL', capacityMw: 1000, efficiency: 0.36, co2PerMwh: 0.95 },
      { id: 'gas', name: 'Modern CCGT Exp', fuel: 'GAS', capacityMw: 900, efficiency: 0.58, co2PerMwh: 0.33 },
    ],
    controls: [
      { key: 'carbonPrice', target: 'market', label: 'Carbon price ← drag me', min: 0, max: 150, step: 1, unit: '£/t' },
      { key: 'powerPrice', target: 'price', label: 'Power price', min: 0, max: 200, step: 1, unit: '£/MWh' },
      { key: 'coalPrice', target: 'market', label: 'Coal price', min: 5, max: 60, step: 1, unit: '£/MWh' },
    ],
    triggers: [
      {
        id: 'coal-wins',
        when: (s) => {
          const coal = s.rows.find((r) => r.plant.id === 'coal')
          const gas = s.rows.find((r) => r.plant.id === 'gas')
          return !!coal && !!gas && coal.marginalCost < gas.marginalCost
        },
        anchor: 'plant:coal',
        title: 'Coal sits below gas in the merit order',
        body: 'With carbon priced this low, coal’s emissions cost little and its cheaper fuel places it below gas, so it runs first. From my reading this was broadly the European picture through the 2010s.',
      },
      {
        id: 'gas-wins',
        when: (s) => {
          const coal = s.rows.find((r) => r.plant.id === 'coal')
          const gas = s.rows.find((r) => r.plant.id === 'gas')
          return !!coal && !!gas && gas.marginalCost < coal.marginalCost
        },
        anchor: 'plant:gas',
        title: 'Gas has overtaken coal',
        body: 'Carbon is now expensive enough that gas has moved below coal, at roughly <b>£16/tonne</b> with these fuel prices. This is the coal-to-gas switching I read about, where carbon pricing displaces coal generation without banning it.',
      },
    ],
  },

  {
    id: 8,
    title: 'Negative prices',
    subtitle: ' ',
    content: chapterContent(8),
    mode: 'auction',
    priceControl: 'manual',
    demand: { initial: 900 },
    plants: [
      { id: 'wind', name: 'Wind Farm 1', fuel: 'WIND', capacityMw: 900, efficiency: 1, co2PerMwh: 0, subsidyPerMwh: 50 },
      { id: 'solar', name: 'Solar Farm 1', fuel: 'SOLAR', capacityMw: 400, efficiency: 1, co2PerMwh: 0, subsidyPerMwh: 40 },
      { id: 'nuclear', name: 'Nuclear Plant 1', fuel: 'NUCLEAR', capacityMw: 1200, efficiency: 0.34, co2PerMwh: 0 },
      { id: 'ccgt', name: 'Modern CCGT Exp', fuel: 'GAS', capacityMw: 600, efficiency: 0.58, co2PerMwh: 0.33 },
    ],
    controls: [
      { key: 'demand', target: 'demand', label: 'Demand ← drop me', min: 200, max: 2600, step: 50, unit: 'MW' },
      { key: 'windAvail', target: 'availability', plantId: 'wind', label: 'How hard the wind blows', min: 0, max: 1, step: 0.05, unit: '' },
      { key: 'solarAvail', target: 'availability', plantId: 'solar', label: 'How bright the sun is', min: 0, max: 1, step: 0.05, unit: '' },
    ],
    triggers: [
      {
        id: 'negative',
        when: (s) => s.powerPrice < 0,
        anchor: 'board',
        title: 'The clearing price has gone below zero',
        body: 'Generators are now paying to put power on the grid. The subsidised wind farm still profits because its support payment exceeds what it is paying, while the unsubsidised plants are penalised for producing.',
      },
      {
        id: 'deep-negative',
        when: (s) => s.powerPrice < -30,
        once: true,
        anchor: 'board',
        title: 'The price is deeply negative',
        body: 'Prices this low suggest the system cannot physically absorb the generation being offered. From my reading the responses to this are storage, interconnectors for export, and flexible demand — all areas RWE invests in.',
      },
      {
        id: 'back-positive',
        when: (s) => s.powerPrice > 20,
        anchor: 'board',
        title: 'The price is positive again',
        body: 'Demand now exceeds what the zero-fuel plants can supply, so a conventional plant is marginal again and sets a positive price. I notice how quickly it flipped, which seems to be exactly the volatility that flexible generation is paid for.',
      },
    ],
  },
]

export const reflectionById = (id: number): Reflection => REFLECTIONS.find((r) => r.id === id) ?? REFLECTIONS[0]
