# Vinted Value

A purchase-decision tool for evaluating individual Vinted listings for resale through a U.S.-based auction operation.

## What it does

Paste a Vinted listing URL and Vinted Value estimates:

- realistic U.S. auction hammer value, not optimistic retail asking prices
- recommended way to split a bulk listing into auction lots
- first-pass sell-through
- expected hammer per sold lot
- Poland-to-Arkansas Meest freight allocation
- import reserve
- recommended offer
- absolute walk-away price
- expected contribution at the seller's asking price
- BUY / OFFER / PASS / NEED PHOTOS verdict

Default auction economics are based on the current operating model:

- $2.50 minimum hammer
- 21% buyer's premium
- $5 per customer order
- $1 per small auction item
- $1 per customer order shipping fee
- actual domestic postage label is pass-through
- average 5 auction items per customer order
- $165 Meest master carton
- 23.5 kg usable merchandise weight
- 15% import reserve
- 3% payment-processing reserve
- target profit of $2 per sold auction lot

All defaults can be changed in the Settings panel.

## Deployment

The frontend is static, but analysis requires a server-side OpenAI API key.

### Vercel

1. Import this GitHub repository into Vercel.
2. Add an environment variable named `OPENAI_API_KEY`.
3. Optionally set `OPENAI_MODEL` (defaults to `gpt-5.6-terra`).
4. Deploy.

Do **not** put an API key in `index.html` or commit one to GitHub.

## Listing access

The app does not run a Vinted crawler or catalog scraper. It sends the user-selected public listing URL to the model with web search enabled. Vinted pages are not always fully indexable, so the app also supports pasting or dropping listing screenshots. When imagery or listing details cannot be verified from the URL alone, the result should say so rather than inventing them.

For image-heavy lots, screenshots materially improve valuation accuracy.

## Files

- `index.html` — responsive frontend and deterministic unit-economics calculations
- `api/analyze.js` — server-side AI valuation endpoint
- `vercel.json` — Vercel routing/configuration
