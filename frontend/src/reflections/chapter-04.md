
Over here, in my toy simulator learning tool, it is really challenging to actually model a Day Ahead market and show all of the entities involved within the SDAC, EUPHEMIA as the algorithm, etc...

Instead, right here I wanted to focus on the core concepts of the auctioning process behind the Day Ahead, specifically on the pay-as-clear auction (alternative is pay-as-bid), and in this Pay-As-Clear market auction we show how for a given singular value of electricity demanded, how the Merit Order is obtained and how the market clearing price is set.

Following from the previous chapter, **merit orders** determined the order in which bids are accepted (ascending order of supply bid offers) until the demand is satiated. At this point, the last offer accepted becomes the **market clearing price**, and it is applied to all buyers and suppliers. These happen in the **Day-Ahead market**, therefore securing certainty of energy production stores for all participants through the settled contracts.

The marginal cost plays a big role in influencing the offers placed by the energy producing companies, as ultimately in the end the profits obtained are:

final market clearing offer - marginal cost

Hence, the marginal cost is one key factor that affects the offer bid by energy producers, and especially impactful where the nature of the energy produced demands less marginal cost in the conventional sense - such as renewable sources of energy vs CCGTs that entail higher operational, resource costs for coal + gas. Higher marginal costs can lead to higher bid offers, and therefore a lower competitive factor. This links directly to the Merit Order Effect in the previous chapter, as well as the current situation of rising **negative prices** in the energy market, covered in Chapter 8.


---

**More About Day Ahead Market**
The Day Ahead market covers the power generation quotas for **24 hours** of the next day, closing at **12pm** during the day before delivery where results are announced. However, during the period between closing and the start of the next day, some parameters will still shift. Therefore, the participants need to balance their spreadsheets to account for these unprecedented deviations. This is done during the **intraday market**.

Here is an interesting example off the internet, related to **Germany's power market**:

> "On a fictitious Sunday lunchtime in June, the forecasts for Monday indicate that solar and wind renewables will feed in around **43 gigawatt-hours (GWh)** of power between 12 noon and 1 pm. The forecast demand is **60 GWh**. As the marginal costs of renewable energy from wind and solar parks are **close to zero**, their power will be used in any case...
> Conventional power plants compete for the missing **13 gigawatt hours** on the day-ahead market. As low-cost waste-fired power plants supply no more than one gigawatt-hour, additional coal-fired power plants are required. After several of these were needed during the night, some operators even offer their output **below the marginal costs**. Their calculation: **Ramping up** those plants is so expensive that it is more lucrative to only slightly reduce their output-selling the power with a considerable discount. The power plant operator's power traders calculate a marginal price of **EUR 31** for a megawatt-hour at which delivery is still profitable. This clears the market and the auction ends at EUR 31. This price now applies to **every megawatt-hour** that is traded at this time and delivered the following day between 12 noon and 1 p.m. - regardless the power plant generating it.
>
> On the **Intraday Market**: Until the next day and the actual delivery time (t0), the parameters shift again slightly. However, all market players (**"balancing group managers"**) must balance their respective **balancing groups** at the end of a delivery day. This means that the market players must have an even balance between **feed-in and feed-out** in the grid for every quarter of an hour. If they are unable to balance one or more balancing groups via the market, they must pay the grid operators for **balancing energy**, which is usually even more expensive."
> - (FlexPower, n.d.)

---

## References

FlexPower. (n.d.). *Power pricing*. School of Flex. Retrieved July 28, 2026, from https://flex-power.energy/school-of-flex/power-pricing/
