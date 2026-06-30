import http from "node:http";

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS" });
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const url = parsed.searchParams.get("url");

  if (!url || !/^https:\/\/[a-z-]+\.polymarket\.com\//.test(url)) {
    res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "bad url" }));
    return;
  }

  try {
    const r = await fetch(url);
    res.writeHead(r.status, { "Access-Control-Allow-Origin": "*", "Content-Type": r.headers.get("content-type") || "text/plain" });
    res.end(await r.text());
  } catch (e) {
    res.writeHead(502, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "upstream fetch failed" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
