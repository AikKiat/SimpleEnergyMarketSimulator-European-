# Simple Energy Market Game Simulator

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![three.js](https://img.shields.io/badge/three.js-r185-000000?style=flat-square&logo=threedotjs&logoColor=white)
![Java](https://img.shields.io/badge/Java-26-ED8B00?style=flat-square&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.1-6DB33F?style=flat-square&logo=springboot&logoColor=white)
![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-3.9-231F20?style=flat-square&logo=apachekafka&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![nginx](https://img.shields.io/badge/nginx-009639?style=flat-square&logo=nginx&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![Claude API](https://img.shields.io/badge/Claude_API-D97757?style=flat-square&logo=anthropic&logoColor=white)

Just a Energy Market simulator I made, as an entrypoint into understanding the European Energy Market and how something as `seemingly` simple and ubiquitous such as energy, is actually a product of a long, painstaking and storied journey being made possible by various key drivers of our global infrastructure, and economy. It is my fist step to better understanding finance as a software engineer. Cheers.




An interactive, reflective learning tool that teaches how a wholesale electricity
market actually works — from a single power plant's run/don't-run decision all the
way up to negative prices — by letting you *drive the market yourself* with sliders
and watch the consequences clear in real time.

This started as a way for me to learn energy markets from zero. Rather than just
reading about merit order and spark spreads, I built the market, wired each concept
to a control I could move, and wrote up what I understood at each step. The result is
part simulator, part learning journal: every lesson pairs a short reflection (in my
own words, with sources) with a live model you can experiment on.

---

## My Key Reflective Points (Split into chapters)

The lessons build on each other — each one adds a single new idea on top of the same
underlying auction, in roughly this order:

1. **Spark spread** — why a gas plant runs only when electricity is worth more than
   the gas (and carbon) needed to make it, and how that decision becomes a schedule.
2. **Efficiency & economic viability** — why a more efficient plant survives a price
   squeeze that shuts a less efficient one, and why zero-fuel renewables are the
   logical endpoint of that argument.
3. **The merit order** — ranking plants cheapest-first to meet demand, and the
   Merit Order Effect: cheap renewables pushing conventional plants down the stack.
4. **Marginal pricing & the day-ahead auction** — how a pay-as-clear auction sets a
   single uniform clearing price (the marginal plant's offer) that everyone receives.
5. **Market power & strategic bidding** — what happens when plants can bid *above*
   cost, why withholding is tempting, and why it's regulated.
6. **Hedging** — forwards, futures and Contracts for Difference: locking in a price
   to trade volatility for certainty, and how hedging quietly disciplines bidding.
7. **Carbon pricing** — how the EU ETS re-sorts the merit order by making dirtier
   plants' costs climb faster, driving coal-to-gas switching.
8. **Negative prices** — how per-MWh subsidies (and inflexibility) push the marginal
   offer below zero, dragging the whole market price with it.

---

## How the simulation works

At the heart is a single clearing routine shared by every lesson:

1. Each plant computes its **marginal cost**:
   `(fuel price ÷ efficiency) + (tonnes CO₂/MWh × carbon price)`
2. It turns that into an **offer** (optionally adjusted for subsidies or strategy).
3. Offers are sorted cheapest-first and stacked until they meet demand
   (the **merit order**).
4. The last plant needed — the **marginal plant** — sets the **uniform clearing
   price** paid to every plant that cleared.

Each lesson exposes a few of these inputs as sliders (power price, gas price, carbon
price, wind availability, demand, strategic bid...) and defines **triggers** that
detect meaningful states ("the inefficient plant just dropped out", "the market
cleared negative") and surface them as events.

---

## Features

- **Interactive lessons** — move a slider, watch the merit order re-stack and the
  clearing price update instantly.
- **Event detection** — the simulator flags meaningful moments as they happen
  (a plant dropping out, coal-to-gas switching, a negative clearing price) rather
  than front-loading explanation.
- **Optional AI analyst** — on request, an assistant (Anthropic Claude API) explains
  *why* a detected event occurred, with structured output, prompt caching, graceful
  degradation when no API key is present, and session-scoped memory. (Disabled for now but fully implemented in the codebase. Plan to develop it further.)
- **Realtime sync with actual data sources** — each feed can be toggled
  individually between live and simulated, and the panel states plainly which
  ones *can* be live and which cannot (see below).


---

## External data sources

The backend is a small ETL pipeline: poll → publish to Kafka → project into a
read model → serve `GET /api/market/live`. The frontend shows every feed with its
provider, endpoint and cost, so it is always clear what is real and what is
simulated.

| Feed | Source | Endpoint | Region | Cost | Status |
|---|---|---|---|---|---|
| Generation mix | Carbon Intensity API | `api.carbonintensity.org.uk/generation` | Great Britain | Free, no key | **Live** |
| Carbon intensity | Carbon Intensity API | `api.carbonintensity.org.uk/intensity` | Great Britain | Free, no key | **Live** |
| Day-ahead / system power price | Elexon BMRS / ENTSO-E Transparency Platform | `bmrs.elexon.co.uk` / `transparency.entsoe.eu` | GB / EU bidding zones | Free, needs an API key | Not wired yet |
| Fuel & carbon prices | Commercial market data (ICE, EEX and similar) | Subscription data terminals | NBP/TTF gas, API2 coal, EU ETS carbon | Paid | No free feed — simulated |

Polled every 5 minutes; the upstream feed itself only updates every half hour, so
polling harder just wastes calls.

Two honest caveats worth stating:

- **Carbon intensity is display-only.** The live gCO₂/kWh reading is shown for
  context, but the carbon *price* driving the merit order is still the slider —
  there is no free feed for the EU ETS price.
- **Gas, coal and carbon prices have no free live source.** They are simulated in
  the frontend. The pipeline is wired for them regardless, so swapping in a real
  feed later is a change in one place.

---

## Hosted on

| Part | Where |
|---|---|---|
| Frontend | **Vercel** https://simple-energy-market-simulato-git-835623-millerman764s-projects.vercel.app/ |
| Backend | AWS EC2 (`t3.small`) + Docker Compose, nginx behind Cloudflare |

The frontend runs entirely standalone: the whole simulation — merit order,
clearing price, hedging, cap-and-trade — is computed in the browser, so the live
site is fully usable with the backend offline. The backend only adds the live GB
feeds on top.

## How to run

**Frontend only** (enough for everything except the live feeds):

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

**With the backend** (adds the live GB generation mix and carbon intensity):

```bash
docker compose up -d   # Kafka (KRaft, no Zookeeper) + Postgres
./mvnw spring-boot:run # http://localhost:8080
```

Then in another terminal run the frontend as above — Vite proxies `/api` to
`localhost:8080` in dev, so no configuration is needed.

Postgres is only used by the AI analyst, which is currently disabled; the app
boots and serves the live feeds without it.

To serve the built frontend from Spring instead of Vite:

```bash
cd frontend && npm run build:spring   # builds, then copies into src/main/resources/static
```

---

## Tech stack

- **Frontend / lesson engine:** TypeScript + React (declarative lessons: plants,
  controls, and triggers as data)
- **Simulation core:** a shared merit-order clearing engine
- **Visualisation (in progress):** a graphical three.js front-end to show plants,
  bidding, and the clearing price as a proper little game
