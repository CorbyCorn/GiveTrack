import { useState, useEffect, useRef, useMemo } from "react";
import Globe from "react-globe.gl";
import { scaleSqrt } from "d3-scale";
import * as topojson from "topojson-client";

/*
 * GiveTrack — Employee Charitable Giving Dashboard
 * Premium Modern Design
 */

const GOOGLE_CLIENT_ID = "296721826980-i3sgo6dgklh7v8fppql7mumdnuv0lu33.apps.googleusercontent.com";
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

// ─── GLOBE DATA ──────────────────────────────────────────────

const ORG_COUNTRY_MAP = {
  "Save the Children": "COD",
  "Doctors Without Borders": "COD",
  "Médecins Sans Frontières": "COD",
  "Médecins sans Frontières": "COD",
  "GiveWell": "NGA",
  "Sea Shepherd": "MEX",
  "Evidence Action": "IND",
  "Open Door Legal": "USA",
  "Wholesome Wave": "USA",
  "Room to Read": "NPL",
  "Asylum Access": "KEN",
  "School on Wheels": "USA",
  "Malaria Consortium": "NGA",
  "The Washing Machine Project": "IND",
  "Action Against Hunger": "SYR",
  "Clean Ocean Action": "USA",
  "Middle East Children's Alliance": "PSE",
  "Oceana": "USA",
  "WWF": "CHN",
  "En Ptahy Vidchui": "UKR",
  "Give To IV": "USA",
  "NCCHC Foundation": "USA",
  "Radiance SF": "USA",
  "Reality SF": "USA",
  "SFHS": "USA",
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
    { r: 254, g: 235, b: 210 },
    { r: 253, g: 186, b: 116 },
    { r: 249, g: 115, b: 22 },
    { r: 220, g: 60, b: 40 },
    { r: 153, g: 27, b: 27 },
  ];
  const idx = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, stops.length - 1);
  const f = idx - lo;
  const r = Math.round(stops[lo].r + (stops[hi].r - stops[lo].r) * f);
  const g = Math.round(stops[lo].g + (stops[hi].g - stops[lo].g) * f);
  const b = Math.round(stops[lo].b + (stops[hi].b - stops[lo].b) * f);
  return `rgb(${r},${g},${b})`;
}

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

const FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap";
const GLOBAL_CSS = `
  @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#f8f9fb; color:#111827; -webkit-font-smoothing:antialiased; }
  ::-webkit-scrollbar { width:6px; } ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.15); border-radius:3px; }
  ::selection { background:rgba(15,118,110,0.15); }
`;

const C = {
  bg: "#f8f9fb",
  card: "#ffffff",
  cardBorder: "rgba(0,0,0,0.08)",
  cardShadow: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
  cardHover: "0 4px 16px rgba(0,0,0,0.08)",
  text: "#111827",
  textSoft: "#6b7280",
  textMuted: "#9ca3af",
  accent: "#0f766e",
  accentLight: "#ccfbf1",
  accentSoft: "rgba(15,118,110,0.06)",
  warm: "#f97316",
  warmLight: "#fff7ed",
  divider: "rgba(0,0,0,0.06)",
};

const cardStyle = {
  background: C.card,
  borderRadius: 16,
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

function DonutChart({ data, size = 200 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2 - 12, ir = r * 0.68, gap = 0.025;
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
          <path key={i} d={s.path} fill={s.color} stroke={C.card} strokeWidth="2.5"
            style={{ transition: "transform .3s ease, opacity .3s", transformOrigin: `${size/2}px ${size/2}px`, transform: hovered === i ? "scale(1.05)" : "scale(1)", cursor: "pointer", opacity: hovered !== null && hovered !== i ? 0.35 : 1 }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
        {hovered !== null ? (<>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 2 }}>{slices[hovered].label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{fmt(slices[hovered].value)}</div>
          <div style={{ fontSize: 11, color: slices[hovered].color, fontWeight: 600 }}>{(slices[hovered].fraction * 100).toFixed(1)}%</div>
        </>) : (<>
          <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.accent }}>{fmt(total)}</div>
        </>)}
      </div>
    </div>
  );
}

