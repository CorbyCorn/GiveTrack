import { useState, useEffect, useRef, useMemo } from "react";
import Globe from "react-globe.gl";
import { scaleSqrt } from "d3-scale";
import * as topojson from "topojson-client";

/*
 * GiveTrack — Employee Charitable Giving Dashboard
 * Premium redesign: Photography-first, bento grid, warm palette, organic shapes
 */

const GOOGLE_CLIENT_ID = "296721826980-i3sgo6dgklh7v8fppql7mumdnuv0lu33.apps.googleusercontent.com";
const USE_DEMO_DATA = true;

// ─── GOOGLE SHEETS SYNC ─────────────────────────────────────
// Replace DEPLOYMENT_ID with your Google Apps Script deployment URL
const SHEET_URL = "https://script.google.com/macros/s/AKfycbwf9zNPkHFLn6dEpmhC7JNlD07gMqJlLYhkbTQi6f79AHe5ECmnceDLanbkgyxDAjH5AA/exec";
const SHEET_ENABLED = SHEET_URL !== "__SHEET_URL_PLACEHOLDER__";

// Fetch all data from Google Sheet
async function fetchFromSheet() {
  if (!SHEET_ENABLED) return null;
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error("Sheet fetch failed");
    const data = await res.json();
    Object.entries(data).forEach(([key, value]) => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    });
    return data;
  } catch (err) {
    console.warn("Sheet fetch failed, using localStorage cache:", err);
    return null;
  }
}

// Write a key to Google Sheet (async, non-blocking)
function syncToSheet(key, value) {
  if (!SHEET_ENABLED) return;
  fetch(SHEET_URL, {
    method: "POST",
    body: JSON.stringify({ key, value }),
  }).catch(err => console.warn("Sheet sync failed:", err));
}

// ─── RESPONSIVE ──────────────────────────────────────────────

function useIsMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return m;
}

// ─── SCROLL REVEAL ──────────────────────────────────────────

function ScrollReveal({ children, delay = 0, style = {} }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ ...style, opacity: visible ? 1 : 0, animation: visible ? `fadeSlideUp .5s ease ${delay}s both` : "none" }}>
      {children}
    </div>
  );
}

// ─── IMAGE CENTERING ────────────────────────────────────────
// Uses manual ORG_IMAGE_POS if set, otherwise smart default based on
// image aspect ratio. Positions favor the upper portion where faces are,
// while keeping enough room so scalps aren't clipped.
const facePositionCache = {};
function useFacePosition(src, manualPos) {
  const [pos, setPos] = useState(manualPos || "center 20%");
  useEffect(() => {
    if (manualPos) { setPos(manualPos); return; }
    if (!src) return;
    if (facePositionCache[src]) { setPos(facePositionCache[src]); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      let smart;
      if (ratio < 0.85) smart = "center 15%";       // portrait — face near top
      else if (ratio > 1.5) smart = "center 20%";    // wide landscape — face in upper fifth
      else smart = "center 18%";                      // square-ish — face in upper portion
      facePositionCache[src] = smart;
      setPos(smart);
    };
    img.src = src;
  }, [src, manualPos]);
  return pos;
}

// ─── UTILITIES ────────────────────────────────────────────────

