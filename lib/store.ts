"use client";
import { create } from "zustand";
import type { Category, Highlight, KioskData, Level, Location, Node, Staff, Trending } from "./types";
import { hdx } from "./hdx";
import { BLOCKED_WAYFINDER_LOCATION_IDS } from "./blocked-locations";

interface DataStore {
  levels: Record<number, Level>;
  categories: Record<number, Category>;
  locations: Location[];
  nodes: Node[];
  highlights: Highlight[];
  trendings: Trending[];
  staffs: Staff[];
  loaded: boolean;
  staffLoaded: boolean;
  lastRefreshed: Date | null;
  lastStaffRefreshed: Date | null;
  loadData: (force?: boolean) => Promise<void>;
  loadStaff: (force?: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

const KIOSK_CACHE_KEY = "kiosk.data.cache";
const STAFF_CACHE_KEY = "kiosk.staff.cache";

function processKioskData(data: KioskData) {
  const sortedLevels = [...data.levels].sort((a, b) => b.position - a.position);
  const levelsMap: Record<number, Level> = {};
  sortedLevels.forEach((l, i) => { levelsMap[l.id] = { ...l, ordinal: i }; });

  const categoriesMap: Record<number, Category> = {};
  data.categories.forEach(c => { categoriesMap[c.id] = c; });

  // Only expose locations that have at least one map node — unmapped locations
  // cannot be navigated to, so they should never appear in the directory.
  // When a node is added in the CMS, the location automatically becomes visible.
  const mappedLocationIds = new Set(data.nodes.map(n => n.location).filter(id => id !== null));

  const locations = data.locations
    .filter(l => l.latitude === 0 && l.longitude === 0)
    .filter(l => l.kind === "FACILITY")
    .filter(l => mappedLocationIds.has(l.id))
    .filter(l => !BLOCKED_WAYFINDER_LOCATION_IDS.has(l.id))
    .map(l => {
      const categories_ = data.categories.filter(c => l.categories.includes(c.id));
      const levelSet = new Set<Level>();
      data.nodes.forEach(n => {
        if (n.location === l.id && levelsMap[n.level]) levelSet.add(levelsMap[n.level]);
      });
      const sortedNodeLevels = Array.from(levelSet).sort((a, b) => b.position - a.position);
      const levelTitles = sortedNodeLevels.length === 1
        ? [sortedNodeLevels[0].title]
        : sortedNodeLevels.map(lv => lv.label);
      return { ...l, categories_, levelTitles };
    });

  const now = new Date();
  const highlights = (data.kiosklights as Highlight[])
    .filter(h => new Date(h.display_at) <= now && new Date(h.end_at) > now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  return {
    levels: levelsMap,
    categories: categoriesMap,
    locations,
    nodes: data.nodes,
    highlights,
    trendings: [...data.trendings].sort((a, b) => a.position - b.position),
  };
}

function buildingFromWing(wing: string): string {
  switch (wing) {
    case "NORTH":
    case "SOUTH":
    case "SB": return "College Building";
    case "NUB": return "University Building";
    case "SQ": return "Sunway Square";
    case "GRADUATE": return "Graduate School";
    default: return "";
  }
}

function floorLabelFromVenue(floor: string, wing: string): string {
  const isCollege = wing === "NORTH" || wing === "SOUTH" || wing === "SB";
  if (isCollege) {
    const map: Record<string, string> = {
      LG: "Lower Ground", G: "Ground Floor",
      M1: "Level 1", M2: "Level 2",
      L1: "Level 3", L2: "Level 4", L3: "Level 5", L4: "Level 6",
    };
    return map[floor] ?? floor;
  }
  const genericMap: Record<string, string> = {
    LG: "Lower Ground", LG2: "Lower Ground 2", LG3: "Lower Ground 3",
    G: "Ground Floor", B2: "Basement 2",
    M1: "Mezzanine 1", M2: "Mezzanine 2",
  };
  if (genericMap[floor]) return genericMap[floor];
  const m = floor.match(/^L(\d+)$/);
  if (m) return `Level ${m[1]}`;
  return floor;
}

function locationNameFromLotID(lotID: string): string {
  const segment = lotID.split(".")[4] ?? "";
  return segment
    .replace(/_/g, " ")
    .split(" ")
    .map(w => /^\([A-Z]+\)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function processStaffData(staffs: Staff[], locations: Location[]) {
  return staffs.map(s => {
    const parts = s.lotID.split(".");
    const floor = parts[0] ?? "";
    const wing = parts[1] ?? "";
    const loc = locations.find(l => l.venue === s.lotID);
    const locationTitle = loc?.title ?? locationNameFromLotID(s.lotID);
    const buildingName = buildingFromWing(wing);
    const floorLabel = buildingName ? floorLabelFromVenue(floor, wing) : "";
    return { ...s, locationTitle, buildingName, floorLabel };
  });
}

async function fetchGzip(url: string): Promise<unknown> {
  const bust = `&_=${Date.now()}`;
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // fail fast offline
  try {
    const res = await fetch(
      `https://sunway-kiosk-proxy.sunway-kiosk.workers.dev/?url=${encodeURIComponent(url)}${bust}`,
      { cache: "no-store", signal: controller.signal }
    );
    const ms = Date.now() - t0;
    if (!res.ok) {
      hdx.addAction("api.fetch.error", { url, status: res.status, ms });
      throw new Error(`Failed to fetch ${url}`);
    }
    hdx.addAction("api.fetch.success", { url, status: res.status, ms });
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const useDataStore = create<DataStore>((set, get) => ({
  levels: {},
  categories: {},
  locations: [],
  nodes: [],
  highlights: [],
  trendings: [],
  staffs: [],
  loaded: false,
  staffLoaded: false,
  lastRefreshed: null,
  lastStaffRefreshed: null,

  loadData: async (force = false) => {
    if (get().loaded && !force) return;

    // Load from cache immediately so UI shows instantly even offline.
    // Network fetch runs in background and updates if it succeeds.
    if (!get().loaded) {
      try {
        const cached = localStorage.getItem(KIOSK_CACHE_KEY);
        if (cached) {
          const raw = JSON.parse(cached) as KioskData;
          const processed = processKioskData(raw);
          hdx.addAction("data.loaded.cache", {
            locations: processed.locations.length,
            highlights: processed.highlights.length,
            trendings: processed.trendings.length,
            nodes: processed.nodes.length,
          });
          set({ ...processed, loaded: true, lastRefreshed: null });
        }
      } catch (ce) {
        console.error("Cache load failed", ce);
        hdx.addAction("data.cache.error", { error: String(ce) });
      }
    }

    // Fetch fresh from network; update store and cache on success.
    try {
      const raw = await fetchGzip("https://sunwayedu3-data.indoorcms.com/datas_v001.json.gz") as KioskData;
      try { localStorage.setItem(KIOSK_CACHE_KEY, JSON.stringify(raw)); } catch {}
      const processed = processKioskData(raw);
      hdx.addAction("data.loaded.live", {
        locations: processed.locations.length,
        highlights: processed.highlights.length,
        trendings: processed.trendings.length,
        nodes: processed.nodes.length,
      });
      set({ ...processed, loaded: true, lastRefreshed: new Date() });
    } catch (e) {
      console.error("Network fetch failed, using cache", e);
      hdx.addAction("data.load.failed", { error: String(e) });
      if (!get().loaded) hdx.addAction("data.cache.miss", {});
    }
  },

  refreshData: async () => {
    await get().loadData(true);
    await get().loadStaff(true);
  },

  loadStaff: async (force = false) => {
    if (get().staffLoaded && !force) return;

    // Load from cache immediately.
    if (!get().staffLoaded) {
      try {
        const cached = localStorage.getItem(STAFF_CACHE_KEY);
        if (cached) {
          const raw = JSON.parse(cached) as Staff[];
          const staffs = processStaffData(raw, get().locations);
          hdx.addAction("staff.loaded.cache", { count: staffs.length });
          set({ staffs, staffLoaded: true, lastStaffRefreshed: null });
        }
      } catch (ce) {
        console.error("Staff cache load failed", ce);
        hdx.addAction("staff.cache.error", { error: String(ce) });
      }
    }

    // Fetch fresh from network.
    try {
      const raw = await fetchGzip(
        "https://izone.sunway.edu.my/segfeeds/staff/mycampus/bd2fd99be3e0c4b144e3c3c3a3f7a22999cf8615"
      ) as Staff[];
      try { localStorage.setItem(STAFF_CACHE_KEY, JSON.stringify(raw)); } catch {}
      const staffs = processStaffData(raw, get().locations);
      hdx.addAction("staff.loaded.live", { count: staffs.length });
      set({ staffs, staffLoaded: true, lastStaffRefreshed: new Date() });
    } catch (e) {
      console.error("Staff network fetch failed, using cache", e);
      hdx.addAction("staff.load.failed", { error: String(e) });
      if (!get().staffLoaded) hdx.addAction("staff.cache.miss", {});
    }
  },
}));