function BarChart({ data, height = 200 }) {
  const maxVal = Math.max(...data.map(d => d.total), 1);
  const [hb, setHb] = useState(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => { setTimeout(() => setAnimated(true), 100); }, []);
  return (
    <div style={{ width: "100%", height, display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 28, position: "relative" }}>
      {data.map((d, i) => {
        const barH = animated ? (d.total / maxVal) * (height - 48) : 0;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
            onMouseEnter={() => setHb(i)} onMouseLeave={() => setHb(null)}>
            {hb === i && <div style={{ position: "absolute", bottom: barH + 34, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", zIndex: 10 }}>{fmt(d.total)}</div>}
            <div style={{ width: "65%", minWidth: 20, maxWidth: 48, height: barH, borderRadius: "8px 8px 0 0", overflow: "hidden", cursor: "pointer", transition: `height .7s cubic-bezier(.4,0,.2,1) ${i*.06}s, opacity .2s`, opacity: hb !== null && hb !== i ? 0.4 : 1, display: "flex", flexDirection: "column-reverse" }}>
              {d.segments.map((seg, j) => <div key={j} style={{ width: "100%", height: (seg.value / maxVal) * (height - 48), background: seg.color, flexShrink: 0 }} />)}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 8, fontWeight: 500, letterSpacing: ".02em" }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function GlobeTab({ donations }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [countries, setCountries] = useState([]);
  const [globeReady, setGlobeReady] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [containerWidth, setContainerWidth] = useState(800);
  const [hoverD, setHoverD] = useState(null);

  const countryData = useMemo(() => aggregateDonationsByCountry(donations), [donations]);
  const maxDonation = useMemo(() => Math.max(...Object.values(countryData).map(d => d.total), 1), [countryData]);
  const colorScale = useMemo(() => scaleSqrt().domain([0, maxDonation]).range([0, 1]), [maxDonation]);
  const countryCount = Object.keys(countryData).length;

  useEffect(() => {
    fetch("https://unpkg.com/world-atlas@2.0.2/countries-110m.json")
      .then(res => res.json())
      .then(data => {
        const geoJson = topojson.feature(data, data.objects.countries);
        setCountries(geoJson.features);
        setGlobeReady(true);
      })
      .catch(() => setFetchError(true));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!globeRef.current || !globeReady) return;
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.enableZoom = true;
    controls.minDistance = 150;
    controls.maxDistance = 500;
    let timeout;
    const pause = () => {
      controls.autoRotate = false;
      clearTimeout(timeout);
      timeout = setTimeout(() => { controls.autoRotate = true; }, 3000);
    };
    controls.addEventListener("start", pause);
    return () => { controls.removeEventListener("start", pause); clearTimeout(timeout); };
  }, [globeReady]);

  const getAlpha3 = (feat) => ISO_NUM_TO_ALPHA3[String(feat.id)] || null;

  return (
    <div style={{ animation: "fadeSlideUp .4s ease" }}>
      <div style={{ ...cardStyle, padding: "24px 28px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ fontSize: 20, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, color: C.text, margin: 0 }}>Global Impact</h3>
          <p style={{ fontSize: 13, color: C.textSoft, fontWeight: 400, marginTop: 4 }}>
            Your donations reach {countryCount} {countryCount === 1 ? "country" : "countries"} worldwide
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 500 }}>Less</span>
          <div style={{ width: 120, height: 8, borderRadius: 4, background: "linear-gradient(to right, #fed7aa, #f97316, #991b1b)" }} />
          <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 500 }}>More</span>
        </div>
      </div>

      <div ref={containerRef} style={{ background: "#111827", borderRadius: 16, overflow: "hidden", position: "relative", minHeight: 520 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 40%, rgba(15,118,110,0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 1 }} />
        {!globeReady && !fetchError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, zIndex: 5 }}>
            <div style={{ width: 28, height: 28, border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(255,255,255,0.6)", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Loading globe...</p>
          </div>
        )}
        {fetchError && (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Unable to load map data. Please refresh to try again.</p>
          </div>
        )}
        {globeReady && (
          <Globe
            ref={globeRef}
            width={containerWidth}
            height={520}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            showAtmosphere={true}
            atmosphereColor="rgba(15,118,110,0.3)"
            atmosphereAltitude={0.15}
            animateIn={true}
            polygonsData={countries}
            polygonAltitude={d => countryData[getAlpha3(d)] ? 0.015 : 0.004}
            polygonCapColor={d => {
              const code = getAlpha3(d);
              if (!code || !countryData[code]) return "rgba(255,255,255,0.06)";
              return warmColorInterpolate(colorScale(countryData[code].total));
            }}
            polygonSideColor={d => {
              const code = getAlpha3(d);
              if (!code || !countryData[code]) return "rgba(255,255,255,0.02)";
              return "rgba(249,115,22,0.2)";
            }}
            polygonStrokeColor={() => "rgba(255,255,255,0.1)"}
            polygonLabel={d => {
              const code = getAlpha3(d);
              const name = d.properties.name || "Unknown";
              const data = code && countryData[code];
              if (!data) {
                return `<div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:10px 16px;box-shadow:0 8px 24px rgba(0,0,0,0.12);font-family:'Inter',-apple-system,sans-serif;"><div style="font-size:13px;color:#111827;font-weight:500;">${name}</div><div style="font-size:11px;color:#9ca3af;margin-top:2px;">No donations</div></div>`;
              }
              const orgLines = Object.entries(data.orgs).sort((a, b) => b[1] - a[1]).map(([org, amt]) =>
                `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05);"><span style="font-size:12px;color:#6b7280;">${org}</span><span style="font-size:12px;color:#111827;font-weight:600;white-space:nowrap;">${fmt(amt)}</span></div>`
              ).join("");
              return `<div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:14px;padding:18px 22px;min-width:220px;max-width:320px;box-shadow:0 12px 32px rgba(0,0,0,0.15);font-family:'Inter',-apple-system,sans-serif;pointer-events:none;"><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;font-weight:500;">Country</div><div style="font-size:18px;font-weight:600;color:#111827;margin-bottom:14px;font-family:'DM Sans',sans-serif;">${name}</div><div style="margin-bottom:14px;">${orgLines}</div><div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid rgba(0,0,0,0.08);"><span style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;font-weight:500;">Total</span><span style="font-size:18px;font-weight:700;color:#0f766e;">${fmt(data.total)}</span></div></div>`;
            }}
            onPolygonHover={setHoverD}
            polygonsTransitionDuration={300}
          />
        )}
      </div>

      {countryCount > 0 && (
        <div style={{ ...cardStyle, marginTop: 16, overflow: "hidden", animation: "fadeSlideUp .4s ease .1s both" }}>
          <div style={{ padding: "18px 24px 12px" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Donations by country</h3>
          </div>
          {Object.entries(countryData).sort((a, b) => b[1].total - a[1].total).map(([code, data], i) => (
            <div key={code} style={{ padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${C.divider}`, animation: `fadeSlideUp .4s ease ${i * .04}s both`, transition: "background .15s" }}
              onMouseEnter={e => e.currentTarget.style.background = C.accentSoft}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: warmColorInterpolate(colorScale(data.total)), flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{COUNTRY_NAMES[code] || code}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{Object.keys(data.orgs).join(", ")}</div>
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmt(data.total)}</div>
            </div>
          ))}
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
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          try {
            const payload = JSON.parse(atob(response.credential.split(".")[1]));
            onLogin({ email: payload.email, name: payload.name, picture: payload.picture });
          } catch { setError("Login failed. Please try again."); }
        },
        auto_select: false,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        { theme: "outline", size: "large", width: 300, text: "signin_with", shape: "pill" }
      );
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <div style={{ width: 440, textAlign: "center", animation: "fadeSlideUp .6s ease" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: C.accent, margin: "0 auto 28px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(15,118,110,0.25)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 32, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: C.text, margin: "0 0 8px", letterSpacing: "-0.02em" }}>GiveTrack</h1>
        <p style={{ color: C.textSoft, fontSize: 15, margin: "0 0 44px", fontWeight: 400 }}>Your personal donation dashboard</p>

        <div style={{ ...cardStyle, padding: "40px 44px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <p style={{ color: C.textSoft, fontSize: 14, marginBottom: 28, fontWeight: 400, lineHeight: 1.6 }}>Sign in with your company Google account to view your charitable giving.</p>
          <div id="google-signin-btn" style={{ display: "flex", justifyContent: "center" }}></div>
          {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 16, fontWeight: 500 }}>{error}</div>}
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
      if (USE_DEMO_DATA) {
        setDonations(DEMO_DATA[googleUser.email] || []);
      } else {
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
        <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ width: 32, height: 32, border: `2px solid ${C.divider}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          <p style={{ color: C.textSoft, fontSize: 13, fontWeight: 500 }}>Loading your data...</p>
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
    const og = {}; md.forEach(d => { og[d.orgName] = (og[d.orgName] || 0) + d.allocatedAmount; });
    return { label: m.replace(" 20", "'"), total, segments: Object.entries(og).map(([n, v]) => ({ value: v, color: getOrgColor(n) })) };
  });
  const donutData = Object.entries(orgTotals).sort((a, b) => b[1] - a[1]).map(([n, v]) => ({ label: n, value: v, color: getOrgColor(n) }));
  const avgCycle = cycles.length > 0 ? totalDonated / cycles.length : 0;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "breakdown", label: "Organizations" },
    { id: "history", label: "History" },
    { id: "impact", label: "Impact" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      {/* Header */}
      <header style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.divider}`, background: "rgba(248,249,251,0.85)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>GiveTrack</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{user.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{user.email}</div>
          </div>
          {user.picture && <img src={user.picture} alt="" style={{ width: 34, height: 34, borderRadius: "50%", border: `2px solid ${C.divider}` }} />}
          <button onClick={onLogout} style={{ padding: "7px 16px", background: "transparent", border: `1px solid ${C.cardBorder}`, borderRadius: 8, color: C.textSoft, fontSize: 12, cursor: "pointer", transition: "all .15s", fontWeight: 500 }}
            onMouseEnter={e => { e.target.style.borderColor = "rgba(0,0,0,0.2)"; e.target.style.color = C.text; e.target.style.background = "rgba(0,0,0,0.02)"; }}
            onMouseLeave={e => { e.target.style.borderColor = C.cardBorder; e.target.style.color = C.textSoft; e.target.style.background = "transparent"; }}>Sign out</button>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 28px 80px" }}>
        {/* Welcome */}
        <div style={{ marginBottom: 40, animation: "fadeSlideUp .4s ease" }}>
          <h2 style={{ fontSize: 28, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, margin: "0 0 6px", color: C.text, letterSpacing: "-0.02em" }}>
            Welcome back, {user.name.split(" ")[0]}
          </h2>
          <p style={{ color: C.textSoft, fontSize: 14, fontWeight: 400 }}>Your charitable giving at a glance.</p>
        </div>

        {dataError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 18px", marginBottom: 24, color: "#dc2626", fontSize: 13, fontWeight: 500 }}>{dataError}</div>}

        {donations.length === 0 && !dataError ? (
          <div style={{ ...cardStyle, padding: "56px 32px", textAlign: "center", animation: "fadeSlideUp .4s ease" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: C.accentLight, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>No donations found</h3>
            <p style={{ color: C.textSoft, fontSize: 14, maxWidth: 380, margin: "0 auto", lineHeight: 1.6 }}>We couldn't find any records linked to {user.email}. Please contact your administrator if this seems incorrect.</p>
          </div>
        ) : donations.length > 0 && (<>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, marginBottom: 36, borderBottom: `1px solid ${C.divider}` }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                padding: "12px 24px", background: "transparent", border: "none", borderBottom: activeTab === t.id ? `2.5px solid ${C.accent}` : "2.5px solid transparent",
                color: activeTab === t.id ? C.text : C.textMuted, fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
                cursor: "pointer", transition: "all .2s", marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
              }}>
                {t.id === "impact" && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                )}
                {t.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {activeTab === "overview" && (<>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
              {[
                { label: "Total donated", value: totalDonated, sub: `${cycles.length} payroll cycles`, hero: true },
                { label: "Per cycle", value: avgCycle, sub: "Average contribution" },
                { label: "Organizations", value: orgCount, sub: "Supported", isCount: true },
                { label: "Payments", value: donations.length, sub: "Transactions", isCount: true },
              ].map((card, i) => (
                <div key={i} style={{
                  ...cardStyle,
                  padding: "24px 26px",
                  animation: `fadeSlideUp .4s ease ${i*.05}s both`,
                  transition: "box-shadow .2s, transform .2s",
                  ...(card.hero ? { background: C.accent, border: "none", boxShadow: "0 4px 16px rgba(15,118,110,0.2)" } : {}),
                }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = card.hero ? "0 8px 24px rgba(15,118,110,0.3)" : C.cardHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = card.hero ? "0 4px 16px rgba(15,118,110,0.2)" : C.cardShadow; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ fontSize: 11, color: card.hero ? "rgba(255,255,255,0.7)" : C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10, fontWeight: 500 }}>{card.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: card.hero ? "#fff" : C.text, marginBottom: 4, lineHeight: 1, fontFamily: "'DM Sans',sans-serif", letterSpacing: "-0.02em" }}>
                    {card.isCount ? card.value : <AnimatedNumber value={card.value} currency={primaryCurrency} />}
                  </div>
                  <div style={{ fontSize: 12, color: card.hero ? "rgba(255,255,255,0.6)" : C.textSoft, fontWeight: 400 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: months.length > 1 ? "1.4fr 1fr" : "1fr", gap: 16 }}>
              {months.length > 1 && (
                <div style={{ ...cardStyle, padding: "26px 28px", animation: "fadeSlideUp .4s ease .15s both" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 22px" }}>Monthly overview</h3>
                  <BarChart data={monthlyData} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
                    {Object.keys(orgTotals).map(n => <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textSoft, fontWeight: 400 }}><div style={{ width: 8, height: 8, borderRadius: 3, background: getOrgColor(n) }} />{n}</div>)}
                  </div>
                </div>
              )}
              <div style={{ ...cardStyle, padding: "26px 28px", display: "flex", flexDirection: "column", alignItems: "center", animation: "fadeSlideUp .4s ease .2s both" }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 22px", alignSelf: "flex-start" }}>Allocation breakdown</h3>
                <DonutChart data={donutData} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22, width: "100%" }}>
                  {donutData.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 3, background: d.color }} />
                        <span style={{ color: C.textSoft, fontWeight: 400 }}>{d.label}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{((d.value / totalDonated) * 100).toFixed(0)}%</span>
                        <span style={{ fontWeight: 600, color: C.text, minWidth: 60, textAlign: "right" }}>{fmt(d.value)}</span>
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
                const od = donations.filter(d => d.orgName === name);
                const ma = months.map(m => ({ month: m, amount: od.filter(d => d.month === m).reduce((s, d) => s + d.allocatedAmount, 0) }));
                const maxM = Math.max(...ma.map(m => m.amount), 1);
                const url = orgUrls[name];
                const color = getOrgColor(name);
                return (
                  <div key={name} style={{ ...cardStyle, padding: "24px 26px", position: "relative", overflow: "hidden", animation: `fadeSlideUp .4s ease ${i*.05}s both`, transition: "box-shadow .2s, transform .2s" }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = C.cardHover; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = C.cardShadow; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: color }} />
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
                      <div>
                        {url ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: C.text, textDecoration: "none", transition: "color .2s" }} onMouseEnter={e => e.target.style.color = color} onMouseLeave={e => e.target.style.color = C.text}>{name} ↗</a>
                          : <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{name}</div>}
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3, fontWeight: 500 }}>{od.length} payment{od.length !== 1 ? "s" : ""}</div>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "'DM Sans',sans-serif" }}>{fmt(total)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 36 }}>
                      {ma.map((m, j) => <div key={j} style={{ flex: 1, height: m.amount > 0 ? `${Math.max((m.amount/maxM)*100, 12)}%` : "4px", background: m.amount > 0 ? color : C.divider, borderRadius: "4px 4px 0 0", opacity: m.amount > 0 ? .3 + (m.amount/maxM)*.7 : .3, transition: "all .3s" }} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* HISTORY */}
          {activeTab === "history" && (
            <div style={{ animation: "fadeSlideUp .3s ease" }}>
              {cycles.map((cycle, ci) => {
                const cd = donations.filter(d => d.cycle === cycle);
                const ct = cd.reduce((s, d) => s + d.allocatedAmount, 0);
                return (
                  <div key={cycle} style={{ marginBottom: 24, animation: `fadeSlideUp .4s ease ${ci*.06}s both` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cycle}</h3>
                      <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{fmt(ct, primaryCurrency)}</span>
                    </div>
                    <div style={{ ...cardStyle, overflow: "hidden" }}>
                      {cd.map((d, i) => {
                        const color = getOrgColor(d.orgName);
                        return (
                          <div key={i} style={{ padding: "14px 22px", display: "flex", alignItems: "center", gap: 14, borderBottom: i < cd.length - 1 ? `1px solid ${C.divider}` : "none", transition: "background .15s" }}
                            onMouseEnter={e => e.currentTarget.style.background = C.accentSoft}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <div style={{ width: 3, height: 32, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              {d.paidTo?.startsWith("http") ? (
                                <a href={d.paidTo} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: C.text, textDecoration: "none" }}
                                  onMouseEnter={e => e.target.style.color = color} onMouseLeave={e => e.target.style.color = C.text}>{d.orgName} ↗</a>
                              ) : <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{d.orgName}</div>}
                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontWeight: 400 }}>{d.paidDate} · {d.percentage}%</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{fmt(d.allocatedAmount, d.currency)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* IMPACT GLOBE */}
          {activeTab === "impact" && (
            <GlobeTab donations={donations} />
          )}
        </>)}
      </div>

      <div style={{ textAlign: "center", padding: "20px 0 32px", borderTop: `1px solid ${C.divider}` }}>
        <p style={{ color: C.textMuted, fontSize: 11, letterSpacing: ".06em", fontWeight: 500 }}>GiveTrack · {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
