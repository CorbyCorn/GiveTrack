import { useState, useEffect, useRef, useCallback } from "react";

/*
 * ============================================================
 *  GiveTrack — Employee Charitable Giving Dashboard
 * ============================================================
 *
 *  SETUP INSTRUCTIONS FOR ADMIN:
 *  
 *  1. Replace the EMPLOYEES, ORGS, DONATIONS, and THANK_EMAILS
 *     data below with your real data (or wire up to an API/DB).
 *  
 *  2. For Microsoft SSO (optional), register an app in Entra ID
 *     and update the MSAL config in the auth section.
 *  
 *  3. Deploy to Vercel by running `npm run build` and uploading
 *     the `dist` folder.
 * ============================================================
 */

// ─── MOCK DATA — Replace with real data or API calls ─────────

const EMPLOYEES = {
  emp001: { name: "Sarah Mitchell", pin: "1234", role: "Marketing Manager", email: "sarah.m@company.com", avatar: "SM" },
  emp002: { name: "James Chen", pin: "5678", role: "Software Engineer", email: "james.c@company.com", avatar: "JC" },
  emp003: { name: "Priya Patel", pin: "9012", role: "Finance Analyst", email: "priya.p@company.com", avatar: "PP" },
};

const ORGS = {
  redcross:  { name: "Red Cross",              color: "#E63946", icon: "🏥", description: "Emergency disaster relief and blood donation services" },
  habitat:   { name: "Habitat for Humanity",    color: "#2A9D8F", icon: "🏠", description: "Building affordable housing for families in need" },
  wwf:       { name: "World Wildlife Fund",     color: "#457B9D", icon: "🌍", description: "Protecting endangered species and natural habitats" },
  feedam:    { name: "Feeding America",         color: "#E9C46A", icon: "🍞", description: "Fighting hunger through food bank networks nationwide" },
  stjude:    { name: "St. Jude Children's",     color: "#F4A261", icon: "💛", description: "Pediatric cancer treatment and research hospital" },
  unicef:    { name: "UNICEF",                  color: "#6C9BD1", icon: "👶", description: "Protecting the rights of children worldwide" },
};

const DONATIONS = {
  emp001: [
    { month: "Sep 2025", org: "redcross", amount: 120 },
    { month: "Sep 2025", org: "habitat", amount: 80 },
    { month: "Oct 2025", org: "redcross", amount: 120 },
    { month: "Oct 2025", org: "habitat", amount: 80 },
    { month: "Oct 2025", org: "wwf", amount: 50 },
    { month: "Nov 2025", org: "redcross", amount: 120 },
    { month: "Nov 2025", org: "habitat", amount: 80 },
    { month: "Nov 2025", org: "wwf", amount: 50 },
    { month: "Dec 2025", org: "redcross", amount: 140 },
    { month: "Dec 2025", org: "habitat", amount: 80 },
    { month: "Dec 2025", org: "wwf", amount: 50 },
    { month: "Dec 2025", org: "feedam", amount: 30 },
    { month: "Jan 2026", org: "redcross", amount: 140 },
    { month: "Jan 2026", org: "habitat", amount: 80 },
    { month: "Jan 2026", org: "wwf", amount: 50 },
    { month: "Jan 2026", org: "feedam", amount: 30 },
    { month: "Feb 2026", org: "redcross", amount: 140 },
    { month: "Feb 2026", org: "habitat", amount: 80 },
    { month: "Feb 2026", org: "wwf", amount: 50 },
    { month: "Feb 2026", org: "feedam", amount: 30 },
  ],
  emp002: [
    { month: "Sep 2025", org: "stjude", amount: 200 },
    { month: "Sep 2025", org: "unicef", amount: 100 },
    { month: "Oct 2025", org: "stjude", amount: 200 },
    { month: "Oct 2025", org: "unicef", amount: 100 },
    { month: "Nov 2025", org: "stjude", amount: 200 },
    { month: "Nov 2025", org: "unicef", amount: 100 },
    { month: "Nov 2025", org: "wwf", amount: 75 },
    { month: "Dec 2025", org: "stjude", amount: 200 },
    { month: "Dec 2025", org: "unicef", amount: 100 },
    { month: "Dec 2025", org: "wwf", amount: 75 },
    { month: "Jan 2026", org: "stjude", amount: 200 },
    { month: "Jan 2026", org: "unicef", amount: 150 },
    { month: "Jan 2026", org: "wwf", amount: 75 },
    { month: "Feb 2026", org: "stjude", amount: 200 },
    { month: "Feb 2026", org: "unicef", amount: 150 },
    { month: "Feb 2026", org: "wwf", amount: 75 },
  ],
  emp003: [
    { month: "Sep 2025", org: "feedam", amount: 150 },
    { month: "Sep 2025", org: "redcross", amount: 50 },
    { month: "Oct 2025", org: "feedam", amount: 150 },
    { month: "Oct 2025", org: "redcross", amount: 50 },
    { month: "Oct 2025", org: "habitat", amount: 100 },
    { month: "Nov 2025", org: "feedam", amount: 150 },
    { month: "Nov 2025", org: "redcross", amount: 50 },
    { month: "Nov 2025", org: "habitat", amount: 100 },
    { month: "Dec 2025", org: "feedam", amount: 175 },
    { month: "Dec 2025", org: "redcross", amount: 50 },
    { month: "Dec 2025", org: "habitat", amount: 100 },
    { month: "Jan 2026", org: "feedam", amount: 175 },
    { month: "Jan 2026", org: "redcross", amount: 75 },
    { month: "Jan 2026", org: "habitat", amount: 100 },
    { month: "Feb 2026", org: "feedam", amount: 175 },
    { month: "Feb 2026", org: "redcross", amount: 75 },
    { month: "Feb 2026", org: "habitat", amount: 100 },
  ],
};

