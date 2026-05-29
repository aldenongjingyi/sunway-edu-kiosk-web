export interface Level {
  id: number;
  code: string;
  label: string;
  title: string;
  primary: boolean;
  position: number;
  ordinal: number;
}

export interface Category {
  id: number;
  parent: number | null;
  code: string;
  hidden: boolean;
  title: string;
  image: string;
}

export interface Location {
  id: number;
  kind: string;
  categories: number[];
  title: string;
  label: string;
  venue: string;
  text: string;
  email: string;
  phone: string;
  latitude: number;
  longitude: number;
  images: string[];
  keyword: string;
  // resolved
  categories_?: Category[];
  levelTitles?: string[];
}

export interface Node {
  id: number;
  level: number;
  location: number | null;
  peers: number[];
  x: number;
  y: number;
  rotation: number;
  // resolved
  level_?: Level;
  location_?: Location;
}

export interface Highlight {
  id: number;
  title: string;
  image: string;
  display_at: string;
  start_at: string;
  end_at: string;
}

export interface Trending {
  id: number;
  title: string;
  position: number;
}

export interface Staff {
  department: string;
  fullName: string;
  designation: string;
  email: string;
  ext: string;
  lotID: string;
  photo: string;
  keywords: string;
  // resolved
  levelTitle?: string;
}

export interface KioskData {
  levels: Level[];
  categories: Category[];
  locations: Location[];
  nodes: Node[];
  highlights: Highlight[];
  trendings: Trending[];
}
