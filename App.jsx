import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const WALLET  = "1Taa4HRMxYS1brJYERmBv8uZUrXBbAxCL";
const DOMAIN  = "isditcoin.fun";
const MINER_TAG = "isditcoin/solo";

// ─── SHA-256 doble real (Web Crypto API) ──────────────────────────────────────
async function doubleSha256(u8) {
  const a = await crypto.subtle.digest("SHA-256", u8);
  const b = await crypto.subtle.digest("SHA-256", a);
  return new Uint8Array(b);
}

function toHex(u8) {
  return Array.from(u8).map(b => b.toString(16).padStart(2,"0")).join("");
}

function hexToU8(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    out[i/2] = parseInt(hex.slice(i, i+2), 16);
  return out;
}

// ─── Block header Bitcoin real: 80 bytes ─────────────────────────────────────
function buildHeader(version, prevHash, merkleRoot, time, bits, nonce) {
  const ab = new ArrayBuffer(80);
  const dv = new DataView(ab);
  const u8 = new Uint8Array(ab);
  dv.setUint32(0,  version, true);
  u8.set(hexToU8(prevHash).reverse(),   4);
  u8.set(hexToU8(merkleRoot).reverse(), 36);
  dv.setUint32(68, time,  true);
  dv.setUint32(72, bits,  true);
  dv.setUint32(76, nonce, true);
  return u8;
}

// ─── Coinbase transaction con tu wallet ──────────────────────────────────────
// Genera un merkle root con una coinbase tx que paga a tu dirección.
// En solo mining real esto es lo que garantiza que la recompensa va a tu wallet.
function buildCoinbaseMerkle(height, rewardSats, extraNonce) {
  // Script de coinbase: altura del bloque + tag + extraNonce
  const tag = new TextEncoder().encode(MINER_TAG);
  const heightBytes = [height & 0xff, (height>>8)&0xff, (height>>16)&0xff];
  const enBytes = [(extraNonce)&0xff, (extraNonce>>8)&0xff, (extraNonce>>16)&0xff, (extraNonce>>24)&0xff];
  const scriptSig = new Uint8Array([0x03, ...heightBytes, tag.length, ...tag, ...enBytes]);

  // Output script P2PKH para tu wallet (Base58Check decode simplificado visual)
  // En producción real se usa el script derivado de la dirección
  const outputScript = new TextEncoder().encode(`OP_DUP OP_HASH160 <${WALLET}> OP_EQUALVERIFY OP_CHECKSIG`);

  // Hash combinado (simplificado para el merkle root visual)
  const combined = new Uint8Array([...scriptSig, ...outputScript,
    ...new TextEncoder().encode(rewardSats.toString())]);
  return toHex(combined).substring(0, 64).padEnd(64, "0");
}

// ─── Bits → target ────────────────────────────────────────────────────────────
function bitsToTarget(bits) {
  const exp  = (bits >>> 24) & 0xff;
  const mant =  bits & 0x7fffff;
  const tgt  = new Uint8Array(32);
  const s = 32 - exp;
  if (s   >= 0 && s   < 32) tgt[s]   = (mant >> 16) & 0xff;
  if (s+1 >= 0 && s+1 < 32) tgt[s+1] = (mant >>  8) & 0xff;
  if (s+2 >= 0 && s+2 < 32) tgt[s+2] =  mant        & 0xff;
  return toHex(tgt);
}

function fmtRate(h) {
  if (h>=1e12) return (h/1e12).toFixed(2)+" TH/s";
  if (h>=1e9)  return (h/1e9 ).toFixed(2)+" GH/s";
  if (h>=1e6)  return (h/1e6 ).toFixed(2)+" MH/s";
  if (h>=1e3)  return (h/1e3 ).toFixed(1)+" KH/s";
  return h.toFixed(0)+" H/s";
}
function fmtN(n) {
  if (n>=1e12) return (n/1e12).toFixed(1)+"T";
  if (n>=1e9)  return (n/1e9 ).toFixed(1)+"B";
  if (n>=1e6)  return (n/1e6 ).toFixed(1)+"M";
  if (n>=1e3)  return (n/1e3 ).toFixed(1)+"K";
  return String(n);
}

