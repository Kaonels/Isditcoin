// ─── Game data: rarities, items, ranks, chests, pass ────────────────────────

export const RARITIES = {
  common:    { name:"Common",    color:"#9aa0b0", glow:false, weight:50 },
  rare:      { name:"Rare",      color:"#3aa0ff", glow:false, weight:28 },
  epic:      { name:"Epic",      color:"#b15cff", glow:true,  weight:14 },
  legendary: { name:"Legendary", color:"#ffb000", glow:true,  weight:6  },
  mythic:    { name:"Mythic",    color:"#ff3d6e", glow:true,  weight:2  },
};

// Nobility ranks (by drip score)
export const RANKS = [
  { name:"Peasant",   min:0,    color:"#9aa0b0" },
  { name:"Squire",    min:200,  color:"#7fd0a0" },
  { name:"Knight",    min:600,  color:"#3aa0ff" },
  { name:"Baron",     min:1500, color:"#b15cff" },
  { name:"Duke",      min:3500, color:"#ffb000" },
  { name:"Sovereign", min:7000, color:"#ff3d6e" },
];

export function rankFor(score) {
  let r = RANKS[0];
  for (const rk of RANKS) if (score >= rk.min) r = rk;
  return r;
}

// Item catalog. slot: outfit|wings|crown|aura|weapon|tattoo
// power = drip score contribution
export const ITEMS = [
  // Outfits
  { id:"o1", slot:"outfit", name:"Street Hoodie",    rarity:"common",    power:10,  color:"#3a3a5a", price:120 },
  { id:"o2", slot:"outfit", name:"Cyber Jacket",     rarity:"rare",      power:35,  color:"#1a4a6a", price:400 },
  { id:"o3", slot:"outfit", name:"Validator Armor",  rarity:"epic",      power:80,  color:"#2a6cff", price:1200 },
  { id:"o4", slot:"outfit", name:"Genesis Suit",     rarity:"legendary", power:180, color:"#ffb000", price:null },
  // Wings
  { id:"w1", slot:"wings", name:"Glider Wings",      rarity:"rare",      power:50,  c1:"#7fb0ff", c2:"#3a6cff", price:600 },
  { id:"w2", slot:"wings", name:"Phantom Wings",     rarity:"epic",      power:110, c1:"#b15cff", c2:"#6a2caa", price:1800 },
  { id:"w3", slot:"wings", name:"Seraph Wings",      rarity:"legendary", power:250, c1:"#ffd700", c2:"#ff9000", legendary:true, price:null },
  { id:"w4", slot:"wings", name:"Void Mythwings",    rarity:"mythic",    power:420, c1:"#ff3d6e", c2:"#7a0030", legendary:true, price:null },
  // Crowns
  { id:"c1", slot:"crown", name:"Iron Circlet",      rarity:"rare",      power:40,  color:"#8a8a9a", c2:"#bbb", gem:"#3aa0ff", price:500 },
  { id:"c2", slot:"crown", name:"Royal Crown",       rarity:"epic",      power:95,  color:"#ffb000", c2:"#fff", gem:"#ff3d6e", price:1500 },
  { id:"c3", slot:"crown", name:"Sovereign Crown",   rarity:"legendary", power:300, color:"#ffd700", c2:"#fff", gem:"#ff3d6e", legendary:true, price:null },
  // Auras
  { id:"a1", slot:"aura", name:"Soft Glow",          rarity:"rare",      power:30,  color:"#7fd0ff", price:450 },
  { id:"a2", slot:"aura", name:"Ember Aura",         rarity:"epic",      power:85,  color:"#ff7a3a", price:1300 },
  { id:"a3", slot:"aura", name:"Divine Aura",        rarity:"legendary", power:220, color:"#ffd700", price:null },
  // Weapons (cosmetic)
  { id:"k1", slot:"weapon", name:"Cyber Blade",      rarity:"rare",      power:45,  color:"#00ff9d", price:550 },
  { id:"k2", slot:"weapon", name:"Plasma Saber",     rarity:"epic",      power:100, color:"#b15cff", legendary:false, price:1400 },
  { id:"k3", slot:"weapon", name:"Genesis Edge",     rarity:"legendary", power:240, color:"#ffd700", legendary:true, price:null },
  // Tattoos
  { id:"t1", slot:"tattoo", name:"Chain Mark",       rarity:"common",    power:8,   color:"#00ff9d", price:100 },
  { id:"t2", slot:"tattoo", name:"Hash Sigil",       rarity:"rare",      power:32,  color:"#b15cff", price:380 },
  { id:"t3", slot:"tattoo", name:"Block Rune",       rarity:"epic",      power:75,  color:"#ffb000", price:1100 },
];

export const SLOTS = ["outfit","wings","crown","aura","weapon","tattoo"];

// Chests — opened with EARNED points (free to earn). Pass improves odds.
export const CHESTS = {
  bronze: { name:"Bronze Chest", cost:300,  color:"#cd7f32",
    odds:        { common:60, rare:30, epic:8,  legendary:1.8, mythic:0.2 },
    oddsWithPass:{ common:45, rare:35, epic:14, legendary:4.5, mythic:1.5 } },
  silver: { name:"Silver Chest", cost:800,  color:"#c0c0c0",
    odds:        { common:40, rare:38, epic:16, legendary:5,   mythic:1 },
    oddsWithPass:{ common:25, rare:38, epic:24, legendary:10,  mythic:3 } },
  gold:   { name:"Gold Chest",   cost:2000, color:"#ffd700",
    odds:        { common:20, rare:38, epic:28, legendary:11,  mythic:3 },
    oddsWithPass:{ common:8,  rare:32, epic:35, legendary:18,  mythic:7 } },
};

// Season pass — fixed price (legal: paying for access/perks, not for randomness)
export const PASS = {
  priceUSD: 9.99,
  perks: [
    "Golden highlighted name + animated medal",
    "Much higher Legendary & Mythic odds in all chests",
    "Exclusive pass-only Legendary items",
    "+3 daily free chests",
    "Weekly exclusive chest",
  ],
};

// Daily play actions that earn points (free) — the "defend the chain" loop
export const ACTIONS = [
  { id:"patrol", name:"Patrol the Chain",  reward:[40,80],   cooldown:0 },
  { id:"defend", name:"Defend a Block",    reward:[80,160],  cooldown:0 },
  { id:"hunt",   name:"Hunt an Exploit",   reward:[150,300], cooldown:0 },
];

export function rollChest(chest, hasPass) {
  const odds = hasPass ? chest.oddsWithPass : chest.odds;
  const total = Object.values(odds).reduce((a,b)=>a+b,0);
  let r = Math.random()*total;
  let picked = "common";
  for (const [rar,w] of Object.entries(odds)) { if (r < w) { picked=rar; break; } r -= w; }
  // pick a random item of that rarity (or nearest available)
  let pool = ITEMS.filter(i=>i.rarity===picked);
  if (pool.length===0) pool = ITEMS.filter(i=>i.rarity==="common");
  return pool[Math.floor(Math.random()*pool.length)];
}
