import { useState, useCallback } from "react";
import { fetchAllNews, FEEDS } from "./news.js";

const C = {
  bg:"#080810", bg2:"#0d0d1c", bg3:"#12122a", border:"#1e1e3a",
  orange:"#f7931a", orangeD:"#c97010", purple:"#9b59ff", purpleD:"#6a35cc",
  purpleL:"#c084fc", green:"#00ff88", red:"#ff4466", blue:"#00aaff",
  text:"#e0e0f0", muted:"#555580", dim:"#1e1e38",
};
const DOMAIN="isditcoin.xyz";

const PLATFORMS=[
  {id:"x",        label:"𝕏 / Twitter", color:"#1da1f2", max:280,  style:"Punchy, 1-2 lines, 1-2 hashtags, strong hook. Use line breaks."},
  {id:"instagram",label:"Instagram",   color:"#e1306c", max:2200, style:"Engaging caption, emojis, 8-15 hashtags at the end, call-to-action."},
  {id:"tiktok",   label:"TikTok",      color:"#00f2ea", max:2200, style:"Casual, trendy, hook in first line, 3-5 hashtags, Gen-Z tone."},
  {id:"facebook", label:"Facebook",    color:"#1877f2", max:2000, style:"Slightly longer, conversational, 1-3 hashtags, invite discussion."},
];

// Generate posts via Anthropic API (real call, runs in browser)
async function generatePosts(newsItem, platform) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1000,
      messages:[{
        role:"user",
        content:`You are a viral crypto social media writer. Write 3 different ${platform.label} posts about this news, IN YOUR OWN WORDS (never copy the source text). Each must open with a scroll-stopping HOOK.

Platform style: ${platform.style}
Character limit: ${platform.max}

News headline: "${newsItem.title}"
Source: ${newsItem.source}
Context snippet: "${newsItem.snippet}"

Rules:
- Start each with a strong hook (question, bold claim, curiosity gap, or number)
- Original wording only — summarize, don't copy
- No financial advice, no "you'll get rich" promises
- Include a subtle nod to following @isditcoin for more
- Return ONLY valid JSON, no markdown: {"posts":[{"hook":"...","body":"...","hashtags":"..."},{...},{...}]}`
      }],
    }),
  });
  const data = await res.json();
  let text = data.content?.map(b=>b.text||"").join("")||"";
  text = text.replace(/```json|```/g,"").trim();
  return JSON.parse(text);
}

