// Layered SVG avatar — "isditcoin Ghost" character.
// Purple ghost with sharp grin, glowing eyes, black ghost-logo hoodie.
import React from "react";

export default function Avatar({ equipped={}, size=220, role }) {
  const wings  = equipped.wings;
  const aura   = equipped.aura;
  const crown  = equipped.crown;
  const outfit = equipped.outfit;
  const weapon = equipped.weapon;
  const tattoo = equipped.tattoo;

  const skin = "#6a3aB0";       // purple body
  const skinD = "#4a2580";      // darker purple shade
  const hoodie = outfit?.color || "#15131f"; // default black hoodie

  return (
    <svg viewBox="0 0 200 250" width={size} height={size*1.25} style={{display:"block"}}>
      <defs>
        <radialGradient id="auraGlow" cx="50%" cy="42%" r="58%">
          <stop offset="0%" stopColor={aura?.color||"#fff"} stopOpacity={aura?0.6:0}/>
          <stop offset="100%" stopColor={aura?.color||"#fff"} stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="wingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={wings?.c1||"#fff"}/>
          <stop offset="100%" stopColor={wings?.c2||"#aaa"}/>
        </linearGradient>
        <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff"/>
          <stop offset="60%" stopColor="#e0c0ff"/>
          <stop offset="100%" stopColor="#b070ff"/>
        </radialGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="softGlow"><feGaussianBlur stdDeviation="1.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {aura && <circle cx="100" cy="115" r="98" fill="url(#auraGlow)"/>}

      {/* Wings behind */}
      {wings && (
        <g filter={wings.legendary?"url(#glow)":undefined} opacity="0.96">
          <path d="M68 95 Q18 62 12 128 Q40 116 68 138 Z" fill="url(#wingGrad)" stroke={wings.c2} strokeWidth="1.5"/>
          <path d="M132 95 Q182 62 188 128 Q160 116 132 138 Z" fill="url(#wingGrad)" stroke={wings.c2} strokeWidth="1.5"/>
          {wings.legendary && <>
            <path d="M68 105 Q28 84 24 130" stroke="#fff" strokeWidth="1" fill="none" opacity="0.6"/>
            <path d="M132 105 Q172 84 176 130" stroke="#fff" strokeWidth="1" fill="none" opacity="0.6"/>
          </>}
        </g>
      )}

      {/* Legs (purple) */}
      <rect x="84" y="168" width="13" height="52" rx="6" fill={skin}/>
      <rect x="103" y="168" width="13" height="52" rx="6" fill={skin}/>
      {/* Feet */}
      <ellipse cx="88" cy="222" rx="11" ry="6" fill={skinD}/>
      <ellipse cx="112" cy="222" rx="11" ry="6" fill={skinD}/>

      {/* Hoodie body */}
      <rect x="70" y="108" width="60" height="66" rx="16" fill={hoodie}/>
      {/* Hoodie ghost logo (glowing) */}
      <g filter="url(#softGlow)">
        <path d="M92 132 Q92 122 100 122 Q108 122 108 132 L108 146 Q105 143 103 146 Q101 143 100 146 Q99 143 97 146 Q95 143 92 146 Z" fill="#f0e0ff"/>
        <circle cx="97" cy="132" r="2" fill={hoodie}/>
        <circle cx="103" cy="132" r="2" fill={hoodie}/>
      </g>
      {/* Hoodie strings */}
      <rect x="93" y="110" width="2" height="12" fill="#c0a0e0"/>
      <rect x="105" y="110" width="2" height="12" fill="#c0a0e0"/>
      {/* Arms (purple hands out of hoodie) */}
      <rect x="58" y="112" width="14" height="44" rx="7" fill={hoodie}/>
      <rect x="128" y="112" width="14" height="44" rx="7" fill={hoodie}/>
      <circle cx="65" cy="158" r="9" fill={skin}/>
      <circle cx="135" cy="158" r="9" fill={skin}/>

      {/* Weapon */}
      {weapon && (
        <g filter={weapon.legendary?"url(#glow)":undefined}>
          <rect x="132" y="124" width="6" height="46" rx="2" fill={weapon.color}/>
          <polygon points="135,120 130,130 140,130" fill={weapon.color}/>
        </g>
      )}

      {/* HEAD — purple ghost with spiky top */}
      <g>
        {/* spiky ears/horns */}
        <polygon points="74,58 68,30 86,52" fill={skin}/>
        <polygon points="126,58 132,30 114,52" fill={skin}/>
        {/* head shape */}
        <path d="M70 70 Q70 40 100 40 Q130 40 130 70 L130 86 Q130 100 100 100 Q70 100 70 86 Z" fill={skin}/>
        {/* shading */}
        <path d="M70 70 Q70 40 100 40 Q112 40 120 48 Q95 50 88 72 Q84 90 95 99 Q80 98 72 88 Z" fill={skinD} opacity="0.4"/>
        {/* glowing eyes (angry slant) */}
        <g filter="url(#softGlow)">
          <ellipse cx="86" cy="68" rx="8" ry="6" fill="url(#eyeGlow)" transform="rotate(-15 86 68)"/>
          <ellipse cx="114" cy="68" rx="8" ry="6" fill="url(#eyeGlow)" transform="rotate(15 114 68)"/>
        </g>
        {/* sharp grin */}
        <path d="M80 80 Q100 96 120 80 Q116 86 100 88 Q84 86 80 80 Z" fill="#fff"/>
        <g fill={skinD}>
          <polygon points="84,81 87,87 90,81"/>
          <polygon points="91,82 94,89 97,82"/>
          <polygon points="98,83 101,90 104,83"/>
          <polygon points="105,82 108,89 111,82"/>
          <polygon points="112,81 115,87 118,81"/>
        </g>
        {/* tattoo on cheek */}
        {tattoo && <path d="M122 74 Q126 80 122 86" stroke={tattoo.color} strokeWidth="2" fill="none" opacity="0.85" filter="url(#softGlow)"/>}
      </g>

      {/* Crown */}
      {crown && (
        <g filter={crown.legendary?"url(#glow)":undefined}>
          <polygon points="80,42 88,24 100,36 112,24 120,42" fill={crown.color} stroke={crown.c2||"#fff"} strokeWidth="1"/>
          <circle cx="100" cy="30" r="3.5" fill={crown.gem||"#ff3d6e"}/>
          {crown.legendary && <circle cx="100" cy="34" r="18" fill="none" stroke={crown.color} strokeWidth="0.5" opacity="0.5"/>}
        </g>
      )}
    </svg>
  );
}

export const ROLE_COLORS = {};
