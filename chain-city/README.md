# isditcoin City — Guardians of the Chain

A Habbo-style avatar game with chests, ranks, leaderboard and a paid Season Pass.
Payments are real SOL transactions to your project wallet, verified on-chain.

## Deploy (Vercel)
1. Push this folder to GitHub.
2. Import the repo in Vercel. It auto-detects Vite.
3. Deploy. The `/api` folder becomes serverless functions automatically.
4. Add your domain in Vercel → Settings → Domains.

## How payment works
- User pays the pass in SOL via Phantom → goes to PROJECT_WALLET.
- Frontend sends the tx signature to `/api/verify-payment`.
- The serverless function checks the Solana blockchain and confirms the wallet
  received the correct amount BEFORE the pass is granted. This runs server-side
  so it can't be bypassed from the browser.

## IMPORTANT — make it production-grade
The current anti-replay guard (`usedSignatures`) lives in memory and resets when
the function goes cold. For real durability so a signature can NEVER be reused
and passes persist per user, back it with a database:
- Easiest: **Vercel KV** (free tier). Store `signature -> granted` and
  `wallet -> hasPass`.
- Then read the user's pass status from the DB on load, instead of localStorage.

## Config
- Project wallet + price: `src/payment.js` and `api/verify-payment.js`
  (keep them in sync).
- Optional: set `SOLANA_RPC` env var in Vercel to a faster RPC (e.g. Helius)
  for reliable verification under load.

## Legal
You confirmed this model is legal in your jurisdiction. The pass sells access &
cosmetics (not a loot box; chests open with earned points). Keep the in-app
disclaimer and have a local lawyer review terms before scaling.