export default function App(){
  const [news,setNews]=useState([]);
  const [loadingNews,setLoadingNews]=useState(false);
  const [selected,setSelected]=useState(null);
  const [platform,setPlatform]=useState(PLATFORMS[0]);
  const [posts,setPosts]=useState([]);
  const [generating,setGenerating]=useState(false);
  const [err,setErr]=useState(null);
  const [approved,setApproved]=useState([]);
  const [copied,setCopied]=useState(null);

  const loadNews=useCallback(async()=>{
    setLoadingNews(true); setErr(null);
    try{
      const items=await fetchAllNews(5);
      setNews(items);
      if(items.length===0) setErr("No news loaded — feeds may be blocked. Try again.");
    }catch{ setErr("Failed to load news feeds."); }
    setLoadingNews(false);
  },[]);

  const generate=useCallback(async(item,plat)=>{
    setSelected(item); setPlatform(plat); setGenerating(true); setErr(null); setPosts([]);
    try{
      const result=await generatePosts(item,plat);
      setPosts(result.posts||[]);
    }catch(e){ setErr("Generation failed. Check API access. "+(e.message||"")); }
    setGenerating(false);
  },[]);

  const copyPost=(p,i)=>{
    const full=`${p.hook}\n\n${p.body}\n\n${p.hashtags}`;
    navigator.clipboard?.writeText(full);
    setCopied(i); setTimeout(()=>setCopied(null),2000);
  };

  const approve=(p)=>{
    setApproved(a=>[{...p,platform:platform.label,news:selected.title,ts:new Date().toLocaleTimeString()},...a].slice(0,20));
  };

  return(
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Courier New',monospace",color:C.text,padding:"16px 20px",boxSizing:"border-box"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,paddingBottom:14,borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${C.orange},${C.purple})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:`0 0 20px ${C.orange}55`}}>📡</div>
          <div>
            <div style={{fontSize:17,fontWeight:"bold",background:`linear-gradient(90deg,${C.orange},${C.purpleL})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:".1em"}}>SOCIAL AGENT</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:".1em"}}>{DOMAIN} · AI CRYPTO NEWS POSTS</div>
          </div>
        </div>
        <button onClick={loadNews} disabled={loadingNews} style={{padding:"9px 18px",background:loadingNews?"#12122a":`linear-gradient(135deg,${C.orange},${C.orangeD})`,border:"none",borderRadius:6,color:loadingNews?C.muted:"#000",fontFamily:"monospace",fontSize:11,fontWeight:"bold",letterSpacing:".08em",cursor:loadingNews?"not-allowed":"pointer"}}>
          {loadingNews?"LOADING…":"📰 FETCH LATEST NEWS"}
        </button>
      </div>

      {err&&<div style={{padding:"9px 12px",background:`${C.red}15`,border:`1px solid ${C.red}33`,borderRadius:6,color:C.red,fontSize:10,marginBottom:14}}>{err}</div>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1.2fr",gap:14}}>
        {/* News column */}
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
          <div style={{fontSize:11,fontWeight:"bold",color:C.text,marginBottom:6,letterSpacing:".06em"}}>LATEST CRYPTO NEWS</div>
          <div style={{fontSize:8,color:C.dim,marginBottom:12}}>Sources: {FEEDS.map(f=>f.name).join(" · ")}</div>
          {news.length===0
            ? <div style={{color:C.muted,fontSize:10,padding:30,textAlign:"center"}}>Press "Fetch Latest News" to pull real headlines</div>
            : <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:560,overflowY:"auto"}}>
                {news.map((n,i)=>(
                  <div key={i} style={{padding:12,background:selected?.title===n.title?C.bg3:`${C.bg3}88`,border:`1px solid ${selected?.title===n.title?C.purple+"66":C.border}`,borderRadius:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span style={{fontSize:8,color:C.orange,letterSpacing:".05em"}}>{n.source}</span>
                      <a href={n.link} target="_blank" rel="noopener noreferrer" style={{fontSize:8,color:C.purple,textDecoration:"none"}}>read ↗</a>
                    </div>
                    <div style={{fontSize:11,color:C.text,fontWeight:"bold",lineHeight:1.4,marginBottom:8}}>{n.title}</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {PLATFORMS.map(p=>(
                        <button key={p.id} onClick={()=>generate(n,p)} disabled={generating}
                          style={{fontSize:8,padding:"4px 8px",borderRadius:4,border:`1px solid ${p.color}55`,background:`${p.color}11`,color:p.color,cursor:generating?"not-allowed":"pointer",fontFamily:"monospace"}}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>}
        </div>

        {/* Posts column */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
            <div style={{fontSize:11,fontWeight:"bold",color:C.text,marginBottom:12,letterSpacing:".06em"}}>
              GENERATED POSTS {selected&&<span style={{color:platform.color}}>· {platform.label}</span>}
            </div>
            {generating
              ? <div style={{color:C.purpleL,fontSize:11,padding:30,textAlign:"center"}}>✨ Writing viral hooks…</div>
              : posts.length===0
              ? <div style={{color:C.muted,fontSize:10,padding:30,textAlign:"center"}}>Select a news item and platform to generate posts with hooks</div>
              : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {posts.map((p,i)=>(
                    <div key={i} style={{padding:14,background:C.bg3,border:`1px solid ${platform.color}33`,borderRadius:8}}>
                      <div style={{fontSize:8,color:platform.color,letterSpacing:".1em",marginBottom:6}}>VARIANT {i+1} · HOOK</div>
                      <div style={{fontSize:12,color:C.text,fontWeight:"bold",lineHeight:1.5,marginBottom:8}}>{p.hook}</div>
                      <div style={{fontSize:11,color:C.text,lineHeight:1.6,marginBottom:8,whiteSpace:"pre-wrap"}}>{p.body}</div>
                      <div style={{fontSize:10,color:C.blue,marginBottom:10}}>{p.hashtags}</div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>copyPost(p,i)} style={{fontSize:9,padding:"6px 14px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,color:copied===i?C.green:C.muted,cursor:"pointer",fontFamily:"monospace"}}>{copied===i?"✓ COPIED":"📋 COPY"}</button>
                        <button onClick={()=>approve(p)} style={{fontSize:9,padding:"6px 14px",background:`linear-gradient(135deg,${C.green},#00cc66)`,border:"none",borderRadius:5,color:"#000",fontWeight:"bold",cursor:"pointer",fontFamily:"monospace"}}>✓ APPROVE</button>
                      </div>
                    </div>
                  ))}
                </div>}
          </div>

          {approved.length>0&&(
            <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
              <div style={{fontSize:11,fontWeight:"bold",color:C.text,marginBottom:12,letterSpacing:".06em"}}>✓ APPROVED — READY TO POST ({approved.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
                {approved.map((a,i)=>(
                  <div key={i} style={{padding:"8px 10px",background:C.bg3,border:`1px solid ${C.green}22`,borderRadius:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                      <span style={{fontSize:9,color:C.green}}>{a.platform}</span>
                      <span style={{fontSize:8,color:C.muted}}>{a.ts}</span>
                    </div>
                    <div style={{fontSize:10,color:C.text}}>{a.hook}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{marginTop:20,paddingTop:12,borderTop:`1px solid ${C.border}`,fontSize:8,color:C.dim,textAlign:"center"}}>
        {DOMAIN} · Posts written in original wording · Approve before publishing · Sources linked &amp; credited
      </div>

      <style>{`
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
        button:hover:not(:disabled){opacity:.88}
        a:hover{opacity:.8}
      `}</style>
    </div>
  );
}
