/**
 * Location IDs to hide from the Wayfinder map canvas.
 *
 * The Wayfinder engine renders every location in its data-url as a label/pin
 * on the map canvas — there is no API to filter by ID. We intercept the fetch,
 * strip these entries from the locations array, and serve a filtered blob URL
 * as the wayfinder's data-url instead.
 *
 * To add/remove entries: update this list and redeploy.
 * IDs can be verified at: https://sunwayedu3.indoorcms.com/admin/locations/
 */
export const BLOCKED_WAYFINDER_LOCATION_IDS = new Set<number>([
  // Outdoor locations (lat/lng ≠ 0) — appear as external pins on the map
  1277, // ARTLab
  1676, // Assembly Point A
  1677, // Assembly Point B
  1678, // Assembly Point C
  1281, // Menara Sunway
  419,  // Monash University
  415,  // Sun-U Residence
  1280, // Sunway Clio Exhibition Centre
  1325, // Sunway FutureX
  1336, // Sunway FutureX Iskandar
  1391, // Sunway FutureX Penang
  421,  // Sunway International School (SIS)
  423,  // Sunway International School (SIS) — duplicate entry
  1629, // Sunway International School — Admissions Office
  417,  // Sunway Medical Centre
  414,  // Waterfront Residence

  // Gates
  424,  // Main Gate
  425,  // Side Gate 1
  426,  // Side Gate 2
  427,  // Side Gate 3
  428,  // Hostel Gate 1
  429,  // Hostel Gate 2

  // Outdoor campus areas / external buildings
  1432, // Avenue of Achievements
  1243, // Boulevard
  1323, // FET Building
  413,  // Sun-U Apartment

  // Canopy walks and link bridges to external buildings
  354,  // Canopy Walk to Monash Uni
  1279, // Canopy Walk to Sunway Clio Exhibition Centre
  1443, // SUN-U Link Bridge
  1444, // SUN-U Residence Link Bridge

  // Off-campus
  139,  // Off-Campus Residence
]);
