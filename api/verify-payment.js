// ─── Serverless payment verification (Vercel) ───────────────────────────────
// Verifies on-chain that a real SOL payment of the correct amount was sent to
// the project wallet BEFORE the pass is granted. Runs server-side so it cannot
// be bypassed from the browser.
//
// Endpoint: POST /api/verify-payment   body: { signature, payer }

const PROJECT_WALLET = "FK4P7R9nmqt81USLtQJKMsGFE6D7LPJvrEnnfX7BKChZ";
const PASS_PRICE_SOL = 0.06;
const MIN_LAMPORTS = Math.round(PASS_PRICE_SOL * 1e9 * 0.98); // allow 2% tolerance
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";

// Simple in-memory used-signature guard (per warm instance).
// For production durability, back this with Vercel KV / a database so a
// signature can never be reused across restarts. (Notes below.)
const usedSignatures = new Set();

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

  try {
    const { signature, payer } = req.body || {};
    if (!signature) return res.status(400).json({ ok:false, error:"Missing signature" });

    // Prevent replay: a signature can only grant the pass once
    if (usedSignatures.has(signature)) {
      return res.status(409).json({ ok:false, error:"Signature already used" });
    }

    // Fetch the transaction from Solana
    const rpcRes = await fetch(RPC, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        jsonrpc:"2.0", id:1, method:"getTransaction",
        params:[ signature, { encoding:"jsonParsed", maxSupportedTransactionVersion:0 } ],
      }),
    });
    const data = await rpcRes.json();
    const tx = data.result;
    if (!tx) return res.status(404).json({ ok:false, error:"Transaction not found yet — try again in a few seconds" });
    if (tx.meta?.err) return res.status(400).json({ ok:false, error:"Transaction failed on-chain" });

    // Verify a transfer to the project wallet of >= expected amount.
    // Compare pre/post balances of the project wallet account.
    const keys = tx.transaction.message.accountKeys.map(k => (typeof k === "string" ? k : k.pubkey));
    const idx = keys.indexOf(PROJECT_WALLET);
    if (idx === -1) return res.status(400).json({ ok:false, error:"Payment not sent to project wallet" });

    const pre  = tx.meta.preBalances[idx];
    const post = tx.meta.postBalances[idx];
    const received = post - pre;

    if (received < MIN_LAMPORTS) {
      return res.status(400).json({ ok:false, error:`Underpaid: received ${received/1e9} SOL` });
    }

    // Success — mark signature used and grant pass
    usedSignatures.add(signature);
    return res.status(200).json({
      ok:true,
      verified:true,
      receivedSol: received/1e9,
      signature,
      payer: payer || null,
      grantedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"Verification error: " + (e.message||"unknown") });
  }
}
