// ─── Copy-trade engine (reads real on-chain activity) ───────────────────────
// Watches wallets you choose and detects when they BUY a token, so you can
// mirror the trade from YOUR wallet. You still approve every mirrored buy.

import { Connection, PublicKey } from "@solana/web3.js";

const RPC = "https://api.mainnet-beta.solana.com";
const conn = new Connection(RPC, "confirmed");

// Known SPL token program for parsing
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// Track last-seen signature per wallet so we only react to NEW trades
const lastSeen = {};

// Fetch recent transactions for a watched wallet and detect token buys.
// Returns array of detected buys: { wallet, token, signature, time }
export async function detectNewBuys(walletAddress) {
  try {
    const pk = new PublicKey(walletAddress);
    const sigs = await conn.getSignaturesForAddress(pk, { limit: 10 });
    if (!sigs.length) return [];

    const newBuys = [];
    const stopAt = lastSeen[walletAddress];

    for (const s of sigs) {
      if (s.signature === stopAt) break; // reached already-seen
      if (s.err) continue;

      // Parse the transaction to find token balance changes (a buy = token balance up)
      const tx = await conn.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) continue;

      const pre  = tx.meta?.preTokenBalances  || [];
      const post = tx.meta?.postTokenBalances || [];

      // Find tokens whose balance INCREASED for this wallet (likely a buy)
      for (const pb of post) {
        if (pb.owner !== walletAddress) continue;
        const before = pre.find(x => x.accountIndex === pb.accountIndex);
        const beforeAmt = before ? parseFloat(before.uiTokenAmount.uiAmountString || 0) : 0;
        const afterAmt  = parseFloat(pb.uiTokenAmount.uiAmountString || 0);
        if (afterAmt > beforeAmt && pb.mint !== "So11111111111111111111111111111111111111112") {
          newBuys.push({
            wallet: walletAddress,
            token: pb.mint,
            amount: (afterAmt - beforeAmt).toFixed(2),
            signature: s.signature,
            time: s.blockTime ? new Date(s.blockTime * 1000).toLocaleTimeString() : "—",
          });
        }
      }
    }

    // Update last seen
    lastSeen[walletAddress] = sigs[0].signature;
    return newBuys;
  } catch (e) {
    return [];
  }
}

// Watch multiple wallets at once
export async function scanWatchedWallets(wallets) {
  const all = [];
  for (const w of wallets) {
    const buys = await detectNewBuys(w);
    all.push(...buys);
  }
  return all;
}

// Get token metadata (symbol) from Jupiter token list — cached
let tokenList = null;
export async function getTokenSymbol(mint) {
  try {
    if (!tokenList) {
      const r = await fetch("https://token.jup.ag/strict");
      tokenList = await r.json();
    }
    const t = tokenList.find(x => x.address === mint);
    return t ? t.symbol : mint.slice(0, 6);
  } catch {
    return mint.slice(0, 6);
  }
}
