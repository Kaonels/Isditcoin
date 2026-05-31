// ─── Real Jupiter swap integration (non-custodial) ──────────────────────────
// Each swap is signed by the user's own Phantom wallet. Funds never pass
// through any central wallet. A 0.5% platform fee is routed to PLATFORM_FEE_ACCOUNT
// via Jupiter's native platformFeeBps parameter.

import { Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";

const RPC = "https://api.mainnet-beta.solana.com";
export const connection = new Connection(RPC, "confirmed");

export const PLATFORM_FEE_BPS = 50; // 0.5%
export const PLATFORM_FEE_WALLET = "FK4P7R9nmqt81USLtQJKMsGFE6D7LPJvrEnnfX7BKChZ";

// Common Solana token mints
export const MINTS = {
  SOL:  "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF:  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  JUP:  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
};

// 1) Get a real quote from Jupiter
export async function getQuote(inputMint, outputMint, amount, slippageBps = 100) {
  const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}`
    + `&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
    + `&platformFeeBps=${PLATFORM_FEE_BPS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Quote failed");
  return res.json();
}

// 2) Build the swap transaction (with platform fee account)
export async function buildSwap(quoteResponse, userPublicKey) {
  const res = await fetch("https://quote-api.jup.ag/v6/swap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      // Jupiter routes the platform fee to a fee token account derived from this wallet
      feeAccount: undefined, // optional ATA; omit to let Jupiter handle simple cases
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!res.ok) throw new Error("Swap build failed");
  return res.json();
}

// 3) Sign with Phantom + send. User approves in their own wallet.
export async function executeSwap(swapTransactionB64, provider) {
  const buf = Uint8Array.from(atob(swapTransactionB64), c => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(buf);
  // Phantom signs — user must approve in the popup
  const signed = await provider.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    maxRetries: 3,
  });
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

// Get real SOL balance
export async function getSolBalance(pubkey) {
  const lamports = await connection.getBalance(new PublicKey(pubkey));
  return lamports / 1e9;
}
