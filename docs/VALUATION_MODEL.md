# Valuation model

Vinted Value intentionally separates **merchandise valuation** from **purchase economics**.

## 1. AI valuation

The model estimates:

- physical piece count
- recommended auction-lot count
- first-pass sell-through
- average hammer per sold lot
- low / expected / high first-pass hammer totals
- total merchandise weight
- strengths, risks, and confidence

Hammer estimates exclude buyer premium and customer fees.

## 2. Auction revenue

For expected sold lots `L` and expected hammer `H`:

```
buyer premium revenue = H × 21%
small-item fee revenue = L × $1
allocated order-fee revenue = L × (($5 + $1) / 5)
expected auction revenue =
    H
  + buyer premium revenue
  + small-item fee revenue
  + allocated order-fee revenue
```

Domestic postage is omitted from contribution because the actual shipping label is charged to the customer.

## 3. Poland → Arkansas freight

Default master-carton assumptions:

```
Meest master carton = $165
usable merchandise weight = 23.5 kg
freight per kg = $165 / 23.5 ≈ $7.02/kg
listing freight = estimated listing weight × $7.02/kg
```

The defaults are editable.

## 4. Purchase ceilings

The app subtracts:

- payment-processing reserve
- Meest allocation
- target or floor profit
- import reserve

The **Target Buy** preserves the target profit per expected sold auction lot.

The **Walk-away Max** preserves only the floor profit per expected sold auction lot.

Default profit settings:

- Target: $2 per expected sold auction lot
- Floor: $1 per expected sold auction lot

When the actual Vinted checkout total is unknown, the app reserves $4 for buyer protection + inbound Poland shipping. That reserve is editable.

## 5. Verdicts

- **STRONG BUY** — asking all-in cost is at most ~75% of Target Buy
- **BUY** — asking all-in cost is within Target Buy
- **OFFER** — above Target Buy but below Walk-away Max
- **PASS** — above Walk-away Max
- **NEED PHOTOS** — listing evidence is too weak to support a confident purchase decision

## 6. Sourcing philosophy

The tool favors:

- bulk lots
- small/light items
- NOS/deadstock
- recognizable brands/institutions/themes
- lots that can be broken into many sensible auction lots
- items where weak pieces can be grouped rather than individually relisted

It penalizes:

- heavy low-dollar items
- generic material with weak sell-through
- optimistic retail asking-price comparisons
- inventory that only works if every piece sells
