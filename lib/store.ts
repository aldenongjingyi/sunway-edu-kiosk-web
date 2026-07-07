"use client";
import { create } from "zustand";
import type { Category, Highlight, KioskData, Level, Location, Node, Staff, Trending } from "./types";

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
  loadData: () => Promise<void>;
  loadStaff: () => Promise<void>;
}

async function fetchGzip(url: string): Promise<unknown> {
  const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
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

  loadData: async () => {
    if (get().loaded) return;
    try {
      const data = await fetchGzip("https://sunwayedu3-data.indoorcms.com/datas_v001.json.gz") as KioskData;

      // Build levels map with ordinal
      const sortedLevels = [...data.levels].sort((a, b) => b.position - a.position);
      const levelsMap: Record<number, Level> = {};
      sortedLevels.forEach((l, i) => { levelsMap[l.id] = { ...l, ordinal: i }; });

      // Build categories map
      const categoriesMap: Record<number, Category> = {};
      data.categories.forEach(c => { categoriesMap[c.id] = c; });

      // Build nodes map
      const nodesMap: Record<number, { level_?: Level; location?: number | null }> = {};
      data.nodes.forEach(n => { nodesMap[n.id] = { level_: levelsMap[n.level], location: n.location }; });

      // Resolve locations (indoor only: lat/lng == 0)
      const locations = data.locations
        .filter(l => l.latitude === 0 && l.longitude === 0)
        .map(l => {
          const categories_ = data.categories.filter(c => l.categories.includes(c.id));
          // find levels via nodes
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

      // Filter highlights
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const highlights = (data.kiosklights as Highlight[]).filter(h => {
        const display = new Date(h.display_at);
        const end = new Date(h.end_at);
        return today >= display && end > today;
      }).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

      set({
        levels: levelsMap,
        categories: categoriesMap,
        locations,
        nodes: data.nodes,
        highlights,
        trendings: [...data.trendings].sort((a, b) => a.position - b.position),
        loaded: true,
        lastRefreshed: new Date(),
      });
    } catch (e) {
      console.error("Failed to load kiosk data", e);
    }
  },

  loadStaff: async () => {
    if (get().staffLoaded) return;
    try {
      const staffs = await fetchGzip(
        "https://izone.sunway.edu.my/segfeeds/staff/mycampus/bd2fd99be3e0c4b144e3c3c3a3f7a22999cf8615"
      ) as Staff[];

      // Resolve level from location venue match
      const locations = get().locations;
      const resolved = staffs.map(s => {
        const loc = locations.find(l => l.venue === s.lotID);
        const levelTitle = loc?.levelTitles?.join(" / ") ?? "";
        return { ...s, levelTitle };
      });

      set({ staffs: resolved, staffLoaded: true, lastStaffRefreshed: new Date() });
    } catch (e) {
      console.error("Failed to load staff data", e);
    }
  },
}));
