import { useState, useEffect, useRef } from "react";

/*
 * ============================================================
 *  GiveTrack — Employee Charitable Giving Dashboard
 * ============================================================
 *  Auth: Google Sign-In (isara.io Workspace)
 *  Data: Microsoft Graph API → SharePoint Excel file
 *  
 *  Once the SharePoint API route is set up, change useDemoData
 *  to false and the app will pull live data.
 * ============================================================
 */

const GOOGLE_CLIENT_ID = "296721826980-i3sgo6dgklh7v8fppql7mumdnuv0lu33.apps.googleusercontent.com";

// Set to false once /api/sharepoint is deployed
const USE_DEMO_DATA = true;

// ─── UTILITIES ────────────────────────────────────────────────

const fmt = (n, currency = "$") => {
  const sym = currency === "£" ? "£" : "$";
  return sym + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function extractOrgName(paidTo) {
  if (!paidTo) return "Unknown";
  if (paidTo.startsWith("http")) {
    try {
      const url = new URL(paidTo);
      let name = url.hostname.replace("www.", "").split(".")[0];
      name = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
      return name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    } catch { return paidTo; }
  }
  return paidTo;
}

function getOrgColor(name) {
  const colors = ["#E63946","#2A9D8F","#457B9D","#E9C46A","#F4A261","#6C9BD1","#8B5CF6","#EC4899","#14B8A6","#F97316","#06B6D4","#84CC16","#A855F7","#EF4444","#3B82F6","#10B981","#F59E0B","#6366F1","#D946EF","#0EA5E9"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getOrgIcon(name) {
  const l = name.toLowerCase();
  if (l.includes("children") || l.includes("child") || l.includes("jude") || l.includes("unicef")) return "👶";
  if (l.includes("wildlife") || l.includes("wwf") || l.includes("ocean") || l.includes("sea")) return "🌍";
  if (l.includes("habitat") || l.includes("home") || l.includes("housing")) return "🏠";
  if (l.includes("feed") || l.includes("hunger") || l.includes("food")) return "🍞";
  if (l.includes("red cross") || l.includes("health") || l.includes("doctor") || l.includes("médecin")) return "🏥";
  if (l.includes("school") || l.includes("education") || l.includes("read")) return "📚";
  if (l.includes("malaria")) return "🦟";
  if (l.includes("save") || l.includes("evidence")) return "💚";
  if (l.includes("wave") || l.includes("wholesome")) return "🌊";
  if (l.includes("legal") || l.includes("door")) return "⚖️";
  if (l.includes("radiance") || l.includes("reality")) return "✨";
  if (l.includes("give")) return "🎁";
  if (l.includes("asylum") || l.includes("refugee")) return "🤝";
  if (l.includes("washing")) return "🧺";
  if (l.includes("ptahy") || l.includes("bird")) return "🐦";
  if (l.includes("action against")) return "✊";
  return "💝";
}

// ─── DEMO DATA (from your actual spreadsheet) ────────────────

const DEMO_DATA = {
  "courtney@isara.io": [
    { orgName: "Save The Children", paidTo: "https://support.savethechildren.org/site/Ecommerce", allocatedAmount: 950, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Save The Children", paidTo: "https://support.savethechildren.org/site/Ecommerce", allocatedAmount: 950, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "edward@isara.io": [
    { orgName: "Givetoiv", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 30 },
    { orgName: "Opendoorlegal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesomewave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 10 },
    { orgName: "Thewashingmachineproject", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 10 },
    { orgName: "Radiancesf", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 15 },
    { orgName: "Realitysf", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 15 },
    { orgName: "Givetoiv", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Opendoorlegal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesomewave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "Thewashingmachineproject", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "Radiancesf", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
    { orgName: "Realitysf", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
  ],
  "amy@isara.io": [
    { orgName: "Evidenceaction", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Evidenceaction", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "ben@isara.io": [
    { orgName: "Ncchcfoundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Ncchcfoundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "bernie@isara.io": [
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 40 },
    { orgName: "Seashepherd", paidTo: "https://seashepherd.org", allocatedAmount: 2367.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins Sans Frontières", paidTo: "Médecins Sans Frontières", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Seashepherd", paidTo: "https://seashepherd.org", allocatedAmount: 473.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
  ],
  "ed@isara.io": [
    { orgName: "Givewell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Givewell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "peter@isara.io": [
    { orgName: "Sfhs", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Sfhs", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "jerry@isara.io": [
    { orgName: "Schoolonwheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Schoolonwheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "rowan@isara.io": [
    { orgName: "Asylumaccess", paidTo: "https://www.asylumaccess.org/", allocatedAmount: 1924.83, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Clean Ocean Action", paidTo: "Clean Ocean Action", allocatedAmount: 577.45, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Middle East Children's Alliance", paidTo: "Middle East Children's Alliance", allocatedAmount: 769.93, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Room to Read", paidTo: "Room to Read", allocatedAmount: 577.45, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
  ],
  "sam@isara.io": [
    { orgName: "Doctorswithoutborders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 100 },
    { orgName: "Doctorswithoutborders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "artur@isara.io": [
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "10-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 50 },
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 50 },
  ],
  "lily@isara.io": [
    { orgName: "Oceana", paidTo: "Oceana", allocatedAmount: 689.58, month: "Feb 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 50 },
    { orgName: "WWF", paidTo: "WWF", allocatedAmount: 689.58, month: "Feb 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Feb-01 Payroll Cycle", percentage: 50 },
    { orgName: "Seashepherd", paidTo: "https://seashepherd.org", allocatedAmount: 551.67, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins sans Frontières", paidTo: "Médecins sans Frontières", allocatedAmount: 551.67, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 275.83, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
  ],
};

// ─── PARSE LIVE SPREADSHEET DATA ─────────────────────────────

function parseSpreadsheetData(rows, userEmail) {
  if (!rows || rows.length === 0) return [];
  const donations = [];
  let currentCycle = "";
  let currentEmployee = { first: "", last: "", email: "" };
  let currentCurrency = "$";
  let currentDonationAmount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const firstCell = String(row[0] || "").trim();

    if (firstCell.toLowerCase().includes("payroll cycle")) { currentCycle = firstCell; continue; }
    if (firstCell.toLowerCase() === "first") continue;

    const hasAllocation = row[4] !== undefined && row[4] !== null && String(row[4]).trim() !== "";
    const hasPaidTo = row[6] !== undefined && row[6] !== null && String(row[6]).trim() !== "";
    if (!hasAllocation && !hasPaidTo) continue;

    if (firstCell && firstCell.length > 0) {
      currentEmployee = {
        first: String(row[0] || "").trim(),
        last: String(row[1] || "").trim(),
        email: String(row[2] || "").trim().toLowerCase(),
      };
      const amountStr = String(row[3] || "");
      currentCurrency = amountStr.includes("£") ? "£" : "$";
      currentDonationAmount = parseFloat(amountStr.replace(/[$£,\s]/g, "")) || 0;
    }

    if (currentEmployee.email !== userEmail.toLowerCase()) continue;

    const pctStr = String(row[4] || "100").replace("%", "").trim();
    const pct = parseFloat(pctStr) || 100;
    const allocStr = String(row[5] || "0").replace(/[$£,\s]/g, "");
    const allocAmount = parseFloat(allocStr) || 0;
    const paidTo = String(row[6] || "").trim();
    if (!paidTo) continue;
    const paidDate = String(row[7] || "").trim();

    let month = "";
    if (paidDate) {
      const parts = paidDate.split("-");
      if (parts.length === 3) month = parts[1] + " 20" + parts[2];
    }
    if (!month && currentCycle) {
      const match = currentCycle.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
      if (match) month = match[1] + " 2026";
    }

    donations.push({
      cycle: currentCycle, first: currentEmployee.first, last: currentEmployee.last,
      email: currentEmployee.email, percentage: pct, allocatedAmount: allocAmount,
      currency: currentCurrency, paidTo, orgName: extractOrgName(paidTo),
      paidDate, month,
    });
  }
  return donations;
}

// ─── STYLES ───────────────────────────────────────────────────

const FONTS_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Playfair+Display:wght@600;700&display=swap";
const GLOBAL_CSS = `
  @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.04); } }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'DM Sans',-apple-system,sans-serif; background:#0f0f23; color:#fff; -webkit-font-smoothing:antialiased; }
  ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:3px; }
  ::selection { background:rgba(42,157,143,0.3); } input::placeholder { color:#4a5568; }
`;

// ─── COMPONENTS ───────────────────────────────────────────────

function AnimatedNumber({ value, currency = "$", duration = 900 }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = display; startRef.current = null;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      setDisplay(fromRef.current + (value - fromRef.current) * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);
  return <>{fmt(display, currency)}</>;
}

function DonutChart({ data, size = 210 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2 - 14, ir = r * 0.62, gap = 0.02;
  let cum = 0;
  const slices = data.map((d) => {
    const sa = (cum / total) * 2 * Math.PI - Math.PI / 2 + gap / 2;
    cum += d.value;
    const ea = (cum / total) * 2 * Math.PI - Math.PI / 2 - gap / 2;
    const la = ea - sa > Math.PI ? 1 : 0, cx = size / 2, cy = size / 2;
    const path = `M ${cx+r*Math.cos(sa)} ${cy+r*Math.sin(sa)} A ${r} ${r} 0 ${la} 1 ${cx+r*Math.cos(ea)} ${cy+r*Math.sin(ea)} L ${cx+ir*Math.cos(ea)} ${cy+ir*Math.sin(ea)} A ${ir} ${ir} 0 ${la} 0 ${cx+ir*Math.cos(sa)} ${cy+ir*Math.sin(sa)} Z`;
    return { ...d, path, fraction: d.value / total };
  });
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="rgba(15,15,35,0.8)" strokeWidth="2"
            style={{ transition: "transform .25s cubic-bezier(.4,0,.2,1), opacity .25s", transformOrigin: `${size/2}px ${size/2}px`, transform: hovered === i ? "scale(1.06)" : "scale(1)", cursor: "pointer", opacity: hovered !== null && hovered !== i ? 0.45 : 1 }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
        {hovered !== null ? (<>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{slices[hovered].label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{fmt(slices[hovered].value)}</div>
          <div style={{ fontSize: 12, color: slices[hovered].color, fontWeight: 600 }}>{(slices[hovered].fraction * 100).toFixed(1)}%</div>
        </>) : (<>
          <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: ".1em", textTransform: "uppercase" }}>Total Given</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{fmt(total)}</div>
        </>)}
      </div>
    </div>
  );
}

function BarChart({ data, height = 220 }) {
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const [hb, setHb] = useState(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 100); }, []);
  return (
    <div style={{ width: "100%", height, display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 32, position: "relative" }}>
      {data.map((d, i) => {
        const barH = animated ? (d.total / maxVal) * (height - 56) : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
            onMouseEnter={() => setHb(i)} onMouseLeave={() => setHb(null)}>
            {hb === i && <div style={{ position: "absolute", bottom: barH + 40, left: "50%", transform: "translateX(-50%)", background: "rgba(30,30,60,.95)", color: "#fff", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,.5)", border: "1px solid rgba(255,255,255,.08)" }}>{fmt(d.total)}</div>}
            <div style={{ width: "70%", minWidth: 18, maxWidth: 52, height: barH, borderRadius: "8px 8px 0 0", overflow: "hidden", cursor: "pointer", transition: `height .6s cubic-bezier(.4,0,.2,1) ${i*.05}s, filter .2s`, filter: hb === i ? "brightness(1.2)" : hb !== null ? "brightness(.7)" : "none", display: "flex", flexDirection: "column-reverse" }}>
              {d.segments.map((seg, j) => <div key={j} style={{ width: "100%", height: (seg.value / maxVal) * (height - 56), background: seg.color, flexShrink: 0 }} />)}
            </div>
            <div style={{ fontSize: 10, color: hb === i ? "#d1d5db" : "#6b7280", marginTop: 8, fontWeight: hb === i ? 600 : 400 }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, accent, sub, isCount, delay = 0, currency }) {
  return (
    <div style={{ background: "rgba(26,26,60,.5)", backdropFilter: "blur(16px)", borderRadius: 18, padding: "26px 28px", border: "1px solid rgba(255,255,255,.05)", position: "relative", overflow: "hidden", animation: `fadeSlideUp .5s ease ${delay}s both`, transition: "border-color .3s, transform .2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}30`; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.05)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: accent, opacity: .05 }} />
      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", marginBottom: 6, lineHeight: 1 }}>
        {isCount ? value : <AnimatedNumber value={value} currency={currency} />}
      </div>
      <div style={{ fontSize: 12, color: accent, fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [error, setError] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          try {
            const payload = JSON.parse(atob(response.credential.split(".")[1]));
            onLogin({ email: payload.email, name: payload.name, picture: payload.picture });
          } catch (err) {
            setError("Login failed. Please try again.");
          }
        },
        auto_select: false,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        { theme: "filled_black", size: "large", width: 320, text: "signin_with", shape: "pill" }
      );
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, #0f0f23 0%, #1a1a3e 40%, #0d1b2a 100%)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "15%", left: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(42,157,143,.06) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "15%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(69,123,157,.05) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ width: 440, background: "rgba(26,26,60,.6)", backdropFilter: "blur(24px)", borderRadius: 24, padding: "56px 48px", border: "1px solid rgba(255,255,255,.06)", boxShadow: "0 32px 80px rgba(0,0,0,.5)", animation: "fadeSlideUp .6s ease", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16, animation: "pulse 2s ease infinite" }}>💝</div>
        <h1 style={{ fontSize: 32, fontFamily: "'Playfair Display',serif", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>GiveTrack</h1>
        <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 36px", lineHeight: 1.5 }}>Sign in to view your personal<br/>donation dashboard</p>
        <div id="google-signin-btn" style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}></div>
        {error && <div style={{ color: "#E63946", fontSize: 13, marginTop: 16, background: "rgba(230,57,70,.1)", padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(230,57,70,.2)" }}>{error}</div>}
        <div style={{ marginTop: 32, padding: "14px 18px", background: "rgba(255,255,255,.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,.03)" }}>
          <p style={{ color: "#4a5568", fontSize: 11, margin: 0, lineHeight: 1.6 }}>Sign in with your company Google account to view your charitable giving history.</p>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [dataError, setDataError] = useState("");

  const handleLogin = async (googleUser) => {
    setUser(googleUser);
    setLoading(true);
    setDataError("");
    try {
      if (USE_DEMO_DATA) {
        const d = DEMO_DATA[googleUser.email] || [];
        setDonations(d);
      } else {
        const res = await fetch("/api/sharepoint");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setDonations(parseSpreadsheetData(data.values || [], googleUser.email));
      }
    } catch (err) {
      setDataError("Unable to load donation data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null); setDonations([]); setActiveTab("overview"); setDataError("");
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  };

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>
      {!user ? <LoginScreen onLogin={handleLogin} /> :
       loading ? (
        <div style={{ minHeight: "100vh", background: "linear-gradient(145deg, #0f0f23 0%, #1a1a3e 40%, #0d1b2a 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
          <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,.1)", borderTop: "3px solid #2A9D8F", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          <p style={{ color: "#6b7280", fontSize: 14 }}>Loading your donation data...</p>
        </div>
       ) : <Dashboard user={user} donations={donations} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} dataError={dataError} />}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────

function Dashboard({ user, donations, activeTab, setActiveTab, onLogout, dataError }) {
  const totalDonated = donations.reduce((s, d) => s + d.allocatedAmount, 0);
  const primaryCurrency = donations[0]?.currency || "$";
  const orgTotals = {}, orgUrls = {};
  donations.forEach(d => {
    orgTotals[d.orgName] = (orgTotals[d.orgName] || 0) + d.allocatedAmount;
    if (d.paidTo?.startsWith("http")) orgUrls[d.orgName] = d.paidTo;
  });
  const orgCount = Object.keys(orgTotals).length;
  const months = [...new Set(donations.map(d => d.month).filter(Boolean))].sort();
  const cycles = [...new Set(donations.map(d => d.cycle).filter(Boolean))];

  const monthlyData = months.map(m => {
    const md = donations.filter(d => d.month === m);
    const total = md.reduce((s, d) => s + d.allocatedAmount, 0);
    const og = {};
    md.forEach(d => { og[d.orgName] = (og[d.orgName] || 0) + d.allocatedAmount; });
    return { label: m.replace(" 20", "'"), total, segments: Object.entries(og).map(([n, v]) => ({ value: v, color: getOrgColor(n) })) };
  });

  const donutData = Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ label: n, value: v, color: getOrgColor(n) }));
  const avgCycle = cycles.length > 0 ? totalDonated / cycles.length : 0;

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "breakdown", label: "Organizations", icon: "🏢" },
    { id: "history", label: "Payment History", icon: "📋" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg, #0f0f23 0%, #1a1a3e 40%, #0d1b2a 100%)" }}>
      {/* Header */}
      <header style={{ padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.04)", background: "rgba(15,15,35,.7)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>💝</span>
          <span style={{ fontSize: 18, fontFamily: "'Playfair Display',serif", fontWeight: 700 }}>GiveTrack</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{user.email}</div>
          </div>
          {user.picture && <img src={user.picture} alt="" style={{ width: 36, height: 36, borderRadius: 10, border: "2px solid rgba(255,255,255,.1)" }} />}
          <button onClick={onLogout} style={{ padding: "8px 16px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, color: "#6b7280", fontSize: 12, cursor: "pointer", transition: "all .15s" }}
            onMouseEnter={e => { e.target.style.background = "rgba(230,57,70,.1)"; e.target.style.color = "#E63946"; }}
            onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,.04)"; e.target.style.color = "#6b7280"; }}>Sign Out</button>
        </div>
      </header>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 28px 72px" }}>
        <div style={{ marginBottom: 32, animation: "fadeSlideUp .4s ease" }}>
          <h2 style={{ fontSize: 30, fontFamily: "'Playfair Display',serif", fontWeight: 700, margin: "0 0 6px", color: "#fff" }}>Welcome, {user.name.split(" ")[0]}</h2>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>Here's an overview of your charitable giving and its impact.</p>
        </div>

        {dataError && <div style={{ background: "rgba(230,57,70,.1)", border: "1px solid rgba(230,57,70,.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 24, color: "#E63946", fontSize: 14 }}>{dataError}</div>}

        {donations.length === 0 && !dataError ? (
          <div style={{ background: "rgba(42,157,143,.1)", border: "1px solid rgba(42,157,143,.2)", borderRadius: 16, padding: "40px 32px", textAlign: "center", animation: "fadeSlideUp .4s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>No donations found</h3>
            <p style={{ color: "#9ca3af", fontSize: 14, maxWidth: 400, margin: "0 auto" }}>We couldn't find any donation records linked to {user.email}. If you believe this is an error, please contact your administrator.</p>
          </div>
        ) : donations.length > 0 && (
          <>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 32, background: "rgba(255,255,255,.025)", borderRadius: 14, padding: 5, width: "fit-content", border: "1px solid rgba(255,255,255,.03)" }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: "10px 22px", background: activeTab === t.id ? "rgba(42,157,143,.15)" : "transparent", border: activeTab === t.id ? "1px solid rgba(42,157,143,.25)" : "1px solid transparent", borderRadius: 10, color: activeTab === t.id ? "#2A9D8F" : "#6b7280", fontSize: 13, fontWeight: activeTab === t.id ? 600 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, transition: "all .2s" }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>

            {/* OVERVIEW */}
            {activeTab === "overview" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
                <StatCard label="Total Donated" value={totalDonated} accent="#2A9D8F" sub={`Across ${cycles.length} payroll cycles`} currency={primaryCurrency} />
                <StatCard label="Per Cycle" value={avgCycle} accent="#457B9D" sub="Average contribution" delay={.05} currency={primaryCurrency} />
                <StatCard label="Organizations" value={orgCount} accent="#F4A261" sub="Supported" isCount delay={.1} />
                <StatCard label="Payments" value={donations.length} accent="#E9C46A" sub="Total transactions" isCount delay={.15} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: months.length > 1 ? "1.4fr 1fr" : "1fr", gap: 16 }}>
                {months.length > 1 && (
                  <div style={{ background: "rgba(26,26,60,.5)", backdropFilter: "blur(16px)", borderRadius: 18, padding: "26px 28px", border: "1px solid rgba(255,255,255,.05)", animation: "fadeSlideUp .5s ease .15s both" }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 20px" }}>Monthly Donations</h3>
                    <BarChart data={monthlyData} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
                      {Object.keys(orgTotals).map(n => <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9ca3af" }}><div style={{ width: 8, height: 8, borderRadius: 3, background: getOrgColor(n) }} />{n}</div>)}
                    </div>
                  </div>
                )}
                <div style={{ background: "rgba(26,26,60,.5)", backdropFilter: "blur(16px)", borderRadius: 18, padding: "26px 28px", border: "1px solid rgba(255,255,255,.05)", display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeSlideUp .5s ease .2s both" }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 22px", alignSelf: "flex-start" }}>Donation Split</h3>
                  <DonutChart data={donutData} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22, width: "100%" }}>
                    {donutData.map((d, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: 4, background: d.color }} />
                          <span style={{ color: "#c9cdd3" }}>{d.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>{((d.value / totalDonated) * 100).toFixed(0)}%</span>
                          <span style={{ fontWeight: 600, minWidth: 60, textAlign: "right" }}>{fmt(d.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>)}

            {/* ORGANIZATIONS */}
            {activeTab === "breakdown" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([name, total], i) => {
                  const orgDonations = donations.filter(d => d.orgName === name);
                  const monthlyAmounts = months.map(m => ({ month: m, amount: orgDonations.filter(d => d.month === m).reduce((s, d) => s + d.allocatedAmount, 0) }));
                  const maxM = Math.max(...monthlyAmounts.map(m => m.amount), 1);
                  const url = orgUrls[name];
                  const color = getOrgColor(name);
                  return (
                    <div key={name} style={{ background: "rgba(26,26,60,.5)", backdropFilter: "blur(16px)", borderRadius: 18, padding: "24px 26px", border: "1px solid rgba(255,255,255,.05)", position: "relative", overflow: "hidden", animation: `fadeSlideUp .45s ease ${i*.06}s both`, transition: "border-color .3s, transform .2s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}30`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.05)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent)` }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `1px solid ${color}25` }}>{getOrgIcon(name)}</div>
                        <div style={{ flex: 1 }}>
                          {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, fontWeight: 600, color: "#fff", textDecoration: "none", borderBottom: "1px dashed rgba(255,255,255,.2)" }}>{name} ↗</a> : <div style={{ fontSize: 15, fontWeight: 600 }}>{name}</div>}
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{orgDonations.length} payment{orgDonations.length !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 16 }}>{fmt(total)}</div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 40, marginBottom: 8 }}>
                        {monthlyAmounts.map((m, j) => <div key={j} style={{ flex: 1, height: m.amount > 0 ? `${Math.max((m.amount/maxM)*100, 8)}%` : "4px", background: m.amount > 0 ? color : "rgba(255,255,255,.04)", borderRadius: "4px 4px 0 0", opacity: m.amount > 0 ? .35 + (m.amount/maxM)*.65 : .2 }} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PAYMENT HISTORY */}
            {activeTab === "history" && (
              <div style={{ animation: "fadeSlideUp .4s ease" }}>
                {cycles.map((cycle, ci) => {
                  const cd = donations.filter(d => d.cycle === cycle);
                  const ct = cd.reduce((s, d) => s + d.allocatedAmount, 0);
                  return (
                    <div key={cycle} style={{ marginBottom: 24, animation: `fadeSlideUp .4s ease ${ci*.08}s both` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 600 }}>{cycle}</h3>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#2A9D8F" }}>{fmt(ct, primaryCurrency)}</span>
                      </div>
                      <div style={{ background: "rgba(26,26,60,.5)", backdropFilter: "blur(16px)", borderRadius: 16, border: "1px solid rgba(255,255,255,.05)", overflow: "hidden" }}>
                        {cd.map((d, i) => (
                          <div key={i} style={{ padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, borderBottom: i < cd.length - 1 ? "1px solid rgba(255,255,255,.03)" : "none", transition: "background .15s" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,.02)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${getOrgColor(d.orgName)}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: `1px solid ${getOrgColor(d.orgName)}25`, flexShrink: 0 }}>{getOrgIcon(d.orgName)}</div>
                            <div style={{ flex: 1 }}>
                              {d.paidTo?.startsWith("http") ? (
                                <a href={d.paidTo} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 500, color: "#fff", textDecoration: "none" }}
                                  onMouseEnter={e => e.target.style.color = getOrgColor(d.orgName)}
                                  onMouseLeave={e => e.target.style.color = "#fff"}>{d.orgName} ↗</a>
                              ) : <div style={{ fontSize: 14, fontWeight: 500 }}>{d.orgName}</div>}
                              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{d.paidDate} · {d.percentage}% allocation</div>
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 600, color: getOrgColor(d.orgName) }}>{fmt(d.allocatedAmount, d.currency)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ textAlign: "center", padding: "20px 0 32px", borderTop: "1px solid rgba(255,255,255,.03)" }}>
        <p style={{ color: "#3a3a5a", fontSize: 11, letterSpacing: ".05em" }}>GiveTrack · Your giving, your impact · {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
