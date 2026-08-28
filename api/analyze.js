const OPENAI_URL = "https://api.openai.com/v1/responses";

function extractText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
      if (typeof content.output_text === "string") parts.push(content.output_text);
    }
  }
  return parts.join("\n").trim();
}

function isVintedUrl(value) {
  try {
    const u = new URL(value);
    return /(^|\.)vinted\.[a-z.]+$/i.test(u.hostname) && /\/items\//i.test(u.pathname);
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "vinted-value-analyze",
      api_key_configured: Boolean(process.env.OPENAI_API_KEY)
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("analyze POST", {
    contentLength: req.headers["content-length"] || null,
    hasApiKey: Boolean(process.env.OPENAI_API_KEY)
  });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not configured on the server.",
      code: "missing_api_key"
    });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Request body was not valid JSON." });
    }
  }

  const url = String(body.url || "").trim();
  const screenshots = Array.isArray(body.screenshots) ? body.screenshots.slice(0, 8) : [];

  if (!isVintedUrl(url)) {
    return res.status(400).json({ error: "Please submit a valid Vinted item URL." });
  }

  const businessContext = body.businessContext || {};

  const systemPrompt = `
You are the valuation engine for "Vinted Value", a sourcing tool used by a U.S. auction operator buying inventory from Vinted in Central/Eastern Europe.

Your job is NOT to estimate optimistic retail asking prices. Estimate what the merchandise can realistically produce when resold in a mixed U.S.-based online auction to ordinary collectors and resellers.

OPERATING MODEL:
- Inventory is bought in Europe, consolidated in Poland, then imported in bulk to Arkansas.
- Small/light items are strongly preferred because international freight is spread across many pieces.
- The auction normally starts lots at $2.50.
- Customer fees are handled by deterministic software outside your valuation. Do not add buyer premium, order fees, shipping fees, or postage into your hammer estimates.
- Your values must be HAMMER PRICE only.
- A source listing containing many pieces may be broken into multiple auction lots.
- If weak pieces are unlikely to sell individually at $2.50, recommend grouping them.
- First-pass sell-through matters. Do not pretend every piece will sell.
- Weight and compactness materially affect whether a purchase is attractive.

VALUATION METHOD:
1. Inspect the submitted Vinted listing URL with web search. Use the listing title, description, price, visible/indexable details and any other reliable public evidence.
2. If screenshots are supplied, inspect every supplied image carefully. Screenshots outrank assumptions from a generic title.
3. Research current U.S. market evidence for the actual objects/categories. Prefer sold/completed auction evidence when available. Asking prices alone are weak evidence.
4. Translate retail/sold-market evidence into REALISTIC U.S. AUCTION HAMMER expectations. Auction hammer should usually be lower than strong retail/eBay sold prices unless the item has broad competitive demand.
5. Distinguish between number of physical pieces, number of sensible auction lots, and expected number of lots that sell on the first pass.
6. Identify hidden upside only when supported by recognizable brands, dates, makers, rare variants, themes, provenance, NOS condition or other visible evidence.
7. Be conservative with generic Soviet/PRL/Yugoslav/common souvenir material. Cheap acquisition can still make it attractive, but do not inflate hammer value.
8. For bulk lots, estimate the collection as a resale workflow: what should be individual lots, what should be grouped, and what may be unsellable.
9. Estimate total packed merchandise weight as realistically as possible. Do not include the Poland-to-U.S. master carton.
10. If the page cannot be adequately inspected and screenshots are missing, lower confidence and explicitly say what could not be verified. Never invent unseen details.

The user wants a fast purchase decision. Be specific, numerical and conservative.
`;

  const userText = `
Analyze this Vinted listing:
${url}

Business settings supplied by the app:
${JSON.stringify(businessContext)}

Return a valuation of the merchandise itself for the user's U.S. auction. The software will separately calculate buyer-premium revenue, order-fee allocation, Meest freight, import reserve, payment processing, target profit, recommended offer, and walk-away maximum.

Important:
- seller_price_usd should be the current LISTING ITEM PRICE converted to USD if you can verify it. Do not include guessed Vinted shipping.
- seller_price_local should preserve the visible local price and currency when verifiable.
- If the seller says "approximately 400-500", use a conservative count for underwriting and mention the range.
- expected_hammer_total_usd must represent expected FIRST-PASS hammer revenue after considering sell-through, not the theoretical value if every piece eventually sells.
- low_hammer_total_usd and high_hammer_total_usd should also be first-pass scenarios.
`;

  const inputContent = [{ type: "input_text", text: userText }];
  for (const image of screenshots) {
    if (typeof image === "string" && image.startsWith("data:image/")) {
      inputContent.push({ type: "input_image", image_url: image });
    }
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      listing: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          era_origin: { type: "string" },
          condition: { type: "string" },
          seller_price_local: { type: ["string", "null"] },
          seller_price_usd: { type: ["number", "null"] },
          physical_piece_count_low: { type: "integer" },
          physical_piece_count_high: { type: "integer" },
          underwriting_piece_count: { type: "integer" },
          listing_access: { type: "string", enum: ["good", "partial", "poor"] }
        },
        required: [
          "title","category","era_origin","condition","seller_price_local","seller_price_usd",
          "physical_piece_count_low","physical_piece_count_high","underwriting_piece_count","listing_access"
        ]
      },
      auction_plan: {
        type: "object",
        additionalProperties: false,
        properties: {
          recommended_auction_lots: { type: "integer" },
          first_pass_sell_through_pct: { type: "number" },
          expected_sold_lots: { type: "number" },
          avg_hammer_per_sold_lot_usd: { type: "number" },
          low_hammer_total_usd: { type: "number" },
          expected_hammer_total_usd: { type: "number" },
          high_hammer_total_usd: { type: "number" },
          strategy: { type: "string" },
          standout_items: {
            type: "array",
            items: { type: "string" },
            maxItems: 8
          }
        },
        required: [
          "recommended_auction_lots","first_pass_sell_through_pct","expected_sold_lots",
          "avg_hammer_per_sold_lot_usd","low_hammer_total_usd","expected_hammer_total_usd",
          "high_hammer_total_usd","strategy","standout_items"
        ]
      },
      logistics: {
        type: "object",
        additionalProperties: false,
        properties: {
          estimated_total_weight_g: { type: "number" },
          weight_confidence: { type: "string", enum: ["high", "medium", "low"] },
          shipping_profile: { type: "string", enum: ["excellent", "good", "average", "poor"] },
          logistics_note: { type: "string" }
        },
        required: ["estimated_total_weight_g","weight_confidence","shipping_profile","logistics_note"]
      },
      evidence: {
        type: "object",
        additionalProperties: false,
        properties: {
          strengths: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 6
          },
          risks: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 6
          },
          market_notes: { type: "string" },
          confidence_pct: { type: "number" },
          confidence_note: { type: "string" }
        },
        required: ["strengths","risks","market_notes","confidence_pct","confidence_note"]
      }
    },
    required: ["listing","auction_plan","logistics","evidence"]
  };

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        reasoning: { effort: "medium" },
        tools: [{ type: "web_search" }],
        input: [
          { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
          { role: "user", content: inputContent }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "vinted_valuation",
            strict: true,
            schema
          }
        },
        max_output_tokens: 5000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI request failed.",
        details: data?.error || null
      });
    }

    const raw = extractText(data);
    if (!raw) {
      return res.status(502).json({ error: "The model returned no valuation." });
    }

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      return res.status(502).json({
        error: "The model returned a response that could not be parsed.",
        raw
      });
    }

    return res.status(200).json({ analysis });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Unexpected server error."
    });
  }
};
