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
  "Save the Children": "https://plus.unsplash.com/premium_photo-1770394034525-2aa9baaabd5b?w=800&h=500&fit=crop&q=80",
  "Doctors Without Borders": "https://www.doctorswithoutborders.org/sites/default/files/styles/media_besides_text_666_520/public/MSF163911%28High%29_0.jpg",
  "Médecins Sans Frontières": "https://www.doctorswithoutborders.org/sites/default/files/styles/collection_block_desktop_666_519/public/image_base_media/2026/02/MSF358702.jpg",
  "Médecins sans Frontières": "https://www.doctorswithoutborders.org/sites/default/files/styles/collection_block_desktop_666_519/public/image_base_media/2026/02/MSF358702.jpg",
  "GiveWell": "https://assets.evidenceaction.org/web/images/_1280xAUTO_crop_center-center_none/ea-doctor.jpg",
  "Sea Shepherd": "https://images.unsplash.com/photo-1610581950163-c37ae06c3a96?w=800&h=500&fit=crop&q=80",
  "Evidence Action": "https://assets.evidenceaction.org/web/images/_1280xAUTO_crop_center-center_none/ea-kids.jpg",
  "Open Door Legal": "https://opendoorlegal.org/wp-content/uploads/2019/08/claudia-for-web.jpg",
  "Wholesome Wave": "https://images.squarespace-cdn.com/content/v1/5febb5b1df316630764c4dec/1b65a895-6b11-4898-b025-f7e397195b1c/ww-little-girl-eating-watermelon.png",
  "Room to Read": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=500&fit=crop&q=80",
  "Asylum Access": "https://asylumaccess.org/wp-content/uploads/2025/05/AAE201609-Skoll-GabrielDiamond1-1ahaje.jpg",
  "School on Wheels": "https://schoolonwheels.org/wp-content/uploads/2026/02/jordan-and-anne.jpg",
  "Malaria Consortium": "https://images.unsplash.com/photo-1694286068362-5dcea7ed282a?w=800&h=500&fit=crop&q=80",
  "The Washing Machine Project": "https://images.squarespace-cdn.com/content/v1/61aa260eae89d2514d87e72a/97bd3be0-03a9-4a2f-b1b8-00bcdb61d495/uganda24-hand-wash-young-lady_DPI300.jpg",
  "Action Against Hunger": "https://www.actionagainsthunger.org/app/themes/actionagainsthunger/assets/images/aah-og.jpg",
  "Clean Ocean Action": "https://images.unsplash.com/photo-1583749063749-423914dce445?w=800&h=500&fit=crop&q=80",
  "Middle East Children's Alliance": "https://www.mecaforpeace.org/wp-content/uploads/2024/12/DSC04045-scaled.jpg",
  "Oceana": "https://images.unsplash.com/photo-1676186013887-fa1c4c658274?w=800&h=500&fit=crop&q=80",
  "WWF": "https://images.unsplash.com/photo-1535759802691-bf5a6cfe6ce9?w=800&h=500&fit=crop&q=80",
  "En Ptahy Vidchui": "https://plus.unsplash.com/premium_photo-1663126366512-62a1e0494bad?w=800&h=500&fit=crop&q=80",
  "Give To IV": "https://give.intervarsity.org/themes/custom/donate/images/meta_img/metatag.jpg",
  "NCCHC Foundation": "https://images.unsplash.com/photo-1617565980755-d57f254b0ba7?w=800&h=500&fit=crop&q=80",
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
  "Evidence Action": "center 40%",        // row of children's faces centered
  "Open Door Legal": "center 25%",        // woman portrait, face upper center
  "Wholesome Wave": "center 20%",         // little girl eating watermelon
  "Room to Read": "center 30%",           // children in classroom
  "Asylum Access": "center 30%",          // two women smiling together
  "School on Wheels": "center 25%",       // volunteer tutoring child
  "Malaria Consortium": "60% 25%",        // health worker feeding child in Africa
  "The Washing Machine Project": "center 20%", // young woman hand-washing
  "Action Against Hunger": "60% 30%",     // mother in orange with baby
  "Clean Ocean Action": "center center",  // clean coastline
  "Middle East Children's Alliance": "center 35%", // MECA workers with children
  "Oceana": "center center",              // coral reef underwater
  "WWF": "center center",                 // African wildlife safari
  "En Ptahy Vidchui": "center 30%",       // three men with Ukraine aid box
  "Give To IV": "center 25%",             // five young people arms around each other
  "NCCHC Foundation": "center 20%",       // medical professional smiling
  "Radiance SF": "center 30%",            // women on stage at gathering
  "Reality SF": "center 30%",             // volunteers at food pantry
  "SFHS": "center 30%",                   // SFHS students smiling together
};
const HERO_IMAGE = "/banner.jpg";

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

