export default async function handler(req, res) {
  const url = req.query.url;
  if (!url || !/^https:\/\/[a-z-]+\.polymarket\.com\//.test(url))
    return res.status(400).json({ error: "bad url" });
  const r = await fetch(url);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(r.status).send(await r.text());
}