const fmt = (n, currency = "$") => {
  const sym = currency === "£" ? "£" : "$";
  return sym + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MONTH_ORDER = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function sortMonths(arr) {
  return [...arr].sort((a, b) => {
    const [am, ay] = a.split(" ");
    const [bm, by] = b.split(" ");
    return ay !== by ? parseInt(ay) - parseInt(by) : MONTH_ORDER[am] - MONTH_ORDER[bm];
  });
}

function extractOrgName(paidTo) {
  if (!paidTo) return "Unknown";
  if (paidTo.startsWith("http")) {
    try {
      const url = new URL(paidTo);
      let name = url.hostname.replace("www.", "").split(".")[0];
      const nameMap = {
        "evidenceaction": "Evidence Action",
        "ncchcfoundation": "NCCHC Foundation",
        "seashepherd": "Sea Shepherd",
        "givetoiv": "Give To IV",
        "opendoorlegal": "Open Door Legal",
        "wholesomewave": "Wholesome Wave",
        "thewashingmachineproject": "The Washing Machine Project",
        "radiancesf": "Radiance SF",
        "realitysf": "Reality SF",
        "schoolonwheels": "School on Wheels",
        "asylumaccess": "Asylum Access",
        "doctorswithoutborders": "Doctors Without Borders",
        "givewell": "GiveWell",
        "sfhs": "SFHS",
        "savethechildren": "Save the Children",
        "support": "Save the Children",
      };
      if (nameMap[name]) return nameMap[name];
      name = name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
      return name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    } catch { return paidTo; }
  }
  return paidTo;
}

const PALETTE = [
  "#0f766e", "#0369a1", "#7c3aed", "#db2777", "#ea580c",
  "#ca8a04", "#059669", "#4f46e5", "#be185d", "#d97706",
  "#0891b2", "#6d28d9",
];

function getOrgColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// ─── ORG IMAGES ──────────────────────────────────────────────

const ORG_IMAGES = {
  "Save the Children": "https://plus.unsplash.com/premium_photo-1770394034525-2aa9baaabd5b?w=800&q=80",
  "Doctors Without Borders": "https://www.doctorswithoutborders.org/sites/default/files/styles/media_besides_text_666_520/public/MSF163911%28High%29_0.jpg",
  "Médecins Sans Frontières": "https://www.doctorswithoutborders.org/sites/default/files/styles/collection_block_desktop_666_519/public/image_base_media/2026/02/MSF358702.jpg",
  "Médecins sans Frontières": "https://www.doctorswithoutborders.org/sites/default/files/styles/collection_block_desktop_666_519/public/image_base_media/2026/02/MSF358702.jpg",
  "GiveWell": "https://assets.evidenceaction.org/web/images/_1280xAUTO_crop_center-center_none/ea-doctor.jpg",
  "Sea Shepherd": "https://images.unsplash.com/photo-1610581950163-c37ae06c3a96?w=800&q=80",
  "Evidence Action": "https://assets.evidenceaction.org/web/images/_1280xAUTO_crop_center-center_none/ea-kids.jpg",
  "Open Door Legal": "https://opendoorlegal.org/wp-content/uploads/2019/08/claudia-for-web.jpg",
  "Wholesome Wave": "https://images.squarespace-cdn.com/content/v1/5febb5b1df316630764c4dec/1b65a895-6b11-4898-b025-f7e397195b1c/ww-little-girl-eating-watermelon.png",
  "Room to Read": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
  "Asylum Access": "https://asylumaccess.org/wp-content/uploads/2025/05/AAE201609-Skoll-GabrielDiamond1-1ahaje.jpg",
  "School on Wheels": "https://schoolonwheels.org/wp-content/uploads/2026/02/jordan-and-anne.jpg",
  "Malaria Consortium": "https://images.unsplash.com/photo-1694286068362-5dcea7ed282a?w=800&q=80",
  "The Washing Machine Project": "https://images.squarespace-cdn.com/content/v1/61aa260eae89d2514d87e72a/97bd3be0-03a9-4a2f-b1b8-00bcdb61d495/uganda24-hand-wash-young-lady_DPI300.jpg",
  "Action Against Hunger": "https://www.actionagainsthunger.org/app/themes/actionagainsthunger/assets/images/aah-og.jpg",
  "Clean Ocean Action": "https://images.unsplash.com/photo-1583749063749-423914dce445?w=800&q=80",
  "Middle East Children's Alliance": "https://www.mecaforpeace.org/wp-content/uploads/2024/12/DSC04045-scaled.jpg",
  "Oceana": "https://images.unsplash.com/photo-1676186013887-fa1c4c658274?w=800&q=80",
  "WWF": "https://images.unsplash.com/photo-1535759802691-bf5a6cfe6ce9?w=800&q=80",
  "En Ptahy Vidchui": "https://plus.unsplash.com/premium_photo-1663126366512-62a1e0494bad?w=800&q=80",
  "Give To IV": "https://give.intervarsity.org/themes/custom/donate/images/meta_img/metatag.jpg",
  "NCCHC Foundation": "https://ncchcfoundation.org/wp-content/uploads/2024-Foundation-Home-Pg-Banner-1920x700_c.jpg",
  "Radiance SF": "https://images.squarespace-cdn.com/content/v1/683e4d39bcde3364772e61ad/b0420a5e-6c73-461e-b4f2-457cc659ccc4/SHK_1720+%281%29.jpg",
  "Reality SF": "https://realitysf.com/wp-content/uploads/2024/08/20240504-Food_Pantry_-08-1024x683.jpg",
  "SFHS": "https://saintfrancishigh.static.amais.com/Hero_Banner_Student_Community-49-Page-Image_157.webp?version=638823013438500000",
};

// Face-centered object-position for each org image (analyzed per photo)
const ORG_IMAGE_POS = {
  "Save the Children": "60% 20%",         // two girls drawing, faces right upper
  "Doctors Without Borders": "30% 30%",   // mother & doctor, faces left upper
  "Médecins Sans Frontières": "30% 30%",
  "Médecins sans Frontières": "30% 30%",
  "GiveWell": "40% 30%",                  // healthcare worker examining patient
  "Sea Shepherd": "center 40%",            // dramatic ocean waves
  "Evidence Action": "30% center",         // row of children's faces, front faces left
  "Open Door Legal": "center 25%",        // woman portrait, face upper center
  "Wholesome Wave": "center center",       // little girl eating watermelon, tight crop
  "Room to Read": "center 30%",           // children in classroom
  "Asylum Access": "center 30%",          // two women smiling together
  "School on Wheels": "center 20%",        // volunteer tutoring child, faces at top
  "Malaria Consortium": "55% 30%",         // health worker feeding child in Africa
  "The Washing Machine Project": "center 20%", // young woman hand-washing
  "Action Against Hunger": "65% 20%",      // mother in orange with baby, right side
  "Clean Ocean Action": "center center",  // clean coastline
  "Middle East Children's Alliance": "center 35%", // MECA workers with children
  "Oceana": "center center",              // coral reef underwater
  "WWF": "center center",                 // African wildlife safari
  "En Ptahy Vidchui": "center 30%",       // three men with Ukraine aid box
  "Give To IV": "center 25%",             // five young people arms around each other
  "NCCHC Foundation": "65% top",             // woman with thumbs up, right-center of banner
  "Radiance SF": "center 30%",            // women on stage at gathering
  "Reality SF": "center 30%",             // volunteers at food pantry
  "SFHS": "center 30%",                   // SFHS students smiling together
};
const HERO_IMAGE = "https://cdn.builder.io/api/v1/image/assets%2F2fe4147bb8c843bb8ebba475c8973899%2Ffabbd9deb9724e1b9ce5bd36d518dd11";

// ─── GLOBE DATA ──────────────────────────────────────────────

const ORG_COUNTRY_MAP = {
  "Save the Children": "COD", "Doctors Without Borders": "COD",
  "Médecins Sans Frontières": "COD", "Médecins sans Frontières": "COD",
  "GiveWell": "NGA", "Evidence Action": "IND",
  "Open Door Legal": "USA", "Wholesome Wave": "USA", "Room to Read": "NPL",
  "Asylum Access": "KEN", "School on Wheels": "USA", "Malaria Consortium": "NGA",
  "The Washing Machine Project": "IND", "Action Against Hunger": "SYR",
  "Middle East Children's Alliance": "PSE",
  "WWF": "CHN", "En Ptahy Vidchui": "UKR",
  "Give To IV": "USA", "NCCHC Foundation": "USA", "Radiance SF": "USA",
  "Reality SF": "USA", "SFHS": "USA",
};

const ISO_NUM_TO_ALPHA3 = {
  "840": "USA", "180": "COD", "566": "NGA", "484": "MEX",
  "356": "IND", "524": "NPL", "404": "KEN", "760": "SYR",
  "275": "PSE", "156": "CHN", "804": "UKR",
};

const COUNTRY_NAMES = {
  USA: "United States", COD: "DR Congo", NGA: "Nigeria", MEX: "Mexico",
  IND: "India", NPL: "Nepal", KEN: "Kenya", SYR: "Syria",
  PSE: "Palestine", CHN: "China", UKR: "Ukraine",
};

const OCEAN_ORGS = {
  "Sea Shepherd": { lat: 5, lng: -120, label: "Eastern Pacific" },
  "Oceana": { lat: 30, lng: -45, label: "North Atlantic" },
  "Clean Ocean Action": { lat: 38, lng: -72, label: "Atlantic Coast" },
};

const SF = { lat: 37.77, lng: -122.42 };

const COUNTRY_CENTROIDS = {
  USA: { lat: 39.8, lng: -98.6 }, COD: { lat: -2.9, lng: 23.6 }, NGA: { lat: 9.1, lng: 7.5 },
  MEX: { lat: 23.6, lng: -102.5 }, IND: { lat: 20.6, lng: 78.9 }, NPL: { lat: 28.4, lng: 84.1 },
  KEN: { lat: 0.02, lng: 37.9 }, SYR: { lat: 35.0, lng: 38.5 },
  PSE: { lat: 31.9, lng: 35.2 }, CHN: { lat: 35.9, lng: 104.2 }, UKR: { lat: 48.4, lng: 31.2 },
};

// Ring radii for ocean orgs only (land countries use polygon glow instead)
const OCEAN_RING_RADIUS = {
  "Sea Shepherd": 10, "Oceana": 9, "Clean Ocean Action": 8,
};

// Bright "beam of light" colors — one per destination
const LIGHT_COLORS = {
  USA: "#fbbf24",   // amber/gold
  COD: "#f472b6",   // pink
  NGA: "#a78bfa",   // violet
  IND: "#34d399",   // emerald
  NPL: "#fb923c",   // orange
  KEN: "#facc15",   // yellow
  SYR: "#f87171",   // rose
  PSE: "#38bdf8",   // sky blue
  CHN: "#c084fc",   // purple
  UKR: "#2dd4bf",   // teal
  MEX: "#fcd34d",   // amber light
  // Ocean orgs
  "Sea Shepherd": "#22d3ee",   // cyan
  "Oceana": "#67e8f9",         // light cyan
  "Clean Ocean Action": "#06b6d4", // darker cyan
};

function aggregateDonationsByCountry(donations) {
  const result = {};
  donations.forEach(d => {
    const code = ORG_COUNTRY_MAP[d.orgName];
    if (!code) return;
    if (!result[code]) result[code] = { total: 0, orgs: {} };
    result[code].total += d.allocatedAmount;
    result[code].orgs[d.orgName] = (result[code].orgs[d.orgName] || 0) + d.allocatedAmount;
  });
  return result;
}

function warmColorInterpolate(t) {
  const stops = [
    { r: 254, g: 235, b: 210 }, { r: 253, g: 186, b: 116 },
    { r: 249, g: 115, b: 22 }, { r: 220, g: 60, b: 40 }, { r: 153, g: 27, b: 27 },
  ];
  const idx = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const lo = Math.floor(idx), hi = Math.min(lo + 1, stops.length - 1), f = idx - lo;
  const r = Math.round(stops[lo].r + (stops[hi].r - stops[lo].r) * f);
  const g = Math.round(stops[lo].g + (stops[hi].g - stops[lo].g) * f);
  const b = Math.round(stops[lo].b + (stops[hi].b - stops[lo].b) * f);
  return `rgba(${r},${g},${b},0.55)`;
}

// ─── ORG CATEGORIES ──────────────────────────────────────────

const ORG_CATEGORIES = {
  "Save the Children": "Children & Youth", "Doctors Without Borders": "Healthcare",
  "Médecins Sans Frontières": "Healthcare", "Médecins sans Frontières": "Healthcare",
  "GiveWell": "Effective Giving", "Sea Shepherd": "Ocean Conservation",
  "Evidence Action": "Global Health", "Open Door Legal": "Legal Aid",
  "Wholesome Wave": "Food Access", "Room to Read": "Education",
  "Asylum Access": "Human Rights", "School on Wheels": "Education",
  "Malaria Consortium": "Global Health", "The Washing Machine Project": "Humanitarian",
  "Action Against Hunger": "Food Security", "Clean Ocean Action": "Ocean Conservation",
  "Oceana": "Ocean Conservation", "WWF": "Wildlife", "En Ptahy Vidchui": "Humanitarian",
  "Give To IV": "Community", "NCCHC Foundation": "Healthcare",
  "Radiance SF": "Community", "Reality SF": "Community", "SFHS": "Healthcare",
  "Middle East Children's Alliance": "Children & Youth",
};

// Fallback images by category — used when an org has no hardcoded or scraped image
// Unsplash crop=faces auto-centers on detected faces in the photo
const CATEGORY_FALLBACK_IMAGES = {
  "Children & Youth": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=800&fit=crop&crop=faces&q=80",
  "Healthcare": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&h=800&fit=crop&crop=faces&q=80",
  "Global Health": "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=800&h=800&fit=crop&crop=faces&q=80",
  "Education": "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=800&fit=crop&crop=faces&q=80",
  "Ocean Conservation": "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&h=800&fit=crop&q=80",
  "Food Access": "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=800&fit=crop&crop=faces&q=80",
  "Food Security": "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=800&fit=crop&crop=faces&q=80",
  "Human Rights": "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800&h=800&fit=crop&crop=faces&q=80",
  "Humanitarian": "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&h=800&fit=crop&crop=faces&q=80",
  "Legal Aid": "https://images.unsplash.com/photo-1591522810850-58128c5f1a26?w=800&h=800&fit=crop&crop=faces&q=80",
  "Wildlife": "https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=800&h=800&fit=crop&q=80",
  "Effective Giving": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=800&fit=crop&crop=faces&q=80",
  "Community": "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&h=800&fit=crop&crop=faces&q=80",
  "_default": "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=800&fit=crop&crop=faces&q=80",
};

const ORG_DESCRIPTIONS = {
  "Save the Children": "Working to improve the lives of children through better education, health care, and economic opportunities.",
  "Doctors Without Borders": "Providing independent, impartial medical humanitarian assistance to people affected by conflict, epidemics, and disasters.",
  "Médecins Sans Frontières": "Providing independent, impartial medical humanitarian assistance to people affected by conflict, epidemics, and disasters.",
  "Médecins sans Frontières": "Providing independent, impartial medical humanitarian assistance to people affected by conflict, epidemics, and disasters.",
  "GiveWell": "Searching for the charities that save or improve lives the most per dollar donated.",
  "Sea Shepherd": "Defending, conserving, and protecting the world's oceans through direct-action campaigns.",
  "Evidence Action": "Scaling proven interventions that improve the lives of millions in the developing world.",
  "Open Door Legal": "Providing free civil legal services to ensure equal access to justice for all.",
  "Wholesome Wave": "Making fresh, locally grown fruits and vegetables affordable for underserved communities.",
  "Room to Read": "Transforming the lives of millions of children through literacy and gender equality in education.",
  "Asylum Access": "Making human rights a reality for refugees worldwide through legal aid and policy advocacy.",
  "School on Wheels": "Providing free tutoring and mentoring for children experiencing homelessness.",
  "Malaria Consortium": "Delivering proven programs to prevent and treat malaria and other communicable diseases.",
  "The Washing Machine Project": "Providing off-grid washing machines to communities displaced by conflict and natural disaster.",
  "Action Against Hunger": "Ending hunger and malnutrition in children while providing communities with access to safe water.",
  "Clean Ocean Action": "Protecting the waters of the NY/NJ coast through research, education, and citizen action.",
  "Middle East Children's Alliance": "Supporting children and families in Palestine and Lebanon through direct aid and community programs.",
  "Oceana": "Protecting and restoring the world's oceans through policy advocacy, science, and law.",
  "WWF": "Conserving nature and reducing the most pressing threats to the diversity of life on Earth.",
  "En Ptahy Vidchui": "Providing humanitarian aid and support to communities affected by the conflict in Ukraine.",
  "Give To IV": "Supporting campus ministries that help college students explore faith and develop as leaders.",
  "NCCHC Foundation": "Advancing the quality of health care in jails, prisons, and juvenile detention facilities.",
  "Radiance SF": "Empowering women in San Francisco through community, mentorship, and professional development.",
  "Reality SF": "Serving the San Francisco community through food pantries, housing support, and neighborhood care.",
  "SFHS": "Providing Catholic college-preparatory education that develops the whole person in faith, intellect, and character.",
};

const ORG_LONG_DESCRIPTIONS = {
  "Save the Children": "Save the Children has been at the forefront of child welfare since 1919, operating in over 100 countries. They respond to emergencies, deliver innovative development programs, and advocate for children's rights. Their work spans education, health, nutrition, and child protection — giving every child the best chance for a healthy, fulfilling future.",
  "Doctors Without Borders": "Founded in 1971, Doctors Without Borders (MSF) delivers emergency medical care in over 70 countries. Their teams — doctors, nurses, and logisticians — respond to armed conflicts, epidemics, natural disasters, and healthcare exclusion. Operating independently of political, economic, or religious influence, MSF treats millions of patients each year.",
  "Médecins Sans Frontières": "Founded in 1971, Doctors Without Borders (MSF) delivers emergency medical care in over 70 countries. Their teams — doctors, nurses, and logisticians — respond to armed conflicts, epidemics, natural disasters, and healthcare exclusion. Operating independently of political, economic, or religious influence, MSF treats millions of patients each year.",
  "Médecins sans Frontières": "Founded in 1971, Doctors Without Borders (MSF) delivers emergency medical care in over 70 countries. Their teams — doctors, nurses, and logisticians — respond to armed conflicts, epidemics, natural disasters, and healthcare exclusion. Operating independently of political, economic, or religious influence, MSF treats millions of patients each year.",
  "GiveWell": "GiveWell conducts rigorous research to find the most cost-effective charities in the world. Rather than rating organizations on overhead or popularity, they analyze the actual impact per dollar — tracking lives saved, diseases prevented, and economic gains. Since 2007, they've directed over $1 billion to high-impact interventions in global health and poverty.",
  "Sea Shepherd": "Sea Shepherd Conservation Society uses direct-action tactics to defend marine wildlife and habitats worldwide. Founded in 1977, they patrol the oceans to combat illegal fishing, poaching, and habitat destruction. Their fleet of ships has intervened against whaling operations, shark finning, and illegal trawling across every ocean.",
  "Evidence Action": "Evidence Action bridges the gap between research and implementation, scaling programs that rigorous evidence shows are effective. Their flagship programs include mass deworming treatments reaching over 300 million people annually and safe water initiatives serving millions across Africa and Asia. Every program they run is backed by randomized controlled trials.",
  "Open Door Legal": "Open Door Legal is the nation's first civil right-to-counsel organization, providing free legal services to all low-income residents of San Francisco. They handle housing, immigration, public benefits, and consumer protection cases — ensuring that justice isn't reserved for those who can afford a lawyer. They've served thousands of families since 2012.",
  "Wholesome Wave": "Wholesome Wave increases access to fresh, healthy food for underserved communities by making fruits and vegetables more affordable. Their programs double the value of federal nutrition benefits at farmers' markets, ensuring that families on SNAP and WIC can bring home twice as much produce. They've operated in hundreds of sites across the United States.",
  "Room to Read": "Room to Read transforms the lives of children in low-income communities through literacy and gender equality in education. They've established over 40,000 libraries, published more than 1,700 original children's book titles in local languages, and supported tens of thousands of girls through secondary school. They operate across Asia and Africa.",
  "Asylum Access": "Asylum Access works in transit countries where refugees face exploitation and legal limbo. They provide direct legal aid, train local lawyers, and advocate for policy changes that give refugees the right to work, attend school, and move freely. Operating across Latin America, Africa, and Asia, they're reshaping how the world treats displaced people.",
  "School on Wheels": "School on Wheels provides free one-on-one tutoring and mentoring for children living in shelters, motels, vehicles, and other temporary housing. Every week, their volunteers meet with students to help with homework, build confidence, and provide stability. They also distribute backpacks filled with school supplies and books to children in need.",
  "Malaria Consortium": "Malaria Consortium is a leading non-profit specializing in the prevention, control, and treatment of malaria and other communicable diseases. Their seasonal malaria chemoprevention program alone protects millions of children in West and Central Africa each year. Rated as one of GiveWell's top charities, they consistently demonstrate exceptional cost-effectiveness.",
  "The Washing Machine Project": "The Washing Machine Project designs and distributes hand-powered, off-grid washing machines to communities displaced by conflict and natural disaster. Their machines reduce the 20+ hours per week that women and girls in refugee camps spend hand-washing clothes — freeing time for education, work, and rest. They operate in camps across East Africa and the Middle East.",
  "Action Against Hunger": "Action Against Hunger has been saving the lives of malnourished children and providing communities with access to safe water and sustainable solutions to hunger since 1979. They operate in nearly 50 countries, treating severe acute malnutrition, building water systems, and supporting livelihoods — reaching over 28 million people annually.",
  "Clean Ocean Action": "Clean Ocean Action is a broad-based coalition dedicated to improving the water quality of the marine waters off the New Jersey and New York coast. Through research, education, and citizen action programs including their famous beach sweeps, they've engaged hundreds of thousands of volunteers in protecting the coast and marine ecosystems.",
  "Middle East Children's Alliance": "The Middle East Children's Alliance provides direct aid to children and families in Palestine and Lebanon, funding community-based projects in health, education, and emergency relief. They deliver clean water systems, build playgrounds, and sponsor programs that help children process trauma through art and storytelling.",
  "Oceana": "Oceana is the largest international advocacy organization focused solely on ocean conservation. They win policy victories that reduce pollution, prevent overfishing, and protect marine habitats. Since 2001, their campaigns have protected over 4.5 million square miles of ocean and helped set catch limits on fish populations across the globe.",
  "WWF": "The World Wildlife Fund is one of the world's largest conservation organizations, working in nearly 100 countries. They protect critical habitats, combat wildlife trafficking, and push for sustainable practices in agriculture, fisheries, and energy. Their initiatives span from saving endangered species to fighting climate change and preserving forests.",
  "En Ptahy Vidchui": "En Ptahy Vidchui (Birds of Responsibility) provides humanitarian aid to communities affected by the conflict in Ukraine. They coordinate emergency supplies, support displaced families, and help rebuild community infrastructure in war-affected regions. Their grassroots approach ensures aid reaches those most in need quickly and directly.",
  "Give To IV": "InterVarsity supports campus ministries at hundreds of colleges and universities, helping students explore questions of faith, justice, and purpose. Through small groups, retreats, and service projects, they develop the next generation of thoughtful leaders. Their Urbana conference is one of the largest missions gatherings in North America.",
  "NCCHC Foundation": "The NCCHC Foundation advances the quality of health care in correctional facilities — jails, prisons, and juvenile detention centers. Through accreditation programs, education, and research, they set the standard for how incarcerated individuals receive medical, mental health, and dental care. They believe health care is a right, not a privilege.",
  "Radiance SF": "Radiance SF empowers women in San Francisco through mentorship circles, community gatherings, and professional development programs. They create spaces where women support each other through life transitions, career challenges, and personal growth. Their approach combines spiritual formation with practical skill-building.",
  "Reality SF": "Reality SF serves the San Francisco community through weekly food pantries, housing assistance, and neighborhood care programs. They partner with local organizations to address homelessness, food insecurity, and social isolation. Their community dinners bring together people from all walks of life in the city.",
  "SFHS": "Saint Francis High School provides Catholic college-preparatory education in the heart of the Bay Area. They develop the whole person through rigorous academics, athletics, and community service — preparing students to be compassionate leaders. Their commitment to character formation shapes young people of faith, intellect, and purpose.",
};

const ORG_WEBSITES = {
  "Save the Children": "https://www.savethechildren.org",
  "Doctors Without Borders": "https://www.doctorswithoutborders.org",
  "Médecins Sans Frontières": "https://www.doctorswithoutborders.org",
  "Médecins sans Frontières": "https://www.doctorswithoutborders.org",
  "GiveWell": "https://www.givewell.org",
  "Sea Shepherd": "https://seashepherd.org",
  "Evidence Action": "https://www.evidenceaction.org",
  "Open Door Legal": "https://opendoorlegal.org",
  "Wholesome Wave": "https://www.wholesomewave.org",
  "Room to Read": "https://www.roomtoread.org",
  "Asylum Access": "https://www.asylumaccess.org",
  "School on Wheels": "https://schoolonwheels.org",
  "Malaria Consortium": "https://www.malariaconsortium.org",
  "The Washing Machine Project": "https://www.thewashingmachineproject.org",
  "Action Against Hunger": "https://www.actionagainsthunger.org",
  "Clean Ocean Action": "https://www.cleanoceanaction.org",
  "Middle East Children's Alliance": "https://www.mecaforpeace.org",
  "Oceana": "https://oceana.org",
  "WWF": "https://www.worldwildlife.org",
  "En Ptahy Vidchui": "https://en.ptahy.vidchui.org",
  "Give To IV": "https://givetoiv.org",
  "NCCHC Foundation": "https://ncchcfoundation.org",
  "Radiance SF": "https://www.radiancesf.org",
  "Reality SF": "https://realitysf.com",
  "SFHS": "https://www.sfhs.com",
};

// ─── DEMO DATA ────────────────────────────────────────────────
// Real donation data from company spreadsheet (Jan-31 and Feb-15 pay cycles)

const DEMO_DATA = {
  "courtney@isara.io": [
    { orgName: "Save the Children", paidTo: "https://support.savethechildren.org/site/Ecommerce", allocatedAmount: 950, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Save the Children", paidTo: "https://support.savethechildren.org/site/Ecommerce", allocatedAmount: 950, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    { orgName: "Save the Children", paidTo: "https://support.savethechildren.org/site/Ecommerce", allocatedAmount: 950, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 100 },
  ],
  "edward@isara.io": [
    { orgName: "Give To IV", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 30 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 10 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 10 },
    { orgName: "Radiance SF", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 15 },
    { orgName: "Reality SF", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 15 },
    { orgName: "Give To IV", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "Radiance SF", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
    { orgName: "Reality SF", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
    { orgName: "Give To IV", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 30 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 10 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 10 },
    { orgName: "Radiance SF", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 15 },
    { orgName: "Reality SF", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 15 },
  ],
  "amy@isara.io": [
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 100 },
  ],
  "ben@isara.io": [
    { orgName: "NCCHC Foundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "NCCHC Foundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    { orgName: "NCCHC Foundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 100 },
  ],
  "bernie@isara.io": [
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 2367.50, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Action Against Hunger", paidTo: "https://www.actionagainsthunger.org", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins Sans Frontières", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 473.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
    { orgName: "Action Against Hunger", paidTo: "https://www.actionagainsthunger.org", allocatedAmount: 947, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins Sans Frontières", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 947, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 40 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 473.50, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 20 },
  ],
  "ed@isara.io": [
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 100 },
  ],
  "peter@isara.io": [
    { orgName: "SFHS", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Jan 2026", currency: "$", paidDate: "", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "SFHS", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Feb 2026", currency: "$", paidDate: "", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    { orgName: "SFHS", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 100 },
  ],
  "jerry@isara.io": [
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 100 },
  ],
  "rowan@isara.io": [
    { orgName: "Asylum Access", paidTo: "https://www.asylumaccess.org/", allocatedAmount: 1924.83, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Clean Ocean Action", paidTo: "https://www.cleanoceanaction.org", allocatedAmount: 577.45, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Middle East Children's Alliance", paidTo: "https://www.mecaforpeace.org", allocatedAmount: 769.93, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Room to Read", paidTo: "https://www.roomtoread.org", allocatedAmount: 577.45, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Clean Ocean Action", paidTo: "https://www.cleanoceanaction.org", allocatedAmount: 577.45, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 30 },
    { orgName: "Middle East Children's Alliance", paidTo: "https://www.mecaforpeace.org", allocatedAmount: 769.93, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 40 },
    { orgName: "Room to Read", paidTo: "https://www.roomtoread.org", allocatedAmount: 577.45, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 30 },
  ],
  "sam@isara.io": [
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Jan 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Mar 2026", currency: "$", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 100 },
  ],
  "artur@isara.io": [
    { orgName: "Malaria Consortium", paidTo: "https://www.malariaconsortium.org", allocatedAmount: 1039.59, month: "Jan 2026", currency: "£", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Jan 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "Malaria Consortium", paidTo: "https://www.malariaconsortium.org", allocatedAmount: 1039.59, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 50 },
    { orgName: "Malaria Consortium", paidTo: "https://www.malariaconsortium.org", allocatedAmount: 1039.59, month: "Mar 2026", currency: "£", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Mar 2026", currency: "£", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 50 },
  ],
  "lily@isara.io": [
    { orgName: "Oceana", paidTo: "https://oceana.org", allocatedAmount: 689.59, month: "Jan 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "WWF", paidTo: "https://www.worldwildlife.org", allocatedAmount: 689.58, month: "Jan 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 551.67, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins sans Frontières", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 551.67, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Action Against Hunger", paidTo: "https://www.actionagainsthunger.org", allocatedAmount: 275.83, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 551.67, month: "Mar 2026", currency: "£", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins sans Frontières", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 551.67, month: "Mar 2026", currency: "£", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 40 },
    { orgName: "Action Against Hunger", paidTo: "https://www.actionagainsthunger.org", allocatedAmount: 275.83, month: "Mar 2026", currency: "£", paidDate: "", cycle: "Feb-28 Payroll Cycle", percentage: 20 },
  ],
};

// ─── LOCAL STORAGE DATA LAYER ─────────────────────────────────

// Admin levels: 0 = not admin, 1 = viewer (read-only), 2 = editor (full access)
const INITIAL_ADMINS = {
  "courtney@isara.io": 2, "ranah@isara.io": 2,
};

const EMPLOYEE_NAMES = {
  "courtney@isara.io": "Courtney Leung", "edward@isara.io": "Edward Kang",
  "amy@isara.io": "Amy Wang", "ben@isara.io": "Benjamin Smith",
  "bernie@isara.io": "Bernie Conrad", "ed@isara.io": "Edwin Zhang",
  "peter@isara.io": "Peter Buckland", "jerry@isara.io": "Jerry Bai",
  "rowan@isara.io": "Rowan Tran", "sam@isara.io": "Sam Kwok",
  "artur@isara.io": "Artur Avameri", "lily@isara.io": "Lily Gasztowtt",
  "ranah@isara.io": "Ranah Netane",
};

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function loadAdmins() {
  const raw = loadStorage("givetrack_admins", INITIAL_ADMINS);
  if (Array.isArray(raw)) { const map = {}; raw.forEach(e => { map[e] = 2; }); return map; }
  return raw;
}
function saveAdmins(map) { saveStorage("givetrack_admins", map); syncToSheet("givetrack_admins", map); }
function checkIsAdmin(email) {
  const e = email?.toLowerCase();
  if (INITIAL_ADMINS[e]) return INITIAL_ADMINS[e];
  const admins = loadAdmins();
  return admins[e] || 0;
}

function loadBudgets() { return loadStorage("givetrack_employee_budgets", {}); }
function saveBudgets(b) { saveStorage("givetrack_employee_budgets", b); syncToSheet("givetrack_employee_budgets", b); }

function loadCycles() { return loadStorage("givetrack_pay_cycles", { currentCycleId: null, cycles: [] }); }
function saveCycles(c) { saveStorage("givetrack_pay_cycles", c); syncToSheet("givetrack_pay_cycles", c); }

function loadSubmissions() { return loadStorage("givetrack_submissions", {}); }
function saveSubmissions(s) { saveStorage("givetrack_submissions", s); syncToSheet("givetrack_submissions", s); }

function loadTracker() { return loadStorage("givetrack_admin_tracker", {}); }
function saveTracker(t) {
  saveStorage("givetrack_admin_tracker", t);
  // Strip receipt data before syncing (too large for Sheet cells)
  const stripped = JSON.parse(JSON.stringify(t));
  Object.values(stripped).forEach(cycle =>
    Object.values(cycle).forEach(employee =>
      Object.values(employee).forEach(org => { delete org.receiptData; delete org.receiptFileName; })
    )
  );
  syncToSheet("givetrack_admin_tracker", stripped);
}

function loadDonations() { return loadStorage("givetrack_donations", null); }
function saveDonations(d) { saveStorage("givetrack_donations", d); syncToSheet("givetrack_donations", d); }

// Compute live pay status for a cycle based on tracker checkboxes
function computeCyclePayStatus(cycleId) {
  const tracker = loadTracker();
  const subs = loadSubmissions();
  const cycleSubs = subs[cycleId] || {};
  const cycleTracker = tracker[cycleId] || {};
  const budgets = loadBudgets();
  const seen = new Set();
  let total = 0, paid = 0;
  Object.entries(cycleSubs).forEach(([email, sub]) => {
    (sub.allocations || []).forEach(alloc => {
      if (alloc.percentage <= 0) return;
      seen.add(`${email}:${alloc.orgName}`);
      total++;
      if (cycleTracker[email]?.[alloc.orgName]?.paid) paid++;
    });
  });
  Object.entries(cycleTracker).forEach(([email, orgs]) => {
    Object.entries(orgs).forEach(([orgName, tData]) => {
      if (!seen.has(`${email}:${orgName}`)) {
        total++;
        if (tData.paid) paid++;
      }
    });
  });
  if (total === 0) return "no submissions";
  if (paid === total) return "paid";
  return `${paid}/${total} paid`;
}

// Map cycle labels from DEMO_DATA to cycleIds
const CYCLE_MAP = {
  "Jan-31 Payroll Cycle": "2026-01-31",
  "Feb-15 Payroll Cycle": "2026-02-15",
  "Feb-28 Payroll Cycle": "2026-02-28",
  "Mar-15 Payroll Cycle": "2026-03-15",
};

// All known org names for the dropdown
// All orgs: from ORG_WEBSITES + every org anyone has ever donated to in DEMO_DATA
// Base set of known orgs (from hardcoded data)
const _BASE_ORGS = [...new Set([
  ...Object.keys(ORG_WEBSITES),
  ...Object.values(DEMO_DATA).flatMap(dons => dons.map(d => d.orgName)),
])];

// Dynamic: includes orgs from shared donations + submissions (new orgs added by other users)
function getAllKnownOrgs() {
  const orgs = new Set(_BASE_ORGS);
  const dons = loadDonations();
  if (dons) dons.forEach(d => { if (d.orgName) orgs.add(d.orgName); });
  const subs = loadSubmissions();
  Object.values(subs).forEach(cycleSubs => {
    Object.values(cycleSubs).forEach(sub => {
      (sub.allocations || []).forEach(a => { if (a.orgName) orgs.add(a.orgName); });
    });
  });
  return [...orgs].sort();
}

function seedFromDemoData() {
  if (localStorage.getItem("givetrack_pay_cycles")) return; // already seeded

  // 1. Seed admins
  saveAdmins(INITIAL_ADMINS);

  // 2. Derive employee budgets from DEMO_DATA
  const budgets = {};
  Object.keys(DEMO_DATA).forEach(email => {
    const dons = DEMO_DATA[email];
    const latestCycle = dons.length > 0 ? dons[dons.length - 1].cycle : "";
    const cycleDons = dons.filter(d => d.cycle === latestCycle);
    const total = cycleDons.reduce((s, d) => s + d.allocatedAmount, 0);
    budgets[email] = { name: EMPLOYEE_NAMES[email] || email.split("@")[0], cycleAmount: Math.round(total * 100) / 100, currency: dons[0]?.currency || "$" };
  });
  // Ranah has no allocations yet — add budget manually
  budgets["ranah@isara.io"] = { name: "Ranah Netane", cycleAmount: 350.77, currency: "$" };
  saveBudgets(budgets);

  // 3. Seed pay cycles (past cycles are "closed" — display status computed dynamically from tracker)
  const cyclesData = {
    currentCycleId: "2026-02-28",
    cycles: [
      { cycleId: "2026-01-31", label: "Jan-31 Payroll Cycle", deadline: "2026-01-26", payDate: "2026-01-31", status: "closed" },
      { cycleId: "2026-02-15", label: "Feb-15 Payroll Cycle", deadline: "2026-02-10", payDate: "2026-02-15", status: "closed" },
      { cycleId: "2026-02-28", label: "Feb-28 Payroll Cycle", deadline: "2026-02-23", payDate: "2026-02-28", status: "open" },
      { cycleId: "2026-03-15", label: "Mar-15 Payroll Cycle", deadline: "2026-03-10", payDate: "2026-03-15", status: "upcoming" },
    ],
  };
  saveCycles(cyclesData);

  // 4. Seed admin tracker from DEMO_DATA (mark paid only if paidDate exists)
  const tracker = {};
  Object.keys(DEMO_DATA).forEach(email => {
    DEMO_DATA[email].forEach(d => {
      const cycleId = CYCLE_MAP[d.cycle];
      if (!cycleId) return;
      if (!tracker[cycleId]) tracker[cycleId] = {};
      if (!tracker[cycleId][email]) tracker[cycleId][email] = {};
      tracker[cycleId][email][d.orgName] = { paid: !!d.paidDate, datePaid: d.paidDate || "", receiptData: null, receiptFileName: null, amount: d.allocatedAmount };
    });
  });
  saveTracker(tracker);

  // 5. Seed submissions for all cycles
  const subs = {};
  Object.keys(DEMO_DATA).forEach(email => {
    const dons = DEMO_DATA[email];
    [...new Set(dons.map(d => d.cycle))].forEach(cycleName => {
      const cycleId = CYCLE_MAP[cycleName];
      if (!cycleId) return;
      const cycleDons = dons.filter(d => d.cycle === cycleName);
      if (!subs[cycleId]) subs[cycleId] = {};
      subs[cycleId][email] = {
        submittedAt: new Date("2026-02-01").toISOString(),
        rolledForward: false,
        allocations: cycleDons.map(d => ({ orgName: d.orgName, paidTo: d.paidTo, percentage: d.percentage })),
      };
    });
  });
  // Rollforward Feb-15 allocations into Feb-28 (current open cycle)
  if (!subs["2026-02-28"]) subs["2026-02-28"] = {};
  Object.keys(DEMO_DATA).forEach(email => {
    const feb15 = DEMO_DATA[email].filter(d => d.cycle === "Feb-15 Payroll Cycle");
    if (feb15.length > 0 && !subs["2026-02-28"][email]) {
      subs["2026-02-28"][email] = {
        submittedAt: null, rolledForward: true,
        allocations: feb15.map(d => ({ orgName: d.orgName, paidTo: d.paidTo, percentage: d.percentage })),
      };
    }
  });
  saveSubmissions(subs);

  // 6. Seed donations to sheet (flat array with email for shared access)
  saveDonations(
    Object.entries(DEMO_DATA).flatMap(([email, dons]) => dons.map(d => ({ ...d, email })))
  );
}

// ─── AUTO CYCLE GENERATOR ─────────────────────────────────────

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getLastDay(year, month) { return new Date(year, month + 1, 0).getDate(); }

function generateAllCycleDates(startDate, endDate) {
  const dates = [];
  const d = new Date(startDate);
  d.setDate(1); // start at 1st of start month
  while (d <= endDate) {
    const y = d.getFullYear(), m = d.getMonth();
    // 15th of this month
    const mid = new Date(y, m, 15);
    if (mid >= startDate && mid <= endDate) dates.push(mid);
    // Last day of this month
    const last = new Date(y, m, getLastDay(y, m));
    if (last >= startDate && last <= endDate) dates.push(last);
    d.setMonth(d.getMonth() + 1);
  }
  return dates;
}

function cycleIdFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function cycleLabelFromDate(d) {
  const day = d.getDate();
  return `${MONTH_NAMES[d.getMonth()]}-${day} Payroll Cycle`;
}

function cycleMonthLabel(d) {
  // 15th cycles → same month, last-day cycles → next month (matching existing data pattern)
  const day = d.getDate();
  const lastDay = getLastDay(d.getFullYear(), d.getMonth());
  if (day === lastDay) {
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return `${MONTH_NAMES[next.getMonth()]} ${next.getFullYear()}`;
  }
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function ensureCyclesUpToDate() {
  const cycles = loadCycles();
  if (!cycles.cycles || cycles.cycles.length === 0) return; // not yet seeded

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the earliest existing cycle date
  const existingIds = new Set(cycles.cycles.map(c => c.cycleId));
  const earliest = new Date(cycles.cycles[0].cycleId + "T00:00:00");

  // Generate all cycle dates from earliest through tomorrow (include today's cycle if it's a cycle day)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const allDates = generateAllCycleDates(earliest, tomorrow);

  let changed = false;
  const subs = loadSubmissions();
  const budgets = loadBudgets();
  const donations = loadDonations() || [];
  const tracker = loadTracker();

  // Sort existing cycles by date to find the previous cycle for roll-forward
  const sortedExisting = [...cycles.cycles].sort((a, b) => a.cycleId.localeCompare(b.cycleId));

  for (const d of allDates) {
    const id = cycleIdFromDate(d);
    if (existingIds.has(id)) continue; // already exists

    // Determine status
    const cycleDate = new Date(d);
    cycleDate.setHours(0, 0, 0, 0);
    let status;
    if (cycleDate > today) status = "upcoming";
    else status = "closed";

    const newCycle = {
      cycleId: id,
      label: cycleLabelFromDate(d),
      deadline: id,
      payDate: id,
      status,
    };
    cycles.cycles.push(newCycle);
    existingIds.add(id);
    sortedExisting.push(newCycle);
    sortedExisting.sort((a, b) => a.cycleId.localeCompare(b.cycleId));
    changed = true;

    // Roll forward allocations from previous cycle
    const prevIdx = sortedExisting.findIndex(c => c.cycleId === id) - 1;
    if (prevIdx >= 0) {
      const prevId = sortedExisting[prevIdx].cycleId;
      const prevSubs = subs[prevId] || {};
      if (!subs[id]) subs[id] = {};
      if (!tracker[id]) tracker[id] = {};

      Object.entries(prevSubs).forEach(([email, sub]) => {
        if (subs[id][email]) return; // already has submission for this cycle
        if (!sub.allocations || sub.allocations.length === 0) return;
        // Roll forward
        subs[id][email] = {
          submittedAt: null,
          rolledForward: true,
          allocations: sub.allocations.map(a => ({ orgName: a.orgName, paidTo: a.paidTo, percentage: a.percentage })),
        };
        // Create donation entries
        const budget = budgets[email] || { cycleAmount: 0, currency: "$" };
        const monthLabel = cycleMonthLabel(d);
        sub.allocations.forEach(a => {
          if (a.percentage <= 0) return;
          const amt = Math.round((a.percentage / 100) * budget.cycleAmount * 100) / 100;
          donations.push({
            orgName: a.orgName,
            paidTo: a.paidTo || ORG_WEBSITES[a.orgName] || "",
            allocatedAmount: amt,
            month: monthLabel,
            currency: budget.currency || "$",
            paidDate: "",
            cycle: newCycle.label,
            percentage: a.percentage,
            email,
          });
          // Tracker entry (unpaid)
          if (!tracker[id][email]) tracker[id][email] = {};
          tracker[id][email][a.orgName] = { paid: false, datePaid: "", receiptData: null, receiptFileName: null, amount: amt };
        });
      });
    }
  }

  if (!changed) return;

  // Re-sort cycles chronologically
  cycles.cycles.sort((a, b) => a.cycleId.localeCompare(b.cycleId));

  // Set currentCycleId to most recent cycle on or before today
  const todayStr = cycleIdFromDate(today);
  const pastCycles = cycles.cycles.filter(c => c.cycleId <= todayStr);
  if (pastCycles.length > 0) {
    cycles.currentCycleId = pastCycles[pastCycles.length - 1].cycleId;
    // Mark the current one as "open", future as "upcoming", older as "closed"
    cycles.cycles.forEach(c => {
      if (c.cycleId === cycles.currentCycleId) c.status = "open";
      else if (c.cycleId > todayStr) c.status = "upcoming";
      else c.status = "closed";
    });
  }

  // Add one upcoming cycle (next cycle date after today)
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + 60); // look 60 days ahead
  const futureDates = generateAllCycleDates(tomorrow, futureDate);
  if (futureDates.length > 0) {
    const nextD = futureDates[0];
    const nextId = cycleIdFromDate(nextD);
    if (!existingIds.has(nextId)) {
      cycles.cycles.push({
        cycleId: nextId,
        label: cycleLabelFromDate(nextD),
        deadline: nextId,
        payDate: nextId,
        status: "upcoming",
      });
    }
  }

  cycles.cycles.sort((a, b) => a.cycleId.localeCompare(b.cycleId));
  saveCycles(cycles);
  saveSubmissions(subs);
  saveDonations(donations);
  saveTracker(tracker);
}

// ─── PARSE LIVE DATA ──────────────────────────────────────────

function parseSpreadsheetData(rows, userEmail) {
  if (!rows || rows.length === 0) return [];
  const donations = [];
  let currentCycle = "", currentEmployee = { first: "", last: "", email: "" }, currentCurrency = "$";
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const firstCell = String(row[0] || "").trim();
    if (firstCell.toLowerCase().includes("payroll cycle")) { currentCycle = firstCell; continue; }
    if (firstCell.toLowerCase() === "first") continue;
    const hasAllocation = String(row[4] || "").trim() !== "";
    const hasPaidTo = String(row[6] || "").trim() !== "";
    if (!hasAllocation && !hasPaidTo) continue;
    if (firstCell && firstCell.length > 0) {
      currentEmployee = { first: String(row[0]||"").trim(), last: String(row[1]||"").trim(), email: String(row[2]||"").trim().toLowerCase() };
      currentCurrency = String(row[3]||"").includes("£") ? "£" : "$";
    }
    if (currentEmployee.email !== userEmail.toLowerCase()) continue;
    const pct = parseFloat(String(row[4]||"100").replace("%","")) || 100;
    const allocAmount = parseFloat(String(row[5]||"0").replace(/[$£,\s]/g,"")) || 0;
    const paidTo = String(row[6]||"").trim();
    if (!paidTo) continue;
    const paidDate = String(row[7]||"").trim();
    let month = "";
    if (paidDate) { const parts = paidDate.split("-"); if (parts.length===3) month = parts[1]+" 20"+parts[2]; }
    if (!month && currentCycle) { const m = currentCycle.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i); if (m) month = m[1]+" 2026"; }
    donations.push({ cycle: currentCycle, percentage: pct, allocatedAmount: allocAmount, currency: currentCurrency, paidTo, orgName: extractOrgName(paidTo), paidDate, month });
  }
  return donations;
}

// ─── STYLES ───────────────────────────────────────────────────

const FONTS_URL = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap";
const GLOBAL_CSS = `
  @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @keyframes float { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-20px) scale(1.05); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.7; } }
  @keyframes shimmer { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
  @keyframes breathe { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
  @keyframes shine { 0% { transform:translateX(-100%); } 100% { transform:translateX(200%); } }
  @keyframes gentlePulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.015); } }
  @keyframes scaleIn { from { opacity:0; transform:scale(0.92) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#F5F0E8; color:#2C2416; -webkit-font-smoothing:antialiased; }
  ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(139,119,90,0.20); border-radius:3px; }
  ::selection { background:rgba(212,168,83,0.25); }
  img { -webkit-user-drag:none; }
  .hide-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
  .hide-scrollbar::-webkit-scrollbar { display:none; }
`;

const C = {
  bg: "#F5F0E8",
  card: "#FFFDF8",
  cardBorder: "rgba(139,119,90,0.15)",
  cardShadow: "0 2px 8px rgba(120,100,70,0.14), 0 1px 3px rgba(120,100,70,0.10)",
  cardHover: "0 8px 28px rgba(120,100,70,0.24), 0 2px 8px rgba(120,100,70,0.14)",
  text: "#2C2416",
  textSoft: "#5C4F3A",
  textMuted: "#9A8E78",
  accent: "#D4A853",
  accentDark: "#B8913A",
  accentLight: "#FAF0D8",
  accentSoft: "rgba(212,168,83,0.10)",
  warm: "#C4693A",
  warmLight: "#FBF0E0",
  divider: "rgba(139,119,90,0.12)",
  navy: "#3D7A6A",
};

const glass = {
  background: C.card,
  borderRadius: 6,
  border: `1px solid ${C.cardBorder}`,
  boxShadow: C.cardShadow,
};

// ─── COMPONENTS ───────────────────────────────────────────────

function AnimatedNumber({ value, currency = "$", duration = 900, isCount = false }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(null), fromRef = useRef(0);
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
  if (isCount) return <>{Math.round(display)}</>;
  return <>{fmt(display, currency)}</>;
}

function DonutChart({ data, size = 220 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2 - 14, ir = r * 0.66, gap = 0.025;
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
          <path key={i} d={s.path} fill={s.color} stroke={C.card} strokeWidth="3"
            style={{ transition: "transform .3s ease, opacity .3s", transformOrigin: `${size/2}px ${size/2}px`, transform: hovered === i ? "scale(1.06)" : "scale(1)", cursor: "pointer", opacity: hovered !== null && hovered !== i ? 0.3 : 1 }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
        {hovered !== null ? (<>
          <div style={{ fontSize: size < 180 ? 10 : 12, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>{slices[hovered].label}</div>
          <div style={{ fontSize: size < 180 ? 16 : 24, fontWeight: 700, color: C.text }}>{fmt(slices[hovered].value)}</div>
          <div style={{ fontSize: size < 180 ? 11 : 13, color: slices[hovered].color, fontWeight: 600 }}>{(slices[hovered].fraction * 100).toFixed(1)}%</div>
        </>) : (<>
          <div style={{ fontSize: size < 180 ? 10 : 12, color: C.textMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>Total</div>
          <div style={{ fontSize: size < 180 ? 16 : 26, fontWeight: 700, color: C.navy }}>{fmt(total)}</div>
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
    <div style={{ width: "100%", height, display: "flex", alignItems: "flex-end", gap: 10, paddingBottom: 32, position: "relative" }}>
      {data.map((d, i) => {
        const barH = animated ? (d.total / maxVal) * (height - 56) : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
            onMouseEnter={() => setHb(i)} onMouseLeave={() => setHb(null)}>
            {hb === i && <div style={{ position: "absolute", bottom: barH + 38, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", padding: "6px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", zIndex: 10 }}>{fmt(d.total)}</div>}
            <div style={{ width: "65%", minWidth: 22, maxWidth: 52, height: barH, borderRadius: "10px 10px 0 0", overflow: "hidden", cursor: "pointer", transition: `height .7s cubic-bezier(.4,0,.2,1) ${i*.06}s, opacity .2s`, opacity: hb !== null && hb !== i ? 0.35 : 1, display: "flex", flexDirection: "column-reverse" }}>
              {d.segments.map((seg, j) => <div key={j} style={{ width: "100%", height: (seg.value / maxVal) * (height - 56), background: seg.color, flexShrink: 0 }} />)}
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 10, fontWeight: 500, letterSpacing: ".02em" }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DONATE TAB ──────────────────────────────────────────────

function DonateTab({ userEmail, sheetData }) {
  const knownOrgs = useMemo(() => getAllKnownOrgs(), [sheetData]);
  const cycles = loadCycles();
  const currentCycle = cycles.cycles.find(c => c.cycleId === cycles.currentCycleId);
  const budgets = loadBudgets();
  const budget = budgets[userEmail] || { name: "", cycleAmount: 0, currency: "$" };
  const allSubs = loadSubmissions();
  const cycleSubs = allSubs[cycles.currentCycleId] || {};
  const mySub = cycleSubs[userEmail] || { submittedAt: null, rolledForward: false, allocations: [] };

  const [allocations, setAllocations] = useState(
    mySub.allocations.length > 0 ? mySub.allocations.map(a => ({ ...a })) : [{ orgName: "", paidTo: "", percentage: 0 }]
  );
  const [showRollforward, setShowRollforward] = useState(mySub.rolledForward && !mySub.submittedAt);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(!!mySub.submittedAt);

  const isLocked = currentCycle && currentCycle.status === "closed";
  const totalPct = allocations.reduce((s, a) => s + (a.percentage || 0), 0);
  const totalAmt = (totalPct / 100) * budget.cycleAmount;
  const sym = budget.currency === "£" ? "£" : "$";
  const hasIncompleteOther = allocations.some(a => a.orgName === "__other" && a.percentage > 0 && !(a.paidTo || "").trim());
  const m = useIsMobile();

  const updateRow = (idx, field, value) => {
    setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    setSaved(false); setSubmitted(false);
  };
  const removeRow = (idx) => {
    setAllocations(prev => prev.filter((_, i) => i !== idx));
    setSaved(false); setSubmitted(false);
  };
  const addRow = () => {
    setAllocations(prev => [...prev, { orgName: "", paidTo: "", percentage: 0, fund: "", customName: "" }]);
  };

  const saveAllocations = (isSubmit) => {
    const subs = loadSubmissions();
    if (!subs[cycles.currentCycleId]) subs[cycles.currentCycleId] = {};
    const finalAllocations = allocations.filter(a => a.percentage > 0).map(a => ({ orgName: a.orgName === "__other" ? extractOrgName(a.paidTo) : a.orgName, paidTo: a.paidTo, percentage: a.percentage, fund: a.fund || "" }));
    subs[cycles.currentCycleId][userEmail] = {
      submittedAt: isSubmit ? new Date().toISOString() : null,
      rolledForward: false,
      allocations: finalAllocations,
    };
    saveSubmissions(subs);

    // Also create/update donation entries so new orgs appear on Team/Impact/Overview immediately
    if (isSubmit) {
      const donations = loadDonations() || [];
      const cycleLabel = currentCycle?.label || "";
      // Compute month label from cycle date
      let monthLabel = "";
      if (cycles.currentCycleId) {
        const d = new Date(cycles.currentCycleId + "T00:00:00");
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        if (d.getDate() === lastDay) {
          const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          monthLabel = `${MONTH_NAMES[next.getMonth()]} ${next.getFullYear()}`;
        } else {
          monthLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
        }
      }
      // Remove this user's existing entries for this cycle, then add fresh ones
      const filtered = donations.filter(d => !(d.email === userEmail.toLowerCase() && d.cycle === cycleLabel));
      finalAllocations.forEach(a => {
        const amt = Math.round((a.percentage / 100) * budget.cycleAmount * 100) / 100;
        filtered.push({
          orgName: a.orgName, paidTo: a.paidTo || ORG_WEBSITES[a.orgName] || "",
          allocatedAmount: amt, month: monthLabel, currency: budget.currency || "$",
          paidDate: "", cycle: cycleLabel, percentage: a.percentage, email: userEmail.toLowerCase(),
        });
      });
      saveDonations(filtered);
    }

    if (isSubmit) setSubmitted(true); else setSaved(true);
    setShowRollforward(false);
  };

  const [clampedIdx, setClampedIdx] = useState(null);

  // Priority: first row = highest priority, last row = lowest
  // When adjusting a slider, don't let total exceed 100%
  const updateRowClamped = (idx, field, value) => {
    if (field === "percentage") {
      const othersTotal = allocations.reduce((s, a, i) => i !== idx ? s + (a.percentage || 0) : s, 0);
      const maxAllowed = Math.max(0, 100 - othersTotal);
      if (value > maxAllowed) {
        value = maxAllowed;
        setClampedIdx(idx);
      } else {
        if (clampedIdx === idx) setClampedIdx(null);
      }
    }
    updateRow(idx, field, value);
  };

  return (
    <div style={{ animation: "fadeSlideUp .3s ease" }}>
      {/* Cycle info */}
      <div style={{ ...glass, padding: "28px 36px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", margin: 0 }}>
              {currentCycle?.label || "Current Cycle"}
            </h3>
            <div style={{ fontSize: 14, color: C.textSoft, marginTop: 6 }}>
              Deadline: <strong style={{ color: C.text }}>{currentCycle?.deadline ? new Date(currentCycle.deadline + "T23:59:59").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"}</strong>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 500 }}>Your Budget</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, fontFamily: "'Playfair Display',Georgia,serif" }}>{sym}{budget.cycleAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        {isLocked && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(139,119,90,0.08)", borderRadius: 4, display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style={{ fontSize: 14, color: C.textSoft }}>This cycle's deadline has passed. Your allocations are locked.</span>
          </div>
        )}
      </div>

      {/* Rollforward notice */}
      {showRollforward && (
        <div style={{ background: C.accentLight, border: `1px solid ${C.accent}`, borderRadius: 4, padding: "14px 20px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, color: C.text }}>These allocations were carried forward from your last cycle. Review and adjust, or they'll be used as-is by the deadline.</span>
          <button onClick={() => setShowRollforward(false)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 18, padding: "0 4px" }}>&times;</button>
        </div>
      )}

      {/* Allocation rows */}
      <div style={{ ...glass, padding: "28px 36px", marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: "0 0 24px", textTransform: "uppercase", letterSpacing: ".06em" }}>Your Allocations</h3>
        {allocations.map((alloc, idx) => {
          const amt = (alloc.percentage / 100) * budget.cycleAmount;
          return (
            <div key={idx} style={{ padding: "18px 0", borderBottom: idx < allocations.length - 1 ? `1px solid ${C.divider}` : "none", animation: `fadeSlideUp .3s ease ${idx * 0.03}s both` }}>
              <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600, marginBottom: 8 }}>
                {idx === 0 ? "Highest Priority" : idx === allocations.length - 1 && allocations.length > 1 ? "Lowest Priority" : `Priority ${idx + 1}`}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <select
                  value={alloc.orgName}
                  onChange={e => {
                    const name = e.target.value;
                    const url = ORG_WEBSITES[name] || "";
                    updateRow(idx, "orgName", name);
                    updateRow(idx, "paidTo", url);
                  }}
                  disabled={isLocked}
                  style={{ width: m ? "100%" : 320, padding: "10px 14px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, background: C.card, color: C.text, fontFamily: "'Montserrat',sans-serif", cursor: isLocked ? "not-allowed" : "pointer" }}>
                  <option value="">Select an organization...</option>
                  {knownOrgs.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="__other">Other (enter manually)</option>
                </select>
                {alloc.orgName === "__other" && (
                  <input
                    type="url" placeholder="Organization URL *" value={alloc.paidTo || ""}
                    onChange={e => { updateRow(idx, "paidTo", e.target.value); updateRow(idx, "customName", extractOrgName(e.target.value)); }}
                    disabled={isLocked}
                    style={{ width: m ? "100%" : 280, padding: "10px 14px", fontSize: 14, border: `1px solid ${(alloc.paidTo || "").trim() ? C.cardBorder : "#dc2626"}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
                )}
                <span style={{ fontSize: 15, fontWeight: 600, color: C.navy, minWidth: 90, textAlign: "right", marginLeft: "auto" }}>{fmt(amt, budget.currency)}</span>
                {allocations.length > 1 && !isLocked && (
                  <button onClick={() => removeRow(idx)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 20, padding: "4px 8px", lineHeight: 1 }}>&times;</button>
                )}
              </div>
              <div style={{ marginBottom: 10 }}>
                <input
                  type="text" placeholder="Fund or campaign (optional)" value={alloc.fund || ""}
                  onChange={e => updateRow(idx, "fund", e.target.value)}
                  disabled={isLocked}
                  style={{ width: 320, padding: "8px 14px", fontSize: 13, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif", color: C.text }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    type="range" min="0" max="100" step="5" list={`ticks-${idx}`}
                    value={alloc.percentage} onChange={e => updateRowClamped(idx, "percentage", parseFloat(e.target.value))}
                    disabled={isLocked}
                    style={{ width: "100%", accentColor: clampedIdx === idx ? "#dc2626" : C.accent, cursor: isLocked ? "not-allowed" : "pointer" }} />
                  <datalist id={`ticks-${idx}`}>
                    {[0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100].map(v => <option key={v} value={v} />)}
                  </datalist>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, padding: "0 2px" }}>
                    {[0,25,50,75,100].map(v => <span key={v} style={{ fontSize: 10, color: C.textMuted }}>{v}%</span>)}
                  </div>
                  {clampedIdx === idx && (
                    <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 500, marginTop: 4 }}>Cannot exceed 100% total — reduce the above organizations first.</div>
                  )}
                </div>
                <input
                  type="number" min="0" max="100" step="5"
                  value={alloc.percentage} onChange={e => updateRowClamped(idx, "percentage", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  disabled={isLocked}
                  style={{ width: 64, padding: "6px 10px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, textAlign: "center", fontFamily: "'Montserrat',sans-serif" }} />
                <span style={{ fontSize: 13, color: C.textMuted, width: 16 }}>%</span>
              </div>
            </div>
          );
        })}
        {!isLocked && (
          <button onClick={addRow} style={{ marginTop: 18, padding: "10px 20px", background: "transparent", border: `1px dashed ${C.cardBorder}`, borderRadius: 4, color: C.textSoft, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center", fontWeight: 500, transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.cardBorder; e.currentTarget.style.color = C.textSoft; }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Organization
          </button>
        )}
      </div>

      {/* Running total */}
      <div style={{ ...glass, padding: m ? "20px 16px" : "24px 36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 500 }}>Allocated: </span>
            <span style={{ fontSize: 18, fontWeight: 700, color: totalPct > 100 ? "#dc2626" : C.text }}>{totalPct.toFixed(1)}%</span>
            <span style={{ fontSize: 14, color: C.textMuted, marginLeft: 12 }}>{fmt(totalAmt, budget.currency)} of {fmt(budget.cycleAmount, budget.currency)}</span>
          </div>
          <div style={{ fontSize: 14, color: C.textMuted }}>
            Remaining: <strong style={{ color: totalPct > 100 ? "#dc2626" : C.text }}>{(100 - totalPct).toFixed(1)}%</strong>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 8, background: C.divider, borderRadius: 4, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ height: "100%", width: `${Math.min(totalPct, 100)}%`, background: totalPct > 100 ? "#dc2626" : totalPct === 100 ? "#16a34a" : C.accent, borderRadius: 4, transition: "width .3s, background .3s", position: "relative", overflow: "hidden" }}>
            {totalPct === 100 && (
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)", animation: "shine 2s ease-in-out infinite" }} />
            )}
          </div>
        </div>
        {totalPct > 100 && (
          <div style={{ color: "#dc2626", fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Total exceeds 100%. Please reduce your allocations.</div>
        )}
        {totalPct === 100 && (
          <div style={{ color: "#16a34a", fontSize: 14, fontWeight: 500, marginBottom: 16, animation: "breathe 2s ease-in-out" }}>Fully allocated!</div>
        )}
        {!isLocked && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button onClick={() => saveAllocations(false)} style={{ padding: "10px 24px", background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 4, color: C.textSoft, fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>
              Save Draft
            </button>
            <button onClick={() => saveAllocations(true)} disabled={totalPct > 100 || hasIncompleteOther}
              style={{ padding: "10px 28px", background: (totalPct > 100 || hasIncompleteOther) ? C.divider : C.accent, color: (totalPct > 100 || hasIncompleteOther) ? C.textMuted : C.text, border: "none", borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: (totalPct > 100 || hasIncompleteOther) ? "not-allowed" : "pointer", transition: "all .15s" }}>
              Submit Allocations
            </button>
            {hasIncompleteOther && (
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 500, marginTop: 4 }}>Please provide a URL for custom organizations.</div>
            )}
          </div>
        )}
        {saved && <div style={{ marginTop: 14, fontSize: 14, color: C.textSoft, textAlign: "center" }}>Draft saved.</div>}
        {submitted && <div style={{ marginTop: 14, fontSize: 14, color: "#16a34a", fontWeight: 500, textAlign: "center" }}>Allocations submitted!</div>}
      </div>
    </div>
  );
}

// ─── ADMIN TAB ───────────────────────────────────────────────

function ReceiptModal({ src, fileName, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .2s ease" }}
      onClick={onClose}>
      <div style={{ background: C.card, borderRadius: 8, padding: 24, maxWidth: 600, maxHeight: "80vh", overflow: "auto", position: "relative" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fileName || "Receipt"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted }}>&times;</button>
        </div>
        {src && src.startsWith("data:image") ? (
          <img src={src} alt="Receipt" style={{ width: "100%", borderRadius: 4 }} />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>Unable to preview this file type.</div>
        )}
      </div>
    </div>
  );
}

function AdminTracker({ selectedCycleId, onTrackerChange, sheetData, adminLevel }) {
  const [tracker, setTracker] = useState(loadTracker());
  const m = useIsMobile();

  // Re-sync tracker when sheet data updates from another admin
  useEffect(() => {
    setTracker(loadTracker());
  }, [sheetData]);

  const subs = loadSubmissions();
  const budgets = loadBudgets();
  const cycleSubs = subs[selectedCycleId] || {};
  const cycleTracker = tracker[selectedCycleId] || {};
  const [viewReceipt, setViewReceipt] = useState(null);

  // Build rows: each employee's allocations for this cycle
  const rows = [];
  Object.entries(cycleSubs).forEach(([email, sub]) => {
    const budget = budgets[email] || { cycleAmount: 0, currency: "$", name: email };
    (sub.allocations || []).forEach(alloc => {
      if (alloc.percentage <= 0) return;
      const amt = (alloc.percentage / 100) * budget.cycleAmount;
      const tData = cycleTracker[email]?.[alloc.orgName] || {};
      rows.push({ email, name: budget.name, orgName: alloc.orgName, paidTo: alloc.paidTo || ORG_WEBSITES[alloc.orgName] || "", fund: alloc.fund || "", amount: Math.round(amt * 100) / 100, currency: budget.currency, paid: tData.paid || false, datePaid: tData.datePaid || "", receiptData: tData.receiptData || null, receiptFileName: tData.receiptFileName || null });
    });
  });

  // Also include rows from tracker that came from seeded DEMO_DATA (not in current submissions)
  Object.entries(cycleTracker).forEach(([email, orgs]) => {
    Object.entries(orgs).forEach(([orgName, tData]) => {
      if (!rows.find(r => r.email === email && r.orgName === orgName)) {
        const budget = budgets[email] || { name: email, currency: "$" };
        rows.push({ email, name: budget.name, orgName, paidTo: ORG_WEBSITES[orgName] || "", fund: "", amount: tData.amount || 0, currency: budget.currency, paid: tData.paid || false, datePaid: tData.datePaid || "", receiptData: tData.receiptData || null, receiptFileName: tData.receiptFileName || null });
      }
    });
  });

  rows.sort((a, b) => a.name.localeCompare(b.name) || a.orgName.localeCompare(b.orgName));

  const paidCount = rows.filter(r => r.paid).length;
  const totalAmt = rows.reduce((s, r) => s + r.amount, 0);

  const updateTrackerField = (email, orgName, field, value) => {
    const t = loadTracker();
    if (!t[selectedCycleId]) t[selectedCycleId] = {};
    if (!t[selectedCycleId][email]) t[selectedCycleId][email] = {};
    if (!t[selectedCycleId][email][orgName]) t[selectedCycleId][email][orgName] = { paid: false, datePaid: "", receiptData: null, receiptFileName: null, amount: 0 };
    t[selectedCycleId][email][orgName][field] = value;
    // Auto-fill date when marking paid
    if (field === "paid" && value && !t[selectedCycleId][email][orgName].datePaid) {
      t[selectedCycleId][email][orgName].datePaid = new Date().toISOString().split("T")[0];
    }
    saveTracker(t);
    setTracker({ ...t });
    if (onTrackerChange) onTrackerChange();
  };

  const handleReceiptUpload = (email, orgName, file) => {
    if (file.size > 2 * 1024 * 1024) { alert("File too large. Please upload under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.type.startsWith("image/")) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          const max = 800;
          if (w > max || h > max) { const r = Math.min(max / w, max / h); w *= r; h *= r; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.6);
          updateTrackerField(email, orgName, "receiptData", compressed);
          updateTrackerField(email, orgName, "receiptFileName", file.name);
        };
        img.src = e.target.result;
      } else {
        updateTrackerField(email, orgName, "receiptData", e.target.result);
        updateTrackerField(email, orgName, "receiptFileName", file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Group rows by employee for subtotals
  const employeeGroups = [];
  let currentGroup = null;
  rows.forEach(row => {
    if (!currentGroup || currentGroup.email !== row.email) {
      currentGroup = { email: row.email, name: row.name, currency: row.currency, rows: [] };
      employeeGroups.push(currentGroup);
    }
    currentGroup.rows.push(row);
  });

  return (
    <div>
      {viewReceipt && <ReceiptModal src={viewReceipt.src} fileName={viewReceipt.name} onClose={() => setViewReceipt(null)} />}
      <div style={{ ...glass, overflow: "hidden", overflowX: m ? "auto" : "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 100px 50px 110px 90px", padding: "12px 20px", borderBottom: `1px solid ${C.divider}`, background: "rgba(139,119,90,0.03)" }}>
          {["Employee", "Organization", "Amount", "Paid", "Date Paid", "Receipt"].map(h => (
            <div key={h} style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>{h}</div>
          ))}
        </div>
        {/* Rows */}
        {rows.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: C.textMuted, fontSize: 15 }}>No submissions for this cycle yet.</div>
        )}
        {employeeGroups.map((group, gi) => {
          const groupTotal = group.rows.reduce((s, r) => s + r.amount, 0);
          return group.rows.map((row, ri) => {
            const showName = ri === 0;
            const isLastInGroup = ri === group.rows.length - 1;
            return (
              <div key={`${row.email}-${row.orgName}`}>
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 100px 50px 110px 90px", padding: "12px 20px", borderBottom: isLastInGroup ? "none" : `1px solid ${C.divider}`, alignItems: "center", background: gi % 2 === 1 ? "rgba(139,119,90,0.02)" : "transparent" }}>
              <div style={{ fontSize: 14, fontWeight: showName ? 600 : 400, color: showName ? C.text : "transparent" }}>{row.name}</div>
              <div style={{ fontSize: 14, color: C.textSoft }}>
                {row.paidTo ? (
                  <a href={row.paidTo} target="_blank" rel="noopener noreferrer" style={{ color: C.navy, textDecoration: "underline", fontWeight: 500 }}>{row.orgName}</a>
                ) : row.orgName}
                {row.fund && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Fund: {row.fund}</div>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmt(row.amount, row.currency)}</div>
              <div>
                <input type="checkbox" checked={row.paid} disabled={adminLevel < 2}
                  onChange={adminLevel >= 2 ? e => updateTrackerField(row.email, row.orgName, "paid", e.target.checked) : undefined}
                  style={{ width: 18, height: 18, cursor: adminLevel < 2 ? "default" : "pointer", accentColor: C.accent, opacity: adminLevel < 2 ? 0.6 : 1 }} />
              </div>
              <div>
                {adminLevel >= 2 ? (
                  <input type="date" value={row.datePaid} onChange={e => updateTrackerField(row.email, row.orgName, "datePaid", e.target.value)}
                    style={{ fontSize: 12, padding: "4px 6px", border: `1px solid ${C.cardBorder}`, borderRadius: 4, color: C.text, fontFamily: "'Montserrat',sans-serif" }} />
                ) : (
                  <span style={{ fontSize: 12, color: C.textSoft }}>{row.datePaid || "—"}</span>
                )}
              </div>
              <div>
                {row.receiptData ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setViewReceipt({ src: row.receiptData, name: row.receiptFileName })}
                      style={{ fontSize: 12, color: C.navy, background: "none", border: "none", cursor: "pointer", fontWeight: 500, textDecoration: "underline" }}>View</button>
                    {adminLevel >= 2 && <button onClick={() => { updateTrackerField(row.email, row.orgName, "receiptData", null); updateTrackerField(row.email, row.orgName, "receiptFileName", null); }}
                      style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Remove</button>}
                  </div>
                ) : (
                  adminLevel >= 2 ? <label style={{ fontSize: 12, color: C.navy, cursor: "pointer", fontWeight: 500 }}>
                    Upload
                    <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                      onChange={e => { if (e.target.files[0]) handleReceiptUpload(row.email, row.orgName, e.target.files[0]); }} />
                  </label> : <span style={{ fontSize: 12, color: C.textMuted }}>—</span>
                )}
              </div>
                </div>
                {/* Subtotal row after last item in group */}
                {isLastInGroup && (
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 100px 50px 110px 90px", padding: "8px 20px", borderBottom: `2px solid ${C.divider}`, alignItems: "center", background: gi % 2 === 1 ? "rgba(139,119,90,0.04)" : "rgba(139,119,90,0.03)" }}>
                    <div />
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.textMuted, textAlign: "right", paddingRight: 12 }}>Subtotal</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{fmt(groupTotal, group.currency)}</div>
                    <div /><div /><div />
                  </div>
                )}
              </div>
            );
          });
        })}
        {/* Summary */}
        {paidCount === rows.length && rows.length > 0 ? (
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(22,163,74,0.08)", animation: "gentlePulse 2s ease-in-out 1" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              All {rows.length} donations paid
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Total: {fmt(totalAmt)}</span>
          </div>
        ) : (
          <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", background: "rgba(139,119,90,0.03)" }}>
            <span style={{ fontSize: 14, color: C.textSoft }}>{paidCount} of {rows.length} donations paid</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Total: {fmt(totalAmt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminBudgets({ adminLevel }) {
  const [budgets, setBudgets] = useState(loadBudgets());
  const m = useIsMobile();
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("$");

  const updateBudget = (email, field, value) => {
    const b = { ...budgets };
    b[email] = { ...b[email], [field]: field === "cycleAmount" ? parseFloat(value) || 0 : value };
    saveBudgets(b);
    setBudgets(b);
  };

  const addEmployee = () => {
    if (!newEmail || !newEmail.includes("@")) return;
    const b = { ...budgets };
    b[newEmail.toLowerCase()] = { name: newName || newEmail.split("@")[0], cycleAmount: parseFloat(newAmount) || 0, currency: newCurrency };
    saveBudgets(b);
    setBudgets(b);
    setNewEmail(""); setNewName(""); setNewAmount("");
  };

  const removeEmployee = (email) => {
    const b = { ...budgets };
    delete b[email];
    saveBudgets(b);
    setBudgets(b);
  };

  return (
    <div style={{ ...glass, overflow: "hidden", overflowX: m ? "auto" : "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 80px 80px", padding: "12px 20px", borderBottom: `1px solid ${C.divider}`, background: "rgba(139,119,90,0.03)" }}>
        {["Employee", "Email", "Budget/Cycle", "Currency", ""].map(h => (
          <div key={h} style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>{h}</div>
        ))}
      </div>
      {Object.entries(budgets).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([email, b]) => (
        <div key={email} style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 80px 80px", padding: "10px 20px", borderBottom: `1px solid ${C.divider}`, alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{b.name}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>{email}</div>
          <div>
            {adminLevel >= 2 ? (
              <input type="number" value={b.cycleAmount} onChange={e => updateBudget(email, "cycleAmount", e.target.value)}
                style={{ width: 120, padding: "6px 10px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
            ) : (
              <span style={{ fontSize: 14, color: C.text }}>{b.cycleAmount}</span>
            )}
          </div>
          <div>
            {adminLevel >= 2 ? (
              <select value={b.currency} onChange={e => updateBudget(email, "currency", e.target.value)}
                style={{ padding: "6px 8px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }}>
                <option value="$">$</option><option value="£">£</option>
              </select>
            ) : (
              <span style={{ fontSize: 14, color: C.text }}>{b.currency}</span>
            )}
          </div>
          <div>
            {adminLevel >= 2 && <button onClick={() => removeEmployee(email)} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Remove</button>}
          </div>
        </div>
      ))}
      {/* Add employee row — editor only */}
      {adminLevel >= 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 80px 80px", padding: "12px 20px", background: "rgba(139,119,90,0.03)", alignItems: "center", gap: 8 }}>
          <input type="text" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
          <input type="email" placeholder="email@isara.io" value={newEmail} onChange={e => setNewEmail(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
          <input type="number" placeholder="Amount" value={newAmount} onChange={e => setNewAmount(e.target.value)}
            style={{ width: 120, padding: "6px 10px", fontSize: 13, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
          <select value={newCurrency} onChange={e => setNewCurrency(e.target.value)}
            style={{ padding: "6px 8px", fontSize: 13, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }}>
            <option value="$">$</option><option value="£">£</option>
          </select>
          <button onClick={addEmployee} style={{ padding: "6px 14px", background: C.accent, color: C.text, border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Add</button>
        </div>
      )}
    </div>
  );
}

function AdminManagement({ currentEmail, sheetData }) {
  const mergeAdmins = () => ({ ...INITIAL_ADMINS, ...loadAdmins() });
  const [admins, setAdmins] = useState(mergeAdmins);
  const [newAdmin, setNewAdmin] = useState("");
  const [newLevel, setNewLevel] = useState(1);

  useEffect(() => { setAdmins(mergeAdmins()); }, [sheetData]);

  const addAdmin = () => {
    if (!newAdmin || !newAdmin.includes("@")) return;
    const updated = { ...admins, [newAdmin.toLowerCase()]: newLevel };
    saveAdmins(updated);
    setAdmins(updated);
    setNewAdmin("");
  };

  const removeAdmin = (email) => {
    if (email === currentEmail) return;
    if (INITIAL_ADMINS[email]) return;
    const updated = { ...admins };
    delete updated[email];
    saveAdmins(updated);
    setAdmins(updated);
  };

  const setLevel = (email, lvl) => {
    if (INITIAL_ADMINS[email]) return;
    const updated = { ...admins, [email]: lvl };
    saveAdmins(updated);
    setAdmins(updated);
  };

  return (
    <div style={{ ...glass, padding: "32px 36px" }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: "0 0 20px", textTransform: "uppercase", letterSpacing: ".06em" }}>Current Admins</h3>
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        <strong style={{ color: C.text }}>Viewer</strong> — can view tracker, unpaid, and budgets (read-only). <strong style={{ color: C.text }}>Editor</strong> — can also mark payments, upload receipts, and change budgets.
      </p>
      {Object.entries(admins).sort((a, b) => a[0].localeCompare(b[0])).map(([email, level]) => (
        <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.divider}` }}>
          <span style={{ fontSize: 15, color: C.text, fontWeight: 500 }}>{email}</span>
          {email === currentEmail ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", background: level === 2 ? "rgba(61,122,106,0.12)" : "rgba(139,119,90,0.08)", color: level === 2 ? C.navy : C.textMuted }}>{level === 2 ? "Editor" : "Viewer"}</span>
              <span style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>You</span>
            </div>
          ) : INITIAL_ADMINS[email] ? (
            <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", background: level === 2 ? "rgba(61,122,106,0.12)" : "rgba(139,119,90,0.08)", color: level === 2 ? C.navy : C.textMuted }}>{level === 2 ? "Editor" : "Viewer"}</span>
          ) : (
            <select value={level} onChange={e => { const v = e.target.value; if (v === "remove") removeAdmin(email); else setLevel(email, Number(v)); }}
              style={{ padding: "5px 10px", fontSize: 13, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif", color: C.text, cursor: "pointer" }}>
              <option value={1}>Viewer</option>
              <option value={2}>Editor</option>
              <option value="remove" style={{ color: "#dc2626" }}>Remove</option>
            </select>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <input type="email" placeholder="email@isara.io" value={newAdmin} onChange={e => setNewAdmin(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addAdmin()}
          style={{ flex: 1, padding: "10px 14px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
        <select value={newLevel} onChange={e => setNewLevel(Number(e.target.value))}
          style={{ padding: "10px 12px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }}>
          <option value={1}>Viewer</option>
          <option value={2}>Editor</option>
        </select>
        <button onClick={addAdmin} style={{ padding: "10px 24px", background: C.accent, color: C.text, border: "none", borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Add Admin</button>
      </div>
    </div>
  );
}

function exportTrackerCSV(cycleId, cycleLabel) {
  const subs = loadSubmissions();
  const budgets = loadBudgets();
  const tracker = loadTracker();
  const cycleSubs = subs[cycleId] || {};
  const cycleTracker = tracker[cycleId] || {};
  const rows = [];
  Object.entries(cycleSubs).forEach(([email, sub]) => {
    const budget = budgets[email] || { cycleAmount: 0, currency: "$", name: email };
    (sub.allocations || []).forEach(alloc => {
      if (alloc.percentage <= 0) return;
      const amt = Math.round((alloc.percentage / 100) * budget.cycleAmount * 100) / 100;
      const tData = cycleTracker[email]?.[alloc.orgName] || {};
      rows.push({ name: budget.name, email, org: alloc.orgName, paidTo: alloc.paidTo || ORG_WEBSITES[alloc.orgName] || "", amount: amt, currency: budget.currency, paid: tData.paid ? "Yes" : "No", datePaid: tData.datePaid || "" });
    });
  });
  Object.entries(cycleTracker).forEach(([email, orgs]) => {
    Object.entries(orgs).forEach(([orgName, tData]) => {
      if (!rows.find(r => r.email === email && r.org === orgName)) {
        const budget = budgets[email] || { name: email, currency: "$" };
        rows.push({ name: budget.name, email, org: orgName, paidTo: ORG_WEBSITES[orgName] || "", amount: tData.amount || 0, currency: budget.currency, paid: tData.paid ? "Yes" : "No", datePaid: tData.datePaid || "" });
      }
    });
  });
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.org.localeCompare(b.org));
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const header = "Name,Email,Organization,Paid To,Amount,Currency,Paid,Date Paid";
  const csv = [header, ...rows.map(r => [esc(r.name), esc(r.email), esc(r.org), esc(r.paidTo), r.amount, r.currency, r.paid, r.datePaid].join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `givetrack-${cycleLabel.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function AdminTab({ currentEmail, sheetData, adminLevel }) {
  const [subTab, setSubTab] = useState("tracker");
  const cycles = loadCycles();
  const [selectedCycleId, setSelectedCycleId] = useState(cycles.currentCycleId || "");
  const [, refreshStatus] = useState(0);

  // Compute live display status for a cycle
  const getCycleDisplayStatus = (cycle) => {
    if (cycle.status === "open") return "open";
    if (cycle.status === "upcoming") return "upcoming";
    // For closed/past cycles, compute from tracker checkboxes
    return computeCyclePayStatus(cycle.cycleId);
  };

  const statusColor = (status) => {
    if (status === "paid") return "#16a34a";
    if (status === "open") return C.navy;
    if (status === "upcoming") return C.textMuted;
    return "#d97706";
  };

  const subTabs = [
    { id: "tracker", label: "Tracker" },
    { id: "unpaid", label: "Unpaid" },
    { id: "budgets", label: "Budgets" },
    { id: "admins", label: "Admin Management" },
  ];

  return (
    <div style={{ animation: "fadeSlideUp .3s ease", overflowX: "hidden" }}>
      {/* Sub-nav */}
      <div style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: `1px solid ${C.divider}` }}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding: "10px 24px", background: "transparent", border: "none",
            borderBottom: subTab === t.id ? `2px solid ${C.navy}` : "2px solid transparent",
            color: subTab === t.id ? C.navy : C.textMuted, fontSize: 13, fontWeight: subTab === t.id ? 600 : 400,
            cursor: "pointer", transition: "all .2s", marginBottom: -1, letterSpacing: ".04em",
          }}>{t.label}</button>
        ))}
      </div>

      {subTab === "tracker" && (
        <div>
          {/* Cycle selector */}
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 500 }}>Cycle:</span>
            <select value={selectedCycleId} onChange={e => setSelectedCycleId(e.target.value)}
              style={{ padding: "8px 14px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }}>
              {cycles.cycles.map(c => {
                const displayStatus = getCycleDisplayStatus(c);
                return (
                  <option key={c.cycleId} value={c.cycleId}>{c.label} ({displayStatus})</option>
                );
              })}
            </select>
            {(() => {
              const sel = cycles.cycles.find(c => c.cycleId === selectedCycleId);
              if (!sel) return null;
              const ds = getCycleDisplayStatus(sel);
              return (
                <span style={{ fontSize: 13, fontWeight: 600, color: statusColor(ds), textTransform: "uppercase", letterSpacing: ".06em" }}>
                  {ds}
                </span>
              );
            })()}
            <button onClick={() => { const sel = cycles.cycles.find(c => c.cycleId === selectedCycleId); exportTrackerCSV(selectedCycleId, sel?.label || selectedCycleId); }}
              style={{ marginLeft: "auto", padding: "8px 18px", background: C.navy, color: "#fff", border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>
          <AdminTracker selectedCycleId={selectedCycleId} onTrackerChange={() => refreshStatus(v => v + 1)} sheetData={sheetData} adminLevel={adminLevel} />
        </div>
      )}
      {subTab === "unpaid" && <CumulativeUnpaid sheetData={sheetData} onTrackerChange={() => refreshStatus(v => v + 1)} adminLevel={adminLevel} />}
      {subTab === "budgets" && <AdminBudgets adminLevel={adminLevel} />}
      {subTab === "admins" && <AdminManagement currentEmail={currentEmail} sheetData={sheetData} />}
    </div>
  );
}

function CumulativeUnpaid({ sheetData, onTrackerChange, adminLevel }) {
  const m = useIsMobile();
  const [tracker, setTracker] = useState(loadTracker());
  const [viewReceipt, setViewReceipt] = useState(null);

  // Re-sync tracker when sheet data updates from another admin
  useEffect(() => {
    setTracker(loadTracker());
  }, [sheetData]);

  const subs = loadSubmissions();
  const budgets = loadBudgets();
  const cycles = loadCycles();

  // Shared update function — writes to tracker, syncs to sheet, updates local state
  const markPaid = (cycleId, email, orgName, field, value) => {
    const t = loadTracker(); // always read fresh to avoid stale overwrites
    if (!t[cycleId]) t[cycleId] = {};
    if (!t[cycleId][email]) t[cycleId][email] = {};
    if (!t[cycleId][email][orgName]) t[cycleId][email][orgName] = { paid: false, datePaid: "", receiptData: null, receiptFileName: null, amount: 0 };
    t[cycleId][email][orgName][field] = value;
    if (field === "paid" && value && !t[cycleId][email][orgName].datePaid) {
      t[cycleId][email][orgName].datePaid = new Date().toISOString().split("T")[0];
    }
    saveTracker(t);
    setTracker({ ...t });
    if (onTrackerChange) onTrackerChange();
  };

  const handleReceiptUpload = (cycleId, email, orgName, file) => {
    if (file.size > 2 * 1024 * 1024) { alert("File too large. Please upload under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (file.type.startsWith("image/")) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          const max = 800;
          if (w > max || h > max) { const r = Math.min(max / w, max / h); w *= r; h *= r; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.6);
          markPaid(cycleId, email, orgName, "receiptData", compressed);
          markPaid(cycleId, email, orgName, "receiptFileName", file.name);
        };
        img.src = e.target.result;
      } else {
        markPaid(cycleId, email, orgName, "receiptData", e.target.result);
        markPaid(cycleId, email, orgName, "receiptFileName", file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Build ALL unpaid rows across ALL cycles
  const unpaidRows = [];
  cycles.cycles.forEach(cycle => {
    const cycleId = cycle.cycleId;
    const cycleSubs = subs[cycleId] || {};
    const cycleTracker = tracker[cycleId] || {};
    const seen = new Set();

    Object.entries(cycleSubs).forEach(([email, sub]) => {
      const budget = budgets[email] || { cycleAmount: 0, currency: "$", name: email };
      (sub.allocations || []).forEach(alloc => {
        if (alloc.percentage <= 0) return;
        seen.add(`${email}:${alloc.orgName}`);
        const tData = cycleTracker[email]?.[alloc.orgName] || {};
        if (!tData.paid) {
          const amt = (alloc.percentage / 100) * budget.cycleAmount;
          unpaidRows.push({ email, name: budget.name, orgName: alloc.orgName, paidTo: alloc.paidTo || ORG_WEBSITES[alloc.orgName] || "", amount: Math.round(amt * 100) / 100, currency: budget.currency, cycleId, cycleLabel: cycle.label, receiptData: tData.receiptData || null, receiptFileName: tData.receiptFileName || null, datePaid: tData.datePaid || "" });
        }
      });
    });

    Object.entries(cycleTracker).forEach(([email, orgs]) => {
      Object.entries(orgs).forEach(([orgName, tData]) => {
        if (!seen.has(`${email}:${orgName}`) && !tData.paid) {
          const budget = budgets[email] || { name: email, currency: "$" };
          unpaidRows.push({ email, name: budget.name, orgName, paidTo: ORG_WEBSITES[orgName] || "", amount: tData.amount || 0, currency: budget.currency, cycleId, cycleLabel: cycle.label, receiptData: tData.receiptData || null, receiptFileName: tData.receiptFileName || null, datePaid: tData.datePaid || "" });
        }
      });
    });
  });

  unpaidRows.sort((a, b) => a.cycleId.localeCompare(b.cycleId) || a.name.localeCompare(b.name) || a.orgName.localeCompare(b.orgName));

  // Group by pay cycle
  const groups = [];
  let currentGroup = null;
  unpaidRows.forEach(row => {
    if (!currentGroup || currentGroup.cycleId !== row.cycleId) {
      currentGroup = { cycleId: row.cycleId, cycleLabel: row.cycleLabel, rows: [] };
      groups.push(currentGroup);
    }
    currentGroup.rows.push(row);
  });

  const totalUnpaid = unpaidRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      {viewReceipt && <ReceiptModal src={viewReceipt.src} fileName={viewReceipt.name} onClose={() => setViewReceipt(null)} />}
      <div style={{ ...glass, padding: "20px 28px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.warm, textTransform: "uppercase", letterSpacing: ".06em" }}>Cumulative Unpaid</div>
          <div style={{ fontSize: 16, color: C.textSoft, marginTop: 5 }}>
            <strong style={{ color: C.text }}>{unpaidRows.length}</strong> unpaid donation{unpaidRows.length !== 1 ? "s" : ""} across all cycles
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.warm, fontFamily: "'Playfair Display',Georgia,serif" }}>{fmt(totalUnpaid)}</div>
      </div>

      {unpaidRows.length === 0 ? (
        <div style={{ ...glass, padding: "60px 36px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#16a34a", marginBottom: 8 }}>All caught up!</div>
          <div style={{ fontSize: 15, color: C.textMuted }}>Every donation across all cycles has been paid.</div>
        </div>
      ) : (
        <div style={{ ...glass, overflow: "hidden", overflowX: m ? "auto" : "hidden" }}>
          {groups.map((group) => {
            const groupTotal = group.rows.reduce((s, r) => s + r.amount, 0);
            return (
              <div key={group.cycleId}>
                {/* Cycle header dark bar */}
                <div style={{ display: "grid", gridTemplateColumns: m ? "1fr 80px" : "1fr 100px 50px 110px 90px", padding: "10px 20px", background: C.text, alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: ".04em" }}>{group.cycleLabel} — {group.rows.length} unpaid</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{fmt(groupTotal)}</div>
                  {!m && <><div /><div /><div /></>}
                </div>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: m ? "100px 1fr 80px 40px" : "140px 1fr 100px 50px 110px 90px", padding: "10px 20px", borderBottom: `1px solid ${C.divider}`, background: "rgba(139,119,90,0.03)" }}>
                  {(m ? ["Name", "Org", "Amt", ""] : ["Employee", "Organization", "Amount", "Paid", "Date Paid", "Receipt"]).map(h => (
                    <div key={h || "spacer"} style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>{h}</div>
                  ))}
                </div>
                {group.rows.map((row, ri) => (
                  <div key={`${row.cycleId}-${row.email}-${row.orgName}`} style={{ display: "grid", gridTemplateColumns: m ? "100px 1fr 80px 40px" : "140px 1fr 100px 50px 110px 90px", padding: "12px 20px", borderBottom: ri === group.rows.length - 1 ? "none" : `1px solid ${C.divider}`, alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{row.name}</div>
                    <div style={{ fontSize: 14, color: C.textSoft }}>
                      {row.paidTo ? <a href={row.paidTo} target="_blank" rel="noopener noreferrer" style={{ color: C.navy, textDecoration: "underline", fontWeight: 500 }}>{row.orgName}</a> : row.orgName}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.warm }}>{fmt(row.amount, row.currency)}</div>
                    <div>
                      <input type="checkbox" checked={false} disabled={adminLevel < 2}
                        onChange={adminLevel >= 2 ? () => markPaid(row.cycleId, row.email, row.orgName, "paid", true) : undefined}
                        style={{ width: 18, height: 18, cursor: adminLevel < 2 ? "default" : "pointer", accentColor: C.accent, opacity: adminLevel < 2 ? 0.6 : 1 }} />
                    </div>
                    {!m && (
                      <>
                        <div>
                          {adminLevel >= 2 ? (
                            <input type="date" value={row.datePaid} onChange={e => markPaid(row.cycleId, row.email, row.orgName, "datePaid", e.target.value)}
                              style={{ fontSize: 12, padding: "4px 6px", border: `1px solid ${C.cardBorder}`, borderRadius: 4, color: C.text, fontFamily: "'Montserrat',sans-serif" }} />
                          ) : (
                            <span style={{ fontSize: 12, color: C.textSoft }}>{row.datePaid || "—"}</span>
                          )}
                        </div>
                        <div>
                          {row.receiptData ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => setViewReceipt({ src: row.receiptData, name: row.receiptFileName })}
                                style={{ fontSize: 12, color: C.navy, background: "none", border: "none", cursor: "pointer", fontWeight: 500, textDecoration: "underline" }}>View</button>
                              {adminLevel >= 2 && <button onClick={() => { markPaid(row.cycleId, row.email, row.orgName, "receiptData", null); markPaid(row.cycleId, row.email, row.orgName, "receiptFileName", null); }}
                                style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Remove</button>}
                            </div>
                          ) : (
                            adminLevel >= 2 ? <label style={{ fontSize: 12, color: C.navy, cursor: "pointer", fontWeight: 500 }}>
                              Upload
                              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                                onChange={e => { if (e.target.files[0]) handleReceiptUpload(row.cycleId, row.email, row.orgName, e.target.files[0]); }} />
                            </label> : <span style={{ fontSize: 12, color: C.textMuted }}>—</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── GLOBE ────────────────────────────────────────────────────

function GlobeTab({ donations, userEmail, sheetData }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [countries, setCountries] = useState([]);
  const [globeReady, setGlobeReady] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showData, setShowData] = useState(false);
  const m = useIsMobile();

  useEffect(() => {
    if (globeReady) {
      const t = setTimeout(() => setShowData(true), 600);
      return () => clearTimeout(t);
    }
  }, [globeReady]);

  // Build company-wide donations from submissions + budgets
  const companyDonations = useMemo(() => {
    const subs = loadSubmissions();
    const budgets = loadBudgets();
    const all = [];
    Object.entries(subs).forEach(([cycleId, cycleSubs]) => {
      Object.entries(cycleSubs).forEach(([email, sub]) => {
        const b = budgets[email];
        if (!b || !sub.allocations) return;
        sub.allocations.forEach(a => {
          if (a.percentage <= 0) return;
          all.push({ email, orgName: a.orgName, allocatedAmount: (a.percentage / 100) * b.cycleAmount, currency: b.currency || "$" });
        });
      });
    });
    return all;
  }, [sheetData]);

  // User's org names for highlighting
  const userOrgNames = useMemo(() => {
    const s = new Set();
    companyDonations.filter(d => d.email === userEmail).forEach(d => s.add(d.orgName));
    return s;
  }, [companyDonations, userEmail]);

  const countryData = useMemo(() => aggregateDonationsByCountry(companyDonations), [companyDonations]);
  const maxDonation = useMemo(() => Math.max(...Object.values(countryData).map(d => d.total), 1), [countryData]);
  const colorScale = useMemo(() => scaleSqrt().domain([0, maxDonation]).range([0, 1]), [maxDonation]);
  const countryCount = Object.keys(countryData).length;
  const donatedCountries = useMemo(() => new Set(Object.keys(countryData)), [countryData]);

  // Breathing glow phase for donated countries (0→1→0 over ~2 seconds)
  const [glowPhase, setGlowPhase] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      setGlowPhase((Math.sin(elapsed * Math.PI) + 1) / 2);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const oceanPointsData = useMemo(() => {
    const orgTotals = {};
    companyDonations.forEach(d => {
      if (OCEAN_ORGS[d.orgName]) {
        orgTotals[d.orgName] = (orgTotals[d.orgName] || 0) + d.allocatedAmount;
      }
    });
    return Object.entries(orgTotals).map(([name, total]) => {
      const loc = OCEAN_ORGS[name];
      return { lat: loc.lat, lng: loc.lng, name, total, label: loc.label, color: "rgba(14,165,233,0.85)" };
    });
  }, [companyDonations]);

  const allDestinations = useMemo(() => {
    const maxAll = Math.max(maxDonation, ...oceanPointsData.map(d => d.total), 1);
    const countryDests = Object.entries(countryData).map(([code, data]) => {
      const c = COUNTRY_CENTROIDS[code];
      if (!c) return null;
      const lightColor = LIGHT_COLORS[code] || "#fbbf24";
      const isUser = Object.keys(data.orgs).some(org => userOrgNames.has(org));
      return { lat: c.lat, lng: c.lng, name: COUNTRY_NAMES[code] || code, code, total: data.total, orgs: data.orgs, isOcean: false, color: lightColor, isUser };
    }).filter(Boolean);
    const oceanDests = oceanPointsData.map(d => ({
      ...d, isOcean: true, orgs: { [d.name]: d.total }, maxRadius: OCEAN_RING_RADIUS[d.name] || 8, color: LIGHT_COLORS[d.name] || "#22d3ee", isUser: userOrgNames.has(d.name)
    }));
    return [...countryDests, ...oceanDests];
  }, [countryData, oceanPointsData, maxDonation, userOrgNames]);

  const arcsData = useMemo(() => allDestinations.map(d => ({
    startLat: SF.lat, startLng: SF.lng, endLat: d.lat, endLng: d.lng, name: d.name, total: d.total, orgs: d.orgs, isOcean: d.isOcean, color: d.isUser ? d.color : "rgba(255,255,255,0.5)", code: d.code, isUser: d.isUser
  })), [allDestinations]);

  // Rings only for ocean orgs (land countries use polygon glow)
  const oceanRingsData = useMemo(() => allDestinations.filter(d => d.isOcean), [allDestinations]);

  useEffect(() => {
    fetch("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
      .then(res => res.json())
      .then(data => { setCountries(topojson.feature(data, data.objects.countries).features); setGlobeReady(true); })
      .catch(() => setFetchError(true));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!globeRef.current || !globeReady) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = true; controls.autoRotateSpeed = 0.4;
    controls.enableZoom = true; controls.minDistance = 150; controls.maxDistance = 500;
    let timeout;
    const pause = () => { controls.autoRotate = false; clearTimeout(timeout); timeout = setTimeout(() => { controls.autoRotate = true; }, 3000); };
    controls.addEventListener("start", pause);
    return () => { controls.removeEventListener("start", pause); clearTimeout(timeout); };
  }, [globeReady]);

  const pauseRef = useRef(null);
  const focusPoint = (lat, lng, data) => {
    if (!globeRef.current) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = false;
    clearTimeout(pauseRef.current);
    globeRef.current.pointOfView({ lat, lng, altitude: 1.8 }, 800);
    if (data) setSelectedPoint(data);
    pauseRef.current = setTimeout(() => { controls.autoRotate = true; }, 10000);
  };

  const getAlpha3 = (feat) => ISO_NUM_TO_ALPHA3[String(feat.id)] || null;

  return (
    <div style={{ animation: "fadeSlideUp .4s ease" }}>
      <div style={{ ...glass, padding: m ? "20px 16px" : "32px 40px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 22, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 600, color: C.text, margin: 0 }}>Global Impact</h3>
          <p style={{ fontSize: 15, color: C.textSoft, fontWeight: 400, marginTop: 5 }}>
            Your donations reach {countryCount} {countryCount === 1 ? "country" : "countries"}{oceanPointsData.length > 0 ? " and the world's oceans" : ""}
          </p>
        </div>
      </div>

      <div ref={containerRef} style={{ background: "#1a3a3a", borderRadius: 8, overflow: "hidden", position: "relative", minHeight: Math.round(containerWidth * 0.7) }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(61,122,106,0.10) 0%, rgba(61,122,106,0.05) 40%, transparent 70%)", pointerEvents: "none", zIndex: 1 }} />
        {!globeReady && !fetchError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, zIndex: 5 }}>
            <div style={{ width: 28, height: 28, border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(255,255,255,0.6)", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)" }}>Loading globe...</p>
          </div>
        )}
        {fetchError && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>Unable to load map data. Please refresh to try again.</p>
          </div>
        )}
        {globeReady && (
          <Globe ref={globeRef} width={containerWidth} height={Math.round(containerWidth * 0.7)} backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            showAtmosphere={true} atmosphereColor="rgba(0,200,200,0.25)" atmosphereAltitude={0.18} animateIn={false}
            polygonsData={countries}
            polygonAltitude={() => 0.002}
            polygonCapColor={d => {
              const code = getAlpha3(d);
              if (code && donatedCountries.has(code)) {
                const hex = LIGHT_COLORS[code] || "#fbbf24";
                const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
                const alpha = 0.05 + 0.18 * glowPhase;
                return `rgba(${r},${g},${b},${alpha})`;
              }
              return "rgba(0,180,180,0.04)";
            }}
            polygonSideColor={() => "rgba(0,0,0,0)"}
            polygonStrokeColor={() => "rgba(0,220,210,0.2)"}
            polygonLabel={d => {
              const name = d.properties.name || "Unknown";
              return `<div style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(139,119,90,0.15);border-radius:6px;padding:8px 14px;box-shadow:0 4px 12px rgba(0,0,0,0.1);font-family:'Montserrat',sans-serif;"><div style="font-size:14px;color:#2C2416;font-weight:500;">${name}</div></div>`;
            }}
            onPolygonClick={d => { const code = getAlpha3(d); const c = code && COUNTRY_CENTROIDS[code]; const data = code && countryData[code]; if (c) focusPoint(c.lat, c.lng, data ? { name: d.properties.name || code, orgs: data.orgs, total: data.total, color: LIGHT_COLORS[code] || "#fbbf24", isOcean: false } : null); }}
            onPolygonHover={() => {}} polygonsTransitionDuration={100}
            arcsData={showData ? arcsData : []}
            arcStartLat={d => d.startLat}
            arcStartLng={d => d.startLng}
            arcEndLat={d => d.endLat}
            arcEndLng={d => d.endLng}
            arcColor={d => d.isUser ? [`rgba(255,255,255,0.9)`, `${d.color}`] : [`rgba(255,255,255,0.15)`, `rgba(255,255,255,0.3)`]}
            arcStroke={d => d.isUser ? 0.9 : 0.4}
            arcDashLength={0.8}
            arcDashGap={2}
            arcDashInitialGap={() => 0}
            arcDashAnimateTime={1200}
            arcAltitudeAutoScale={0.4}
            onArcClick={d => focusPoint(d.endLat, d.endLng, { name: d.name, orgs: d.orgs, total: d.total, color: d.color, isOcean: d.isOcean })}
            arcLabel={d => `<div style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(139,119,90,0.15);border-radius:6px;padding:8px 14px;box-shadow:0 4px 12px rgba(0,0,0,0.1);font-family:'Montserrat',sans-serif;"><div style="font-size:14px;color:#2C2416;font-weight:500;">${d.name}</div></div>`}
            ringsData={showData ? oceanRingsData : []}
            ringLat={d => d.lat}
            ringLng={d => d.lng}
            ringAltitude={0.005}
            ringColor={d => {
              const hex = d.color;
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
              return t => `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},${Math.pow(1 - t, 0.5)})`;
            }}
            ringMaxRadius={d => d.maxRadius}
            ringPropagationSpeed={0.8}
            ringRepeatPeriod={2000}
            pointsData={showData ? allDestinations : []}
            pointLat={d => d.lat}
            pointLng={d => d.lng}
            pointAltitude={0.008}
            pointRadius={0.35}
            pointColor={d => d.color}
            onPointClick={d => focusPoint(d.lat, d.lng, { name: d.name, orgs: d.orgs, total: d.total, color: d.color, isOcean: d.isOcean })}
            onRingClick={d => focusPoint(d.lat, d.lng, { name: d.name, orgs: d.orgs, total: d.total, color: d.color, isOcean: d.isOcean })}
          />
        )}
        {selectedPoint && (() => {
          const topOrg = Object.entries(selectedPoint.orgs).sort((a, b) => b[1] - a[1])[0]?.[0];
          const topOrgImg = topOrg ? ORG_IMAGES[topOrg] : null;
          const topOrgPos = topOrg ? (ORG_IMAGE_POS[topOrg] || "center center") : "center center";
          return (
          <div style={{ position: "absolute", top: m ? 10 : 20, right: m ? 10 : 20, left: m ? 10 : "auto", zIndex: 10, background: C.card, border: "1px solid rgba(139,119,90,0.10)", borderRadius: 8, overflow: "hidden", minWidth: 240, maxWidth: m ? "calc(100vw - 40px)" : 320, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", fontFamily: "'Montserrat',sans-serif", animation: "scaleIn .25s cubic-bezier(.34,1.56,.64,1)" }}>
            {topOrgImg ? (
              <div style={{ width: "100%", height: 160, overflow: "hidden", position: "relative" }}>
                <img src={topOrgImg} alt={topOrg} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: topOrgPos, display: "block" }} />
              </div>
            ) : topOrg && (
              <div style={{ width: "100%", height: 160, overflow: "hidden", position: "relative", background: `linear-gradient(135deg, ${getOrgColor(topOrg)}44, ${getOrgColor(topOrg)}88)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 48, fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: "'Playfair Display',Georgia,serif" }}>
                  {topOrg.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: selectedPoint.color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, marginBottom: 4 }}>{selectedPoint.isOcean ? "Ocean Conservation" : "Country"}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#2C2416", fontFamily: "'Playfair Display',Georgia,serif" }}>{selectedPoint.name}</div>
              </div>
              <button onClick={() => setSelectedPoint(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", fontSize: 18, color: "#8A8D85", lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              {Object.entries(selectedPoint.orgs).sort((a, b) => b[1] - a[1]).map(([org, amt]) => (
                <div key={org} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "7px 0", borderBottom: "1px solid rgba(139,119,90,0.10)" }}>
                  <span style={{ fontSize: 14, color: "#555850" }}>{org}</span>
                  <span style={{ fontSize: 14, color: "#2C2416", fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(amt)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(139,119,90,0.12)" }}>
              <span style={{ fontSize: 12, color: "#8A8D85", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 500 }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: selectedPoint.color }}>{fmt(selectedPoint.total)}</span>
            </div>
            </div>
          </div>
          );
        })()}
      </div>

      {(countryCount > 0 || oceanPointsData.length > 0) && (
        <div style={{ ...glass, marginTop: 18, overflow: "hidden", animation: "fadeSlideUp .4s ease .1s both" }}>
          <div style={{ padding: "20px 28px 14px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>Donations by region</h3>
          </div>
          {Object.entries(countryData).sort((a, b) => b[1].total - a[1].total).map(([code, data], i) => (
            <div key={code} style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.divider}`, animation: `fadeSlideUp .4s ease ${i*.04}s both`, transition: "background .15s", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = C.accentSoft}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: LIGHT_COLORS[code] || "#fbbf24", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{COUNTRY_NAMES[code] || code}</div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{Object.keys(data.orgs).join(", ")}</div>
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{fmt(data.total)}</div>
            </div>
          ))}
          {oceanPointsData.length > 0 && (
            <>
              <div style={{ padding: "14px 28px 8px", borderTop: `1px solid ${C.divider}` }}>
                <span style={{ fontSize: 12, color: "#0ea5e9", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>Ocean Conservation</span>
              </div>
              {oceanPointsData.map((pt, i) => (
                <div key={pt.name} style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.divider}`, animation: `fadeSlideUp .4s ease ${(Object.keys(countryData).length + i)*.04}s both`, transition: "background .15s", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(14,165,233,0.04)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: LIGHT_COLORS[pt.name] || "#22d3ee", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{pt.name}</div>
                      <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>{pt.label}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{fmt(pt.total)}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [error, setError] = useState("");
  const m = useIsMobile();
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client"; script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          try { const payload = JSON.parse(atob(response.credential.split(".")[1])); onLogin({ email: payload.email, name: payload.name, picture: payload.picture }); }
          catch { setError("Login failed. Please try again."); }
        }, auto_select: false,
      });
      window.google.accounts.id.renderButton(document.getElementById("google-signin-btn"), { theme: "outline", size: "large", width: 300, text: "signin_with", shape: "pill" });
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <div style={{ width: m ? "calc(100vw - 32px)" : 420, maxWidth: 420, textAlign: "center", animation: "fadeSlideUp .6s ease" }}>
        <h1 style={{ fontSize: m ? 28 : 44, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, color: C.text, margin: "0 0 12px", letterSpacing: "-0.03em" }}>GiveTrack</h1>
        <p style={{ color: C.textMuted, fontSize: 16, margin: m ? "0 0 28px" : "0 0 48px", fontWeight: 400, lineHeight: 1.6 }}>Track the impact of your generosity</p>

        <div style={{ background: C.card, borderRadius: 6, padding: m ? "28px 20px" : "48px 48px", border: `1px solid ${C.cardBorder}` }}>
          <p style={{ color: C.textSoft, fontSize: 15, marginBottom: 36, fontWeight: 400, lineHeight: 1.7 }}>Sign in with your company Google account to view your charitable giving.</p>
          <div id="google-signin-btn" style={{ display: "flex", justifyContent: "center" }}></div>
          {error && <div style={{ color: "#dc2626", fontSize: 15, marginTop: 18, fontWeight: 500 }}>{error}</div>}
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
  const [isUserAdmin, setIsUserAdmin] = useState(0);
  const [sheetData, setSheetData] = useState(null);
  const userRef = useRef(null);

  // Seed localStorage on first load
  useEffect(() => { seedFromDemoData(); ensureCyclesUpToDate(); }, []);

  // Google Sheets polling for live updates
  useEffect(() => {
    // Initial fetch
    fetchFromSheet().then(data => { if (data) setSheetData(data); });

    // Poll every 30s
    const interval = setInterval(async () => {
      const data = await fetchFromSheet();
      if (data) {
        setSheetData(data);
        // If user is logged in, refresh their donations + admin status from sheet data
        if (userRef.current) {
          const sheetDons = loadDonations();
          if (sheetDons) {
            setDonations(sheetDons.filter(d => d.email === userRef.current.email.toLowerCase()));
          }
          setIsUserAdmin(checkIsAdmin(userRef.current.email));
        }
      }
    }, 30000);

    // Also refresh on tab focus
    const onFocus = async () => {
      const data = await fetchFromSheet();
      if (data) {
        setSheetData(data);
        if (userRef.current) {
          const sheetDons = loadDonations();
          if (sheetDons) {
            setDonations(sheetDons.filter(d => d.email === userRef.current.email.toLowerCase()));
          }
          setIsUserAdmin(checkIsAdmin(userRef.current.email));
        }
      }
    };
    window.addEventListener("focus", onFocus);

    return () => { clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, []);

  const handleLogin = async (googleUser) => {
    setUser(googleUser); setLoading(true); setDataError("");
    userRef.current = googleUser;
    setIsUserAdmin(checkIsAdmin(googleUser.email));
    try {
      // Try sheet donations first, fall back to DEMO_DATA
      const sheetDons = loadDonations();
      if (sheetDons) {
        setDonations(sheetDons.filter(d => d.email === googleUser.email.toLowerCase()));
      } else if (USE_DEMO_DATA) { setDonations(DEMO_DATA[googleUser.email] || []); }
      else {
        const res = await fetch("/api/sharepoint");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setDonations(parseSpreadsheetData(data.values || [], googleUser.email));
      }
    } catch { setDataError("Unable to load donation data."); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    setUser(null); setDonations([]); setActiveTab("overview");
    userRef.current = null;
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  };

  return (
    <>
      <link href={FONTS_URL} rel="stylesheet" />
      <style>{GLOBAL_CSS}</style>
      {!user ? <LoginScreen onLogin={handleLogin} /> :
       loading ? (
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <div style={{ width: 36, height: 36, border: `2px solid ${C.divider}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          <p style={{ color: C.textSoft, fontSize: 15, fontWeight: 500 }}>Loading your data...</p>
        </div>
       ) : <Dashboard user={user} donations={donations} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} dataError={dataError} isUserAdmin={isUserAdmin} sheetData={sheetData} />}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────

// ─── TEAM ORG CARD (component so it can use hooks) ───────────
function TeamOrgCard({ orgName, isExpanded, onToggle, fetchedImages, fetchedDescs, allOrgUrls, imgErrors, setImgErrors, m }) {
  const img = ORG_IMAGES[orgName] || fetchedImages[orgName];
  const fallbackImg = CATEGORY_FALLBACK_IMAGES[ORG_CATEGORIES[orgName]] || CATEGORY_FALLBACK_IMAGES._default;
  const displayImg = img && !imgErrors[orgName] ? img : fallbackImg;
  const desc = ORG_DESCRIPTIONS[orgName] || fetchedDescs[orgName] || "";
  const longDesc = ORG_LONG_DESCRIPTIONS[orgName] || desc;
  const website = ORG_WEBSITES[orgName] || allOrgUrls[orgName];
  const color = getOrgColor(orgName);
  const categoryName = ORG_CATEGORIES[orgName];
  // Face detection: use manual position if defined, otherwise auto-detect faces
  const thumbPos = useFacePosition(displayImg, ORG_IMAGE_POS[orgName]);
  const squarePos = useFacePosition(displayImg, ORG_IMAGE_POS[orgName]);
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${isExpanded ? "rgba(61,122,106,0.25)" : C.divider}`, transition: "all .3s ease", background: isExpanded ? C.card : "rgba(255,253,248,0.4)", cursor: "pointer", overflow: "hidden", boxShadow: isExpanded ? "0 8px 32px rgba(120,100,70,0.15)" : "none" }}
      onClick={onToggle}
      onMouseEnter={e => { if (!isExpanded) { e.currentTarget.style.borderColor = "rgba(139,119,90,0.3)"; e.currentTarget.style.background = C.accentSoft; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(120,100,70,0.22), 0 2px 6px rgba(120,100,70,0.12)"; }}}
      onMouseLeave={e => { if (!isExpanded) { e.currentTarget.style.borderColor = C.divider; e.currentTarget.style.background = "rgba(255,255,255,0.4)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}}>
      <div style={{ display: "flex", gap: 14, padding: "16px 18px", alignItems: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
          <img src={displayImg} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: thumbPos, opacity: 0, transition: "opacity .3s ease" }}
            onLoad={e => { e.target.style.opacity = "1"; }}
            onError={(e) => { e.target.style.display = "none"; setImgErrors(prev => ({ ...prev, [orgName]: true })); }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{orgName}</div>
          {!isExpanded && <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5 }}>{desc}</div>}
          {isExpanded && categoryName && <div style={{ fontSize: 11, fontWeight: 600, color: C.navy, textTransform: "uppercase", letterSpacing: ".08em" }}>{categoryName}</div>}
        </div>
        <div style={{ flexShrink: 0, alignSelf: "center", color: C.textMuted, opacity: 0.4, transition: "transform .25s", transform: isExpanded ? "rotate(90deg)" : "none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
      {isExpanded && (
        <div style={{ animation: "fadeSlideUp .25s ease" }} onClick={e => e.stopPropagation()}>
          <div style={{ width: "100%", paddingBottom: "100%", position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
            <img src={displayImg} alt={orgName} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: squarePos, display: "block", opacity: 0, transition: "opacity .5s ease" }}
              onLoad={e => { e.target.style.opacity = "1"; }} />
          </div>
          <div style={{ padding: m ? "18px 18px 20px" : "20px 22px 22px" }}>
            <p style={{ fontSize: 14, color: C.textSoft, lineHeight: 1.75, margin: "0 0 16px" }}>{longDesc}</p>
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", background: C.navy, color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "all .2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#005a66"; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.navy; }}>
                Visit {orgName.length > 25 ? "Website" : orgName}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ user, donations, activeTab, setActiveTab, onLogout, dataError, isUserAdmin, sheetData }) {
  const [expandedOrgs, setExpandedOrgs] = useState(new Set());
  const [imgErrors, setImgErrors] = useState({});
  const [fetchedImages, setFetchedImages] = useState({});
  const [fetchedDescs, setFetchedDescs] = useState({});
  const [selectedTeamOrg, setSelectedTeamOrg] = useState(null);
  const [barOffset, setBarOffset] = useState(-1); // -1 = "most recent 5"
  const [allocTimeframe, setAllocTimeframe] = useState("all");
  const [monthPage, setMonthPage] = useState(1);
  const m = useIsMobile();

  const totalDonated = donations.reduce((s, d) => s + d.allocatedAmount, 0);
  const primaryCurrency = donations[0]?.currency || "$";
  const orgTotals = {}, orgUrls = {};
  donations.forEach(d => {
    orgTotals[d.orgName] = (orgTotals[d.orgName] || 0) + d.allocatedAmount;
    if (d.paidTo?.startsWith("http")) orgUrls[d.orgName] = d.paidTo;
  });

  // Collect ALL org URLs across entire team (not just current user)
  const allOrgUrls = useMemo(() => {
    const urls = { ...orgUrls };
    Object.values(DEMO_DATA).forEach(dons => {
      dons.forEach(d => { if (d.paidTo?.startsWith("http") && !urls[d.orgName]) urls[d.orgName] = d.paidTo; });
    });
    // Also check ORG_WEBSITES for anything missing
    Object.entries(ORG_WEBSITES).forEach(([name, url]) => { if (!urls[name]) urls[name] = url; });
    return urls;
  }, []);

  // Auto-fetch og:image + description for orgs not in hardcoded maps
  useEffect(() => {
    const orgsNeedingFetch = Object.keys(allOrgUrls).filter(
      name => (!ORG_IMAGES[name] && !fetchedImages[name]) || (!ORG_DESCRIPTIONS[name] && !fetchedDescs[name])
    );
    orgsNeedingFetch.forEach(name => {
      const url = allOrgUrls[name];
      if (!url) return;
      fetch(`/api/og-image?url=${encodeURIComponent(url)}`)
        .then(r => r.json())
        .then(data => {
          if (!ORG_IMAGES[name]) {
            var bestImg = data.banner || data.image;
            if (bestImg) setFetchedImages(prev => ({ ...prev, [name]: bestImg }));
          }
          if (data.description && !ORG_DESCRIPTIONS[name]) {
            setFetchedDescs(prev => ({ ...prev, [name]: data.description }));
          }
        })
        .catch(() => {});
    });
  }, [Object.keys(allOrgUrls).join(",")]);
  const orgCount = Object.keys(orgTotals).length;
  const months = sortMonths([...new Set(donations.map(d => d.month).filter(Boolean))]);
  const cycles = [...new Set(donations.map(d => d.cycle).filter(Boolean))];
  const monthlyData = months.map(m => {
    const md = donations.filter(d => d.month === m);
    const total = md.reduce((s, d) => s + d.allocatedAmount, 0);
    const og = {}; md.forEach(d => { og[d.orgName] = (og[d.orgName] || 0) + d.allocatedAmount; });
    return { label: m.replace(" 20", "'"), total, segments: Object.entries(og).map(([n, v]) => ({ value: v, color: getOrgColor(n) })) };
  });
  // Bar chart: max 5 bars, default to most recent
  const MAX_BARS = 5;
  const displayMonthlyData = monthlyData.length <= MAX_BARS
    ? monthlyData
    : barOffset < 0
      ? monthlyData.slice(-MAX_BARS)
      : monthlyData.slice(barOffset, barOffset + MAX_BARS);
  const canBarPrev = monthlyData.length > MAX_BARS && (barOffset < 0 ? monthlyData.length - MAX_BARS > 0 : barOffset > 0);
  const canBarNext = monthlyData.length > MAX_BARS && barOffset >= 0 && barOffset + MAX_BARS < monthlyData.length;

  // Allocation breakdown: filter by timeframe
  const filteredDonations = useMemo(() => {
    if (allocTimeframe === "all") return donations;
    const now = new Date();
    const cutoff = new Date(now);
    if (allocTimeframe === "6m") cutoff.setMonth(now.getMonth() - 6);
    else if (allocTimeframe === "1y") cutoff.setFullYear(now.getFullYear() - 1);
    else if (allocTimeframe === "3y") cutoff.setFullYear(now.getFullYear() - 3);
    return donations.filter(d => {
      const parts = d.month?.split(" ");
      if (!parts || parts.length < 2) return true;
      const monthDate = new Date(`${parts[0]} 1, ${parts[1]}`);
      return monthDate >= cutoff;
    });
  }, [donations, allocTimeframe]);
  const filteredOrgTotals = {};
  filteredDonations.forEach(d => { filteredOrgTotals[d.orgName] = (filteredOrgTotals[d.orgName] || 0) + d.allocatedAmount; });
  const filteredDonutData = Object.entries(filteredOrgTotals).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ label: n, value: v, color: getOrgColor(n) }));
  const filteredTotal = filteredDonations.reduce((s, d) => s + d.allocatedAmount, 0);

  const donutData = Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ label: n, value: v, color: getOrgColor(n) }));
  const avgCycle = cycles.length > 0 ? totalDonated / cycles.length : 0;
  const countriesReached = [...new Set(donations.map(d => ORG_COUNTRY_MAP[d.orgName]).filter(Boolean))].length;
  const categoryTotals = {};
  donations.forEach(d => { const cat = ORG_CATEGORIES[d.orgName] || "Other"; categoryTotals[cat] = (categoryTotals[cat] || 0) + d.allocatedAmount; });
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const categoryCount = Object.keys(categoryTotals).length;

  // Upcoming deadline data
  const allCycles = loadCycles();
  const now = new Date();
  const upcomingCycle = allCycles.cycles?.find(c => new Date(c.payDate + "T00:00:00") >= now) || allCycles.cycles?.find(c => c.cycleId === allCycles.currentCycleId);
  const daysUntilDeadline = upcomingCycle ? Math.max(0, Math.ceil((new Date(upcomingCycle.deadline + "T00:00:00") - now) / 86400000)) : null;
  const userSubs = loadSubmissions();
  const hasSubmitted = upcomingCycle && userSubs[upcomingCycle.cycleId]?.[user.email]?.submittedAt;

  // Impact quotes — rotate through user's orgs
  const userOrgNames = Object.keys(orgTotals);
  const [quoteIdx, setQuoteIdx] = useState(0);
  useEffect(() => {
    if (userOrgNames.length <= 1) return;
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % userOrgNames.length), 8000);
    return () => clearInterval(t);
  }, [userOrgNames.length]);
  const spotlightOrg = userOrgNames[quoteIdx % userOrgNames.length];
  const spotlightDesc = ORG_LONG_DESCRIPTIONS[spotlightOrg] || ORG_DESCRIPTIONS[spotlightOrg] || "";
  const spotlightImg = ORG_IMAGES[spotlightOrg] || fetchedImages[spotlightOrg];
  const spotlightFallbackImg = CATEGORY_FALLBACK_IMAGES[ORG_CATEGORIES[spotlightOrg]] || CATEGORY_FALLBACK_IMAGES._default;
  const spotlightDisplayImg = spotlightImg && !imgErrors[spotlightOrg] ? spotlightImg : spotlightFallbackImg;
  const spotlightImgPos = useFacePosition(spotlightDisplayImg, ORG_IMAGE_POS[spotlightOrg]);

  const monthBreakdowns = months.map((m) => {
    const md = donations.filter(d => d.month === m);
    const total = md.reduce((s, d) => s + d.allocatedAmount, 0);
    const orgBreakdown = {};
    md.forEach(d => { orgBreakdown[d.orgName] = (orgBreakdown[d.orgName] || 0) + d.allocatedAmount; });
    const mDonut = Object.entries(orgBreakdown).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ label: name, value, color: getOrgColor(name) }));
    return { month: m, total, donutData: mDonut, donationCount: md.length };
  });

  // Team data — aggregate totals only (no individual breakdowns for privacy)
  // Uses shared sheet donations if available, otherwise falls back to DEMO_DATA
  const teamData = useMemo(() => {
    let teamTotal = 0;
    const teamOrgs = new Set();
    const sheetDons = loadDonations();
    let memberCount, allDons;
    if (sheetDons && sheetDons.length > 0) {
      memberCount = new Set(sheetDons.map(d => d.email)).size;
      allDons = sheetDons;
    } else {
      memberCount = Object.keys(DEMO_DATA).length;
      allDons = Object.values(DEMO_DATA).flat();
    }
    allDons.forEach(d => {
      teamTotal += d.allocatedAmount;
      teamOrgs.add(d.orgName);
    });
    // Deduplicate variant org names (MSF variants → Doctors Without Borders)
    const deduped = new Set();
    teamOrgs.forEach(name => {
      if (name === "Médecins Sans Frontières" || name === "Médecins sans Frontières") deduped.add("Doctors Without Borders");
      else deduped.add(name);
    });
    // Group orgs by category
    const orgsByCategory = {};
    deduped.forEach(name => {
      const cat = ORG_CATEGORIES[name] || "Other";
      if (!orgsByCategory[cat]) orgsByCategory[cat] = [];
      orgsByCategory[cat].push(name);
    });
    // Sort categories by number of orgs (descending), then alphabetically
    const sortedCategories = Object.entries(orgsByCategory).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    return { teamTotal, memberCount, orgCount: deduped.size, orgsByCategory: sortedCategories };
  }, [sheetData]);

  const tabs = [
    { id: "overview", label: "Overview", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg> },
    { id: "breakdown", label: "Organizations", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
    { id: "allocation", label: "Monthly", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { id: "donate", label: "Donate", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
    { id: "team", label: "Team", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: "impact", label: "Impact", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
    ...(isUserAdmin > 0 ? [{ id: "admin", label: "Admin", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, position: "relative" }}>
      {/* Paper grain texture */}
      <div style={{ position: "fixed", inset: 0, opacity: 0.03, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "200px 200px", pointerEvents: "none", zIndex: 0 }} />
      {/* Header */}
      <header style={{ padding: m ? "12px 16px" : "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.divider}`, background: C.bg, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, color: C.text, letterSpacing: "0.01em" }}>GiveTrack</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {!m && <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{user.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{user.email}</div>
          </div>}
          {user.picture && <img src={user.picture} alt="" style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.divider}` }} />}
          <button onClick={onLogout} style={{ padding: "7px 16px", background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 4, color: C.textSoft, fontSize: 13, cursor: "pointer", transition: "all .15s", fontWeight: 500 }}
            onMouseEnter={e => { e.target.style.background = C.text; e.target.style.color = "#fff"; e.target.style.borderColor = C.text; }}
            onMouseLeave={e => { e.target.style.borderColor = C.cardBorder; e.target.style.color = C.textSoft; e.target.style.background = "transparent"; }}>Sign out</button>
        </div>
      </header>

      {/* STICKY TAB BAR — full width, below header */}
      {(
        <nav style={{ position: "sticky", top: m ? 53 : 67, zIndex: 99, background: C.bg, borderBottom: `1px solid ${C.divider}`, boxShadow: "0 1px 3px rgba(139,119,90,0.08)" }}>
          <div className="hide-scrollbar" style={{ maxWidth: 1100, margin: "0 auto", padding: m ? "0 8px" : "0 32px", display: "flex", gap: 0, overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
                padding: m ? "12px 12px" : "14px 28px", background: "transparent", border: "none",
                borderBottom: activeTab === t.id ? `2px solid ${C.accent}` : "2px solid transparent",
                color: activeTab === t.id ? C.text : C.textMuted, fontSize: m ? 11 : 13, fontWeight: activeTab === t.id ? 600 : 400,
                cursor: "pointer", transition: "all .2s", marginBottom: -1, display: "flex", alignItems: "center", gap: m ? 4 : 8, whiteSpace: "nowrap",
                letterSpacing: ".06em", textTransform: "uppercase",
              }}
                onMouseEnter={e => { if (activeTab !== t.id) e.target.style.color = C.textSoft; }}
                onMouseLeave={e => { if (activeTab !== t.id) e.target.style.color = C.textMuted; }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        </nav>
      )}

      {donations.length > 0 && activeTab === "overview" && (<>
        {/* FULL-BLEED HERO */}
        <div style={{ position: "relative", height: m ? 380 : 620, overflow: "hidden", animation: "fadeSlideUp .5s ease" }}>
          <img src={HERO_IMAGE} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%", display: "block", filter: "saturate(1.1) contrast(1.08) brightness(1.02)" }}
            onError={e => { e.target.style.display = "none"; }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(80,55,25,0.20) 0%, rgba(60,40,20,0.15) 50%, rgba(80,55,25,0.18) 100%)", mixBlendMode: "multiply" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(245,240,230,0.08)", mixBlendMode: "screen" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.09, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px 128px", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: m ? "32px 20px" : "56px 64px" }}>
            <div style={{ fontSize: 14, color: "rgba(255,248,230,0.7)", textTransform: "uppercase", letterSpacing: ".15em", fontWeight: 600, marginBottom: 14 }}>Total Donated</div>
            <div style={{ fontSize: m ? 40 : 88, fontWeight: 900, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 3px 6px rgba(40,25,10,0.7), 0 6px 20px rgba(40,25,10,0.4), 0 12px 40px rgba(40,25,10,0.25)" }}>
              <AnimatedNumber value={totalDonated} currency={primaryCurrency} />
            </div>
            <div style={{ fontSize: m ? 14 : 18, color: "rgba(255,255,255,0.8)", marginTop: 18, fontWeight: 500, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
              Welcome back, {user.name.split(" ")[0]} — across {cycles.length} payroll cycles
            </div>
          </div>
        </div>

        {/* FULL-BLEED DARK STAT STRIP */}
        <div style={{ background: C.text, padding: m ? "24px 16px" : "44px 64px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: m ? "wrap" : "nowrap", gap: m ? 16 : 0 }}>
          {[
            { label: "Per cycle", value: avgCycle },
            { label: "Organizations", value: orgCount, isCount: true },
            { label: "Countries reached", value: countriesReached, isCount: true },
            { label: "Months active", value: months.length, isCount: true },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: "center", flex: m ? "1 1 45%" : 1, padding: "16px 12px", borderRadius: 8, transition: "all .25s ease", cursor: "default" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.background = "rgba(70,55,35,0.6)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(30,20,10,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ fontSize: m ? 11 : 14, color: "rgba(255,248,230,0.45)", textTransform: "uppercase", letterSpacing: ".18em", fontWeight: 500, marginBottom: 12 }}>{stat.label}</div>
              <div style={{ fontSize: m ? 26 : 42, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.02em" }}>
                <AnimatedNumber value={stat.value} currency={stat.isCount ? null : primaryCurrency} isCount={!!stat.isCount} />
              </div>
            </div>
          ))}
        </div>
      </>)}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: donations.length > 0 && activeTab === "overview" ? (m ? "32px 12px 60px" : "72px 32px 100px") : (m ? "24px 12px 60px" : "48px 32px 100px") }}>
        {dataError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "16px 20px", marginBottom: 28, color: "#dc2626", fontSize: 15, fontWeight: 500 }}>{dataError}</div>}

        {donations.length === 0 && !dataError && (activeTab === "overview" || activeTab === "breakdown" || activeTab === "allocation") ? (
          <div style={{ ...glass, padding: "80px 36px", textAlign: "center", animation: "fadeSlideUp .4s ease" }}>
            <h3 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 12, fontFamily: "'Playfair Display',Georgia,serif" }}>No donations yet</h3>
            <p style={{ color: C.textSoft, fontSize: 16, maxWidth: 400, margin: "0 auto", lineHeight: 1.7 }}>You haven't made any donations yet. Head to the <strong style={{ cursor: "pointer", color: C.navy }} onClick={() => setActiveTab("donate")}>Donate</strong> tab to get started, or check out the <strong style={{ cursor: "pointer", color: C.navy }} onClick={() => setActiveTab("team")}>Team</strong> tab to see what your colleagues support.</p>
          </div>
        ) : null}
        {(donations.length > 0 || activeTab === "team" || activeTab === "impact" || activeTab === "donate" || activeTab === "admin") && (<>
          {/* ═══════════════ OVERVIEW ═══════════════ */}
          {activeTab === "overview" && (<>
            {/* Upcoming deadline banner */}
            {upcomingCycle && daysUntilDeadline !== null && (
              <div style={{ ...glass, padding: m ? "16px 16px" : "18px 32px", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, borderLeft: `4px solid ${hasSubmitted ? "#16a34a" : daysUntilDeadline <= 3 ? C.warm : C.accent}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hasSubmitted ? "#16a34a" : daysUntilDeadline <= 3 ? C.warm : C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{upcomingCycle.label}</div>
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
                      {daysUntilDeadline === 0 ? "Due today" : daysUntilDeadline === 1 ? "Due tomorrow" : `${daysUntilDeadline} days remaining`}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {hasSubmitted ? (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#16a34a", display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Submitted
                    </span>
                  ) : (
                    <button onClick={() => setActiveTab("donate")} style={{ padding: "8px 20px", background: daysUntilDeadline <= 3 ? C.warm : C.accent, color: daysUntilDeadline <= 3 ? "#fff" : C.text, border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      Submit Allocations
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Section heading */}
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 28, fontWeight: 500, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", margin: 0 }}>Your Giving</h2>
              <p style={{ fontSize: 15, color: C.textMuted, marginTop: 8 }}>A breakdown of where your contributions go</p>
            </div>

            {/* Charts — asymmetric layout */}
            <ScrollReveal>
            <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : (months.length > 1 ? "58fr 42fr" : "1fr"), gap: 32, marginBottom: 64 }}>
              {months.length > 1 && (
                <div style={{ ...glass, padding: m ? "24px 16px" : "36px 40px", animation: "fadeSlideUp .4s ease .15s both", transition: "box-shadow .3s" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(120,100,70,0.22)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = C.cardShadow; }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 32px" }}>
                    <h3 style={{ fontSize: 22, fontWeight: 500, color: C.text, margin: 0, fontFamily: "'Playfair Display',Georgia,serif" }}>Monthly overview</h3>
                    {monthlyData.length > MAX_BARS && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={() => setBarOffset(prev => prev < 0 ? Math.max(0, monthlyData.length - MAX_BARS - 1) : Math.max(0, prev - 1))} disabled={!canBarPrev}
                          style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${C.cardBorder}`, background: "transparent", cursor: canBarPrev ? "pointer" : "default", opacity: canBarPrev ? 1 : 0.3, display: "flex", alignItems: "center", justifyContent: "center", color: C.textSoft }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                        </button>
                        <span style={{ fontSize: 12, color: C.textMuted, minWidth: 80, textAlign: "center" }}>
                          {displayMonthlyData[0]?.label} – {displayMonthlyData[displayMonthlyData.length - 1]?.label}
                        </span>
                        <button onClick={() => setBarOffset(prev => prev < 0 ? -1 : Math.min(monthlyData.length - MAX_BARS, prev + 1))} disabled={!canBarNext}
                          style={{ width: 28, height: 28, borderRadius: 4, border: `1px solid ${C.cardBorder}`, background: "transparent", cursor: canBarNext ? "pointer" : "default", opacity: canBarNext ? 1 : 0.3, display: "flex", alignItems: "center", justifyContent: "center", color: C.textSoft }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        {barOffset >= 0 && (
                          <button onClick={() => setBarOffset(-1)} style={{ fontSize: 11, color: C.accent, background: "none", border: "none", cursor: "pointer", fontWeight: 600, marginLeft: 4 }}>Latest</button>
                        )}
                      </div>
                    )}
                  </div>
                  <BarChart data={displayMonthlyData} />
                  <div style={{ display: "grid", gridTemplateColumns: m ? "1fr 1fr" : "1fr 1fr 1fr", gap: "6px 18px", marginTop: 20, padding: "20px 0 0", borderTop: `1px solid ${C.divider}` }}>
                    {Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([n]) => (
                      <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textSoft, minWidth: 0, padding: "4px 0" }}>
                        <div style={{ width: 8, height: 8, borderRadius: 3, background: getOrgColor(n), flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ ...glass, padding: m ? "24px 16px" : "36px 40px", display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeSlideUp .4s ease .2s both", transition: "box-shadow .3s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(120,100,70,0.22)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = C.cardShadow; }}>
                <h3 style={{ fontSize: 22, fontWeight: 500, color: C.text, margin: "0 0 16px", alignSelf: "flex-start", fontFamily: "'Playfair Display',Georgia,serif" }}>Allocation breakdown</h3>
                <div style={{ display: "flex", gap: 6, alignSelf: "flex-start", marginBottom: 28 }}>
                  {[{ id: "all", label: "All Time" }, { id: "6m", label: "6 Months" }, { id: "1y", label: "1 Year" }, { id: "3y", label: "3 Years" }].map(tf => (
                    <button key={tf.id} onClick={() => setAllocTimeframe(tf.id)} style={{
                      padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", letterSpacing: ".04em",
                      background: allocTimeframe === tf.id ? C.accent : "transparent",
                      color: allocTimeframe === tf.id ? C.text : C.textMuted,
                      transition: "all .2s",
                    }}>{tf.label}</button>
                  ))}
                </div>
                <DonutChart data={filteredDonutData.length > 0 ? filteredDonutData : donutData} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28, width: "100%" }}>
                  {(filteredDonutData.length > 0 ? filteredDonutData : donutData).slice(0, 8).map((d, i) => {
                    const total = filteredDonutData.length > 0 ? filteredTotal : totalDonated;
                    return (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                        <span style={{ color: C.textSoft, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500, width: 32, textAlign: "right" }}>{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
                        <span style={{ fontWeight: 600, color: C.text, minWidth: 68, textAlign: "right" }}>{fmt(d.value)}</span>
                      </div>
                    </div>
                    );
                  })}
                  {(filteredDonutData.length > 0 ? filteredDonutData : donutData).length > 8 && (
                    <div style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "6px 0" }}>+{(filteredDonutData.length > 0 ? filteredDonutData : donutData).length - 8} more organizations</div>
                  )}
                </div>
              </div>
            </div>
            </ScrollReveal>

            {/* Cause areas */}
            <ScrollReveal>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 500, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", margin: "0 0 24px" }}>Cause Areas</h2>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt], i) => (
                  <div key={cat} style={{ padding: "12px 24px", borderRadius: 4, background: i === 0 ? `linear-gradient(90deg, ${C.card} 0%, ${C.accentLight} 50%, ${C.card} 100%)` : C.card, backgroundSize: i === 0 ? "200% 100%" : "auto", animation: i === 0 ? "shimmer 3s ease-in-out infinite" : "none", border: `1px solid ${C.divider}`, display: "flex", alignItems: "center", gap: 12, transition: "all .2s ease", cursor: "default" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.03)"; e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = "0 6px 18px rgba(120,100,70,0.25), 0 2px 6px rgba(120,100,70,0.12)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = C.divider; e.currentTarget.style.boxShadow = "none"; }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{cat}</span>
                    <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 600 }}>{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
            </ScrollReveal>

            {/* Organization spotlight / impact quote */}
            {spotlightOrg && spotlightDesc && (
              <ScrollReveal>
              <div style={{ marginTop: 64 }}>
                <h2 style={{ fontSize: 22, fontWeight: 500, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", margin: "0 0 24px" }}>Organization Spotlight</h2>
                <div style={{ ...glass, padding: 0, position: "relative", overflow: "hidden" }}>
                  {/* Banner image */}
                  <div style={{ position: "relative", width: "100%", height: m ? 200 : 300 }}>
                    <img
                      key={spotlightOrg}
                      src={spotlightDisplayImg}
                      alt={spotlightOrg}
                      style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: spotlightImgPos, display: "block", animation: "fadeIn .6s ease" }}
                      onError={(e) => { e.target.src = spotlightFallbackImg; setImgErrors(prev => ({ ...prev, [spotlightOrg]: true })); }}
                    />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "60%", background: `linear-gradient(to bottom, transparent, #FFFDF8)`, pointerEvents: "none" }} />
                  </div>
                  {/* Text content */}
                  <div style={{ padding: m ? "16px 20px 28px" : "20px 44px 36px", position: "relative" }}>
                    <div style={{ position: "absolute", top: -8, right: 28, fontSize: 80, fontFamily: "'Playfair Display',Georgia,serif", color: C.divider, lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>"</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: getOrgColor(spotlightOrg) }} />
                      <span style={{ fontSize: 18, fontWeight: 600, color: C.text, fontFamily: "'Playfair Display',Georgia,serif" }}>{spotlightOrg}</span>
                      {ORG_CATEGORIES[spotlightOrg] && (
                        <span style={{ fontSize: 11, color: C.textMuted, background: "rgba(139,119,90,0.08)", padding: "3px 10px", borderRadius: 4, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{ORG_CATEGORIES[spotlightOrg]}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 15, color: C.textSoft, lineHeight: 1.75, margin: "0 0 20px", maxWidth: 700 }}>{spotlightDesc}</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                      <div style={{ fontSize: 14, color: C.textMuted }}>
                        Your total: <strong style={{ color: C.text, fontFamily: "'Playfair Display',Georgia,serif" }}>{fmt(orgTotals[spotlightOrg] || 0)}</strong>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {ORG_WEBSITES[spotlightOrg] && (
                          <a href={ORG_WEBSITES[spotlightOrg]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: C.navy, fontWeight: 500, textDecoration: "none" }}>Visit site</a>
                        )}
                        {userOrgNames.length > 1 && (
                          <div style={{ display: "flex", gap: 6 }}>
                            {userOrgNames.map((_, i) => (
                              <div key={i} onClick={() => setQuoteIdx(i)} style={{ width: 6, height: 6, borderRadius: "50%", background: i === quoteIdx % userOrgNames.length ? C.accent : C.divider, cursor: "pointer", transition: "background .2s" }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </ScrollReveal>
            )}
          </>)}

          {/* ═══════════════ ORGANIZATIONS ═══════════════ */}
          {activeTab === "breakdown" && (
            <div style={{ animation: "fadeSlideUp .3s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: 24 }}>
                {Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([name, total], i) => {
                  const od = donations.filter(d => d.orgName === name);
                  const url = orgUrls[name];
                  const color = getOrgColor(name);
                  const category = ORG_CATEGORIES[name];
                  const img = ORG_IMAGES[name] || fetchedImages[name];
                  const overviewFallbackImg = CATEGORY_FALLBACK_IMAGES[ORG_CATEGORIES[name]] || CATEGORY_FALLBACK_IMAGES._default;
                  const overviewDisplayImg = img && !imgErrors[name] ? img : overviewFallbackImg;
                  const isExpanded = expandedOrgs.has(name);
                  const byMonth = {};
                  od.forEach(d => { byMonth[d.month] = (byMonth[d.month] || 0) + d.allocatedAmount; });

                  return (
                    <div key={name} style={{ ...glass, overflow: "hidden", animation: `fadeSlideUp .4s ease ${i*.04}s both`, transition: "box-shadow .3s, transform .3s", cursor: "pointer" }}
                      onClick={() => setExpandedOrgs(prev => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; })}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = C.cardHover; e.currentTarget.style.transform = "translateY(-3px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = C.cardShadow; e.currentTarget.style.transform = "translateY(0)"; }}>
                      {/* Photo banner */}
                      <div style={{ height: 180, position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
                        <img src={overviewDisplayImg} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", objectPosition: ORG_IMAGE_POS[name] || "center top", opacity: 0, transition: "opacity .4s ease" }}
                          onLoad={e => { e.target.style.opacity = "1"; }}
                          onError={(e) => { e.target.style.display = "none"; setImgErrors(prev => ({ ...prev, [name]: true })); }} />
                        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)` }} />
                        {/* Category badge */}
                        {category && (
                          <div style={{ position: "absolute", top: 14, right: 14, fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.4)", padding: "4px 12px", borderRadius: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>{category}</div>
                        )}
                        {/* Name on photo */}
                        <div style={{ position: "absolute", bottom: 14, left: 18, right: 18 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>{name}</div>
                        </div>
                      </div>

                      {/* Card body */}
                      <div style={{ padding: "18px 22px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{od.length} contribution{od.length !== 1 ? "s" : ""}</span>
                            {url && (
                              <a href={url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ marginLeft: 12, fontSize: 13, color: C.navy, textDecoration: "none", fontWeight: 500 }}>Visit site</a>
                            )}
                          </div>
                          <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'Playfair Display',Georgia,serif" }}><AnimatedNumber value={total} /></div>
                        </div>

                        {/* Expand arrow */}
                        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .3s" }}>
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.divider}`, animation: "fadeSlideUp .3s ease" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.textSoft, marginBottom: 10, textTransform: "uppercase", letterSpacing: ".06em" }}>Donation History</div>
                            {Object.entries(byMonth).map(([m, amt], rowIdx) => (
                              <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.divider}`, animation: `fadeSlideUp .3s ease ${rowIdx * 0.05}s both` }}>
                                <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{m}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 60, height: 5, borderRadius: 3, background: C.divider, overflow: "hidden" }}>
                                    <div style={{ width: `${(amt / total) * 100}%`, height: "100%", background: color, borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmt(amt)}</span>
                                </div>
                              </div>
                            ))}
                            {od.length > 0 && (
                              <div style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap" }}>
                                {[...new Set(od.map(d => d.cycle))].map(c => (
                                  <span key={c} style={{ fontSize: 12, color: C.textMuted, background: "rgba(139,119,90,0.08)", padding: "4px 10px", borderRadius: 8 }}>{c}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════ MONTHLY ALLOCATION ═══════════════ */}
          {activeTab === "allocation" && (
            <div style={{ animation: "fadeSlideUp .3s ease" }}>
              <div style={{ ...glass, padding: m ? "20px 16px" : "28px 40px", marginBottom: 36, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.navy, textTransform: "uppercase", letterSpacing: ".06em" }}>Allocation Summary</div>
                  <div style={{ fontSize: 16, color: C.textSoft, marginTop: 5 }}>
                    You've allocated <strong style={{ color: C.text }}>{fmt(totalDonated, primaryCurrency)}</strong> across <strong style={{ color: C.text }}>{months.length} month{months.length !== 1 ? "s" : ""}</strong>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.textSoft }}>
                  {orgCount} organizations
                </div>
              </div>

              {(() => {
                const MONTHS_PER_PAGE = 15;
                const reversed = [...monthBreakdowns].reverse();
                const totalPages = Math.ceil(reversed.length / MONTHS_PER_PAGE);
                const page = Math.min(monthPage, totalPages || 1);
                const paged = reversed.slice((page - 1) * MONTHS_PER_PAGE, page * MONTHS_PER_PAGE);
                return (<>
                  {paged.map((mb, ci) => (
                    <div key={mb.month} style={{ ...glass, marginBottom: 28, overflow: "hidden", animation: `fadeSlideUp .4s ease ${ci*.06}s both`, transition: "box-shadow .3s, transform .3s" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = C.cardHover; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = C.cardShadow; e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{ padding: m ? "16px 16px" : "22px 32px", borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h3 style={{ fontSize: 22, fontWeight: 600, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", margin: 0 }}>{mb.month}</h3>
                          <span style={{ fontSize: 14, color: C.textSoft, marginTop: 4, display: "block" }}>{mb.donationCount} transaction{mb.donationCount !== 1 ? "s" : ""}</span>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, fontFamily: "'Playfair Display',Georgia,serif" }}>{fmt(mb.total, primaryCurrency)}</div>
                      </div>
                      <div style={{ padding: "26px 32px", display: "flex", flexDirection: m ? "column" : "row", gap: m ? 20 : 36, alignItems: m ? "center" : "flex-start" }}>
                        <div style={{ flexShrink: 0 }}>
                          <DonutChart data={mb.donutData} size={170} />
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
                          {mb.donutData.map((d, i) => {
                            const pct = (d.value / mb.total) * 100;
                            return (
                              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < mb.donutData.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                                <div style={{ width: 10, height: 10, borderRadius: 4, background: d.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 14, color: C.text, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
                                <div style={{ width: 52, height: 5, borderRadius: 3, background: C.divider, overflow: "hidden", flexShrink: 0 }}>
                                  <div style={{ width: `${pct}%`, height: "100%", background: d.color, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500, width: 36, textAlign: "right", flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: C.text, width: 80, textAlign: "right", flexShrink: 0 }}>{fmt(d.value, primaryCurrency)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "20px 0 12px" }}>
                      <button onClick={() => { setMonthPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={page <= 1}
                        style={{ padding: "8px 16px", borderRadius: 4, border: `1px solid ${C.cardBorder}`, background: "transparent", color: page <= 1 ? C.textMuted : C.textSoft, cursor: page <= 1 ? "default" : "pointer", fontSize: 13, fontWeight: 500, opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button key={i + 1} onClick={() => { setMonthPage(i + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          style={{ width: 34, height: 34, borderRadius: 4, border: "none", background: page === i + 1 ? C.accent : "transparent", color: page === i + 1 ? C.text : C.textMuted, cursor: "pointer", fontSize: 13, fontWeight: page === i + 1 ? 700 : 500 }}>{i + 1}</button>
                      ))}
                      <button onClick={() => { setMonthPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={page >= totalPages}
                        style={{ padding: "8px 16px", borderRadius: 4, border: `1px solid ${C.cardBorder}`, background: "transparent", color: page >= totalPages ? C.textMuted : C.textSoft, cursor: page >= totalPages ? "default" : "pointer", fontSize: 13, fontWeight: 500, opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
                    </div>
                  )}
                </>);
              })()}
            </div>
          )}

          {/* ═══════════════ TEAM ═══════════════ */}
          {activeTab === "team" && (
            <div style={{ animation: "fadeSlideUp .3s ease" }}>
              {/* Team hero */}
              <div style={{ borderRadius: 8, overflow: "hidden", position: "relative", height: m ? 220 : 320, marginBottom: 28, background: C.text }}>
                <img src="https://assets.evidenceaction.org/web/images/_1280xAUTO_crop_center-center_none/ea-kids.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center bottom", display: "block", filter: "brightness(0.6) saturate(1.1)" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(61,122,106,0.2) 0%, rgba(44,36,22,0.35) 100%)" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: m ? "28px 20px" : "36px 48px" }}>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 500, marginBottom: 8 }}>Isara Team Impact</div>
                  <div style={{ fontSize: m ? 32 : 54, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.03em", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.25), 0 0 80px rgba(255,255,255,0.15)" }}>
                    <AnimatedNumber value={teamData.teamTotal} />
                  </div>
                  <div style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", marginTop: 12 }}>
                    {teamData.memberCount} team members supporting {teamData.orgCount} organizations
                  </div>
                </div>
              </div>

              {/* Summary stats */}
              <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr 1fr", gap: 18, marginBottom: 22 }}>
                {[
                  { label: "Team Members", value: teamData.memberCount, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                  { label: "Organizations", value: teamData.orgCount, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
                  { label: "Cause Areas", value: teamData.orgsByCategory.length, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
                ].map((stat, i) => (
                  <div key={i} style={{ ...glass, padding: "24px 28px", animation: `fadeSlideUp .4s ease ${i*.06}s both`, transition: "box-shadow .3s, transform .3s", cursor: "default" }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = C.cardHover; e.currentTarget.style.transform = "translateY(-3px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = C.cardShadow; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: C.navy, animation: "gentlePulse 3s ease-in-out infinite" }}>{stat.icon}</div>
                    <div style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", lineHeight: 1 }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Organizations we support — grouped by category */}
              <div style={{ ...glass, padding: m ? "24px 16px" : "40px 44px", animation: "fadeSlideUp .4s ease .1s both" }}>
                <h3 style={{ fontSize: 22, fontWeight: 500, color: C.text, margin: "0 0 8px", fontFamily: "'Playfair Display',Georgia,serif" }}>Organizations We Support</h3>
                <p style={{ fontSize: 15, color: C.textSoft, margin: "0 0 32px" }}>Our team collectively supports these organizations across {teamData.orgsByCategory.length} cause areas.</p>

                {teamData.orgsByCategory.map(([category, orgs], ci) => (
                  <div key={category} style={{ marginBottom: ci < teamData.orgsByCategory.length - 1 ? 28 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, textTransform: "uppercase", letterSpacing: ".08em" }}>{category}</div>
                      <div style={{ flex: 1, height: 1, background: C.divider }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: m ? "1fr" : "1fr 1fr", gap: 14 }}>
                      {orgs.map((orgName) => (
                        <TeamOrgCard key={orgName} orgName={orgName} isExpanded={selectedTeamOrg === orgName}
                          onToggle={() => setSelectedTeamOrg(selectedTeamOrg === orgName ? null : orgName)}
                          fetchedImages={fetchedImages} fetchedDescs={fetchedDescs} allOrgUrls={allOrgUrls}
                          imgErrors={imgErrors} setImgErrors={setImgErrors} m={m} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════ IMPACT GLOBE ═══════════════ */}
          {activeTab === "donate" && (
            <DonateTab userEmail={user.email} sheetData={sheetData} />
          )}

          {activeTab === "impact" && (
            <GlobeTab donations={donations} userEmail={user.email} sheetData={sheetData} />
          )}

          {activeTab === "admin" && isUserAdmin > 0 && (
            <AdminTab currentEmail={user.email} sheetData={sheetData} adminLevel={isUserAdmin} />
          )}
        </>)}
      </div>

      {/* Photo — only on overview with donations */}
      {activeTab === "overview" && donations.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", padding: m ? "20px 12px 32px" : "20px 0 48px" }}>
          <img src="/hero.jpg" alt="" style={{ maxWidth: 760, width: "100%", borderRadius: 0, display: "block", filter: "saturate(0.9) contrast(1.05) sepia(0.08) brightness(1.02)" }} />
        </div>
      )}

      {/* Footer */}
      <ScrollReveal>
      <div style={{ textAlign: "center", padding: m ? "40px 16px 32px" : "60px 0 48px", background: C.card }}>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${C.accent}40, ${C.navy}30, transparent)`, margin: "0 auto 32px", maxWidth: 600 }} />
        <p style={{ color: C.textMuted, fontSize: 15, fontStyle: "italic", fontWeight: 400, letterSpacing: ".01em", lineHeight: 1.7, fontFamily: "'Playfair Display',Georgia,serif" }}>
          "No one has ever become poor by giving." — Anne Frank
        </p>
        <p style={{ color: C.textMuted, fontSize: 12, letterSpacing: ".1em", fontWeight: 500, marginTop: 16, textTransform: "uppercase" }}>GiveTrack · {new Date().getFullYear()}</p>
      </div>
      </ScrollReveal>
    </div>
  );
}