const THANK_EMAILS = {
  emp001: [
    { org: "redcross", date: "Feb 10, 2026", subject: "Your Generosity Saves Lives", body: "Dear Sarah, Thank you so much for your continued monthly donations to the Red Cross. Your contributions have helped us provide emergency disaster relief to over 200 families this quarter. Your consistent generosity truly makes a difference in the lives of those affected by natural disasters and emergencies. With heartfelt gratitude, The Red Cross Team" },
    { org: "habitat", date: "Jan 15, 2026", subject: "Building Homes, Building Hope", body: "Hi Sarah, We wanted to reach out and personally thank you for your ongoing support of Habitat for Humanity. Thanks to donors like you, we completed 3 new homes in the Bay Area this month. Each home represents a family achieving the dream of stable, affordable housing. Thank you for being part of that journey." },
    { org: "wwf", date: "Dec 20, 2025", subject: "Protecting Our Planet Together", body: "Dear Sarah, Your donations to the World Wildlife Fund are helping protect endangered species around the globe. This quarter, your support contributed to our marine conservation program that has expanded protected ocean habitats by 15%. Thank you for standing with us in the fight to preserve our natural world." },
    { org: "feedam", date: "Feb 1, 2026", subject: "Meals Made Possible By You", body: "Sarah, we're writing to let you know that your recent donations have helped Feeding America provide over 500 meals to families in need. During these challenging times, every dollar counts, and your generosity ensures no family goes hungry. Thank you from the bottom of our hearts." },
  ],
  emp002: [
    { org: "stjude", date: "Feb 12, 2026", subject: "Hope for Every Child", body: "Dear James, Your generous donations to St. Jude Children's Research Hospital are helping us ensure that no child is denied treatment based on their family's ability to pay. Your support this quarter has contributed to groundbreaking pediatric cancer research. Thank you for giving children a fighting chance." },
    { org: "unicef", date: "Jan 20, 2026", subject: "Changing Lives Around the World", body: "Hi James, Thanks to supporters like you, UNICEF was able to deliver clean water to 10,000 children in sub-Saharan Africa this month. Your monthly contributions make an enormous impact on the lives of the world's most vulnerable children. We are deeply grateful for your partnership." },
    { org: "wwf", date: "Dec 18, 2025", subject: "A Greener Future Thanks to You", body: "James, your support of WWF's reforestation initiative has helped plant over 2,000 trees this quarter. Every tree planted is a step toward combating climate change and restoring vital ecosystems. Thank you for investing in the future of our planet." },
  ],
  emp003: [
    { org: "feedam", date: "Feb 5, 2026", subject: "Fighting Hunger Together", body: "Dear Priya, Your consistent and generous support of Feeding America has been incredible. This quarter alone, your donations helped distribute over 800 meals to underserved communities in your region. We are so grateful for partners like you who refuse to let hunger win." },
    { org: "redcross", date: "Jan 25, 2026", subject: "Thank You for Being a Lifesaver", body: "Priya, we want you to know that your donations to the Red Cross have directly funded blood drives and disaster preparedness training in your community. Your generosity helps us be ready when emergencies strike. Thank you for making a real difference." },
    { org: "habitat", date: "Feb 14, 2026", subject: "Walls Going Up Thanks to You!", body: "Hi Priya! Exciting news — the home your donations helped fund in East Oakland is nearly complete! The Martinez family will be moving in next month. This wouldn't be possible without dedicated supporters like you. Thank you for building hope, one home at a time." },
  ],
};

