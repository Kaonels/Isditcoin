// ─── Real Solana payment for the Season Pass ────────────────────────────────
// Sends SOL from the user's Phantom wallet to the project wallet.
//
// IMPORTANT — security note for production:
// This frontend sends a REAL payment, but it cannot SECURELY verify it alone.
// To prevent someone faking the pass without paying, you need a small backend
// that watches the project wallet and confirms the transaction landed before
// granting the pass. Until then, treat this as "honor system" — fine for early
// testing, NOT safe against a determined cheater.

import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

const RPC = "https://api.mainnet-beta.solana.com";
export const connection = new Connection(RPC, "confirmed");

// Project wallet (receives pass payments)
export const PROJECT_WALLET = "FK4P7R9nmqt81USLtQJKMsGFE6D7LPJvrEnnfX7BKChZ";

// Pass price in SOL. (Set based on ~$9.99; update as SOL price moves, or
// fetch a live SOL/USD quote to keep it pegged to a dollar amount.)
export const PASS_PRICE_SOL = 0.06;

// Send the pass payment. Returns the transaction signature on success.
export async function payForPass(provider, payerPubkey) {
  const fromPubkey = new PublicKey(payerPubkey);
  const toPubkey = new PublicKey(PROJECT_WALLET);
  const lamports = Math.round(PASS_PRICE_SOL * LAMPORTS_PER_SOL);

  const { blockhash } = await connection.getLatestBlockhash();
  const tx = new Transaction({ feePayer: fromPubkey, recentBlockhash: blockhash })
    .add(SystemProgram.transfer({ fromPubkey, toPubkey, lamports }));

  // User approves in Phantom
  const signed = await provider.signAndSendTransaction(tx);
  const sig = signed.signature || signed;
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

export async function getSolBalance(pubkey) {
  try { return (await connection.getBalance(new PublicKey(pubkey))) / LAMPORTS_PER_SOL; }
  catch { return null; }
}
