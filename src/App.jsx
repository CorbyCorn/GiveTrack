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
const HERO_IMAGE = "https://images.unsplash.com/photo-1722963220475-979db2dbf216?w=1200&h=600&fit=crop&q=80";

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
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: 20,
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
      <div style={{ ...glass, padding: "28px 32px", marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

      <div ref={containerRef} style={{ background: "#2d3748", borderRadius: 20, overflow: "hidden", position: "relative", minHeight: 520 }}>
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
              return `<div style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(34,37,32,0.12);border-radius:10px;padding:8px 14px;box-shadow:0 4px 12px rgba(0,0,0,0.1);font-family:'Montserrat',sans-serif;"><div style="font-size:14px;color:#222520;font-weight:500;">${name}</div></div>`;
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
            arcLabel={d => `<div style="background:rgba(255,255,255,0.95);backdrop-filter:blur(12px);border:1px solid rgba(34,37,32,0.12);border-radius:10px;padding:8px 14px;box-shadow:0 4px 12px rgba(0,0,0,0.1);font-family:'Montserrat',sans-serif;"><div style="font-size:14px;color:#222520;font-weight:500;">${d.name}</div></div>`}
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
          <div style={{ position: "absolute", top: 20, right: 20, zIndex: 10, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)", border: "1px solid rgba(34,37,32,0.12)", borderRadius: 16, padding: "20px 24px", minWidth: 240, maxWidth: 320, boxShadow: "0 12px 32px rgba(0,0,0,0.2)", fontFamily: "'Montserrat',sans-serif", animation: "fadeSlideUp .3s ease" }}>
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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF7F0", position: "relative", overflow: "hidden" }}>
      {/* Organic blobs */}
      <div style={{ position: "fixed", top: -120, right: -80, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,202,10,0.1) 0%, transparent 70%)", filter: "blur(60px)", animation: "float 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -100, left: -60, width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,51,102,0.06) 0%, transparent 70%)", filter: "blur(60px)", animation: "float 15s ease-in-out infinite 2s", pointerEvents: "none" }} />

      <div style={{ width: 460, textAlign: "center", animation: "fadeSlideUp .6s ease", zIndex: 1 }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #003366, #005599)", margin: "0 auto 32px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,51,102,0.3)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 38, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, color: C.text, margin: "0 0 10px", letterSpacing: "-0.03em" }}>GiveTrack</h1>
        <p style={{ color: C.textSoft, fontSize: 17, margin: "0 0 48px", fontWeight: 400 }}>Track the impact of your generosity</p>

        <div style={{ ...glass, padding: "48px 52px", boxShadow: "0 8px 40px rgba(34,37,32,0.08)" }}>
          <p style={{ color: C.textSoft, fontSize: 16, marginBottom: 32, fontWeight: 400, lineHeight: 1.6 }}>Sign in with your company Google account to view your charitable giving.</p>
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

  const handleLogin = async (googleUser) => {
    setUser(googleUser); setLoading(true); setDataError("");
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
       ) : <Dashboard user={user} donations={donations} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} dataError={dataError} />}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────