// ─── UTILITIES ────────────────────────────────────────────────

const fmt = (n) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const MONTH_ORDER = [
  "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026",
  "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026",
];

function shortMonth(m) {
  const parts = m.split(" ");
  const yr = parts[1] ? "'" + parts[1].slice(2) : "";
  return parts[0].slice(0, 3) + yr;
}

// ─── GLOBAL STYLES ────────────────────────────────────────────

const FONTS_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@600;700&display=swap";

const GLOBAL_CSS = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.04); }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: 'DM Sans', -apple-system, sans-serif; 
    background: #0f0f23; 
    color: #fff;
    -webkit-font-smoothing: antialiased;
  }
  select option { background: #1a1a3e; color: #fff; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
  ::selection { background: rgba(42,157,143,0.3); }
  input::placeholder { color: #4a5568; }
`;

// ─── ANIMATED NUMBER ──────────────────────────────────────────

function AnimatedNumber({ value, duration = 900 }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(fromRef.current + (value - fromRef.current) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <>{fmt(display)}</>;
}

// ─── DONUT CHART ──────────────────────────────────────────────

function DonutChart({ data, size = 220 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const radius = size / 2 - 14;
  const innerRadius = radius * 0.62;
  const gap = 0.02;
  let cumulative = 0;

  const slices = data.map((d) => {
    const fraction = d.value / total;
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2 + gap / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2 - gap / 2;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const cx = size / 2, cy = size / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const ix1 = cx + innerRadius * Math.cos(startAngle);
    const iy1 = cy + innerRadius * Math.sin(startAngle);
    const ix2 = cx + innerRadius * Math.cos(endAngle);
    const iy2 = cy + innerRadius * Math.sin(endAngle);
    const path = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
    return { ...d, path, fraction };
  });

  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          {slices.map((s, i) => (
            <filter key={i} id={`glow-${i}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood floodColor={s.color} floodOpacity="0.4" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            stroke="rgba(15,15,35,0.8)"
            strokeWidth="2"
            filter={hovered === i ? `url(#glow-${i})` : "none"}
            style={{
              transition: "transform 0.25s cubic-bezier(.4,0,.2,1), filter 0.25s",
              transformOrigin: `${size / 2}px ${size / 2}px`,
              transform: hovered === i ? "scale(1.06)" : "scale(1)",
              cursor: "pointer",
              opacity: hovered !== null && hovered !== i ? 0.5 : 1,
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        textAlign: "center", pointerEvents: "none", transition: "all 0.2s",
      }}>
        {hovered !== null ? (
          <>
            <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: "0.05em", marginBottom: 2 }}>{slices[hovered].label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{fmt(slices[hovered].value)}</div>
            <div style={{ fontSize: 12, color: slices[hovered].color, fontWeight: 600 }}>{(slices[hovered].fraction * 100).toFixed(1)}%</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 10, color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>Total Given</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>{fmt(total)}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── BAR CHART ────────────────────────────────────────────────

function BarChart({ data, height = 230 }) {
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ width: "100%", height, position: "relative", display: "flex", alignItems: "flex-end", gap: 6, paddingBottom: 32 }}>
      {data.map((d, i) => {
        const targetH = (d.total / maxVal) * (height - 56);
        const barH = animated ? targetH : 0;
        return (
          <div
            key={i}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              position: "relative",
            }}
            onMouseEnter={() => setHoveredBar(i)}
            onMouseLeave={() => setHoveredBar(null)}
          >
            {hoveredBar === i && (
              <div style={{
                position: "absolute", bottom: barH + 40, left: "50%", transform: "translateX(-50%)",
                background: "rgba(30,30,60,0.95)", color: "#fff",
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.08)",
                animation: "fadeIn 0.15s ease",
              }}>
                {fmt(d.total)}
                <div style={{
                  position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)",
                  width: 8, height: 8, background: "rgba(30,30,60,0.95)", borderRight: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)",
                }} />
              </div>
            )}
            <div style={{
              width: "70%", minWidth: 18, maxWidth: 52, height: barH, borderRadius: "8px 8px 0 0",
              overflow: "hidden", cursor: "pointer",
              transition: `height 0.6s cubic-bezier(.4,0,.2,1) ${i * 0.05}s, filter 0.2s`,
              filter: hoveredBar === i ? "brightness(1.2)" : hoveredBar !== null ? "brightness(0.7)" : "none",
              display: "flex", flexDirection: "column-reverse",
            }}>
              {d.segments.map((seg, j) => {
                const segH = (seg.value / maxVal) * (height - 56);
                return <div key={j} style={{ width: "100%", height: segH, background: seg.color, flexShrink: 0 }} />;
              })}
            </div>
            <div style={{
              fontSize: 10, color: hoveredBar === i ? "#d1d5db" : "#6b7280",
              marginTop: 8, textAlign: "center", letterSpacing: "0.02em",
              transition: "color 0.2s", fontWeight: hoveredBar === i ? 600 : 400,
            }}>
              {shortMonth(d.label)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── STAT CARD ────────────────────────────────────────────────

function StatCard({ label, value, accent, sub, isCount, delay = 0 }) {
  return (
    <div style={{
      background: "rgba(26, 26, 60, 0.5)", backdropFilter: "blur(16px)",
      borderRadius: 18, padding: "26px 28px", border: "1px solid rgba(255,255,255,0.05)",
      position: "relative", overflow: "hidden",
      animation: `fadeSlideUp 0.5s ease ${delay}s both`,
      transition: "border-color 0.3s, transform 0.2s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${accent}30`; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{
        position: "absolute", top: -30, right: -30, width: 100, height: 100,
        borderRadius: "50%", background: accent, opacity: 0.05,
      }} />
      <div style={{
        position: "absolute", bottom: -20, left: -20, width: 60, height: 60,
        borderRadius: "50%", background: accent, opacity: 0.03,
      }} />
      <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 700, color: "#fff", fontFamily: "'DM Sans', sans-serif", marginBottom: 6, lineHeight: 1 }}>
        {isCount ? value : <AnimatedNumber value={value} />}
      </div>
      <div style={{ fontSize: 12, color: accent, fontWeight: 500 }}>{sub}</div>
    </div>
  );
}

