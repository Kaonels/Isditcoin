// ─── Crypto news fetcher (real RSS feeds) ───────────────────────────────────
// Pulls recent headlines from reputable crypto sources. We summarize in our
// OWN words for posts — never copy article text (copyright).

const PROXIES = [
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

// Reputable crypto RSS feeds
export const FEEDS = [
  { name: "CoinDesk",      url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt",       url: "https://decrypt.co/feed" },
  { name: "The Block",     url: "https://www.theblock.co/rss.xml" },
  { name: "Bitcoin Mag",   url: "https://bitcoinmagazine.com/.rss/full/" },
];

async function fetchText(url) {
  for (const px of PROXIES) {
    try {
      const r = await fetch(px(url), { signal: AbortSignal.timeout(8000) });
      if (r.ok) return await r.text();
    } catch {}
  }
  throw new Error("feed fetch failed");
}

// Parse RSS XML into headline objects (title, link, date, source)
function parseRSS(xml, source) {
  const items = [];
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const nodes = doc.querySelectorAll("item");
  nodes.forEach(n => {
    const title = n.querySelector("title")?.textContent?.trim() || "";
    const link  = n.querySelector("link")?.textContent?.trim() || "";
    const date  = n.querySelector("pubDate")?.textContent?.trim() || "";
    // We take only the TITLE and a short snippet — never the full article.
    let desc = n.querySelector("description")?.textContent?.trim() || "";
    desc = desc.replace(/<[^>]+>/g, "").slice(0, 180); // strip tags, short snippet only
    if (title) items.push({ title, link, date, source, snippet: desc });
  });
  return items;
}

export async function fetchAllNews(maxPerFeed = 5) {
  const all = [];
  for (const feed of FEEDS) {
    try {
      const xml = await fetchText(feed.url);
      const items = parseRSS(xml, feed.name).slice(0, maxPerFeed);
      all.push(...items);
    } catch {}
  }
  // Sort by date (newest first)
  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  return all;
}
