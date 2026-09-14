According to a 2022 keynote by Helene Robaye from Engie Low Carbon Energy Solutions, volumes traded forward are +/- 10 times more than volumes traded in the short term market - Day Ahead and Intraday (Robaye, 2022). From the keynote, the chronological progression of the power trading event flows in this order:

![Chronological progression of power trading, from the Engie keynote](/reflections/img/engie-trading-timeline.png)

- **Forward contract**: defined as a bilateral agreement to buy or sell an asset at a specific moment in time, for a predetermined price, and sold **over the counter (OTC)**.
- **Futures contract**: defined as an agreement to buy or sell an asset at a specific moment in time, for a predetermined price -> traded on an **exchange** which is the counterparty for both participants.

(Robaye, 2022)

The central idea behind both instruments is hedging. Instead of leaving the future sale price of electricity completely exposed to an uncertain spot market, a producer can lock in some of its future revenue beforehand.

## Power Purchase Agreements

> "A PPA is a contractual agreement between a power producer and a power purchaser...longer compared to standard contracts, (to be around) 10, 15, or even 20 years. It outlines the terms and conditions for selling and purchasing electricity. PPAs are used in the energy industry, particularly in renewable energy projects."
>
> - [Flexidao](https://www.flexidao.com/resources/how-to-choose-a-ppa-physical-vs-virtual-ppas)

RWE defines a PPA as a long-term agreement for purchasing or selling renewable electricity which can provide more predictable pricing and financial stability (RWE, n.d.).

More specifically, there are 2 different kinds of PPAs:

- **Physical PPA**
  - Under the Physical PPA between RWE and the customer, RWE delivers contracted power directly to the customer and receives the agreed PPA price. If the delivered power is more than what the customer needs, RWE can sell it at the market as well as its Guarantees of Origin (GO). If the delivered power is less than what the customer needs, the customer will receive the supplmentary power from the market, as well as the Guarantees of Origin (GO).

- **Virtual PPA**
  - Under the virtual PPA, both RWE and the customer agree on a fixed price as well as floating price per megawatt hour, and buy energy from a utility, or the spot market. If the fixed price is less than the spot price, RWE sells energy at the spot price in the market while the customer buys energy at that spot price. Then, RWE additionally pays the customer the remainder of the (spot price - fixed price) to keep to the terms of the contract. Conversely, if the fixed price is greater than the spot price RWE similarly sells energy in the market while the customer buys it. But this time, the *customer* makes do on the remaining (fixed price - spot price) amount to RWE. All this time, the customer receives Guarantees of Origin from RWE.

Source: [RWE Supply & Trading — Power Purchase Agreement](https://www.rwe.com/en/the-group/rwest/rwest-products-and-services/power-purchase-agreement/) (RWE, n.d.)

All these are sophisticated concepts, and it is really difficult to actually model these markets. However, we can focus on the contract itself, and how it fares amidst spot price voltaility -> hence the importance of hedging.

From all of this, linking back to thus toy learning simulator we can model these variables:

| Variable | Meaning |
| --- | --- |
| `Q_produced` | The quantity of energy produced by the energy generation fleet under one company |
| `Q_contracted` | The agreed amount of energy to be produced for the company, to a particular customer. |
| `P_spot` | Spot price of the energy in the spot market |
| `P_contracted` | the agreed contract price (fixed price) in the forward contract. |

In an unhedged scenario, the company sells energy in the market at the spot price and gets a profit via:

```
Q_produced × P_spot − cost
```

However, referring to the above processes, for a forward contract a possible profit valuation can be calculated through:

```
(Quantity of Energy Overproduced) * spot_price per MWh
  + (Quantity of Energy Produced * fixed price per MWh)
  - cost.
```

## Linking to physical and virtual PPAs

**Virtual PPA** --> The company's gains is:

- When fixed price is < spot_price:

```
  (spot_price per MWh) * Quantity_contracted
    - (spot_price - fixed_price) * Quantitiy_contracted

  =

  Q_contracted * (P_fixed)
```

- When fixed price > spot price:

```
  (spot_price per MWh) * Quantity_contracted
    + (fixed_price - spot price) * Quantitiy_contracted

  =

  Q_contracted * (P_fixed)
```

We can see that it is the same amount for both cases. And best of the all, the spot price is gone! That ultimately shows that hedging, or the very act of forward contracts, mathemtically removes the dependency on spot prices.

Overall, if we look at it we can resolve the two sides of the equation - regarding spot prices and contract price, as:

- What would be gained if we just sold in the market (postulated unhedged returns scenario), and then settling the contract details on top of this amount (with hedging). This collapses the equation into:

```
(What we produced in total * spot_price per MWh)
  + (Price differences between contract and the spot price,
     for all MWh units of energy agreed in the contract).
```

This leads to:

```
Net Returns = Q_produced × P_spot − cost
                + Q_contracted × P_fixed - Q_contracted × P_spot

            = (Q_produced − Q_contracted) × P_spot
                + Q_contracted × P_fixed - cost
```

---

For this Toy Simulator we hence focus on this equation, and it shows with a running spot price (based on WalkForward Algorithm), how the net returns (cost subtracted already) is heavily dependent on the spot price, rising up and down compared to the case of a hedged contract.

## Reflection

My reflection on futures specifically: because they are traded on an **exchange** rather than negotiated privately, there is greater **transparency** on top of certainty. All see the same public forward price as a shared reference for what electricity years ahead will be worth.

According to RWE's Annual Report 2025, "to mitigate market risks in electricity generation... (it has secured)...contracts for difference awarded by the state or long-term fixed-price contracts with commercial customers...mainly related to electricity for renewables" (RWE, 2025). The above not only shows how trading in futures empowers market **transparency and certainty**, but also emphasises the pertinence of such a mechanism in the **renewables** market, since sources such as solar, offshore wind are all bound to physical environmental factors that are even more susceptible to unpredictable changes.

One final key finding, from the same annual report: "hedged forward margins for 2025 came in lower." However, "the persistent volatility of spot prices once again supported strong earnings from the short-term optimisation of our power plant dispatch" (RWE, 2025).

Ultimately, this has cemented my understanding that strong energy and supply trading portfolios are a combination of both long and short term actions. The robust futures trading contracts, coupled with fast, reactive and short-term trading, a strong growing financial outlook while at the same time enacting on the wholesome mission for sustainable, green power.

---

## References

Flexidao. (n.d.). *How to choose a PPA: Physical vs virtual PPAs*. https://www.flexidao.com/resources/how-to-choose-a-ppa-physical-vs-virtual-ppas

Robaye, H. (2022, March 10). *Trading in the forward timeframe: How and why?* [Conference presentation]. EFET-ECS Training on Trading in Wholesale Gas and Electricity Markets. ENGIE.

RWE. (n.d.). *Power purchase agreement*. RWE Supply & Trading. https://www.rwe.com/en/the-group/rwest/rwest-products-and-services/power-purchase-agreement/

RWE. (n.d.). *RWE Supply & Trading GmbH*. https://www.rwe.com/en/the-group/rwest/

RWE. (2025). *Annual report 2025*. https://www.rwe.com/-/media/RWE/documents/05-investor-relations/finanzkalendar-und-veroeffentlichungen/2025-GJ/RWE-Annual-Report-2025.pdf
