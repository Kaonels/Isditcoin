import { useState, useEffect, useCallback } from "react";
import Avatar from "./Avatar.jsx";
import { RARITIES, RANKS, rankFor, ITEMS, SLOTS, CHESTS, PASS, ACTIONS, rollChest } from "./gamedata.js";
import { payForPass, getSolBalance, PROJECT_WALLET, PASS_PRICE_SOL } from "./payment.js";

const F_DISPLAY = "'Cinzel', serif";
const F_BODY = "'Rajdhani', sans-serif";

const C = {
  bg:"#0a0612", bg2:"#140a26", bg3:"#1c1038", panel:"#180d2e",
  border:"#2e1a52", gold:"#ffb000", goldL:"#ffd700",
  purple:"#9b59ff", purpleL:"#c084fc", green:"#00ff9d",
  red:"#ff3d6e", blue:"#3aa0ff", text:"#ece4ff", muted:"#7a6a9a", dim:"#3a2a5a",
};

const STARTER = { outfit:ITEMS[0], tattoo:null, wings:null, crown:null, aura:null, weapon:null };

function loadState(){
  try{ return JSON.parse(localStorage.getItem("chaincity")); }catch{ return null; }
}
// Note: localStorage works when deployed on your own domain (not in sandbox preview)

export default function App(){
  const [screen,setScreen]=useState("play");
  const [role,setRole]=useState("Validator");
  const [points,setPoints]=useState(500);
  const [hasPass,setHasPass]=useState(false);
  const [inventory,setInventory]=useState([ITEMS[0]]);
  const [equipped,setEquipped]=useState(STARTER);
  const [name,setName]=useState("Guardian");
  const [opening,setOpening]=useState(null);
  const [reveal,setReveal]=useState(null);
  const [toast,setToast]=useState(null);
  const [provider,setProvider]=useState(null);
  const [wallet,setWallet]=useState(null);
  const [paying,setPaying]=useState(false);
  const [lastTx,setLastTx]=useState(null);

  useEffect(()=>{ const p=window?.phantom?.solana; if(p?.isPhantom) setProvider(p); },[]);

  const connectWallet=useCallback(async()=>{
    if(!provider){ window.open("https://phantom.app/","_blank"); return null; }
    try{ const res=await provider.connect(); const pk=res.publicKey.toString(); setWallet(pk); return pk; }
    catch{ showToast("Wallet connection rejected",C.red); return null; }
  },[provider]);

  // drip score = sum of equipped power
  const dripScore = Object.values(equipped).reduce((s,it)=>s+(it?.power||0),0);
  const rank = rankFor(dripScore);

  const showToast=(msg,color=C.green)=>{ setToast({msg,color}); setTimeout(()=>setToast(null),2200); };

  const earn=(action)=>{
    const [lo,hi]=action.reward;
    const amt=Math.floor(lo+Math.random()*(hi-lo));
    setPoints(p=>p+amt);
    showToast(`+${amt} pts · ${action.name}`,C.green);
  };

  const openChest=(key)=>{
    const chest=CHESTS[key];
    if(points<chest.cost){ showToast("Not enough points",C.red); return; }
    setPoints(p=>p-chest.cost);
    setOpening(key);
    setTimeout(()=>{
      const item=rollChest(chest,hasPass);
      setReveal(item);
      setInventory(inv=>inv.find(x=>x.id===item.id)?inv:[...inv,item]);
      setOpening(null);
    },1600);
  };

  const equip=(item)=>{
    setEquipped(e=>({...e,[item.slot]:item}));
    showToast(`Equipped ${item.name}`,RARITIES[item.rarity].color);
  };
  const unequip=(slot)=>setEquipped(e=>({...e,[slot]:null}));

  const buyItem=(item)=>{
    if(item.price===null){ showToast("Chest/Pass only item",C.gold); return; }
    if(points<item.price){ showToast("Not enough points",C.red); return; }
    if(inventory.find(x=>x.id===item.id)){ showToast("Already owned",C.muted); return; }
    setPoints(p=>p-item.price);
    setInventory(inv=>[...inv,item]);
    showToast(`Bought ${item.name}!`,RARITIES[item.rarity].color);
  };

  const buyPass=async()=>{
    if(paying) return;
    let pk=wallet;
    if(!pk){ pk=await connectWallet(); if(!pk) return; }
    setPaying(true);
    showToast("Approve payment in Phantom…",C.gold);
    try{
      const sig=await payForPass(provider,pk);
      setLastTx(sig);
      showToast("Verifying payment on-chain…",C.gold);
      // Verify server-side before granting the pass (anti-cheat)
      let verified=false;
      for(let attempt=0; attempt<5 && !verified; attempt++){
        try{
          const r=await fetch("/api/verify-payment",{
            method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({signature:sig,payer:pk}),
          });
          const d=await r.json();
          if(d.ok&&d.verified){ verified=true; break; }
          if(r.status===404){ await new Promise(res=>setTimeout(res,3000)); continue; } // tx not indexed yet
          if(d.error){ showToast(d.error,C.red); break; }
        }catch{ await new Promise(res=>setTimeout(res,3000)); }
      }
      if(verified){
        setHasPass(true);
        showToast("Season Pass verified & activated! 👑",C.goldL);
      }else{
        showToast("Payment sent — verification pending. Refresh shortly.",C.gold);
      }
      console.log("Pass payment tx:",sig);
    }catch(e){
      showToast(e.message?.includes("User rejected")?"Payment cancelled":"Payment failed",C.red);
    }
    setPaying(false);
  };

  // Demo leaderboard
  const leaderboard=[
    {name:"0xSovereign", score:8420, pass:true},
    {name:"ChainKing",   score:6100, pass:true},
    {name:name,          score:dripScore, pass:hasPass, you:true},
    {name:"DegenDuke",   score:3200, pass:false},
    {name:"BlockBaron",  score:2750, pass:true},
    {name:"HashHunter",  score:1900, pass:false},
  ].sort((a,b)=>b.score-a.score);

  return(
    <div style={{background:`radial-gradient(ellipse at top, ${C.bg2}, ${C.bg})`,minHeight:"100vh",fontFamily:F_BODY,color:C.text,paddingBottom:40}}>

      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 22px",borderBottom:`1px solid ${C.border}`,background:`${C.bg2}cc`,backdropFilter:"blur(8px)",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,${C.gold},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,boxShadow:`0 0 24px ${C.gold}66`}}>🛡️</div>
          <div>
            <div style={{fontFamily:F_DISPLAY,fontSize:18,fontWeight:900,letterSpacing:".05em",color:C.goldL}}>ISDITCOIN CITY</div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:".2em",textTransform:"uppercase"}}>Guardians of the Chain</div>
          </div>
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center"}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:".15em"}}>POINTS</div>
            <div style={{fontSize:18,fontWeight:700,color:C.goldL}}>{points.toLocaleString()}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:".15em"}}>RANK</div>
            <div style={{fontSize:15,fontWeight:700,fontFamily:F_DISPLAY,color:rank.color}}>{rank.name}</div>
          </div>
          {hasPass&&<div style={{padding:"5px 12px",borderRadius:20,background:`linear-gradient(135deg,${C.gold},${C.goldL})`,color:"#000",fontSize:10,fontWeight:700,letterSpacing:".1em",boxShadow:`0 0 16px ${C.gold}88`}}>👑 PASS</div>}
        </div>
      </div>

      {/* Nav */}
      <div style={{display:"flex",gap:6,padding:"14px 22px",flexWrap:"wrap"}}>
        {[["play","⚔️ Play"],["avatar","🧍 Avatar"],["chests","🎁 Chests"],["shop","🛒 Shop"],["pass","👑 Season Pass"],["ranks","🏆 Leaderboard"]].map(([id,label])=>(
          <button key={id} onClick={()=>setScreen(id)} style={{padding:"9px 18px",borderRadius:8,fontFamily:F_BODY,fontSize:13,fontWeight:600,letterSpacing:".05em",cursor:"pointer",
            background:screen===id?`linear-gradient(135deg,${C.purple}44,${C.gold}33)`:"transparent",
            border:screen===id?`1px solid ${C.gold}99`:`1px solid ${C.border}`,
            color:screen===id?C.goldL:C.muted,transition:"all .15s"}}>{label}</button>
        ))}
      </div>

      <div style={{maxWidth:1000,margin:"0 auto",padding:"0 22px"}}>

        {/* PLAY */}
        {screen==="play"&&(
          <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:20,marginTop:10}}>
            <Panel>
              <div style={{textAlign:"center"}}>
                <div style={{position:"relative",display:"inline-block"}}>
                  <Avatar role={role} equipped={equipped} size={200}/>
                </div>
                <div style={{marginTop:8}}>
                  <input value={name} onChange={e=>setName(e.target.value)} style={{background:"transparent",border:"none",textAlign:"center",fontSize:18,fontWeight:700,fontFamily:F_DISPLAY,
                    color:hasPass?C.goldL:C.text,outline:"none",textShadow:hasPass?`0 0 12px ${C.gold}88`:"none",width:"100%"}}/>
                  <div style={{fontSize:12,color:rank.color,fontFamily:F_DISPLAY,fontWeight:600}}>{rank.name} · {role}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:4}}>Drip Score: <span style={{color:C.goldL,fontWeight:700}}>{dripScore}</span></div>
                </div>
              </div>
            </Panel>
            <div>
              <SectionTitle>Defend the Chain — Earn Points</SectionTitle>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {ACTIONS.map(a=>(
                  <button key={a.id} onClick={()=>earn(a)} style={{textAlign:"left",padding:"16px 20px",borderRadius:12,cursor:"pointer",
                    background:`linear-gradient(135deg,${C.panel},${C.bg3})`,border:`1px solid ${C.border}`,color:C.text,
                    display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=C.gold+"88"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                    <div>
                      <div style={{fontSize:16,fontWeight:700,fontFamily:F_DISPLAY}}>{a.name}</div>
                      <div style={{fontSize:12,color:C.muted}}>Earn {a.reward[0]}–{a.reward[1]} points</div>
                    </div>
                    <div style={{fontSize:22}}>{a.id==="patrol"?"🛡️":a.id==="defend"?"⚔️":"🎯"}</div>
                  </button>
                ))}
              </div>
              <div style={{marginTop:16,padding:"12px 16px",borderRadius:10,background:`${C.purple}11`,border:`1px solid ${C.purple}33`,fontSize:12,color:C.purpleL}}>
                Choose your role: {["Validator","Sentinel","Architect","Oracle"].map(r=>(
                  <button key={r} onClick={()=>setRole(r)} style={{margin:"0 4px",padding:"4px 10px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:F_BODY,
                    background:role===r?C.purple:"transparent",border:`1px solid ${C.purple}66`,color:role===r?"#fff":C.purpleL}}>{r}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AVATAR / equipment */}
        {screen==="avatar"&&(
          <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:20,marginTop:10}}>
            <Panel>
              <div style={{textAlign:"center"}}>
                <Avatar role={role} equipped={equipped} size={210}/>
                <div style={{fontSize:11,color:C.muted,marginTop:8}}>Drip Score: <span style={{color:C.goldL,fontWeight:700}}>{dripScore}</span></div>
              </div>
            </Panel>
            <div>
              <SectionTitle>Your Inventory — Tap to Equip</SectionTitle>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
                {inventory.map((it,i)=>(
                  <ItemCard key={i} item={it} onClick={()=>equip(it)} equipped={equipped[it.slot]?.id===it.id}/>
                ))}
              </div>
              <div style={{marginTop:16}}>
                <SectionTitle>Equipped Slots</SectionTitle>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {SLOTS.map(s=>(
                    <div key={s} style={{padding:"8px 12px",borderRadius:8,background:C.panel,border:`1px solid ${equipped[s]?RARITIES[equipped[s].rarity].color+"66":C.border}`,fontSize:11}}>
                      <span style={{color:C.muted,textTransform:"capitalize"}}>{s}: </span>
                      <span style={{color:equipped[s]?RARITIES[equipped[s].rarity].color:C.dim}}>{equipped[s]?.name||"—"}</span>
                      {equipped[s]&&<button onClick={()=>unequip(s)} style={{marginLeft:6,color:C.red,background:"none",border:"none",cursor:"pointer"}}>✕</button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CHESTS */}
        {screen==="chests"&&(
          <div style={{marginTop:10}}>
            <SectionTitle>Open Chests — Earn points by playing, spend them here</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
              {Object.entries(CHESTS).map(([key,ch])=>(
                <div key={key} style={{padding:20,borderRadius:14,textAlign:"center",
                  background:`linear-gradient(160deg,${C.panel},${C.bg3})`,border:`1px solid ${ch.color}66`,
                  boxShadow:`0 0 28px ${ch.color}22`}}>
                  <div style={{fontSize:48,filter:`drop-shadow(0 0 12px ${ch.color})`}}>🎁</div>
                  <div style={{fontFamily:F_DISPLAY,fontSize:17,fontWeight:700,color:ch.color,marginTop:8}}>{ch.name}</div>
                  <div style={{fontSize:13,color:C.goldL,margin:"6px 0"}}>{ch.cost.toLocaleString()} pts</div>
                  <div style={{fontSize:10,color:C.muted,lineHeight:1.6,marginBottom:12}}>
                    Legendary: {(hasPass?ch.oddsWithPass:ch.odds).legendary}% · Mythic: {(hasPass?ch.oddsWithPass:ch.odds).mythic}%
                    {hasPass&&<div style={{color:C.gold}}>👑 Pass odds active</div>}
                  </div>
                  <button onClick={()=>openChest(key)} disabled={points<ch.cost} style={{width:"100%",padding:"10px",borderRadius:8,fontFamily:F_BODY,fontSize:13,fontWeight:700,letterSpacing:".05em",cursor:points<ch.cost?"not-allowed":"pointer",
                    background:points<ch.cost?C.dim:`linear-gradient(135deg,${ch.color},${ch.color}aa)`,border:"none",color:points<ch.cost?C.muted:"#1a0e00"}}>
                    {points<ch.cost?"NEED MORE PTS":"OPEN CHEST"}
                  </button>
                </div>
              ))}
            </div>
            <div style={{marginTop:14,padding:"10px 16px",borderRadius:10,background:`${C.green}0d`,border:`1px solid ${C.green}33`,fontSize:11,color:C.green}}>
              ✓ Chests are opened with points you EARN by playing — never with direct money. The Season Pass only improves your odds.
            </div>
          </div>
        )}

        {/* SHOP */}
        {screen==="shop"&&(
          <div style={{marginTop:10}}>
            <SectionTitle>The Bazaar — Buy with Points</SectionTitle>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
              {ITEMS.map((it,i)=>(
                <ItemCard key={i} item={it} shop onClick={()=>buyItem(it)} owned={!!inventory.find(x=>x.id===it.id)}/>
              ))}
            </div>
          </div>
        )}

        {/* PASS */}
        {screen==="pass"&&(
          <div style={{marginTop:10,maxWidth:520,margin:"10px auto"}}>
            <div style={{padding:28,borderRadius:18,textAlign:"center",
              background:`linear-gradient(160deg,${C.bg3},${C.panel})`,border:`2px solid ${C.gold}`,boxShadow:`0 0 40px ${C.gold}33`}}>
              <div style={{fontSize:46}}>👑</div>
              <div style={{fontFamily:F_DISPLAY,fontSize:26,fontWeight:900,color:C.goldL,letterSpacing:".05em"}}>SEASON PASS</div>
              <div style={{fontSize:14,color:C.muted,marginBottom:18}}>Unlock the nobility's privileges</div>
              <div style={{textAlign:"left",display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {PASS.perks.map((p,i)=>(
                  <div key={i} style={{display:"flex",gap:10,fontSize:13}}>
                    <span style={{color:C.gold}}>✦</span><span>{p}</span>
                  </div>
                ))}
              </div>
              {hasPass
                ? <div style={{padding:"12px",borderRadius:10,background:`${C.gold}22`,color:C.goldL,fontWeight:700,fontFamily:F_DISPLAY}}>✓ PASS ACTIVE — You are nobility</div>
                : <button onClick={buyPass} disabled={paying} style={{width:"100%",padding:"14px",borderRadius:10,fontFamily:F_DISPLAY,fontSize:16,fontWeight:700,cursor:paying?"wait":"pointer",
                    background:`linear-gradient(135deg,${C.gold},${C.goldL})`,border:"none",color:"#1a0e00",boxShadow:`0 0 24px ${C.gold}66`}}>
                    {paying?"PROCESSING…":`GET PASS — ${PASS_PRICE_SOL} SOL`}
                  </button>}

              {/* On-chain proof of YOUR payment */}
              {lastTx&&(
                <div style={{marginTop:14,padding:"12px 14px",borderRadius:10,background:`${C.green}0d`,border:`1px solid ${C.green}44`,textAlign:"left"}}>
                  <div style={{fontSize:11,color:C.green,fontWeight:700,marginBottom:4}}>✓ Payment confirmed on-chain</div>
                  <div style={{fontSize:10,color:C.muted,wordBreak:"break-all",marginBottom:6}}>Tx: {lastTx.slice(0,24)}…</div>
                  <a href={`https://solscan.io/tx/${lastTx}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.purpleL,textDecoration:"none"}}>View your payment on Solscan ↗</a>
                </div>
              )}

              {/* Public wallet — transparency */}
              <div style={{marginTop:14,padding:"12px 14px",borderRadius:10,background:C.bg3,border:`1px solid ${C.border}`,textAlign:"left"}}>
                <div style={{fontSize:10,color:C.muted,letterSpacing:".1em",marginBottom:6}}>PROJECT WALLET — ALL PAYMENTS PUBLIC</div>
                <div style={{fontSize:10,color:C.goldL,wordBreak:"break-all",fontFamily:"monospace",marginBottom:6}}>{PROJECT_WALLET}</div>
                <a href={`https://solscan.io/account/${PROJECT_WALLET}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.purpleL,textDecoration:"none"}}>See every payment live on Solscan ↗</a>
              </div>

              {/* Full disclaimer */}
              <div style={{marginTop:14,padding:"12px 14px",borderRadius:10,background:`${C.purple}0d`,border:`1px solid ${C.purple}33`,textAlign:"left"}}>
                <div style={{fontSize:10,color:C.purpleL,fontWeight:700,letterSpacing:".1em",marginBottom:6}}>⚠ DISCLAIMER — PLEASE READ</div>
                <div style={{fontSize:9,color:C.muted,lineHeight:1.7}}>
                  • The Season Pass is a one-time purchase of in-game access and cosmetic perks. It is <b style={{color:C.text}}>not an investment</b> and has <b style={{color:C.text}}>no monetary value or payout</b>.<br/>
                  • All rewards (items, ranks, wings, crowns) are cosmetic and stay inside the game. They cannot be redeemed for money.<br/>
                  • Chests are opened with points <b style={{color:C.text}}>earned by playing</b> — never bought directly. The pass only improves odds. This is not gambling.<br/>
                  • Payments are made in SOL on the Solana blockchain and are <b style={{color:C.text}}>final and non-refundable</b> once confirmed.<br/>
                  • Every payment is publicly verifiable on Solscan at the wallet above.<br/>
                  • You are responsible for any taxes applicable in your jurisdiction. Play responsibly.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LEADERBOARD */}
        {screen==="ranks"&&(
          <div style={{marginTop:10}}>
            <SectionTitle>Realm Leaderboard — by Drip Score</SectionTitle>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {leaderboard.map((p,i)=>{
                const r=rankFor(p.score);
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:16,padding:"14px 18px",borderRadius:12,
                    background:p.you?`linear-gradient(135deg,${C.purple}22,${C.gold}11)`:C.panel,
                    border:`1px solid ${p.you?C.gold+"88":C.border}`}}>
                    <div style={{fontFamily:F_DISPLAY,fontSize:22,fontWeight:900,color:i===0?C.goldL:i===1?"#c0c0c0":i===2?"#cd7f32":C.muted,minWidth:36}}>#{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:15,fontWeight:700,color:p.pass?C.goldL:C.text,textShadow:p.pass?`0 0 10px ${C.gold}66`:"none"}}>
                        {p.pass&&"👑 "}{p.name}{p.you&&" (you)"}
                      </div>
                      <div style={{fontSize:12,fontFamily:F_DISPLAY,color:r.color}}>{r.name}</div>
                    </div>
                    <div style={{fontSize:18,fontWeight:700,color:C.goldL}}>{p.score.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Chest opening overlay */}
      {(opening||reveal)&&(
        <div style={{position:"fixed",inset:0,background:"rgba(5,2,12,.94)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}
          onClick={()=>{ if(!opening){ setReveal(null); } }}>
          {opening
            ? <div style={{textAlign:"center"}}>
                <div style={{fontSize:90,animation:"shake .4s infinite",filter:`drop-shadow(0 0 30px ${CHESTS[opening].color})`}}>🎁</div>
                <div style={{fontFamily:F_DISPLAY,fontSize:18,color:C.goldL,marginTop:16,letterSpacing:".1em"}}>OPENING…</div>
              </div>
            : reveal&&(()=>{ const rar=RARITIES[reveal.rarity]; return(
                <div style={{textAlign:"center",animation:"popIn .4s"}}>
                  <div style={{fontFamily:F_DISPLAY,fontSize:14,color:rar.color,letterSpacing:".3em",marginBottom:10}}>{rar.name.toUpperCase()}</div>
                  <div style={{width:200,height:200,margin:"0 auto",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",
                    background:`radial-gradient(circle,${rar.color}33,transparent)`,border:`2px solid ${rar.color}`,
                    boxShadow:rar.glow?`0 0 60px ${rar.color}`:`0 0 20px ${rar.color}66`,fontSize:80,
                    animation:rar.glow?"glowPulse 1.5s infinite":"none"}}>
                    {reveal.slot==="wings"?"🪽":reveal.slot==="crown"?"👑":reveal.slot==="aura"?"✨":reveal.slot==="weapon"?"⚔️":reveal.slot==="tattoo"?"🔮":"👕"}
                  </div>
                  <div style={{fontFamily:F_DISPLAY,fontSize:22,fontWeight:700,color:rar.color,marginTop:16,textShadow:`0 0 16px ${rar.color}88`}}>{reveal.name}</div>
                  <div style={{fontSize:13,color:C.muted,marginTop:4}}>+{reveal.power} Drip Score · Added to inventory</div>
                  <button onClick={()=>setReveal(null)} style={{marginTop:20,padding:"10px 28px",borderRadius:8,fontFamily:F_BODY,fontSize:14,fontWeight:700,cursor:"pointer",
                    background:`linear-gradient(135deg,${rar.color},${rar.color}aa)`,border:"none",color:"#1a0e00"}}>COLLECT</button>
                </div>
              );})()}
        </div>
      )}

      {/* Toast */}
      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:200,
        padding:"12px 24px",borderRadius:30,background:C.bg3,border:`1px solid ${toast.color}`,
        color:toast.color,fontWeight:700,fontSize:14,boxShadow:`0 0 24px ${toast.color}44`}}>{toast.msg}</div>}

      <style>{`
        @keyframes shake{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
        @keyframes popIn{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes glowPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.4)}}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
        button:hover:not(:disabled){filter:brightness(1.12)}
      `}</style>
    </div>
  );
}

function Panel({children}){
  return <div style={{padding:18,borderRadius:16,background:`linear-gradient(160deg,${C.panel},${C.bg3})`,border:`1px solid ${C.border}`}}>{children}</div>;
}
function SectionTitle({children}){
  return <div style={{fontFamily:F_DISPLAY,fontSize:16,fontWeight:700,color:C.goldL,marginBottom:14,letterSpacing:".03em"}}>{children}</div>;
}
function ItemCard({item,onClick,equipped,owned,shop}){
  const rar=RARITIES[item.rarity];
  const isLegend=item.rarity==="legendary"||item.rarity==="mythic";
  return(
    <div onClick={onClick} style={{padding:12,borderRadius:12,cursor:"pointer",textAlign:"center",position:"relative",
      background:C.panel,border:`1px solid ${rar.color}${equipped?"":"55"}`,
      boxShadow:isLegend?`0 0 18px ${rar.color}55`:"none",transition:"all .15s",
      outline:equipped?`2px solid ${rar.color}`:"none"}}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-3px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
      <div style={{fontSize:36,filter:isLegend?`drop-shadow(0 0 8px ${rar.color})`:"none",
        animation:isLegend?"glowPulse 2s infinite":"none"}}>
        {item.slot==="wings"?"🪽":item.slot==="crown"?"👑":item.slot==="aura"?"✨":item.slot==="weapon"?"⚔️":item.slot==="tattoo"?"🔮":"👕"}
      </div>
      <div style={{fontSize:12,fontWeight:700,color:rar.color,marginTop:6,fontFamily:F_DISPLAY}}>{item.name}</div>
      <div style={{fontSize:10,color:C.muted}}>+{item.power} drip</div>
      {shop
        ? <div style={{fontSize:11,marginTop:6,color:item.price===null?C.gold:owned?C.green:C.goldL,fontWeight:700}}>
            {owned?"✓ Owned":item.price===null?"🎁 Chest/Pass":`${item.price} pts`}
          </div>
        : equipped&&<div style={{fontSize:10,color:rar.color,marginTop:4}}>EQUIPPED</div>}
    </div>
  );
}