const DEMO_DATA = {
  "courtney@isara.io": [
    // — Courtney's original donations —
    { orgName: "Save the Children", paidTo: "https://support.savethechildren.org/site/Ecommerce", allocatedAmount: 320, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 15 },
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 280, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 13 },
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 200, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 10 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 180, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 9 },
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 150, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 7 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 120, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 6 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 100, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 5 },
    { orgName: "Room to Read", paidTo: "Room to Read", allocatedAmount: 100, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 5 },
    { orgName: "Asylum Access", paidTo: "https://www.asylumaccess.org/", allocatedAmount: 90, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 5 },
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 80, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 4 },
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 75, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 4 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 60, month: "Jan 2026", currency: "$", paidDate: "15-Jan-26", cycle: "Jan-15 Payroll Cycle", percentage: 3 },
    { orgName: "Save the Children", paidTo: "https://support.savethechildren.org/site/Ecommerce", allocatedAmount: 350, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 15 },
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 300, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 13 },
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 220, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 10 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 190, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 9 },
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 160, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 7 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 130, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 6 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 110, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 5 },
    { orgName: "Room to Read", paidTo: "Room to Read", allocatedAmount: 110, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 5 },
    { orgName: "Asylum Access", paidTo: "https://www.asylumaccess.org/", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 5 },
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 85, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 4 },
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 80, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 4 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 70, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 3 },
    { orgName: "Save the Children", paidTo: "https://support.savethechildren.org/site/Ecommerce", allocatedAmount: 380, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 310, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 13 },
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 230, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 200, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 9 },
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 170, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 7 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 140, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 6 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 120, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 5 },
    { orgName: "Room to Read", paidTo: "Room to Read", allocatedAmount: 115, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 5 },
    { orgName: "Asylum Access", paidTo: "https://www.asylumaccess.org/", allocatedAmount: 100, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 5 },
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 90, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 4 },
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 85, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 4 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 75, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 3 },
    // — Edward's donations —
    { orgName: "Give To IV", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 30 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 10 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 10 },
    { orgName: "Radiance SF", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 15 },
    { orgName: "Reality SF", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 15 },
    { orgName: "Give To IV", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "Radiance SF", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
    { orgName: "Reality SF", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
    // — Amy's donations —
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    // — Ben's donations —
    { orgName: "NCCHC Foundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "NCCHC Foundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    // — Bernie's donations —
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 40 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 2367.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins Sans Frontières", paidTo: "Médecins Sans Frontières", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 473.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
    // — Ed's donations —
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    // — Peter's donations —
    { orgName: "SFHS", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "SFHS", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    // — Jerry's donations —
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    // — Rowan's donations —
    { orgName: "Asylum Access", paidTo: "https://www.asylumaccess.org/", allocatedAmount: 1924.83, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Clean Ocean Action", paidTo: "Clean Ocean Action", allocatedAmount: 577.45, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Middle East Children's Alliance", paidTo: "Middle East Children's Alliance", allocatedAmount: 769.93, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Room to Read", paidTo: "Room to Read", allocatedAmount: 577.45, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    // — Sam's donations —
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
    // — Artur's donations —
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 1039.58, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Feb 2026", currency: "$", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 1039.58, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 50 },
    // — Lily's donations —
    { orgName: "Oceana", paidTo: "Oceana", allocatedAmount: 689.58, month: "Feb 2026", currency: "$", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "WWF", paidTo: "WWF", allocatedAmount: 689.58, month: "Feb 2026", currency: "$", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 551.67, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins sans Frontières", paidTo: "Médecins sans Frontières", allocatedAmount: 551.67, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 275.83, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
  ],
  "edward@isara.io": [
    { orgName: "Give To IV", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 30 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 10 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 10 },
    { orgName: "Radiance SF", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 15 },
    { orgName: "Reality SF", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 15 },
    { orgName: "Give To IV", paidTo: "https://givetoiv.org/justinlee", allocatedAmount: 285, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Open Door Legal", paidTo: "https://opendoorlegal.org/", allocatedAmount: 190, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
    { orgName: "Wholesome Wave", paidTo: "https://www.wholesomewave.org/", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "The Washing Machine Project", paidTo: "https://www.thewashingmachineproject.org/our-impact", allocatedAmount: 95, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 10 },
    { orgName: "Radiance SF", paidTo: "https://www.radiancesf.org/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
    { orgName: "Reality SF", paidTo: "https://realitysf.com/", allocatedAmount: 142.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 15 },
  ],
  "amy@isara.io": [
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Evidence Action", paidTo: "https://www.evidenceaction.org/donate", allocatedAmount: 125, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "ben@isara.io": [
    { orgName: "NCCHC Foundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "NCCHC Foundation", paidTo: "https://ncchcfoundation.org/", allocatedAmount: 435, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "bernie@isara.io": [
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 40 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 2367.50, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins Sans Frontières", paidTo: "Médecins Sans Frontières", allocatedAmount: 947, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 473.50, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
  ],
  "ed@isara.io": [
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "GiveWell", paidTo: "https://www.givewell.org/charities/malaria-consortium", allocatedAmount: 94, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "peter@isara.io": [
    { orgName: "SFHS", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "SFHS", paidTo: "https://www.sfhs.com/make-a-gift", allocatedAmount: 10666.67, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "jerry@isara.io": [
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "School on Wheels", paidTo: "https://schoolonwheels.org/", allocatedAmount: 3208.33, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "rowan@isara.io": [
    { orgName: "Asylum Access", paidTo: "https://www.asylumaccess.org/", allocatedAmount: 1924.83, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Clean Ocean Action", paidTo: "Clean Ocean Action", allocatedAmount: 577.45, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
    { orgName: "Middle East Children's Alliance", paidTo: "Middle East Children's Alliance", allocatedAmount: 769.93, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Room to Read", paidTo: "Room to Read", allocatedAmount: 577.45, month: "Feb 2026", currency: "$", paidDate: "24-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 30 },
  ],
  "sam@isara.io": [
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Feb 2026", currency: "$", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 100 },
    { orgName: "Doctors Without Borders", paidTo: "https://www.doctorswithoutborders.org", allocatedAmount: 1400, month: "Feb 2026", currency: "$", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 100 },
  ],
  "artur@isara.io": [
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "10-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "Malaria Consortium", paidTo: "Malaria Consortium", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 50 },
    { orgName: "En Ptahy Vidchui", paidTo: "https://en.ptahy.vidchui.org/", allocatedAmount: 1039.58, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 50 },
  ],
  "lily@isara.io": [
    { orgName: "Oceana", paidTo: "Oceana", allocatedAmount: 689.58, month: "Feb 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "WWF", paidTo: "WWF", allocatedAmount: 689.58, month: "Feb 2026", currency: "£", paidDate: "12-Feb-26", cycle: "Jan-31 Payroll Cycle", percentage: 50 },
    { orgName: "Sea Shepherd", paidTo: "https://seashepherd.org", allocatedAmount: 551.67, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Médecins sans Frontières", paidTo: "Médecins sans Frontières", allocatedAmount: 551.67, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 40 },
    { orgName: "Action Against Hunger", paidTo: "Action Against Hunger", allocatedAmount: 275.83, month: "Feb 2026", currency: "£", paidDate: "25-Feb-26", cycle: "Feb-15 Payroll Cycle", percentage: 20 },
  ],
};

// ─── LOCAL STORAGE DATA LAYER ─────────────────────────────────

const INITIAL_ADMINS = ["courtney@isara.io"];

const EMPLOYEE_NAMES = {
  "courtney@isara.io": "Courtney Leung", "edward@isara.io": "Edward Lee",
  "amy@isara.io": "Amy Chen", "ben@isara.io": "Ben Park",
  "bernie@isara.io": "Bernie Liu", "ed@isara.io": "Ed Torres",
  "peter@isara.io": "Peter Wagner", "jerry@isara.io": "Jerry Kim",
  "rowan@isara.io": "Rowan Patel", "sam@isara.io": "Sam Reeves",
  "artur@isara.io": "Artur Kovalenko", "lily@isara.io": "Lily Whitfield",
};

function loadStorage(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function saveStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function loadAdmins() { return loadStorage("givetrack_admins", INITIAL_ADMINS); }
function saveAdmins(list) { saveStorage("givetrack_admins", list); }
function checkIsAdmin(email) { return loadAdmins().includes(email?.toLowerCase()); }

function loadBudgets() { return loadStorage("givetrack_employee_budgets", {}); }
function saveBudgets(b) { saveStorage("givetrack_employee_budgets", b); }

function loadCycles() { return loadStorage("givetrack_pay_cycles", { currentCycleId: null, cycles: [] }); }
function saveCycles(c) { saveStorage("givetrack_pay_cycles", c); }

function loadSubmissions() { return loadStorage("givetrack_submissions", {}); }
function saveSubmissions(s) { saveStorage("givetrack_submissions", s); }

function loadTracker() { return loadStorage("givetrack_admin_tracker", {}); }
function saveTracker(t) { saveStorage("givetrack_admin_tracker", t); }

// Map cycle labels from DEMO_DATA to cycleIds
const CYCLE_MAP = {
  "Jan-15 Payroll Cycle": "2026-01-15",
  "Jan-31 Payroll Cycle": "2026-01-31",
  "Feb-15 Payroll Cycle": "2026-02-15",
};

// All known org names for the dropdown
// All orgs: from ORG_WEBSITES + every org anyone has ever donated to in DEMO_DATA
const ALL_KNOWN_ORGS = [...new Set([
  ...Object.keys(ORG_WEBSITES),
  ...Object.values(DEMO_DATA).flatMap(dons => dons.map(d => d.orgName)),
])].sort();

function seedFromDemoData() {
  if (localStorage.getItem("givetrack_pay_cycles")) return; // already seeded

  // 1. Seed admins
  saveAdmins(INITIAL_ADMINS);

  // 2. Derive employee budgets from individual DEMO_DATA entries (not courtney's merged data)
  const budgets = {};
  const individualEmails = Object.keys(DEMO_DATA).filter(e => e !== "courtney@isara.io");
  individualEmails.forEach(email => {
    const dons = DEMO_DATA[email];
    // Get latest cycle's total
    const latestCycle = dons.length > 0 ? dons[dons.length - 1].cycle : "";
    const cycleDons = dons.filter(d => d.cycle === latestCycle);
    const total = cycleDons.reduce((s, d) => s + d.allocatedAmount, 0);
    budgets[email] = { name: EMPLOYEE_NAMES[email] || email.split("@")[0], cycleAmount: Math.round(total * 100) / 100, currency: dons[0]?.currency || "$" };
  });
  // Courtney's own budget — use her original data (the first 12 entries are Jan-15 cycle)
  const courtneyJan15 = DEMO_DATA["courtney@isara.io"].filter(d => d.cycle === "Jan-15 Payroll Cycle" && d.allocatedAmount < 500);
  const courtneyTotal = courtneyJan15.reduce((s, d) => s + d.allocatedAmount, 0);
  budgets["courtney@isara.io"] = { name: "Courtney Leung", cycleAmount: Math.round(courtneyTotal * 100) / 100, currency: "$" };
  saveBudgets(budgets);

  // 3. Seed pay cycles
  const cyclesData = {
    currentCycleId: "2026-03-15",
    cycles: [
      { cycleId: "2026-01-15", label: "Jan-15 Payroll Cycle", deadline: "2026-01-10", payDate: "2026-01-15", status: "paid" },
      { cycleId: "2026-01-31", label: "Jan-31 Payroll Cycle", deadline: "2026-01-26", payDate: "2026-01-31", status: "paid" },
      { cycleId: "2026-02-15", label: "Feb-15 Payroll Cycle", deadline: "2026-02-10", payDate: "2026-02-15", status: "closed" },
      { cycleId: "2026-03-15", label: "Mar-15 Payroll Cycle", deadline: "2026-03-10", payDate: "2026-03-15", status: "open" },
    ],
  };
  saveCycles(cyclesData);

  // 4. Seed admin tracker from individual DEMO_DATA (mark all past as paid)
  const tracker = {};
  individualEmails.forEach(email => {
    DEMO_DATA[email].forEach(d => {
      const cycleId = CYCLE_MAP[d.cycle];
      if (!cycleId) return;
      if (!tracker[cycleId]) tracker[cycleId] = {};
      if (!tracker[cycleId][email]) tracker[cycleId][email] = {};
      tracker[cycleId][email][d.orgName] = { paid: true, datePaid: d.paidDate, receiptData: null, receiptFileName: null, amount: d.allocatedAmount };
    });
  });
  // Courtney's own entries
  const courtneyOwn = DEMO_DATA["courtney@isara.io"].filter(d => d.allocatedAmount < 500);
  courtneyOwn.forEach(d => {
    const cycleId = CYCLE_MAP[d.cycle];
    if (!cycleId) return;
    if (!tracker[cycleId]) tracker[cycleId] = {};
    if (!tracker[cycleId]["courtney@isara.io"]) tracker[cycleId]["courtney@isara.io"] = {};
    tracker[cycleId]["courtney@isara.io"][d.orgName] = { paid: true, datePaid: d.paidDate, receiptData: null, receiptFileName: null, amount: d.allocatedAmount };
  });
  saveTracker(tracker);

  // 5. Seed submissions for current open cycle (rollforward from Feb-15)
  const subs = { "2026-03-15": {} };
  individualEmails.forEach(email => {
    const feb15 = DEMO_DATA[email].filter(d => d.cycle === "Feb-15 Payroll Cycle");
    if (feb15.length > 0) {
      subs["2026-03-15"][email] = {
        submittedAt: null, rolledForward: true,
        allocations: feb15.map(d => ({ orgName: d.orgName, paidTo: d.paidTo, percentage: d.percentage })),
      };
    }
  });
  // Courtney's rollforward
  const courtneyFeb15 = courtneyOwn.filter(d => d.cycle === "Feb-15 Payroll Cycle");
  if (courtneyFeb15.length > 0) {
    subs["2026-03-15"]["courtney@isara.io"] = {
      submittedAt: null, rolledForward: true,
      allocations: courtneyFeb15.map(d => ({ orgName: d.orgName, paidTo: d.paidTo, percentage: d.percentage })),
    };
  }
  saveSubmissions(subs);
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
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#FAF7F0; color:#222520; -webkit-font-smoothing:antialiased; }
  ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(34,37,32,0.15); border-radius:3px; }
  ::selection { background:rgba(255,202,10,0.25); }
  img { -webkit-user-drag:none; }
`;

const C = {
  bg: "#FAF7F0",
  card: "#ffffff",
  cardBorder: "rgba(34,37,32,0.08)",
  cardShadow: "0 2px 8px rgba(34,37,32,0.06), 0 1px 3px rgba(34,37,32,0.04)",
  cardHover: "0 8px 28px rgba(34,37,32,0.1)",
  text: "#222520",
  textSoft: "#555850",
  textMuted: "#8A8D85",
  accent: "#FFCA0A",
  accentDark: "#E0A800",
  accentLight: "#FFF8E0",
  accentSoft: "rgba(255,202,10,0.08)",
  warm: "#E07A30",
  warmLight: "#FFF4E8",
  divider: "rgba(34,37,32,0.08)",
  navy: "#003366",
};

const glass = {
  background: "#ffffff",
  borderRadius: 8,
  border: `1px solid ${C.cardBorder}`,
  boxShadow: C.cardShadow,
};

// ─── COMPONENTS ───────────────────────────────────────────────

function AnimatedNumber({ value, currency = "$", duration = 900 }) {
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

function DonateTab({ userEmail }) {
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

  const updateRow = (idx, field, value) => {
    setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
    setSaved(false); setSubmitted(false);
  };
  const removeRow = (idx) => {
    setAllocations(prev => prev.filter((_, i) => i !== idx));
    setSaved(false); setSubmitted(false);
  };
  const addRow = () => {
    setAllocations(prev => [...prev, { orgName: "", paidTo: "", percentage: 0 }]);
  };

  const saveAllocations = (isSubmit) => {
    const subs = loadSubmissions();
    if (!subs[cycles.currentCycleId]) subs[cycles.currentCycleId] = {};
    subs[cycles.currentCycleId][userEmail] = {
      submittedAt: isSubmit ? new Date().toISOString() : null,
      rolledForward: false,
      allocations: allocations.filter(a => a.percentage > 0).map(a => ({ orgName: a.orgName, paidTo: a.paidTo, percentage: a.percentage })),
    };
    saveSubmissions(subs);
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
        setTimeout(() => setClampedIdx(null), 2000);
      } else {
        setClampedIdx(null);
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
          <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(34,37,32,0.06)", borderRadius: 4, display: "flex", alignItems: "center", gap: 10 }}>
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
                  style={{ width: 320, padding: "10px 14px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, background: "#fff", color: C.text, fontFamily: "'Montserrat',sans-serif", cursor: isLocked ? "not-allowed" : "pointer" }}>
                  <option value="">Select an organization...</option>
                  {ALL_KNOWN_ORGS.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="__other">Other (enter name or URL)</option>
                </select>
                {alloc.orgName === "__other" && (
                  <input
                    type="text" placeholder="Enter org name or URL" value={alloc.paidTo}
                    onChange={e => updateRow(idx, "paidTo", e.target.value)}
                    disabled={isLocked}
                    style={{ width: 260, padding: "10px 14px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
                )}
                <span style={{ fontSize: 15, fontWeight: 600, color: C.navy, minWidth: 90, textAlign: "right", marginLeft: "auto" }}>{fmt(amt, budget.currency)}</span>
                {allocations.length > 1 && !isLocked && (
                  <button onClick={() => removeRow(idx)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 20, padding: "4px 8px", lineHeight: 1 }}>&times;</button>
                )}
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
                    <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 500, marginTop: 4 }}>Cannot exceed 100% total — reduce higher-priority orgs above first.</div>
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
      <div style={{ ...glass, padding: "24px 36px" }}>
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
          <div style={{ height: "100%", width: `${Math.min(totalPct, 100)}%`, background: totalPct > 100 ? "#dc2626" : totalPct === 100 ? "#16a34a" : C.accent, borderRadius: 4, transition: "width .3s, background .3s" }} />
        </div>
        {totalPct > 100 && (
          <div style={{ color: "#dc2626", fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Total exceeds 100%. Please reduce your allocations.</div>
        )}
        {totalPct === 100 && (
          <div style={{ color: "#16a34a", fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Fully allocated!</div>
        )}
        {!isLocked && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button onClick={() => saveAllocations(false)} style={{ padding: "10px 24px", background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 4, color: C.textSoft, fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all .15s" }}>
              Save Draft
            </button>
            <button onClick={() => saveAllocations(true)} disabled={totalPct > 100}
              style={{ padding: "10px 28px", background: totalPct > 100 ? C.divider : C.accent, color: totalPct > 100 ? C.textMuted : C.text, border: "none", borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: totalPct > 100 ? "not-allowed" : "pointer", transition: "all .15s" }}>
              Submit Allocations
            </button>
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
      <div style={{ background: "#fff", borderRadius: 8, padding: 24, maxWidth: 600, maxHeight: "80vh", overflow: "auto", position: "relative" }}
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

function AdminTracker({ selectedCycleId }) {
  const [tracker, setTracker] = useState(loadTracker());
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
      rows.push({ email, name: budget.name, orgName: alloc.orgName, amount: Math.round(amt * 100) / 100, currency: budget.currency, paid: tData.paid || false, datePaid: tData.datePaid || "", receiptData: tData.receiptData || null, receiptFileName: tData.receiptFileName || null });
    });
  });

  // Also include rows from tracker that came from seeded DEMO_DATA (not in current submissions)
  Object.entries(cycleTracker).forEach(([email, orgs]) => {
    Object.entries(orgs).forEach(([orgName, tData]) => {
      if (!rows.find(r => r.email === email && r.orgName === orgName)) {
        const budget = budgets[email] || { name: email, currency: "$" };
        rows.push({ email, name: budget.name, orgName, amount: tData.amount || 0, currency: budget.currency, paid: tData.paid || false, datePaid: tData.datePaid || "", receiptData: tData.receiptData || null, receiptFileName: tData.receiptFileName || null });
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
      <div style={{ ...glass, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 100px 50px 110px 90px", padding: "12px 20px", borderBottom: `1px solid ${C.divider}`, background: "rgba(34,37,32,0.02)" }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 100px 50px 110px 90px", padding: "12px 20px", borderBottom: isLastInGroup ? "none" : `1px solid ${C.divider}`, alignItems: "center", background: gi % 2 === 1 ? "rgba(34,37,32,0.015)" : "transparent" }}>
              <div style={{ fontSize: 14, fontWeight: showName ? 600 : 400, color: showName ? C.text : "transparent" }}>{row.name}</div>
              <div style={{ fontSize: 14, color: C.textSoft }}>{row.orgName}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmt(row.amount, row.currency)}</div>
              <div>
                <input type="checkbox" checked={row.paid} onChange={e => updateTrackerField(row.email, row.orgName, "paid", e.target.checked)}
                  style={{ width: 18, height: 18, cursor: "pointer", accentColor: C.accent }} />
              </div>
              <div>
                <input type="date" value={row.datePaid} onChange={e => updateTrackerField(row.email, row.orgName, "datePaid", e.target.value)}
                  style={{ fontSize: 12, padding: "4px 6px", border: `1px solid ${C.cardBorder}`, borderRadius: 4, color: C.text, fontFamily: "'Montserrat',sans-serif" }} />
              </div>
              <div>
                {row.receiptData ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setViewReceipt({ src: row.receiptData, name: row.receiptFileName })}
                      style={{ fontSize: 12, color: C.navy, background: "none", border: "none", cursor: "pointer", fontWeight: 500, textDecoration: "underline" }}>View</button>
                    <button onClick={() => { updateTrackerField(row.email, row.orgName, "receiptData", null); updateTrackerField(row.email, row.orgName, "receiptFileName", null); }}
                      style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Remove</button>
                  </div>
                ) : (
                  <label style={{ fontSize: 12, color: C.navy, cursor: "pointer", fontWeight: 500 }}>
                    Upload
                    <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                      onChange={e => { if (e.target.files[0]) handleReceiptUpload(row.email, row.orgName, e.target.files[0]); }} />
                  </label>
                )}
              </div>
                </div>
                {/* Subtotal row after last item in group */}
                {isLastInGroup && (
                  <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 100px 50px 110px 90px", padding: "8px 20px", borderBottom: `2px solid ${C.divider}`, alignItems: "center", background: gi % 2 === 1 ? "rgba(34,37,32,0.03)" : "rgba(34,37,32,0.02)" }}>
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
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", background: "rgba(34,37,32,0.02)" }}>
          <span style={{ fontSize: 14, color: C.textSoft }}>{paidCount} of {rows.length} donations paid</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Total: {fmt(totalAmt)}</span>
        </div>
      </div>
    </div>
  );
}

function AdminBudgets() {
  const [budgets, setBudgets] = useState(loadBudgets());
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
    <div style={{ ...glass, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 80px 80px", padding: "12px 20px", borderBottom: `1px solid ${C.divider}`, background: "rgba(34,37,32,0.02)" }}>
        {["Employee", "Email", "Budget/Cycle", "Currency", ""].map(h => (
          <div key={h} style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 600 }}>{h}</div>
        ))}
      </div>
      {Object.entries(budgets).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([email, b]) => (
        <div key={email} style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 80px 80px", padding: "10px 20px", borderBottom: `1px solid ${C.divider}`, alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{b.name}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>{email}</div>
          <div>
            <input type="number" value={b.cycleAmount} onChange={e => updateBudget(email, "cycleAmount", e.target.value)}
              style={{ width: 120, padding: "6px 10px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
          </div>
          <div>
            <select value={b.currency} onChange={e => updateBudget(email, "currency", e.target.value)}
              style={{ padding: "6px 8px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }}>
              <option value="$">$</option><option value="£">£</option>
            </select>
          </div>
          <div>
            <button onClick={() => removeEmployee(email)} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Remove</button>
          </div>
        </div>
      ))}
      {/* Add employee row */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 80px 80px", padding: "12px 20px", background: "rgba(34,37,32,0.02)", alignItems: "center", gap: 8 }}>
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
    </div>
  );
}

function AdminManagement({ currentEmail }) {
  const [admins, setAdmins] = useState(loadAdmins());
  const [newAdmin, setNewAdmin] = useState("");

  const addAdmin = () => {
    if (!newAdmin || !newAdmin.includes("@")) return;
    const updated = [...new Set([...admins, newAdmin.toLowerCase()])];
    saveAdmins(updated);
    setAdmins(updated);
    setNewAdmin("");
  };

  const removeAdmin = (email) => {
    if (email === currentEmail) return;
    const updated = admins.filter(a => a !== email);
    saveAdmins(updated);
    setAdmins(updated);
  };

  return (
    <div style={{ ...glass, padding: "32px 36px" }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: "0 0 20px", textTransform: "uppercase", letterSpacing: ".06em" }}>Current Admins</h3>
      {admins.map(email => (
        <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${C.divider}` }}>
          <span style={{ fontSize: 15, color: C.text, fontWeight: 500 }}>{email}</span>
          {email === currentEmail ? (
            <span style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>You</span>
          ) : (
            <button onClick={() => removeAdmin(email)} style={{ fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Remove</button>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <input type="email" placeholder="email@isara.io" value={newAdmin} onChange={e => setNewAdmin(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addAdmin()}
          style={{ flex: 1, padding: "10px 14px", fontSize: 14, border: `1px solid ${C.cardBorder}`, borderRadius: 4, fontFamily: "'Montserrat',sans-serif" }} />
        <button onClick={addAdmin} style={{ padding: "10px 24px", background: C.accent, color: C.text, border: "none", borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Add Admin</button>
      </div>
      <p style={{ fontSize: 13, color: C.textMuted, marginTop: 16, lineHeight: 1.6 }}>Admins can view all employee submissions, manage budgets, and track donation payments.</p>
    </div>
  );
}

function AdminTab({ currentEmail }) {
  const [subTab, setSubTab] = useState("tracker");
  const cycles = loadCycles();
  const [selectedCycleId, setSelectedCycleId] = useState(cycles.currentCycleId || "");

  const subTabs = [
    { id: "tracker", label: "Tracker" },
    { id: "budgets", label: "Budgets" },
    { id: "admins", label: "Admin Management" },
  ];

  return (
    <div style={{ animation: "fadeSlideUp .3s ease" }}>
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
              {cycles.cycles.map(c => (
                <option key={c.cycleId} value={c.cycleId}>{c.label} ({c.status})</option>
              ))}
            </select>
          </div>
          <AdminTracker selectedCycleId={selectedCycleId} />
        </div>
      )}
      {subTab === "budgets" && <AdminBudgets />}
      {subTab === "admins" && <AdminManagement currentEmail={currentEmail} />}
    </div>
  );
}

// ─── GLOBE ────────────────────────────────────────────────────

function GlobeTab({ donations }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [countries, setCountries] = useState([]);
  const [globeReady, setGlobeReady] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const countryData = useMemo(() => aggregateDonationsByCountry(donations), [donations]);
  const maxDonation = useMemo(() => Math.max(...Object.values(countryData).map(d => d.total), 1), [countryData]);
  const colorScale = useMemo(() => scaleSqrt().domain([0, maxDonation]).range([0, 1]), [maxDonation]);
  const countryCount = Object.keys(countryData).length;

  const oceanPointsData = useMemo(() => {
    const orgTotals = {};
    donations.forEach(d => {
      if (OCEAN_ORGS[d.orgName]) {
        orgTotals[d.orgName] = (orgTotals[d.orgName] || 0) + d.allocatedAmount;
      }
    });
    return Object.entries(orgTotals).map(([name, total]) => {
      const loc = OCEAN_ORGS[name];
      return { lat: loc.lat, lng: loc.lng, name, total, label: loc.label, color: "rgba(14,165,233,0.85)" };
    });
  }, [donations]);

  const allDestinations = useMemo(() => {
    const maxAll = Math.max(maxDonation, ...oceanPointsData.map(d => d.total), 1);
    const countryDests = Object.entries(countryData).map(([code, data]) => {
      const c = COUNTRY_CENTROIDS[code];
      if (!c) return null;
      const lightColor = LIGHT_COLORS[code] || "#fbbf24";
      return { lat: c.lat, lng: c.lng, name: COUNTRY_NAMES[code] || code, code, total: data.total, orgs: data.orgs, isOcean: false, maxRadius: 2 + (data.total / maxAll) * 4, color: lightColor };
    }).filter(Boolean);
    const oceanDests = oceanPointsData.map(d => ({
      ...d, isOcean: true, orgs: { [d.name]: d.total }, maxRadius: 2 + (d.total / maxAll) * 4, color: LIGHT_COLORS[d.name] || "#22d3ee"
    }));
    return [...countryDests, ...oceanDests];
  }, [countryData, oceanPointsData, maxDonation]);

  const arcsData = useMemo(() => allDestinations.map(d => ({
    startLat: SF.lat, startLng: SF.lng, endLat: d.lat, endLng: d.lng, name: d.name, total: d.total, orgs: d.orgs, isOcean: d.isOcean, color: d.color, code: d.code
  })), [allDestinations]);

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
    globeRef.current.pointOfView({ lat, lng, altitude: 0.9 }, 800);
    if (data) setSelectedPoint(data);
    pauseRef.current = setTimeout(() => { controls.autoRotate = true; }, 10000);
  };

  const getAlpha3 = (feat) => ISO_NUM_TO_ALPHA3[String(feat.id)] || null;

  return (
    <div style={{ animation: "fadeSlideUp .4s ease" }}>
      <div style={{ ...glass, padding: "32px 40px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 22, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 600, color: C.text, margin: 0 }}>Global Impact</h3>
          <p style={{ fontSize: 15, color: C.textSoft, fontWeight: 400, marginTop: 5 }}>
            Your donations reach {countryCount} {countryCount === 1 ? "country" : "countries"}{oceanPointsData.length > 0 ? " and the world's oceans" : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, marginRight: 4 }}>From SF</span>
          <div style={{ width: 40, height: 3, borderRadius: 2, background: "linear-gradient(to right, #fbbf24, #f472b6, #34d399, #22d3ee)", opacity: 0.7 }} />
          <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>to the world</span>
        </div>
      </div>

      <div ref={containerRef} style={{ background: "#2d3748", borderRadius: 8, overflow: "hidden", position: "relative", minHeight: 520 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(255,247,230,0.12) 0%, rgba(255,237,200,0.06) 40%, transparent 70%)", pointerEvents: "none", zIndex: 1 }} />
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
          <Globe ref={globeRef} width={containerWidth} height={520} backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            showAtmosphere={true} atmosphereColor="rgba(255,237,200,0.3)" atmosphereAltitude={0.18} animateIn={true}
            polygonsData={countries}
            polygonAltitude={() => 0.002}
            polygonCapColor={() => "rgba(255,255,255,0.03)"}
            polygonSideColor={() => "rgba(0,0,0,0)"}
            polygonStrokeColor={() => "rgba(255,255,255,0.18)"}
            polygonLabel={d => {
              const name = d.properties.name || "Unknown";
              return `<div style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(34,37,32,0.12);border-radius:6px;padding:8px 14px;box-shadow:0 4px 12px rgba(0,0,0,0.1);font-family:'Montserrat',sans-serif;"><div style="font-size:14px;color:#222520;font-weight:500;">${name}</div></div>`;
            }}
            onPolygonClick={d => { const code = getAlpha3(d); const c = code && COUNTRY_CENTROIDS[code]; const data = code && countryData[code]; if (c) focusPoint(c.lat, c.lng, data ? { name: d.properties.name || code, orgs: data.orgs, total: data.total, color: LIGHT_COLORS[code] || "#fbbf24", isOcean: false } : null); }}
            onPolygonHover={() => {}} polygonsTransitionDuration={300}
            arcsData={arcsData}
            arcStartLat={d => d.startLat}
            arcStartLng={d => d.startLng}
            arcEndLat={d => d.endLat}
            arcEndLng={d => d.endLng}
            arcColor={d => [`rgba(255,255,255,1)`, `${d.color}ff`]}
            arcStroke={0.6}
            arcDashLength={0.5}
            arcDashGap={0.15}
            arcDashAnimateTime={1500}
            arcAltitudeAutoScale={0.4}
            onArcClick={d => focusPoint(d.endLat, d.endLng, { name: d.name, orgs: d.orgs, total: d.total, color: d.color, isOcean: d.isOcean })}
            arcLabel={d => `<div style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(34,37,32,0.12);border-radius:6px;padding:8px 14px;box-shadow:0 4px 12px rgba(0,0,0,0.1);font-family:'Montserrat',sans-serif;"><div style="font-size:14px;color:#222520;font-weight:500;">${d.name}</div></div>`}
            ringsData={allDestinations}
            ringLat={d => d.lat}
            ringLng={d => d.lng}
            ringAltitude={0.005}
            ringColor={d => {
              const hex = d.color;
              const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
              return t => `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},${Math.pow(1 - t, 0.5)})`;
            }}
            ringMaxRadius={d => d.maxRadius}
            ringPropagationSpeed={1.2}
            ringRepeatPeriod={1200}
            pointsData={allDestinations}
            pointLat={d => d.lat}
            pointLng={d => d.lng}
            pointAltitude={0.008}
            pointRadius={0.35}
            pointColor={d => d.color}
            onPointClick={d => focusPoint(d.lat, d.lng, { name: d.name, orgs: d.orgs, total: d.total, color: d.color, isOcean: d.isOcean })}
            onRingClick={d => focusPoint(d.lat, d.lng, { name: d.name, orgs: d.orgs, total: d.total, color: d.color, isOcean: d.isOcean })}
          />
        )}
        {selectedPoint && (
          <div style={{ position: "absolute", top: 20, right: 20, zIndex: 10, background: "#fff", border: "1px solid rgba(34,37,32,0.08)", borderRadius: 8, padding: "20px 24px", minWidth: 240, maxWidth: 320, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", fontFamily: "'Montserrat',sans-serif", animation: "fadeSlideUp .3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: selectedPoint.color, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, marginBottom: 4 }}>{selectedPoint.isOcean ? "Ocean Conservation" : "Country"}</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#222520", fontFamily: "'Playfair Display',Georgia,serif" }}>{selectedPoint.name}</div>
              </div>
              <button onClick={() => setSelectedPoint(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 6px", fontSize: 18, color: "#8A8D85", lineHeight: 1 }}>&times;</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              {Object.entries(selectedPoint.orgs).sort((a, b) => b[1] - a[1]).map(([org, amt]) => (
                <div key={org} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "7px 0", borderBottom: "1px solid rgba(34,37,32,0.08)" }}>
                  <span style={{ fontSize: 14, color: "#555850" }}>{org}</span>
                  <span style={{ fontSize: 14, color: "#222520", fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(amt)}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid rgba(34,37,32,0.1)" }}>
              <span style={{ fontSize: 12, color: "#8A8D85", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 500 }}>Total</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: selectedPoint.color }}>{fmt(selectedPoint.total)}</span>
            </div>
          </div>
        )}
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
      <div style={{ width: 420, textAlign: "center", animation: "fadeSlideUp .6s ease" }}>
        <h1 style={{ fontSize: 44, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, color: C.text, margin: "0 0 12px", letterSpacing: "-0.03em" }}>GiveTrack</h1>
        <p style={{ color: C.textMuted, fontSize: 16, margin: "0 0 48px", fontWeight: 400, lineHeight: 1.6 }}>Track the impact of your generosity</p>

        <div style={{ background: "#fff", borderRadius: 8, padding: "48px 48px", border: `1px solid ${C.divider}` }}>
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
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  // Seed localStorage on first load
  useEffect(() => { seedFromDemoData(); }, []);

  const handleLogin = async (googleUser) => {
    setUser(googleUser); setLoading(true); setDataError("");
    setIsUserAdmin(checkIsAdmin(googleUser.email));
    try {
      if (USE_DEMO_DATA) { setDonations(DEMO_DATA[googleUser.email] || []); }
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
       ) : <Dashboard user={user} donations={donations} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} dataError={dataError} isUserAdmin={isUserAdmin} />}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────

function Dashboard({ user, donations, activeTab, setActiveTab, onLogout, dataError, isUserAdmin }) {
  const [expandedOrgs, setExpandedOrgs] = useState(new Set());
  const [imgErrors, setImgErrors] = useState({});
  const [fetchedImages, setFetchedImages] = useState({});

  const totalDonated = donations.reduce((s, d) => s + d.allocatedAmount, 0);
  const primaryCurrency = donations[0]?.currency || "$";
  const orgTotals = {}, orgUrls = {};
  donations.forEach(d => {
    orgTotals[d.orgName] = (orgTotals[d.orgName] || 0) + d.allocatedAmount;
    if (d.paidTo?.startsWith("http")) orgUrls[d.orgName] = d.paidTo;
  });

  // Auto-fetch og:image for orgs not in the hardcoded ORG_IMAGES map
  useEffect(() => {
    const orgsNeedingImages = Object.keys(orgTotals).filter(
      name => !ORG_IMAGES[name] && !fetchedImages[name] && orgUrls[name]
    );
    orgsNeedingImages.forEach(name => {
      const url = orgUrls[name];
      fetch(`/api/og-image?url=${encodeURIComponent(url)}`)
        .then(r => r.json())
        .then(data => {
          if (data.image) {
            setFetchedImages(prev => ({ ...prev, [name]: data.image }));
          }
        })
        .catch(() => {});
    });
  }, [Object.keys(orgTotals).join(",")]);
  const orgCount = Object.keys(orgTotals).length;
  const months = sortMonths([...new Set(donations.map(d => d.month).filter(Boolean))]);
  const cycles = [...new Set(donations.map(d => d.cycle).filter(Boolean))];
  const monthlyData = months.map(m => {
    const md = donations.filter(d => d.month === m);
    const total = md.reduce((s, d) => s + d.allocatedAmount, 0);
    const og = {}; md.forEach(d => { og[d.orgName] = (og[d.orgName] || 0) + d.allocatedAmount; });
    return { label: m.replace(" 20", "'"), total, segments: Object.entries(og).map(([n, v]) => ({ value: v, color: getOrgColor(n) })) };
  });
  const donutData = Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ label: n, value: v, color: getOrgColor(n) }));
  const avgCycle = cycles.length > 0 ? totalDonated / cycles.length : 0;
  const countriesReached = [...new Set(donations.map(d => ORG_COUNTRY_MAP[d.orgName]).filter(Boolean))].length;
  const categoryTotals = {};
  donations.forEach(d => { const cat = ORG_CATEGORIES[d.orgName] || "Other"; categoryTotals[cat] = (categoryTotals[cat] || 0) + d.allocatedAmount; });
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const categoryCount = Object.keys(categoryTotals).length;

  const monthBreakdowns = months.map((m) => {
    const md = donations.filter(d => d.month === m);
    const total = md.reduce((s, d) => s + d.allocatedAmount, 0);
    const orgBreakdown = {};
    md.forEach(d => { orgBreakdown[d.orgName] = (orgBreakdown[d.orgName] || 0) + d.allocatedAmount; });
    const mDonut = Object.entries(orgBreakdown).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ label: name, value, color: getOrgColor(name) }));
    return { month: m, total, donutData: mDonut, donationCount: md.length };
  });

  // Team data — aggregate totals only (no individual breakdowns for privacy)
  const teamData = useMemo(() => {
    let teamTotal = 0;
    const teamOrgs = new Set();
    const memberCount = Object.keys(DEMO_DATA).length;
    Object.values(DEMO_DATA).forEach(dons => {
      dons.forEach(d => {
        teamTotal += d.allocatedAmount;
        teamOrgs.add(d.orgName);
      });
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
  }, []);

  const tabs = [
    { id: "overview", label: "Overview", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg> },
    { id: "breakdown", label: "Organizations", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
    { id: "allocation", label: "Monthly", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
    { id: "donate", label: "Donate", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
    { id: "team", label: "Team", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: "impact", label: "Impact", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
    ...(isUserAdmin ? [{ id: "admin", label: "Admin", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Header */}
      <header style={{ padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.divider}`, background: C.bg, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>GiveTrack</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{user.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{user.email}</div>
          </div>
          {user.picture && <img src={user.picture} alt="" style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.divider}` }} />}
          <button onClick={onLogout} style={{ padding: "7px 16px", background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 4, color: C.textSoft, fontSize: 13, cursor: "pointer", transition: "all .15s", fontWeight: 500 }}
            onMouseEnter={e => { e.target.style.background = C.text; e.target.style.color = "#fff"; e.target.style.borderColor = C.text; }}
            onMouseLeave={e => { e.target.style.borderColor = C.cardBorder; e.target.style.color = C.textSoft; e.target.style.background = "transparent"; }}>Sign out</button>
        </div>
      </header>

      {/* STICKY TAB BAR — full width, below header */}
      {donations.length > 0 && (
        <nav style={{ position: "sticky", top: 67, zIndex: 99, background: C.bg, borderBottom: `1px solid ${C.divider}` }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 32px", display: "flex", gap: 0, overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{
                padding: "14px 28px", background: "transparent", border: "none",
                borderBottom: activeTab === t.id ? `2px solid ${C.text}` : "2px solid transparent",
                color: activeTab === t.id ? C.text : C.textMuted, fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
                cursor: "pointer", transition: "all .2s", marginBottom: -1, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
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
        <div style={{ position: "relative", height: 620, overflow: "hidden", animation: "fadeSlideUp .5s ease" }}>
          <img src={HERO_IMAGE} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%", display: "block", filter: "saturate(1.15) contrast(1.1) sepia(0.25) brightness(1.05)" }}
            onError={e => { e.target.style.display = "none"; }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(220,160,60,0.18) 0%, rgba(200,100,50,0.12) 50%, rgba(180,140,80,0.15) 100%)", mixBlendMode: "multiply" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,240,200,0.08)", mixBlendMode: "screen" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.07, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", backgroundSize: "128px 128px", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "56px 64px" }}>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: ".15em", fontWeight: 600, marginBottom: 14 }}>Total Donated</div>
            <div style={{ fontSize: 88, fontWeight: 900, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.02em", lineHeight: 1, textShadow: "0 3px 6px rgba(0,0,0,0.7), 0 6px 20px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.25)" }}>
              <AnimatedNumber value={totalDonated} currency={primaryCurrency} />
            </div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", marginTop: 18, fontWeight: 500, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
              Welcome back, {user.name.split(" ")[0]} — across {cycles.length} payroll cycles
            </div>
          </div>
        </div>

        {/* FULL-BLEED DARK STAT STRIP */}
        <div style={{ background: C.text, padding: "44px 64px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {[
            { label: "Per cycle", value: avgCycle },
            { label: "Organizations", value: orgCount, isCount: true },
            { label: "Countries reached", value: countriesReached, isCount: true },
            { label: "Months active", value: months.length, isCount: true },
          ].map((stat, i) => (
            <div key={i} style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 500, marginBottom: 12 }}>{stat.label}</div>
              <div style={{ fontSize: 42, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.02em" }}>
                {stat.isCount ? stat.value : <AnimatedNumber value={stat.value} currency={primaryCurrency} />}
              </div>
            </div>
          ))}
        </div>
      </>)}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: donations.length > 0 && activeTab === "overview" ? "72px 32px 100px" : "48px 32px 100px" }}>
        {dataError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "16px 20px", marginBottom: 28, color: "#dc2626", fontSize: 15, fontWeight: 500 }}>{dataError}</div>}

        {donations.length === 0 && !dataError ? (
          <div style={{ ...glass, padding: "80px 36px", textAlign: "center", animation: "fadeSlideUp .4s ease" }}>
            <h3 style={{ fontSize: 24, fontWeight: 600, color: C.text, marginBottom: 12, fontFamily: "'Playfair Display',Georgia,serif" }}>No donations found</h3>
            <p style={{ color: C.textSoft, fontSize: 16, maxWidth: 400, margin: "0 auto", lineHeight: 1.7 }}>We couldn't find any records linked to {user.email}. Please contact your administrator.</p>
          </div>
        ) : donations.length > 0 && (<>
          {/* ═══════════════ OVERVIEW ═══════════════ */}
          {activeTab === "overview" && (<>
            {/* Section heading */}
            <div style={{ marginBottom: 40 }}>
              <h2 style={{ fontSize: 28, fontWeight: 600, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", margin: 0 }}>Your Giving</h2>
              <p style={{ fontSize: 15, color: C.textMuted, marginTop: 8 }}>A breakdown of where your contributions go</p>
            </div>

            {/* Charts — asymmetric layout */}
            <div style={{ display: "grid", gridTemplateColumns: months.length > 1 ? "58fr 42fr" : "1fr", gap: 32, marginBottom: 64 }}>
              {months.length > 1 && (
                <div style={{ ...glass, padding: "36px 40px", animation: "fadeSlideUp .4s ease .15s both" }}>
                  <h3 style={{ fontSize: 22, fontWeight: 600, color: C.text, margin: "0 0 32px", fontFamily: "'Playfair Display',Georgia,serif" }}>Monthly overview</h3>
                  <BarChart data={monthlyData} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 18px", marginTop: 20, padding: "20px 0 0", borderTop: `1px solid ${C.divider}` }}>
                    {Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([n]) => (
                      <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textSoft, minWidth: 0, padding: "4px 0" }}>
                        <div style={{ width: 8, height: 8, borderRadius: 3, background: getOrgColor(n), flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ ...glass, padding: "36px 40px", display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeSlideUp .4s ease .2s both" }}>
                <h3 style={{ fontSize: 22, fontWeight: 600, color: C.text, margin: "0 0 32px", alignSelf: "flex-start", fontFamily: "'Playfair Display',Georgia,serif" }}>Allocation breakdown</h3>
                <DonutChart data={donutData} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28, width: "100%" }}>
                  {donutData.slice(0, 8).map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                        <span style={{ color: C.textSoft, fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500, width: 32, textAlign: "right" }}>{((d.value / totalDonated) * 100).toFixed(0)}%</span>
                        <span style={{ fontWeight: 600, color: C.text, minWidth: 68, textAlign: "right" }}>{fmt(d.value)}</span>
                      </div>
                    </div>
                  ))}
                  {donutData.length > 8 && (
                    <div style={{ fontSize: 13, color: C.textMuted, textAlign: "center", padding: "6px 0" }}>+{donutData.length - 8} more organizations</div>
                  )}
                </div>
              </div>
            </div>

            {/* Cause areas */}
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", margin: "0 0 24px" }}>Cause Areas</h2>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ padding: "12px 24px", borderRadius: 4, background: "#fff", border: `1px solid ${C.divider}`, display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: C.text }}>{cat}</span>
                    <span style={{ fontSize: 14, color: C.textMuted, fontWeight: 600 }}>{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          {/* ═══════════════ ORGANIZATIONS ═══════════════ */}
          {activeTab === "breakdown" && (
            <div style={{ animation: "fadeSlideUp .3s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([name, total], i) => {
                  const od = donations.filter(d => d.orgName === name);
                  const url = orgUrls[name];
                  const color = getOrgColor(name);
                  const category = ORG_CATEGORIES[name];
                  const img = ORG_IMAGES[name] || fetchedImages[name];
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
                        {img && !imgErrors[name] && (
                          <img src={img} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", objectPosition: ORG_IMAGE_POS[name] || "center center" }}
                            onError={() => setImgErrors(prev => ({ ...prev, [name]: true }))} />
                        )}
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
                          <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'Playfair Display',Georgia,serif" }}>{fmt(total)}</div>
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
                            {Object.entries(byMonth).map(([m, amt]) => (
                              <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.divider}` }}>
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
                                  <span key={c} style={{ fontSize: 12, color: C.textMuted, background: "rgba(34,37,32,0.06)", padding: "4px 10px", borderRadius: 8 }}>{c}</span>
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
              <div style={{ ...glass, padding: "28px 40px", marginBottom: 36, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

              {[...monthBreakdowns].reverse().map((mb, ci) => (
                <div key={mb.month} style={{ ...glass, marginBottom: 28, overflow: "hidden", animation: `fadeSlideUp .4s ease ${ci*.06}s both` }}>
                  <div style={{ padding: "22px 32px", borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ fontSize: 22, fontWeight: 600, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", margin: 0 }}>{mb.month}</h3>
                      <span style={{ fontSize: 14, color: C.textSoft, marginTop: 4, display: "block" }}>{mb.donationCount} transaction{mb.donationCount !== 1 ? "s" : ""}</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: C.navy, fontFamily: "'Playfair Display',Georgia,serif" }}>{fmt(mb.total, primaryCurrency)}</div>
                  </div>

                  <div style={{ padding: "26px 32px", display: "flex", gap: 36, alignItems: "flex-start" }}>
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
            </div>
          )}

          {/* ═══════════════ TEAM ═══════════════ */}
          {activeTab === "team" && (
            <div style={{ animation: "fadeSlideUp .3s ease" }}>
              {/* Team hero */}
              <div style={{ borderRadius: 8, overflow: "hidden", position: "relative", height: 240, marginBottom: 28, background: C.text }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "36px 48px" }}>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 500, marginBottom: 8 }}>Isara Team Impact</div>
                  <div style={{ fontSize: 54, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.03em", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.25), 0 0 80px rgba(255,255,255,0.15)" }}>
                    <AnimatedNumber value={teamData.teamTotal} />
                  </div>
                  <div style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", marginTop: 12 }}>
                    {teamData.memberCount} team members supporting {teamData.orgCount} organizations
                  </div>
                </div>
              </div>

              {/* Summary stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 22 }}>
                {[
                  { label: "Team Members", value: teamData.memberCount, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                  { label: "Organizations", value: teamData.orgCount, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
                  { label: "Cause Areas", value: teamData.orgsByCategory.length, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
                ].map((stat, i) => (
                  <div key={i} style={{ ...glass, padding: "24px 28px", animation: `fadeSlideUp .4s ease ${i*.06}s both` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: C.navy }}>{stat.icon}</div>
                    <div style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8, fontWeight: 500 }}>{stat.label}</div>
                    <div style={{ fontSize: 32, fontWeight: 700, color: C.text, fontFamily: "'Playfair Display',Georgia,serif", lineHeight: 1 }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Organizations we support — grouped by category */}
              <div style={{ ...glass, padding: "40px 44px", animation: "fadeSlideUp .4s ease .1s both" }}>
                <h3 style={{ fontSize: 22, fontWeight: 600, color: C.text, margin: "0 0 8px", fontFamily: "'Playfair Display',Georgia,serif" }}>Organizations We Support</h3>
                <p style={{ fontSize: 15, color: C.textSoft, margin: "0 0 32px" }}>Our team collectively supports these organizations across {teamData.orgsByCategory.length} cause areas.</p>

                {teamData.orgsByCategory.map(([category, orgs], ci) => (
                  <div key={category} style={{ marginBottom: ci < teamData.orgsByCategory.length - 1 ? 28 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.navy, textTransform: "uppercase", letterSpacing: ".08em" }}>{category}</div>
                      <div style={{ flex: 1, height: 1, background: C.divider }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      {orgs.map((orgName) => {
                        const img = ORG_IMAGES[orgName] || fetchedImages[orgName];
                        const desc = ORG_DESCRIPTIONS[orgName] || "";
                        const website = ORG_WEBSITES[orgName] || orgUrls[orgName];
                        const color = getOrgColor(orgName);
                        return (
                          <div key={orgName} style={{ display: "flex", gap: 14, padding: "16px 18px", borderRadius: 8, border: `1px solid ${C.divider}`, transition: "all .2s", background: "#fff" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,202,10,0.3)"; e.currentTarget.style.background = C.accentSoft; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.divider; e.currentTarget.style.background = "rgba(255,255,255,0.4)"; }}>
                            {/* Org thumbnail */}
                            <div style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", flexShrink: 0, background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
                              {img && !imgErrors[orgName] ? (
                                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: ORG_IMAGE_POS[orgName] || "center center" }}
                                  onError={() => setImgErrors(prev => ({ ...prev, [orgName]: true }))} />
                              ) : (
                                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color, fontFamily: "'Playfair Display',Georgia,serif" }}>
                                  {orgName.charAt(0)}
                                </div>
                              )}
                            </div>
                            {/* Org info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>{orgName}</div>
                              <div style={{ fontSize: 13, color: C.textSoft, lineHeight: 1.5, marginBottom: 6 }}>{desc}</div>
                              {website && (
                                <a href={website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.navy, textDecoration: "none", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}
                                  onClick={e => e.stopPropagation()}>
                                  Visit website
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════ IMPACT GLOBE ═══════════════ */}
          {activeTab === "donate" && (
            <DonateTab userEmail={user.email} />
          )}

          {activeTab === "impact" && (
            <GlobeTab donations={donations} />
          )}

          {activeTab === "admin" && isUserAdmin && (
            <AdminTab currentEmail={user.email} />
          )}
        </>)}
      </div>

      {/* Photo */}
      <div style={{ display: "flex", justifyContent: "center", padding: "20px 0 40px" }}>
        <img src="/hero.jpg" alt="" style={{ maxWidth: 640, width: "100%", borderRadius: 0, display: "block", filter: "saturate(1.15) contrast(1.1) sepia(0.25) brightness(1.05)" }} />
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "60px 0 48px", borderTop: `1px solid ${C.divider}` }}>
        <p style={{ color: C.textMuted, fontSize: 15, fontStyle: "italic", fontWeight: 400, letterSpacing: ".01em", lineHeight: 1.7, fontFamily: "'Playfair Display',Georgia,serif" }}>
          "No one has ever become poor by giving." — Anne Frank
        </p>
        <p style={{ color: C.textMuted, fontSize: 12, letterSpacing: ".1em", fontWeight: 500, marginTop: 16, textTransform: "uppercase" }}>GiveTrack · {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