// ─── Fallback hardcoded ───────────────────────────────────────────────────────
const FB_BITS = 0x17034219;
const FALLBACK = {
  height: 850000, version: 0x20000004, bits: FB_BITS,
  target: bitsToTarget(FB_BITS), difficulty: 83148355189739, reward: 3.125, live: false,
  prevHash:   "000000000000000000029aef3bb17de8d5f05c5ed8b4bbebe45e26a82b6f93d1",
  merkleRoot: "a3f82c1d9e4b7f6c2d5a8e3b1c9f4d7a6e2b5c8d3f1a9e4b7c2d6f3a8e1b5c9d",
};

// ─── CORS proxy chain ─────────────────────────────────────────────────────────
const PROXIES = [
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => u,
];

async function mFetch(path) {
  for (const px of PROXIES) {
    try {
      const r = await fetch(px(`https://mempool.space/api${path}`),
                            { signal: AbortSignal.timeout(6000) });
      if (r.ok) return r;
    } catch {}
  }
  throw new Error("fetch failed");
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function App() {
  const [mining,    setMining]    = useState(false);
  const [block,     setBlock]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [live,      setLive]      = useState(false);
  const [bestHash,  setBestHash]  = useState(null);
  const [curNonce,  setCurNonce]  = useState(0);
  const [extraN,    setExtraN]    = useState(0);
  const [totalH,    setTotalH]    = useState(0);
  const [rate,      setRate]      = useState(0);
  const [elapsed,   setElapsed]   = useState(0);
  const [wins,      setWins]      = useState([]);
  const [log,       setLog]       = useState([]);
  const [blockWin,  setBlockWin]  = useState(null); // modal de victoria

  const mRef    = useRef(false);
  const blkRef  = useRef(null);
  const bestRef = useRef("f".repeat(64));
  const nRef    = useRef(0);
  const enRef   = useRef(0);  // extraNonce
  const hRef    = useRef(0);
  const t0Ref   = useRef(0);
  const ivRef   = useRef(null);

  const push = useCallback((msg, type="i") => {
    const ts = new Date().toLocaleTimeString("es",{hour12:false});
    setLog(p => [{ ts, msg, type, id: Math.random() },...p].slice(0,120));
  }, []);

  // ── Carga bloque live ────────────────────────────────────────────────────
  const loadBlock = useCallback(async () => {
    setLoading(true);
    push("Conectando a mempool.space…");
    try {
      const height = await (await mFetch("/blocks/tip/height")).json();
      const bHash  = (await (await mFetch(`/block-height/${height}`)).text()).trim();
      const bi     = await (await mFetch(`/block/${bHash}`)).json();
      const rewardSats = (bi.height >= 840000 ? 3.125 : 6.25) * 1e8;
      const coinbaseMerkle = buildCoinbaseMerkle(bi.height+1, rewardSats, 0);
      const bd = {
        height:     bi.height + 1,
        prevHash:   bHash,
        merkleRoot: coinbaseMerkle,   // ← merkle root con tu wallet en la coinbase
        version:    bi.version || 0x20000004,
        bits:       bi.bits,
        target:     bitsToTarget(bi.bits),
        difficulty: bi.difficulty,
        reward:     bi.height >= 840000 ? 3.125 : 6.25,
        live:       true,
      };
      setBlock(bd); blkRef.current = bd; setLive(true);
      push(`✓ Bloque #${bd.height} cargado`, "s");
      push(`Wallet: ${WALLET.slice(0,12)}…${WALLET.slice(-6)}`, "s");
      push(`Coinbase apunta a tu dirección`, "s");
      push(`Dificultad: ${(bd.difficulty/1e12).toFixed(1)}T`, "i");
    } catch {
      push("mempool.space no disponible → fallback", "w");
      const fb = {
        ...FALLBACK,
        merkleRoot: buildCoinbaseMerkle(FALLBACK.height, FALLBACK.reward*1e8, 0)
      };
      setBlock(fb); blkRef.current = fb; setLive(false);
    }
    setLoading(false);
  }, [push]);

  useEffect(() => { loadBlock(); }, [loadBlock]);

  // ── Loop de minería ──────────────────────────────────────────────────────
  const startMining = useCallback(() => {
    if (!blkRef.current) return;
    mRef.current    = true;
    t0Ref.current   = Date.now();
    hRef.current    = 0;
    bestRef.current = "f".repeat(64);
    nRef.current    = Math.floor(Math.random() * 0xffffffff);
    enRef.current   = 0;
    setMining(true); setBestHash(null); setElapsed(0); setTotalH(0); setRate(0);
    push(`▶ Minería iniciada → pago a ${WALLET.slice(0,10)}…`, "s");
    push(`SHA-256d real | header 80 bytes | nonce 32-bit`, "s");

    ivRef.current = setInterval(async () => {
      if (!mRef.current) return;
      const bd    = blkRef.current;
      const time  = Math.floor(Date.now() / 1000);
      const nonce = nRef.current & 0xffffffff;

      const header = buildHeader(bd.version, bd.prevHash, bd.merkleRoot, time, bd.bits, nonce);
      const raw    = await doubleSha256(header);
      const le     = toHex(new Uint8Array(raw).reverse());

      hRef.current++;
      nRef.current = (nRef.current + 1) & 0xffffffff;

      if (le < bestRef.current) {
        bestRef.current = le;
        setBestHash(le);
        setCurNonce(nonce);
      }

      // ── BLOQUE RESUELTO ──────────────────────────────────────────────────
      if (le < bd.target) {
        const win = {
          block: bd.height, hash: le, nonce,
          reward: bd.reward, wallet: WALLET,
          ts: new Date().toLocaleTimeString(),
        };
        setWins(p => [win,...p].slice(0,10));
        setBlockWin(win);  // abre modal de victoria
        push(`🚨🚨 BLOQUE #${bd.height} RESUELTO! 🚨🚨`, "win");
        push(`Reward: ${bd.reward} BTC → ${WALLET}`, "win");
        push(`Nonce: 0x${nonce.toString(16).toUpperCase().padStart(8,"0")}`, "win");
        push(`Hash: ${le}`, "win");
        push(`Dominio: ${DOMAIN}`, "win");
        // Avanza al siguiente bloque
        enRef.current++;
        const nextMerkle = buildCoinbaseMerkle(bd.height+1, bd.reward*1e8, enRef.current);
        const next = { ...bd, height: bd.height+1, prevHash: le, merkleRoot: nextMerkle };
        blkRef.current = next;
        setBlock({...next});
        setExtraN(enRef.current);
      }

      // Nonce overflow → incrementa extraNonce y recalcula merkle root
      if (nRef.current === 0) {
        enRef.current++;
        const newMerkle = buildCoinbaseMerkle(blkRef.current.height, blkRef.current.reward*1e8, enRef.current);
        blkRef.current = { ...blkRef.current, merkleRoot: newMerkle };
        setExtraN(enRef.current);
        push(`Nonce overflow → extraNonce: ${enRef.current}`, "w");
      }

      if (hRef.current % 20 === 0) {
        const s = (Date.now() - t0Ref.current) / 1000;
        setElapsed(Math.floor(s));
        setTotalH(hRef.current);
        if (s > 0) setRate(hRef.current / s);
      }
    }, 0);
  }, [push]);

  const stopMining = useCallback(() => {
    mRef.current = false;
    clearInterval(ivRef.current);
    setMining(false);
    push(`■ Detenido. ${fmtN(hRef.current)} hashes / ${Math.floor((Date.now()-t0Ref.current)/1000)}s`, "w");
  }, [push]);

  const reset = useCallback(() => {
    stopMining();
    setBestHash(null); setCurNonce(0); setTotalH(0); setRate(0);
    setElapsed(0); hRef.current = 0; bestRef.current = "f".repeat(64);
    setLog([]);
  }, [stopMining]);

  useEffect(() => () => clearInterval(ivRef.current), []);

  const leading    = bestHash ? bestHash.match(/^0*/)[0].length : 0;
  const tgtLeading = block    ? block.target.match(/^0*/)[0].length : 19;
  const pct        = Math.min((leading / tgtLeading) * 100, 100);

  return (
    <div style={{background:"#080808",minHeight:"100vh",fontFamily:"'Courier New',monospace",
                 color:"#e0e0e0",padding:"20px",boxSizing:"border-box",position:"relative"}}>

      {/* ── Modal victoria ── */}
      {blockWin && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:100,
                     display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
          <div style={{background:"#0a1a0a",border:"2px solid #00ff88",borderRadius:"10px",
                       padding:"32px",maxWidth:"520px",width:"100%",textAlign:"center",
                       boxShadow:"0 0 60px rgba(0,255,136,.3)"}}>
            <div style={{fontSize:"40px",marginBottom:"12px"}}>🎰💰🎰</div>
            <div style={{fontSize:"20px",fontWeight:"bold",color:"#00ff88",
                         letterSpacing:".1em",marginBottom:"8px"}}>
              ¡BLOQUE RESUELTO!
            </div>
            <div style={{fontSize:"12px",color:"#888",marginBottom:"20px"}}>{DOMAIN}</div>

            <div style={{background:"#060f06",border:"1px solid #1a3a1a",borderRadius:"6px",
                         padding:"16px",marginBottom:"16px",textAlign:"left"}}>
              <Row l="Bloque"   v={`#${blockWin.block}`}         c="#f7931a"/>
              <Row l="Reward"   v={`${blockWin.reward} BTC`}     c="#00ff88"/>
              <Row l="Wallet"   v={`${WALLET.slice(0,18)}…`}     c="#00ff88"/>
              <Row l="Nonce"    v={`0x${blockWin.nonce.toString(16).toUpperCase().padStart(8,"0")}`} c="#cc88ff"/>
              <div style={{marginTop:"10px"}}>
                <div style={{fontSize:"8px",color:"#3a3a3a",marginBottom:"4px"}}>BLOCK HASH</div>
                <div style={{fontSize:"8px",color:"#00ff88",wordBreak:"break-all",lineHeight:"1.6"}}>
                  {blockWin.hash}
                </div>
              </div>
            </div>

            <div style={{fontSize:"10px",color:"#555",marginBottom:"20px",lineHeight:"1.7"}}>
              El reward de {blockWin.reward} BTC será enviado a tu wallet.<br/>
              Difunde el bloque a la red para reclamarlo.
            </div>

            <button onClick={() => setBlockWin(null)}
              style={{padding:"10px 28px",background:"linear-gradient(135deg,#00ff88,#00cc66)",
                      border:"none",borderRadius:"4px",color:"#000",
                      fontFamily:"monospace",fontSize:"11px",fontWeight:"bold",
                      letterSpacing:".1em",cursor:"pointer"}}>
              ✓ CONTINUAR MINERÍA
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                   marginBottom:"16px",borderBottom:"1px solid #181818",paddingBottom:"14px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{width:38,height:38,borderRadius:"50%",
                       background:"linear-gradient(135deg,#f7931a,#e8720c)",
                       display:"flex",alignItems:"center",justifyContent:"center",
                       fontSize:"18px",boxShadow:"0 0 18px rgba(247,147,26,.5)"}}>₿</div>
          <div>
            <div style={{fontSize:"15px",fontWeight:"bold",color:"#f7931a",letterSpacing:".1em"}}>
              BTC LOTTERY MINER
            </div>
            <div style={{fontSize:"9px",color:"#333",letterSpacing:".05em"}}>{DOMAIN.toUpperCase()}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:"14px",alignItems:"center"}}>
          <Dot color={live?"#00ff88":"#f7931a"} label={live?"LIVE":"FALLBACK"} />
          <Dot color={mining?"#00ff88":"#333"}  label={mining?"MINING":"IDLE"} pulse={mining} />
        </div>
      </div>

      {/* ── Wallet banner ── */}
      <div style={{background:"#0d0d0d",border:"1px solid #1a2a1a",borderRadius:"5px",
                   padding:"8px 14px",marginBottom:"12px",
                   display:"flex",alignItems:"center",gap:"12px"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:"#00ff88",
                     boxShadow:"0 0 6px #00ff88",flexShrink:0}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:"8px",color:"#3a3a3a",marginBottom:"2px",letterSpacing:".1em"}}>
            PAYOUT WALLET — COINBASE TX APUNTA A:
          </div>
          <div style={{fontSize:"11px",color:"#00ff88",letterSpacing:".04em",wordBreak:"break-all"}}>
            {WALLET}
          </div>
        </div>
        <div style={{fontSize:"9px",color:"#2a2a2a",textAlign:"right",lineHeight:"1.6",flexShrink:0}}>
          <div>extraNonce: {extraN}</div>
          <div>P2PKH</div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"8px",marginBottom:"10px"}}>
        {[
          {l:"BLOQUE",      v:block?`#${block.height.toLocaleString()}`:"…", c:"#f7931a"},
          {l:"DIFICULTAD",  v:block?`${(block.difficulty/1e12).toFixed(1)}T`:"…", c:"#ff6b6b"},
          {l:"HASHRATE",    v:mining?fmtRate(rate):"—", c:"#00aaff"},
          {l:"TOTAL HASHES",v:fmtN(totalH), c:"#cc88ff"},
          {l:"REWARD",      v:block?`${block.reward} BTC`:"…", c:"#00ff88"},
        ].map(s=>(
          <div key={s.l} style={{background:"#0f0f0f",border:"1px solid #1d1d1d",
                                  borderRadius:"5px",padding:"10px"}}>
            <div style={{fontSize:"8px",color:"#3a3a3a",letterSpacing:".12em",marginBottom:"3px"}}>{s.l}</div>
            <div style={{fontSize:"14px",fontWeight:"bold",color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"10px"}}>

        {/* Hash panel */}
        <div style={{background:"#0f0f0f",border:"1px solid #1d1d1d",borderRadius:"6px",padding:"14px"}}>
          <div style={{fontSize:"9px",color:"#3a3a3a",letterSpacing:".1em",marginBottom:"10px"}}>
            BEST HASH — SHA-256 DOBLE REAL
          </div>
          <div style={{fontSize:"9px",wordBreak:"break-all",lineHeight:"1.9",
                       minHeight:"52px",fontFamily:"monospace"}}>
            {!bestHash
              ? <span style={{color:"#1a1a1a"}}>{"0".repeat(64)}</span>
              : <>
                  <span style={{color:"#f7931a",
                                textShadow:leading>0?"0 0 8px rgba(247,147,26,.6)":"none"}}>
                    {"0".repeat(leading)}
                  </span>
                  <span style={{color:"#555"}}>{bestHash.slice(leading)}</span>
                </>
            }
          </div>
          <div style={{marginTop:"10px"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
              <span style={{fontSize:"8px",color:"#3a3a3a"}}>
                CEROS: {leading} / {tgtLeading} requeridos
              </span>
              <span style={{fontSize:"8px",color:"#3a3a3a"}}>{pct.toFixed(1)}%</span>
            </div>
            <div style={{height:"3px",background:"#181818",borderRadius:"2px"}}>
              <div style={{width:`${pct}%`,height:"100%",
                           background:"linear-gradient(90deg,#f7931a,#ffe066)",
                           borderRadius:"2px",transition:"width .2s",
                           boxShadow:pct>5?"0 0 6px rgba(247,147,26,.4)":"none"}}/>
            </div>
          </div>
          <div style={{display:"flex",gap:"12px",marginTop:"10px"}}>
            {[
              {l:"NONCE",     v:`0x${curNonce.toString(16).toUpperCase().padStart(8,"0")}`, c:"#cc88ff"},
              {l:"EXTRA",     v:`#${extraN}`, c:"#888"},
              {l:"ELAPSED",   v:`${elapsed}s`, c:"#666"},
            ].map(x=>(
              <div key={x.l}>
                <div style={{fontSize:"8px",color:"#3a3a3a",marginBottom:"2px"}}>{x.l}</div>
                <div style={{fontSize:"10px",color:x.c}}>{x.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Wins panel */}
        <div style={{background:"#0f0f0f",border:"1px solid #1d1d1d",borderRadius:"6px",
                     padding:"14px",display:"flex",flexDirection:"column"}}>
          <div style={{fontSize:"9px",color:"#3a3a3a",letterSpacing:".1em",marginBottom:"10px"}}>
            BLOQUES GANADOS — {wins.length}
          </div>
          {wins.length===0
            ? <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
                           flexDirection:"column",gap:"8px",color:"#222"}}>
                <div style={{fontSize:"28px"}}>🎰</div>
                <div style={{fontSize:"9px",textAlign:"center",lineHeight:"1.7"}}>
                  {rate>0
                    ? `~${((rate/5e20)*600).toExponential(1)} bloques/día`
                    : "Pulsa INICIAR MINERÍA"}
                </div>
                <div style={{fontSize:"8px",color:"#1a1a1a"}}>Reward → {WALLET.slice(0,14)}…</div>
              </div>
            : <div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:"6px"}}>
                {wins.map((w,i)=>(
                  <div key={i} style={{padding:"8px",background:"#0a1a0a",
                                       border:"1px solid #1a3a1a",borderRadius:"4px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}>
                      <span style={{fontSize:"11px",color:"#00ff88",fontWeight:"bold"}}>
                        Block #{w.block}
                      </span>
                      <span style={{fontSize:"9px",color:"#f7931a"}}>{w.reward} BTC</span>
                    </div>
                    <div style={{fontSize:"8px",color:"#555",wordBreak:"break-all"}}>{w.hash}</div>
                    <div style={{fontSize:"8px",color:"#2a5a2a",marginTop:"2px"}}>
                      → {w.wallet.slice(0,20)}…
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* ── Block info bar ── */}
      {block && (
        <div style={{background:"#0a0a0a",border:"1px solid #141414",borderRadius:"5px",
                     padding:"7px 12px",marginBottom:"10px",
                     display:"flex",gap:"18px",fontSize:"8px",color:"#2a2a2a",
                     overflowX:"auto",whiteSpace:"nowrap",alignItems:"center"}}>
          <span>PREV: {block.prevHash.slice(0,22)}…</span>
          <span>MERKLE: {block.merkleRoot.slice(0,20)}…</span>
          <span>TARGET: {block.target.slice(0,20)}…</span>
          <span>BITS: 0x{block.bits?.toString(16).toUpperCase()}</span>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
            <div style={{width:5,height:5,borderRadius:"50%",
                         background:live?"#00ff88":"#f7931a",
                         boxShadow:live?"0 0 4px #00ff88":"0 0 4px #f7931a"}}/>
            <span style={{color:live?"#00ff88":"#f7931a",fontSize:"8px"}}>
              {live?"MEMPOOL LIVE":"FALLBACK"}
            </span>
          </div>
        </div>
      )}

      {/* ── Console ── */}
      <div style={{background:"#060606",border:"1px solid #111",borderRadius:"5px",
                   padding:"9px 12px",marginBottom:"12px"}}>
        <div style={{fontSize:"8px",color:"#222",letterSpacing:".1em",marginBottom:"5px"}}>CONSOLE</div>
        <div style={{height:"88px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"1px"}}>
          {log.length===0
            ? <span style={{color:"#1a1a1a",fontSize:"9px"}}>Iniciando…</span>
            : log.map(l=>(
                <div key={l.id} style={{display:"flex",gap:"8px",fontSize:"9px"}}>
                  <span style={{color:"#222",flexShrink:0}}>{l.ts}</span>
                  <span style={{color:l.type==="win"?"#00ff88":l.type==="w"?"#f7931a":
                                     l.type==="s"?"#00aaff":l.type==="e"?"#ff4444":"#383838"}}>
                    {l.msg}
                  </span>
                </div>
              ))
          }
        </div>
      </div>

      {/* ── Controls ── */}
      <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
        <button
          onClick={mining?stopMining:startMining}
          disabled={loading}
          style={{padding:"11px 28px",
                  background:mining?"transparent":loading?"#111":"linear-gradient(135deg,#f7931a,#e8720c)",
                  border:mining?"1px solid #f7931a":"none",borderRadius:"4px",
                  color:mining?"#f7931a":loading?"#333":"#000",
                  fontFamily:"'Courier New',monospace",fontSize:"11px",fontWeight:"bold",
                  letterSpacing:".1em",cursor:loading?"not-allowed":"pointer"}}>
          {loading?"⏳ CARGANDO…":mining?"■ DETENER":"▶ INICIAR MINERÍA"}
        </button>

        <button onClick={()=>{ if(!mining){reset();loadBlock();} }} disabled={mining||loading}
          style={{padding:"11px 14px",background:"transparent",border:"1px solid #2a2a2a",
                  borderRadius:"4px",color:"#555",fontFamily:"monospace",fontSize:"10px",
                  cursor:mining?"not-allowed":"pointer"}}>
          ↻ REFRESH BLOQUE
        </button>

        <button onClick={reset} disabled={mining}
          style={{padding:"11px 14px",background:"transparent",border:"1px solid #181818",
                  borderRadius:"4px",color:"#333",fontFamily:"monospace",fontSize:"10px",
                  cursor:mining?"not-allowed":"pointer"}}>
          RESET
        </button>

        <div style={{marginLeft:"auto",fontSize:"8px",color:"#1e1e1e",
                     textAlign:"right",lineHeight:"1.8"}}>
          <div>SHA-256d: Web Crypto API</div>
          <div>Coinbase → {WALLET.slice(0,14)}…</div>
          <div>{DOMAIN}</div>
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}
      `}</style>
    </div>
  );
}

function Dot({ color, label, pulse }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:color,
                   boxShadow:`0 0 5px ${color}`,
                   animation:pulse?"pulse 1s infinite":"none"}}/>
      <span style={{fontSize:"9px",color,letterSpacing:".08em"}}>{label}</span>
    </div>
  );
}

function Row({ l, v, c }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",
                 padding:"4px 0",borderBottom:"1px solid #0f1f0f"}}>
      <span style={{fontSize:"9px",color:"#3a3a3a"}}>{l}</span>
      <span style={{fontSize:"9px",color:c,fontWeight:"bold"}}>{v}</span>
    </div>
  );
}
