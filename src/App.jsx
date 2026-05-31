import { useState, useEffect, useCallback, useRef } from "react";
import { getQuote, buildSwap, executeSwap, getSolBalance, MINTS } from "./jupiter.js";
import { fetchCandidates, fetchPairData, scoreToken } from "./signals.js";
import { scanWatchedWallets, getTokenSymbol } from "./copytrade.js";

const C = {
  bg:"#080810", bg2:"#0d0d1c", bg3:"#12122a", border:"#1e1e3a",
  orange:"#f7931a", orangeD:"#c97010", purple:"#9b59ff", purpleD:"#6a35cc",
  purpleL:"#c084fc", green:"#00ff88", red:"#ff4466", blue:"#00aaff",
  yellow:"#ffe066", text:"#e0e0f0", muted:"#555580", dim:"#1e1e38",
};
const DOMAIN = "isditcoin.xyz";
const short = (w,s=6)=>w?`${w.slice(0,s)}…${w.slice(-4)}`:"—";
const ts = ()=>new Date().toLocaleTimeString("en",{hour12:false});

export default function App(){
  const [provider,setProvider]=useState(null);
  const [pubkey,setPubkey]=useState(null);
  const [solBal,setSolBal]=useState(null);
  const [scanning,setScanning]=useState(false);
  const [autoMode,setAutoMode]=useState(false);
  const [signals,setSignals]=useState([]);
  const [history,setHistory]=useState([]);
  const [buySize,setBuySize]=useState("0.05");
  const [status,setStatus]=useState(null);
  const ivRef=useRef(null);
  const autoRef=useRef(false);

  // ── Copy-trade state ──
  const [tab,setTab]=useState("signals");
  const [watchList,setWatchList]=useState([
    "BjSeEChiVANUAEeqDJVrKqwmfTK5aSdmHJPdBqyFUvv8", // example known wallet
  ]);
  const [watchInput,setWatchInput]=useState("");
  const [copyBuys,setCopyBuys]=useState([]);
  const [copyWatching,setCopyWatching]=useState(false);
  const copyIvRef=useRef(null);
  const copyWatchRef=useRef(false);

  useEffect(()=>{ const p=window?.phantom?.solana; if(p?.isPhantom) setProvider(p); },[]);

  const connect=useCallback(async()=>{
    if(!provider){ window.open("https://phantom.app/","_blank"); return; }
    try{
      const res=await provider.connect();
      const pk=res.publicKey.toString();
      setPubkey(pk);
      setSolBal((await getSolBalance(pk)).toFixed(4));
      setStatus({type:"ok",msg:"Wallet connected"});
    }catch{ setStatus({type:"err",msg:"Connection rejected"}); }
  },[provider]);

  const disconnect=useCallback(async()=>{
    try{ await provider?.disconnect(); }catch{}
    setPubkey(null); setSolBal(null); setAutoMode(false); autoRef.current=false;
  },[provider]);

  // Real scan: pull candidates, score with real data
  const scan=useCallback(async()=>{
    setScanning(true);
    try{
      const cands=await fetchCandidates();
      const found=[];
      for(const c of cands.slice(0,12)){
        const addr=c.tokenAddress||c.baseToken?.address;
        if(!addr) continue;
        const pair=await fetchPairData(addr);
        if(!pair) continue;
        const scored=scoreToken(pair);
        if(!scored) continue;
        if(scored.action==="BUY" || scored.action==="AVOID"){
          found.push({
            id:Math.random(), addr,
            symbol:pair.baseToken?.symbol||addr.slice(0,6),
            name:pair.baseToken?.name||"",
            action:scored.action, score:scored.score,
            reasons:scored.reasons, metrics:scored.metrics,
            url:pair.url||"", ts:ts(), taken:false,
          });
        }
        if(found.length>=6) break;
      }
      setSignals(found);
      // Auto mode: execute BUY signals automatically
      if(autoRef.current && pubkey){
        for(const s of found.filter(x=>x.action==="BUY")){
          await takeSignal(s, true);
        }
      }
    }catch(e){ setStatus({type:"err",msg:"Scan failed — retrying next cycle"}); }
    setScanning(false);
  },[pubkey]);

  // Execute a real buy via Jupiter (SOL -> token)
  const takeSignal=useCallback(async(sig, isAuto=false)=>{
    if(!pubkey||!provider){ setStatus({type:"err",msg:"Connect wallet first"}); return; }
    try{
      setStatus({type:"info",msg:`${isAuto?"[AUTO] ":""}Quoting ${sig.symbol}…`});
      const rawAmount=Math.floor(parseFloat(buySize)*1e9); // SOL has 9 decimals
      const quote=await getQuote(MINTS.SOL, sig.addr, rawAmount, 150);
      setStatus({type:"info",msg:`Approve ${sig.symbol} buy in Phantom…`});
      const { swapTransaction }=await buildSwap(quote, pubkey);
      const txid=await executeSwap(swapTransaction, provider);
      setHistory(h=>[{
        symbol:sig.symbol, action:"BUY", size:buySize,
        score:sig.score, sig:txid, mode:isAuto?"AUTO":"MANUAL", ts:ts(),
      },...h].slice(0,30));
      setSignals(prev=>prev.map(x=>x.id===sig.id?{...x,taken:true}:x));
      setSolBal((await getSolBalance(pubkey)).toFixed(4));
      setStatus({type:"ok",msg:`Bought ${sig.symbol} ✓`});
    }catch(e){
      setStatus({type:"err",msg:e.message?.includes("User rejected")?"You rejected the buy":"Buy failed: "+(e.message||"unknown")});
    }
  },[pubkey,provider,buySize]);

  // Toggle auto mode
  const toggleAuto=()=>{
    const next=!autoMode;
    setAutoMode(next); autoRef.current=next;
    if(next){ scan(); ivRef.current=setInterval(scan,60000); }
    else clearInterval(ivRef.current);
  };
  useEffect(()=>()=>clearInterval(ivRef.current),[]);

  // ── Copy-trade: buy a token directly by mint (mirror a watched wallet) ──
  const copyBuy=useCallback(async(tokenMint, symbol)=>{
    if(!pubkey||!provider){ setStatus({type:"err",msg:"Connect wallet first"}); return; }
    try{
      setStatus({type:"info",msg:`Quoting ${symbol}…`});
      const rawAmount=Math.floor(parseFloat(buySize)*1e9);
      const quote=await getQuote(MINTS.SOL, tokenMint, rawAmount, 150);
      setStatus({type:"info",msg:`Approve ${symbol} buy in Phantom…`});
      const { swapTransaction }=await buildSwap(quote, pubkey);
      const txid=await executeSwap(swapTransaction, provider);
      setHistory(h=>[{symbol, action:"COPY BUY", size:buySize, sig:txid, mode:"COPY", ts:ts()},...h].slice(0,30));
      setSolBal((await getSolBalance(pubkey)).toFixed(4));
      setStatus({type:"ok",msg:`Copied buy: ${symbol} ✓`});
    }catch(e){
      setStatus({type:"err",msg:e.message?.includes("User rejected")?"You rejected the buy":"Copy buy failed: "+(e.message||"")});
    }
  },[pubkey,provider,buySize]);

  // Scan watched wallets for new buys
  const scanCopy=useCallback(async()=>{
    if(watchList.length===0) return;
    try{
      const buys=await scanWatchedWallets(watchList);
      for(const b of buys){
        b.symbol=await getTokenSymbol(b.token);
        b.id=b.signature+b.token;
      }
      if(buys.length>0){
        setCopyBuys(prev=>{
          const existing=new Set(prev.map(x=>x.id));
          const fresh=buys.filter(x=>!existing.has(x.id));
          return [...fresh,...prev].slice(0,40);
        });
      }
    }catch{}
  },[watchList]);

  const toggleCopyWatch=()=>{
    const next=!copyWatching;
    setCopyWatching(next); copyWatchRef.current=next;
    if(next){ scanCopy(); copyIvRef.current=setInterval(scanCopy,30000); }
    else clearInterval(copyIvRef.current);
  };
  useEffect(()=>()=>clearInterval(copyIvRef.current),[]);

  const addWallet=()=>{
    const w=watchInput.trim();
    if(w && !watchList.includes(w)){ setWatchList([...watchList,w]); setWatchInput(""); }
  };
  const removeWallet=w=>setWatchList(watchList.filter(x=>x!==w));

  const fmtUSD=n=>!n?"$0":n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1e3?`$${(n/1e3).toFixed(0)}K`:`$${n.toFixed(2)}`;

  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Courier New',monospace",color:C.text,padding:"16px 20px",boxSizing:"border-box"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${C.orange},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:`0 0 20px ${C.orange}55`}}>◎</div>
          <div>
            <div style={{fontSize:17,fontWeight:"bold",background:`linear-gradient(90deg,${C.orange},${C.purpleL})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:".1em"}}>ISDITCOIN BOT</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:".1em"}}>{DOMAIN} · SIGNAL TRADING</div>
          </div>
        </div>
        {pubkey
          ? <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:C.green}}>{short(pubkey)}</div>
              <div style={{fontSize:9,color:C.muted}}>{solBal} SOL</div>
              <button onClick={disconnect} style={{fontSize:8,color:C.red,background:"none",border:"none",cursor:"pointer",padding:0,marginTop:2}}>Disconnect</button>
            </div>
          : <button onClick={connect} style={{padding:"9px 18px",background:`linear-gradient(135deg,${C.purple},${C.purpleD})`,border:"none",borderRadius:6,color:"#fff",fontFamily:"monospace",fontSize:11,fontWeight:"bold",letterSpacing:".08em",cursor:"pointer"}}>{provider?"CONNECT PHANTOM":"INSTALL PHANTOM"}</button>}
      </div>

      {/* Risk banner */}
      <div style={{padding:"9px 14px",background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:6,fontSize:9,color:C.red,marginBottom:14}}>
        ⚠ Real trades on Solana with your own funds. Memecoin trading is high risk — most traders lose money. Only trade what you can afford to lose.
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:14}}>
        {[["signals","🔍 Signal Trading"],["copy","📋 Copy Trade"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 18px",borderRadius:6,fontSize:10,fontFamily:"monospace",fontWeight:"bold",letterSpacing:".08em",cursor:"pointer",background:tab===id?`linear-gradient(135deg,${C.orange}22,${C.purple}33)`:"transparent",border:tab===id?`1px solid ${C.purple}99`:`1px solid ${C.border}`,color:tab===id?C.purpleL:C.muted}}>{label}</button>
        ))}
      </div>

      {/* ══ COPY TRADE TAB ══ */}
      {tab==="copy"&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:".1em",marginBottom:4}}>BUY SIZE (SOL)</div>
              <input value={buySize} onChange={e=>setBuySize(e.target.value)} type="number" step="0.01" style={{width:"100%",background:"none",border:"none",color:C.orange,fontFamily:"monospace",fontSize:16,fontWeight:"bold",outline:"none"}}/>
            </div>
            <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:".1em",marginBottom:4}}>WATCHING</div>
              <div style={{fontSize:16,fontWeight:"bold",color:C.purpleL}}>{watchList.length} wallets</div>
            </div>
            <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:".1em",marginBottom:4}}>BUYS DETECTED</div>
              <div style={{fontSize:16,fontWeight:"bold",color:C.green}}>{copyBuys.length}</div>
            </div>
            <div style={{background:C.bg3,border:`1px solid ${copyWatching?C.green:C.border}`,borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:9,color:C.muted,letterSpacing:".1em",marginBottom:4}}>STATUS</div>
              <div style={{fontSize:16,fontWeight:"bold",color:copyWatching?C.green:C.muted}}>{copyWatching?"WATCHING":"IDLE"}</div>
            </div>
          </div>

          {/* Add wallet */}
          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:11,fontWeight:"bold",color:C.text,marginBottom:10,letterSpacing:".06em"}}>WALLETS TO COPY</div>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={watchInput} onChange={e=>setWatchInput(e.target.value)} placeholder="Paste a winning wallet address to follow…"
                style={{flex:1,background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.text,fontFamily:"monospace",fontSize:10,outline:"none"}}/>
              <button onClick={addWallet} style={{padding:"9px 18px",background:`linear-gradient(135deg,${C.purple},${C.purpleD})`,border:"none",borderRadius:6,color:"#fff",fontFamily:"monospace",fontSize:10,fontWeight:"bold",cursor:"pointer"}}>+ ADD</button>
              <button onClick={toggleCopyWatch} disabled={watchList.length===0} style={{padding:"9px 18px",background:copyWatching?"transparent":`linear-gradient(135deg,${C.green},#00cc66)`,border:copyWatching?`1px solid ${C.green}`:"none",borderRadius:6,color:copyWatching?C.green:watchList.length===0?C.muted:"#000",fontFamily:"monospace",fontSize:10,fontWeight:"bold",cursor:watchList.length===0?"not-allowed":"pointer"}}>{copyWatching?"■ STOP":"▶ WATCH"}</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {watchList.map((w,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 10px",background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6}}>
                  <span style={{fontSize:10,color:C.text,fontFamily:"monospace"}}>{short(w,10)}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <a href={`https://solscan.io/account/${w}`} target="_blank" rel="noopener noreferrer" style={{fontSize:8,color:C.purple,textDecoration:"none"}}>solscan ↗</a>
                    <button onClick={()=>removeWallet(w)} style={{fontSize:9,color:C.red,background:"none",border:"none",cursor:"pointer"}}>✕</button>
                  </div>
                </div>
              ))}
              {watchList.length===0&&<div style={{fontSize:10,color:C.muted,padding:10,textAlign:"center"}}>Add wallets you want to mirror</div>}
            </div>
          </div>

          {/* Detected buys */}
          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:11,fontWeight:"bold",color:C.text,marginBottom:12,letterSpacing:".06em"}}>DETECTED BUYS — TAP TO MIRROR</div>
            {copyBuys.length===0
              ? <div style={{fontSize:10,color:C.muted,padding:30,textAlign:"center"}}>{copyWatching?"Watching for new buys from followed wallets…":"Press WATCH to monitor the wallets in real time"}</div>
              : <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:400,overflowY:"auto"}}>
                  {copyBuys.map(b=>(
                    <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:C.bg3,border:`1px solid ${C.green}33`,borderRadius:8}}>
                      <div>
                        <div style={{fontSize:11,fontWeight:"bold",color:C.text}}>{b.symbol} <span style={{fontSize:8,color:C.muted}}>bought by {short(b.wallet)}</span></div>
                        <div style={{fontSize:8,color:C.muted}}>{b.time} · <a href={`https://solscan.io/tx/${b.signature}`} target="_blank" rel="noopener noreferrer" style={{color:C.purple,textDecoration:"none"}}>tx ↗</a></div>
                      </div>
                      <button onClick={()=>copyBuy(b.token,b.symbol)} disabled={!pubkey} style={{padding:"7px 14px",background:!pubkey?"#12122a":`linear-gradient(135deg,${C.green},#00cc66)`,border:"none",borderRadius:5,color:!pubkey?C.muted:"#000",fontFamily:"monospace",fontSize:9,fontWeight:"bold",cursor:!pubkey?"not-allowed":"pointer"}}>COPY {buySize} SOL</button>
                    </div>
                  ))}
                </div>}
            <div style={{fontSize:8,color:C.dim,marginTop:10}}>Detects token buys from followed wallets via Solana RPC. You approve each mirror in Phantom — nothing is automatic.</div>
          </div>
        </div>
      )}

      {/* Controls */}
      {tab==="signals"&&<>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".1em",marginBottom:4}}>BUY SIZE (SOL)</div>
          <input value={buySize} onChange={e=>setBuySize(e.target.value)} type="number" step="0.01"
            style={{width:"100%",background:"none",border:"none",color:C.orange,fontFamily:"monospace",fontSize:16,fontWeight:"bold",outline:"none"}}/>
        </div>
        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".1em",marginBottom:4}}>SIGNALS FOUND</div>
          <div style={{fontSize:16,fontWeight:"bold",color:C.purpleL}}>{signals.length}</div>
        </div>
        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".1em",marginBottom:4}}>TRADES MADE</div>
          <div style={{fontSize:16,fontWeight:"bold",color:C.green}}>{history.length}</div>
        </div>
        <div style={{background:C.bg3,border:`1px solid ${autoMode?C.green:C.border}`,borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:C.muted,letterSpacing:".1em",marginBottom:4}}>MODE</div>
          <div style={{fontSize:16,fontWeight:"bold",color:autoMode?C.green:C.muted}}>{autoMode?"AUTO":"MANUAL"}</div>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={scan} disabled={scanning}
          style={{padding:"10px 22px",background:scanning?"#12122a":`linear-gradient(135deg,${C.orange},${C.orangeD})`,border:"none",borderRadius:6,color:scanning?C.muted:"#000",fontFamily:"monospace",fontSize:11,fontWeight:"bold",letterSpacing:".1em",cursor:scanning?"not-allowed":"pointer"}}>
          {scanning?"SCANNING…":"🔍 SCAN FOR SIGNALS"}
        </button>
        <button onClick={toggleAuto} disabled={!pubkey}
          style={{padding:"10px 22px",background:autoMode?"transparent":`linear-gradient(135deg,${C.purple},${C.purpleD})`,border:autoMode?`1px solid ${C.green}`:"none",borderRadius:6,color:autoMode?C.green:!pubkey?C.muted:"#fff",fontFamily:"monospace",fontSize:11,fontWeight:"bold",letterSpacing:".1em",cursor:!pubkey?"not-allowed":"pointer"}}>
          {autoMode?"■ STOP AUTO":"▶ ENABLE AUTO-TRADE"}
        </button>
      </div>

      {status&&(
        <div style={{padding:"9px 12px",borderRadius:6,marginBottom:14,fontSize:10,
          background:status.type==="err"?`${C.red}15`:status.type==="ok"?`${C.green}15`:`${C.blue}15`,
          border:`1px solid ${status.type==="err"?C.red:status.type==="ok"?C.green:C.blue}33`,
          color:status.type==="err"?C.red:status.type==="ok"?C.green:C.blue}}>{status.msg}</div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:14}}>
        {/* Signals */}
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
          <div style={{fontSize:11,fontWeight:"bold",color:C.text,marginBottom:12,letterSpacing:".06em"}}>LIVE SIGNALS</div>
          {signals.length===0
            ? <div style={{color:C.muted,fontSize:10,padding:30,textAlign:"center"}}>Press SCAN to find signals from real DexScreener data</div>
            : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {signals.map(s=>(
                  <div key={s.id} style={{padding:12,background:C.bg3,border:`1px solid ${s.action==="BUY"?C.green+"44":C.red+"44"}`,borderRadius:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:13,fontWeight:"bold",color:C.text}}>{s.symbol}</span>
                        <span style={{fontSize:8,padding:"2px 7px",borderRadius:3,background:s.action==="BUY"?`${C.green}22`:`${C.red}22`,color:s.action==="BUY"?C.green:C.red,border:`1px solid ${s.action==="BUY"?C.green:C.red}44`}}>{s.action} · score {s.score>0?"+":""}{s.score}</span>
                      </div>
                      {s.url&&<a href={s.url} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:C.purple,textDecoration:"none"}}>chart ↗</a>}
                    </div>
                    <div style={{display:"flex",gap:12,fontSize:9,color:C.muted,marginBottom:6}}>
                      <span>1h: <span style={{color:s.metrics.ch1h>=0?C.green:C.red}}>{s.metrics.ch1h>=0?"+":""}{s.metrics.ch1h.toFixed(1)}%</span></span>
                      <span>vol: {fmtUSD(s.metrics.vol24)}</span>
                      <span>liq: <span style={{color:s.metrics.liq<20000?C.red:C.text}}>{fmtUSD(s.metrics.liq)}</span></span>
                    </div>
                    <div style={{fontSize:8,color:C.muted,lineHeight:1.6,marginBottom:8}}>
                      {s.reasons.slice(0,3).map((r,i)=><div key={i}>• {r}</div>)}
                    </div>
                    {s.action==="BUY"&&(
                      s.taken
                        ? <div style={{fontSize:9,color:C.green}}>✓ Trade taken</div>
                        : <button onClick={()=>takeSignal(s)} disabled={!pubkey}
                            style={{padding:"7px 16px",background:!pubkey?"#12122a":`linear-gradient(135deg,${C.green},#00cc66)`,border:"none",borderRadius:5,color:!pubkey?C.muted:"#000",fontFamily:"monospace",fontSize:10,fontWeight:"bold",letterSpacing:".08em",cursor:!pubkey?"not-allowed":"pointer"}}>
                            TAKE SIGNAL — BUY {buySize} SOL
                          </button>
                    )}
                  </div>
                ))}
              </div>}
        </div>

        {/* History */}
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
          <div style={{fontSize:11,fontWeight:"bold",color:C.text,marginBottom:12,letterSpacing:".06em"}}>TRADE HISTORY</div>
          {history.length===0
            ? <div style={{color:C.muted,fontSize:10,padding:30,textAlign:"center"}}>No trades yet. Take a signal to start.</div>
            : <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:400,overflowY:"auto"}}>
                {history.map((h,i)=>(
                  <div key={i} style={{padding:"8px 10px",background:C.bg3,border:`1px solid ${C.green}22`,borderRadius:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:10,color:C.green,fontWeight:"bold"}}>{h.action} {h.symbol}</span>
                      <span style={{fontSize:8,color:h.mode==="AUTO"?C.purple:C.muted}}>{h.mode}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontSize:9,color:C.muted}}>{h.size} SOL · {h.ts}</span>
                      <a href={`https://solscan.io/tx/${h.sig}`} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:C.purple,textDecoration:"none"}}>tx ↗</a>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      </div>
      </>}

      <div style={{marginTop:20,paddingTop:12,borderTop:`1px solid ${C.border}`,fontSize:8,color:C.dim,textAlign:"center"}}>
        {DOMAIN} · Non-custodial · You sign every trade · Signals from real DexScreener data · Swaps via Jupiter v6
      </div>

      <style>{`
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
        input::placeholder{color:${C.dim}}
        button:hover:not(:disabled){opacity:.88}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
      `}</style>
    </div>
  );
}
