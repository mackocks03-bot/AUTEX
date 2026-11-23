export interface BotDef {
  id: string;
  name: string;
  tier: string;
  investAmount: number;
  dailyPct: number;
  maxMultiplier: number;
  color: string;
  gradient: string;
  glow: string;
  img: string;
  badge: string;
}

export const BOTS: BotDef[] = [
  { id: "nano",    name: "Nano Bot",    tier: "Starter",   investAmount: 5,     dailyPct: 12, maxMultiplier: 2,   color: "#818cf8", gradient: "linear-gradient(135deg,#312e81,#1e1b4b)", glow: "rgba(99,102,241,0.5)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712035.png", badge: "🟣" },
  { id: "mini",    name: "Mini Bot",    tier: "Starter+",  investAmount: 10,    dailyPct: 12, maxMultiplier: 2.5, color: "#10b981", gradient: "linear-gradient(135deg,#064e3b,#022c22)", glow: "rgba(16,185,129,0.5)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712021.png", badge: "🟢" },
  { id: "micro",   name: "Micro Bot",   tier: "Basic",     investAmount: 15,    dailyPct: 12, maxMultiplier: 3,   color: "#38bdf8", gradient: "linear-gradient(135deg,#0c4a6e,#082f49)", glow: "rgba(14,165,233,0.5)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712009.png", badge: "🔵" },
  { id: "delta",   name: "Delta Bot",   tier: "Bronze",    investAmount: 30,    dailyPct: 12, maxMultiplier: 3, color: "#fb923c", gradient: "linear-gradient(135deg,#7c2d12,#431407)", glow: "rgba(249,115,22,0.5)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712027.png", badge: "🟠" },
  { id: "sigma",   name: "Sigma Bot",   tier: "Bronze+",   investAmount: 50,    dailyPct: 12, maxMultiplier: 3, color: "#fbbf24", gradient: "linear-gradient(135deg,#78350f,#422006)", glow: "rgba(234,179,8,0.5)",    img: "https://cdn-icons-png.flaticon.com/512/4712/4712043.png", badge: "🟡" },
  { id: "apex",    name: "Apex Bot",    tier: "Silver",    investAmount: 80,    dailyPct: 12, maxMultiplier: 4, color: "#cbd5e1", gradient: "linear-gradient(135deg,#334155,#1e293b)", glow: "rgba(148,163,184,0.5)",  img: "https://cdn-icons-png.flaticon.com/512/4712/4712015.png", badge: "⚪" },
  { id: "titan",   name: "Titan Bot",   tier: "Silver+",   investAmount: 100,   dailyPct: 15, maxMultiplier: 4, color: "#22d3ee", gradient: "linear-gradient(135deg,#164e63,#083344)", glow: "rgba(34,211,238,0.5)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712049.png", badge: "🩵" },
  { id: "quantum", name: "Quantum Bot", tier: "Gold",      investAmount: 200,   dailyPct: 15, maxMultiplier: 4, color: "#c084fc", gradient: "linear-gradient(135deg,#4c1d95,#2e1065)", glow: "rgba(167,139,250,0.5)",  img: "https://cdn-icons-png.flaticon.com/512/4712/4712055.png", badge: "🟣" },
  { id: "nebula",  name: "Nebula Bot",  tier: "Gold+",     investAmount: 350,   dailyPct: 15, maxMultiplier: 5, color: "#fb7185", gradient: "linear-gradient(135deg,#881337,#4c0519)", glow: "rgba(244,63,94,0.5)",    img: "https://cdn-icons-png.flaticon.com/512/4712/4712061.png", badge: "🔴" },
  { id: "solar",   name: "Solar Bot",   tier: "Platinum",  investAmount: 500,   dailyPct: 15, maxMultiplier: 5, color: "#fb923c", gradient: "linear-gradient(135deg,#9a3412,#431407)", glow: "rgba(251,146,60,0.5)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712067.png", badge: "🟠" },
  { id: "orion",   name: "Orion Bot",   tier: "Plat+",     investAmount: 1000,  dailyPct: 15, maxMultiplier: 5, color: "#34d399", gradient: "linear-gradient(135deg,#064e3b,#022c22)", glow: "rgba(52,211,153,0.5)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712073.png", badge: "🟢" },
  { id: "galaxy",  name: "Galaxy Bot",  tier: "Diamond",   investAmount: 2000,  dailyPct: 15, maxMultiplier: 6, color: "#a78bfa", gradient: "linear-gradient(135deg,#4c1d95,#1e1b4b)", glow: "rgba(129,140,248,0.6)",  img: "https://cdn-icons-png.flaticon.com/512/4712/4712079.png", badge: "💎" },
  { id: "legend",  name: "Legend Bot",  tier: "Elite",     investAmount: 5000,  dailyPct: 15, maxMultiplier: 6, color: "#facc15", gradient: "linear-gradient(135deg,#854d0e,#422006)", glow: "rgba(250,204,21,0.6)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712085.png", badge: "⭐" },
  { id: "supreme", name: "Supreme Bot", tier: "Supreme",   investAmount: 10000, dailyPct: 15, maxMultiplier: 6, color: "#f472b6", gradient: "linear-gradient(135deg,#831843,#4a044e)", glow: "rgba(236,72,153,0.7)",   img: "https://cdn-icons-png.flaticon.com/512/4712/4712091.png", badge: "👑" },
];

export function getBotById(id: string): BotDef {
  return BOTS.find(b => b.id === id) || BOTS[0];
}
