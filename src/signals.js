// ─── Real signal engine using DexScreener live data ─────────────────────────
// Generates buy/sell signals from real market data. No invented numbers.
// Each signal is scored so you can decide whether to take it.

const PROXIES = [
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => u,
];

async function dexFetch(url) {
  for (const px of PROXIES) {
    try {
      const r = await fetch(px(url), { signal: AbortSignal.timeout(7000) });
      if (r.ok) return r.json();
    } catch {}
  }
  throw new Error("fetch failed");
}

// Pull trending/boosted tokens (real)
export async function fetchCandidates() {
  const data = await dexFetch("https://api.dexscreener.com/token-boosts/top/v1");
  const items = Array.isArray(data) ? data : (data.pairs || []);
  return items.slice(0, 30);
}

// Get full pair data for a token (real price, volume, liquidity)
export async function fetchPairData(tokenAddress) {
  const data = await dexFetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
  return (data.pairs || [])[0] || null;
}

// Scoring rules — fully transparent, based on real metrics.
// Returns { action, score, reasons } so YOU decide.
export function scoreToken(pair) {
  if (!pair) return null;
  const reasons = [];
  let score = 0;

  const ch1h   = pair.priceChange?.h1  || 0;
  const ch24h  = pair.priceChange?.h24 || 0;
  const vol24  = pair.volume?.h24      || 0;
  const liq    = pair.liquidity?.usd   || 0;
  const mcap   = pair.marketCap || pair.fdv || 0;
  const age    = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3600000 : null; // hours

  // Momentum
  if (ch1h > 15)  { score += 2; reasons.push(`+${ch1h.toFixed(0)}% in 1h (strong momentum)`); }
  else if (ch1h > 5) { score += 1; reasons.push(`+${ch1h.toFixed(0)}% in 1h`); }
  if (ch1h < -15) { score -= 2; reasons.push(`${ch1h.toFixed(0)}% in 1h (dumping)`); }

  // Volume
  if (vol24 > 1e6)      { score += 2; reasons.push(`$${(vol24/1e6).toFixed(1)}M volume (high interest)`); }
  else if (vol24 > 2e5) { score += 1; reasons.push(`$${(vol24/1e3).toFixed(0)}K volume`); }

  // Liquidity safety
  if (liq < 20000)      { score -= 3; reasons.push(`LOW liquidity $${(liq/1e3).toFixed(0)}K (rug risk)`); }
  else if (liq > 100000){ score += 1; reasons.push(`$${(liq/1e3).toFixed(0)}K liquidity (safer)`); }

  // Volume/liquidity ratio (healthy churn vs wash)
  if (liq > 0) {
    const ratio = vol24 / liq;
    if (ratio > 10) { score -= 1; reasons.push(`Vol/liq ratio ${ratio.toFixed(0)} (possible wash trading)`); }
  }

  // Age
  if (age !== null && age < 1) { score -= 1; reasons.push(`Very new (<1h, unproven)`); }

  let action = "HOLD";
  if (score >= 3) action = "BUY";
  else if (score <= -2) action = "AVOID";

  return { action, score, reasons, metrics: { ch1h, ch24h, vol24, liq, mcap, age } };
}

// Optional: AI second opinion via Anthropic API (real call).
// Returns a short text read. This is OPINION on public data, not a prediction.
export async function aiSignal(pair, scored) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `You are a cautious crypto analyst. Based ONLY on this real data, give a 2-sentence read and a risk level (LOW/MED/HIGH). Do not predict price. Token: ${pair.baseToken?.symbol}. 1h change: ${scored.metrics.ch1h}%. 24h vol: $${scored.metrics.vol24}. Liquidity: $${scored.metrics.liq}. Rule-based action: ${scored.action} (score ${scored.score}).`
        }],
      }),
    });
    const data = await res.json();
    return data.content?.map(b => b.text || "").join("") || "No AI response";
  } catch {
    return "AI analysis unavailable (rule-based score still valid)";
  }
}