// ─── ORG CARD ─────────────────────────────────────────────────

function OrgCard({ org, orgKey, total, donations, months, emails, delay = 0 }) {
  const orgDonations = donations.filter((d) => d.org === orgKey);
  const monthlyAmounts = months.map((m) => {
    const d = orgDonations.find((dd) => dd.month === m);
    return { month: m, amount: d ? d.amount : 0 };
  });
  const orgEmails = emails.filter((e) => e.org === orgKey);
  const maxMonth = Math.max(...monthlyAmounts.map((m) => m.amount), 1);
  const latestAmount = monthlyAmounts[monthlyAmounts.length - 1]?.amount || 0;
  const prevAmount = monthlyAmounts[monthlyAmounts.length - 2]?.amount || 0;
  const trend = latestAmount > prevAmount ? "↑" : latestAmount < prevAmount ? "↓" : "→";
  const trendColor = latestAmount > prevAmount ? "#2A9D8F" : latestAmount < prevAmount ? "#E63946" : "#6b7280";

  return (
    <div style={{
      background: "rgba(26, 26, 60, 0.5)", backdropFilter: "blur(16px)",
      borderRadius: 18, padding: "24px 26px", border: "1px solid rgba(255,255,255,0.05)",
      position: "relative", overflow: "hidden",
      animation: `fadeSlideUp 0.45s ease ${delay}s both`,
      transition: "border-color 0.3s, transform 0.2s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${org.color}30`; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${org.color}, transparent)`,
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, background: `${org.color}15`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          border: `1px solid ${org.color}25`,
        }}>
          {org.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{org.name}</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{org.description}</div>
        </div>
      </div>

      {/* Amount + trend */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: org.color }}>{fmt(total)}</div>
        <div style={{ fontSize: 12, color: trendColor, fontWeight: 600 }}>
          {trend} {fmt(latestAmount)}/mo
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 44, marginBottom: 10 }}>
        {monthlyAmounts.map((m, i) => (
          <div key={i} title={`${m.month}: ${fmt(m.amount)}`} style={{
            flex: 1,
            height: m.amount > 0 ? `${Math.max((m.amount / maxMonth) * 100, 8)}%` : "4px",
            background: m.amount > 0 ? `${org.color}` : "rgba(255,255,255,0.04)",
            borderRadius: "4px 4px 0 0",
            opacity: m.amount > 0 ? 0.35 + (m.amount / maxMonth) * 0.65 : 0.2,
            transition: "all 0.3s ease",
            cursor: "default",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4a5568", marginBottom: 14 }}>
        <span>{shortMonth(months[0])}</span>
        <span>{orgDonations.length} donations</span>
        <span>{shortMonth(months[months.length - 1])}</span>
      </div>

      {/* Latest email preview */}
      {orgEmails.length > 0 && (
        <div style={{
          padding: "10px 14px", background: "rgba(255,255,255,0.025)", borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>💌</span>
          <div style={{ fontSize: 12, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {orgEmails[0].subject}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EMAIL CARD ───────────────────────────────────────────────

function EmailCard({ email, isExpanded, onToggle, delay = 0 }) {
  const orgInfo = ORGS[email.org];
  return (
    <div
      style={{
        background: "rgba(26, 26, 60, 0.5)", backdropFilter: "blur(16px)",
        borderRadius: 16, border: `1px solid ${isExpanded ? `${orgInfo?.color}25` : "rgba(255,255,255,0.05)"}`,
        overflow: "hidden", cursor: "pointer",
        transition: "all 0.25s ease",
        animation: `fadeSlideUp 0.4s ease ${delay}s both`,
      }}
      onClick={onToggle}
      onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.borderColor = `${orgInfo?.color}20`; }}
      onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}
    >
      <div style={{ padding: "18px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: `${orgInfo?.color}15`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
          border: `1px solid ${orgInfo?.color}25`, flexShrink: 0,
        }}>
          {orgInfo?.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{orgInfo?.name}</span>
            <span style={{ fontSize: 11, color: "#4a5568" }}>•</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{email.date}</span>
          </div>
          <div style={{ fontSize: 13, color: "#b0b8c4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {email.subject}
          </div>
        </div>
        <div style={{
          color: "#6b7280", fontSize: 14, transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0,
        }}>
          ▾
        </div>
      </div>
      {isExpanded && (
        <div style={{ padding: "0 24px 22px 82px", animation: "fadeSlideUp 0.3s ease" }}>
          <div style={{
            fontSize: 13.5, lineHeight: 1.75, color: "#a8b2bf",
            background: "rgba(255,255,255,0.02)", borderRadius: 12,
            padding: "18px 22px", border: "1px solid rgba(255,255,255,0.03)",
          }}>
            {email.body}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [empId, setEmpId] = useState("emp001");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);

  const handleLogin = () => {
    const emp = EMPLOYEES[empId];
    if (emp && emp.pin === pin) {
      onLogin(empId);
    } else {
      setError("Invalid PIN. Please try again.");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(145deg, #0f0f23 0%, #1a1a3e 40%, #0d1b2a 100%)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: "absolute", top: "15%", left: "10%", width: 300, height: 300,
        borderRadius: "50%", background: "radial-gradient(circle, rgba(42,157,143,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "10%", right: "15%", width: 400, height: 400,
        borderRadius: "50%", background: "radial-gradient(circle, rgba(69,123,157,0.05) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: 420, background: "rgba(26, 26, 60, 0.6)", backdropFilter: "blur(24px)",
        borderRadius: 24, padding: "52px 44px", border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
        animation: "fadeSlideUp 0.6s ease",
        transform: shaking ? "translateX(-8px)" : "none",
        transition: "transform 0.1s ease",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            fontSize: 44, marginBottom: 12,
            animation: "pulse 2s ease infinite",
          }}>💝</div>
          <h1 style={{
            fontSize: 30, fontFamily: "'Playfair Display', serif", fontWeight: 700,
            color: "#fff", margin: "0 0 6px 0", letterSpacing: "-0.01em",
          }}>GiveTrack</h1>
          <p style={{ color: "#6b7280", fontSize: 13, margin: 0, letterSpacing: "0.04em" }}>
            Your personal donation dashboard
          </p>
        </div>

        {/* Form */}
        <div style={{ marginBottom: 22 }}>
          <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Employee
          </label>
          <select
            value={empId}
            onChange={(e) => { setEmpId(e.target.value); setError(""); }}
            style={{
              width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#fff",
              fontSize: 14, outline: "none", cursor: "pointer", appearance: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => e.target.style.borderColor = "rgba(42,157,143,0.4)"}
            onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
          >
            {Object.entries(EMPLOYEES).map(([id, emp]) => (
              <option key={id} value={id}>{emp.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 30 }}>
          <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            PIN
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Enter your 4-digit PIN"
            maxLength={4}
            style={{
              width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.04)",
              border: `1px solid ${error ? "rgba(230,57,70,0.4)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 12, color: "#fff",
              fontSize: 14, outline: "none", boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => e.target.style.borderColor = error ? "rgba(230,57,70,0.6)" : "rgba(42,157,143,0.4)"}
            onBlur={(e) => e.target.style.borderColor = error ? "rgba(230,57,70,0.4)" : "rgba(255,255,255,0.08)"}
          />
        </div>

        {error && (
          <div style={{
            color: "#E63946", fontSize: 13, marginBottom: 20, textAlign: "center",
            animation: "fadeIn 0.2s ease",
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          style={{
            width: "100%", padding: "15px", background: "linear-gradient(135deg, #2A9D8F, #457B9D)",
            border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 600,
            cursor: "pointer", letterSpacing: "0.03em",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={(e) => { e.target.style.transform = "translateY(-2px)"; e.target.style.boxShadow = "0 12px 32px rgba(42,157,143,0.25)"; }}
          onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "none"; }}
        >
          Sign In
        </button>

        <div style={{
          marginTop: 28, padding: "14px 18px", background: "rgba(255,255,255,0.02)", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.03)",
        }}>
          <p style={{ color: "#4a5568", fontSize: 11, margin: 0, lineHeight: 1.6, textAlign: "center" }}>
            Demo accounts — Sarah: <span style={{ color: "#6b7280" }}>1234</span> · James: <span style={{ color: "#6b7280" }}>5678</span> · Priya: <span style={{ color: "#6b7280" }}>9012</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────

export default function App() {
  const [loggedIn, setLoggedIn] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedEmail, setExpandedEmail] = useState(null);

  const handleLogin = (empId) => setLoggedIn(empId);
  const handleLogout = () => {
    setLoggedIn(null);
    setActiveTab("overview");
    setExpandedEmail(null);
  };

  // Render
  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>

      {!loggedIn ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <Dashboard
          empId={loggedIn}
          activeTab={activeTab}
          setActiveTab={(t) => { setActiveTab(t); setExpandedEmail(null); }}
          expandedEmail={expandedEmail}
          setExpandedEmail={setExpandedEmail}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────

function Dashboard({ empId, activeTab, setActiveTab, expandedEmail, setExpandedEmail, onLogout }) {
  const emp = EMPLOYEES[empId];
  const donations = DONATIONS[empId] || [];
  const emails = THANK_EMAILS[empId] || [];

  // Computed data
  const totalDonated = donations.reduce((s, d) => s + d.amount, 0);
  const orgTotals = {};
  donations.forEach((d) => { orgTotals[d.org] = (orgTotals[d.org] || 0) + d.amount; });
  const orgCount = Object.keys(orgTotals).length;

  const months = [...new Set(donations.map((d) => d.month))].sort(
    (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)
  );

  const monthlyData = months.map((m) => {
    const monthDonations = donations.filter((d) => d.month === m);
    const total = monthDonations.reduce((s, d) => s + d.amount, 0);
    const segments = monthDonations.map((d) => ({ value: d.amount, color: ORGS[d.org]?.color || "#666" }));
    return { label: m, total, segments };
  });

  const donutData = Object.entries(orgTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([org, val]) => ({ label: ORGS[org]?.name || org, value: val, color: ORGS[org]?.color || "#666" }));

  const latestMonth = months[months.length - 1];
  const latestMonthTotal = donations.filter((d) => d.month === latestMonth).reduce((s, d) => s + d.amount, 0);

  const avgMonthly = months.length > 0 ? Math.round(totalDonated / months.length) : 0;

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "breakdown", label: "Organizations", icon: "🏢" },
    { id: "emails", label: "Thank You Notes", icon: "💌" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #0f0f23 0%, #1a1a3e 40%, #0d1b2a 100%)",
    }}>
      {/* Header */}
      <header style={{
        padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(15,15,35,0.7)",
        backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>💝</span>
          <span style={{ fontSize: 18, fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#fff" }}>GiveTrack</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{emp.name}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{emp.role}</div>
          </div>
          <div style={{
            width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #2A9D8F, #457B9D)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.05em",
          }}>
            {emp.avatar}
          </div>
          <button onClick={onLogout} style={{
            padding: "8px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8, color: "#6b7280", fontSize: 12, cursor: "pointer", transition: "all 0.15s",
            fontWeight: 500,
          }}
            onMouseEnter={(e) => { e.target.style.background = "rgba(230,57,70,0.1)"; e.target.style.color = "#E63946"; e.target.style.borderColor = "rgba(230,57,70,0.2)"; }}
            onMouseLeave={(e) => { e.target.style.background = "rgba(255,255,255,0.04)"; e.target.style.color = "#6b7280"; e.target.style.borderColor = "rgba(255,255,255,0.06)"; }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 28px 72px" }}>

        {/* Welcome */}
        <div style={{ marginBottom: 32, animation: "fadeSlideUp 0.4s ease" }}>
          <h2 style={{
            fontSize: 30, fontFamily: "'Playfair Display', serif", fontWeight: 700,
            margin: "0 0 6px 0", color: "#fff",
          }}>
            Welcome back, {emp.name.split(" ")[0]}
          </h2>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Here's an overview of your charitable giving and its impact.
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 32,
          background: "rgba(255,255,255,0.025)", borderRadius: 14, padding: 5, width: "fit-content",
          border: "1px solid rgba(255,255,255,0.03)",
        }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: "10px 22px", background: activeTab === t.id ? "rgba(42,157,143,0.15)" : "transparent",
                border: activeTab === t.id ? "1px solid rgba(42,157,143,0.25)" : "1px solid transparent",
                borderRadius: 10, color: activeTab === t.id ? "#2A9D8F" : "#6b7280",
                fontSize: 13, fontWeight: activeTab === t.id ? 600 : 500,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => { if (activeTab !== t.id) e.target.style.color = "#9ca3af"; }}
              onMouseLeave={(e) => { if (activeTab !== t.id) e.target.style.color = "#6b7280"; }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* ═══════ OVERVIEW TAB ═══════ */}
        {activeTab === "overview" && (
          <>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
              <StatCard label="Total Donated" value={totalDonated} accent="#2A9D8F" sub={`Since ${months[0] || "—"}`} delay={0} />
              <StatCard label="This Month" value={latestMonthTotal} accent="#457B9D" sub={latestMonth || "—"} delay={0.05} />
              <StatCard label="Monthly Average" value={avgMonthly} accent="#F4A261" sub={`Over ${months.length} months`} delay={0.1} />
              <StatCard label="Organizations" value={orgCount} accent="#E9C46A" sub="Supported" isCount delay={0.15} />
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
              {/* Bar chart */}
              <div style={{
                background: "rgba(26, 26, 60, 0.5)", backdropFilter: "blur(16px)",
                borderRadius: 18, padding: "26px 28px", border: "1px solid rgba(255,255,255,0.05)",
                animation: "fadeSlideUp 0.5s ease 0.15s both",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: 0 }}>Monthly Donations</h3>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Stacked by organization</div>
                </div>
                <BarChart data={monthlyData} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
                  {Object.entries(orgTotals).map(([org]) => (
                    <div key={org} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9ca3af" }}>
                      <div style={{ width: 8, height: 8, borderRadius: 3, background: ORGS[org]?.color }} />
                      {ORGS[org]?.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Donut chart */}
              <div style={{
                background: "rgba(26, 26, 60, 0.5)", backdropFilter: "blur(16px)",
                borderRadius: 18, padding: "26px 28px", border: "1px solid rgba(255,255,255,0.05)",
                display: "flex", flexDirection: "column", alignItems: "center",
                animation: "fadeSlideUp 0.5s ease 0.2s both",
              }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: "0 0 22px 0", alignSelf: "flex-start" }}>
                  Donation Split
                </h3>
                <DonutChart data={donutData} size={210} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22, width: "100%" }}>
                  {donutData.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 4, background: d.color }} />
                        <span style={{ color: "#c9cdd3" }}>{d.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: "#6b7280" }}>
                          {((d.value / totalDonated) * 100).toFixed(0)}%
                        </span>
                        <span style={{ fontWeight: 600, color: "#fff", minWidth: 56, textAlign: "right" }}>{fmt(d.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════ ORGANIZATIONS TAB ═══════ */}
        {activeTab === "breakdown" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {Object.entries(orgTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([org, total], i) => (
                <OrgCard
                  key={org}
                  org={ORGS[org]}
                  orgKey={org}
                  total={total}
                  donations={donations}
                  months={months}
                  emails={emails}
                  delay={i * 0.06}
                />
              ))}
          </div>
        )}

        {/* ═══════ EMAILS TAB ═══════ */}
        {activeTab === "emails" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ marginBottom: 8, animation: "fadeSlideUp 0.3s ease" }}>
              <p style={{ color: "#6b7280", fontSize: 13, margin: 0 }}>
                {emails.length} thank-you {emails.length === 1 ? "note" : "notes"} from the organizations you support
              </p>
            </div>
            {emails
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((email, i) => (
                <EmailCard
                  key={i}
                  email={email}
                  isExpanded={expandedEmail === i}
                  onToggle={() => setExpandedEmail(expandedEmail === i ? null : i)}
                  delay={i * 0.05}
                />
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        textAlign: "center", padding: "20px 0 32px", borderTop: "1px solid rgba(255,255,255,0.03)",
      }}>
        <p style={{ color: "#3a3a5a", fontSize: 11, letterSpacing: "0.05em" }}>
          GiveTrack · Your giving, your impact · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