function Dashboard({ user, donations, activeTab, setActiveTab, onLogout, dataError }) {
  const [expandedOrg, setExpandedOrg] = useState(null);
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
    { id: "team", label: "Team", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { id: "impact", label: "Impact", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, position: "relative", overflow: "hidden" }}>
      {/* Organic background blobs */}
      <div style={{ position: "fixed", top: 80, right: -100, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,202,10,0.07) 0%, transparent 70%)", filter: "blur(80px)", animation: "float 18s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", top: "50%", left: -120, width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,51,102,0.04) 0%, transparent 70%)", filter: "blur(80px)", animation: "float 22s ease-in-out infinite 3s", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: -80, right: "30%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,202,10,0.04) 0%, transparent 70%)", filter: "blur(80px)", animation: "float 20s ease-in-out infinite 6s", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <header style={{ padding: "18px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.divider}`, background: "rgba(250,247,240,0.8)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(34,37,32,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #003366, #005599)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <span style={{ fontSize: 19, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>GiveTrack</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{user.name}</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>{user.email}</div>
          </div>
          {user.picture && <img src={user.picture} alt="" style={{ width: 38, height: 38, borderRadius: "50%", border: `2px solid ${C.divider}` }} />}
          <button onClick={onLogout} style={{ padding: "8px 18px", background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 10, color: C.textSoft, fontSize: 14, cursor: "pointer", transition: "all .15s", fontWeight: 500 }}
            onMouseEnter={e => { e.target.style.borderColor = "rgba(34,37,32,0.25)"; e.target.style.color = C.text; e.target.style.background = "rgba(34,37,32,0.04)"; }}
            onMouseLeave={e => { e.target.style.borderColor = C.cardBorder; e.target.style.color = C.textSoft; e.target.style.background = "transparent"; }}>Sign out</button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "44px 32px 80px", position: "relative", zIndex: 1 }}>
        {dataError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: "16px 20px", marginBottom: 28, color: "#dc2626", fontSize: 15, fontWeight: 500 }}>{dataError}</div>}

        {donations.length === 0 && !dataError ? (
          <div style={{ ...glass, padding: "64px 36px", textAlign: "center", animation: "fadeSlideUp .4s ease" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: C.accentLight, margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: C.text, marginBottom: 10 }}>No donations found</h3>
            <p style={{ color: C.textSoft, fontSize: 16, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>We couldn't find any records linked to {user.email}. Please contact your administrator.</p>
          </div>
        ) : donations.length > 0 && (<>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 40, borderBottom: `1px solid ${C.divider}`, overflowX: "auto" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: "14px 26px", background: "transparent", border: "none",
                borderBottom: activeTab === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
                color: activeTab === t.id ? C.text : C.textMuted, fontSize: 15, fontWeight: activeTab === t.id ? 600 : 400,
                cursor: "pointer", transition: "all .2s", marginBottom: -1, display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
              }}
                onMouseEnter={e => { if (activeTab !== t.id) e.target.style.color = C.textSoft; }}
                onMouseLeave={e => { if (activeTab !== t.id) e.target.style.color = C.textMuted; }}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ═══════════════ OVERVIEW ═══════════════ */}
          {activeTab === "overview" && (<>
            {/* Hero photo card — full width bento */}
            <div style={{ borderRadius: 24, overflow: "hidden", position: "relative", height: 280, marginBottom: 20, animation: "fadeSlideUp .5s ease" }}>
              <img src={HERO_IMAGE} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                onError={e => { e.target.style.display = "none"; }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(0,51,102,0.88) 0%, rgba(0,85,153,0.78) 100%)" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 48px" }}>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 500, marginBottom: 10 }}>Total Donated</div>
                <div style={{ fontSize: 60, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.03em", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.25), 0 0 80px rgba(255,255,255,0.15)" }}>
                  <AnimatedNumber value={totalDonated} currency={primaryCurrency} />
                </div>
                <div style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", marginTop: 14, fontWeight: 400 }}>
                  Welcome back, {user.name.split(" ")[0]} — across {cycles.length} payroll cycles
                </div>
              </div>
            </div>

            {/* 3 stat cards — bento grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 28 }}>
              {[
                { label: "Per cycle", value: avgCycle, sub: "Average contribution", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> },
                { label: "Organizations", value: orgCount, sub: `${categoryCount} cause areas`, isCount: true, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
                { label: "Countries reached", value: countriesReached, sub: `${months.length} month${months.length !== 1 ? "s" : ""} active`, isCount: true, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
              ].map((card, i) => (
                <div key={i} style={{ ...glass, padding: "26px 28px", animation: `fadeSlideUp .4s ease ${i*.06}s both`, transition: "box-shadow .2s, transform .2s", cursor: "default" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = C.cardHover; e.currentTarget.style.transform = "translateY(-3px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = C.cardShadow; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, color: C.navy }}>
                    {card.icon}
                  </div>
                  <div style={{ fontSize: 13, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontWeight: 500 }}>{card.label}</div>
                  <div style={{ fontSize: 34, fontWeight: 700, color: C.text, marginBottom: 6, lineHeight: 1, fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.02em" }}>
                    {card.isCount ? card.value : <AnimatedNumber value={card.value} currency={primaryCurrency} />}
                  </div>
                  <div style={{ fontSize: 14, color: C.textSoft, fontWeight: 400 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Charts — asymmetric bento grid */}
            <div style={{ display: "grid", gridTemplateColumns: months.length > 1 ? "1.5fr 1fr" : "1fr", gap: 18 }}>
              {months.length > 1 && (
                <div style={{ ...glass, padding: "28px 32px", animation: "fadeSlideUp .4s ease .15s both" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: "0 0 24px", fontFamily: "'Playfair Display',Georgia,serif" }}>Monthly overview</h3>
                  <BarChart data={monthlyData} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 18px", marginTop: 16, padding: "16px 0 0", borderTop: `1px solid ${C.divider}` }}>
                    {Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([n]) => (
                      <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.textSoft, minWidth: 0, padding: "4px 0" }}>
                        <div style={{ width: 8, height: 8, borderRadius: 3, background: getOrgColor(n), flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ ...glass, padding: "28px 32px", display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeSlideUp .4s ease .2s both" }}>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: C.text, margin: "0 0 24px", alignSelf: "flex-start", fontFamily: "'Playfair Display',Georgia,serif" }}>Allocation breakdown</h3>
                <DonutChart data={donutData} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24, width: "100%" }}>
                  {donutData.slice(0, 8).map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 4, background: d.color, flexShrink: 0 }} />
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

            {/* Top cause areas strip */}
            <div style={{ ...glass, marginTop: 18, padding: "24px 32px", animation: "fadeSlideUp .4s ease .25s both" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 16 }}>Your Cause Areas</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ padding: "10px 18px", borderRadius: 14, background: C.accentSoft, border: `1px solid rgba(255,202,10,0.2)`, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{cat}</span>
                    <span style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>)}

          {/* ═══════════════ ORGANIZATIONS ═══════════════ */}
          {activeTab === "breakdown" && (
            <div style={{ animation: "fadeSlideUp .3s ease" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                {Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([name, total], i) => {
                  const od = donations.filter(d => d.orgName === name);
                  const url = orgUrls[name];
                  const color = getOrgColor(name);
                  const category = ORG_CATEGORIES[name];
                  const img = ORG_IMAGES[name] || fetchedImages[name];
                  const isExpanded = expandedOrg === name;
                  const byMonth = {};
                  od.forEach(d => { byMonth[d.month] = (byMonth[d.month] || 0) + d.allocatedAmount; });

                  return (
                    <div key={name} style={{ ...glass, overflow: "hidden", animation: `fadeSlideUp .4s ease ${i*.04}s both`, transition: "box-shadow .3s, transform .3s", cursor: "pointer" }}
                      onClick={() => setExpandedOrg(isExpanded ? null : name)}
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
                          <div style={{ position: "absolute", top: 14, right: 14, fontSize: 11, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", padding: "4px 12px", borderRadius: 20, textTransform: "uppercase", letterSpacing: ".04em" }}>{category}</div>
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
              <div style={{ ...glass, padding: "22px 32px", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                <div key={mb.month} style={{ ...glass, marginBottom: 22, overflow: "hidden", animation: `fadeSlideUp .4s ease ${ci*.06}s both` }}>
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
              <div style={{ borderRadius: 24, overflow: "hidden", position: "relative", height: 240, marginBottom: 22, background: "linear-gradient(135deg, rgba(0,51,102,1) 0%, rgba(0,85,153,0.9) 100%)" }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "36px 48px" }}>
                  <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 500, marginBottom: 8 }}>Isara Team Impact</div>
                  <div style={{ fontSize: 54, fontWeight: 700, color: "#fff", fontFamily: "'Playfair Display',Georgia,serif", letterSpacing: "-0.03em", lineHeight: 1, textShadow: "0 2px 8px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.25), 0 0 80px rgba(255,255,255,0.15)" }}>
                    {fmt(teamData.teamTotal)}
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
              <div style={{ ...glass, padding: "32px 36px", animation: "fadeSlideUp .4s ease .1s both" }}>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: C.text, margin: "0 0 8px", fontFamily: "'Playfair Display',Georgia,serif" }}>Organizations We Support</h3>
                <p style={{ fontSize: 15, color: C.textSoft, margin: "0 0 28px" }}>Our team collectively supports these organizations across {teamData.orgsByCategory.length} cause areas.</p>

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
                          <div key={orgName} style={{ display: "flex", gap: 14, padding: "16px 18px", borderRadius: 14, border: `1px solid ${C.divider}`, transition: "all .2s", background: "rgba(255,255,255,0.4)" }}
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
          {activeTab === "impact" && (
            <GlobeTab donations={donations} />
          )}
        </>)}
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "32px 0 40px", borderTop: `1px solid ${C.divider}`, position: "relative", zIndex: 1 }}>
        <p style={{ color: C.textMuted, fontSize: 14, fontStyle: "italic", fontWeight: 400, letterSpacing: ".01em", lineHeight: 1.6 }}>
          "No one has ever become poor by giving." — Anne Frank
        </p>
        <p style={{ color: C.textMuted, fontSize: 13, letterSpacing: ".06em", fontWeight: 500, marginTop: 12 }}>GiveTrack · {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
