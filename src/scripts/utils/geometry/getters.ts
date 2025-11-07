import * as Types from "../../../types"

/**
 * Gets vertex indices for a hull panel defined by station and waterline indices
 * Returns starboard and port side vertices for the four corners of a rectangular panel
 */
export function getPanelVertices(vertexMap: Record<string, number>, s: number, w: number) {
  return {
    // Starboard side vertices (positive X)
    topLeft: vertexMap[`${s}_${w}_star`],
    topRight: vertexMap[`${s + 1}_${w}_star`],
    bottomRight: vertexMap[`${s + 1}_${w + 1}_star`],
    bottomLeft: vertexMap[`${s}_${w + 1}_star`],
    
    // Port side vertices (negative X)
    topLeftPort: vertexMap[`${s}_${w}_port`],
    topRightPort: vertexMap[`${s + 1}_${w}_port`],
    bottomRightPort: vertexMap[`${s + 1}_${w + 1}_port`],
    bottomLeftPort: vertexMap[`${s}_${w + 1}_port`]
  };
}

/**
 * Gets vertex indices for chine connections between hull panels
 * Chine vertices represent the curved intersections between hull sections
 */
export function getChineVertices(vertexMap: Record<string, number>, s: number, w: number) {
  return {
    // Starboard chine vertices (curved edge connections)
    chineTopLeft: vertexMap[`${s}_${w}_chine_star`],
    chineTopRight: vertexMap[`${s + 1}_${w}_chine_star`],
    chineBottomLeft: vertexMap[`${s}_${w + 1}_star`],
    chineBottomRight: vertexMap[`${s + 1}_${w + 1}_star`],
    
    // Port chine vertices (curved edge connections)
    chineTopLeftPort: vertexMap[`${s}_${w}_chine_port`],
    chineTopRightPort: vertexMap[`${s + 1}_${w}_chine_port`],
    chineBottomLeftPort: vertexMap[`${s}_${w + 1}_port`],
    chineBottomRightPort: vertexMap[`${s + 1}_${w + 1}_port`]
  };
}

/**
 * Gets half-breadth measurement for specific station, waterline, and hull side
 * Returns starboard measurement if available, otherwise defaults to port (symmetric hulls)
 */
export function getHalfBreadth(table: Types.QuoteTable, station: number, waterline: number, side: 'port' | 'starboard'): number {
  const data = getWaterlineData(table, station, waterline);
  if (!data) return 0;
  
  // Use starboard measurement if specified and available, otherwise use port (symmetric)
  if (side === 'starboard' && data.halfBreadthStarboard !== undefined) {
    return data.halfBreadthStarboard;
  }
  return data.halfBreadthPort;
}

/**
 * Retrieves waterline data for specific station index and waterline index
 * Returns null if station or waterline data doesn't exist
 */
export function getWaterlineData(table: Types.QuoteTable, station: number, waterline: number): Types.WaterlineData | null {
  const stationData = table.stations[station];
  if (!stationData) return null;
  
  const waterlineData = stationData.waterlines[waterline];
  return waterlineData || null;
}

/**
 * Converts measurement units to meters for consistent 3D scaling
 * Returns scale factor: mm→0.001, ft→0.3048, m→1
 */
export function getUnitScale(unit: Types.Units): number {
  return unit === 'mm' ? 0.001 :
    unit === 'ft' ? 0.3048 : 1;
}

/**
 * Gets all stations sorted by position (from bow to stern)
 * Ensures consistent station processing order
 */
export function getSortedStations(table: Types.QuoteTable): Types.Station[] {
  return [...table.stations].sort((a, b) => a.position - b.position);
}

/**
 * Gets all unique waterline heights from the entire hull table
 * Returns sorted array of waterline heights (from bottom to top)
 */
export function getSortedWaterlines(table: Types.QuoteTable): number[] {
  const waterlineSet = new Set<number>();
  table.stations.forEach(station => {
    station.waterlines.forEach(wl => {
      waterlineSet.add(wl.height);
    });
  });
  return Array.from(waterlineSet).sort((a, b) => a - b);
}