import { type LODConfig, type QuoteTable, type Station, type WaterlineData } from "../../../types"
import * as THREE from "three"
import { getSortedStations, getSortedWaterlines } from "./getters";

/**
 * Sorts points in circular order around their centroid
 * Used for preparing station points for triangulation
 */
export function sortPointsInCircle(points: { x: number; y: number; z: number }[]): { x: number; y: number; z: number }[] {
  if (points.length === 0) return [];

  // Calculate centroid of all points
  const centroid = {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
    z: points[0].z // All points share same Z coordinate at a station
  };

  // Sort points by angle around centroid for proper triangulation
  return [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
    const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
    return angleA - angleB;
  });
}

/**
 * Triangulates a polygon using ear clipping algorithm
 * Converts a polygon into triangles for 3D rendering
 */
export function triangulatePolygon(points: { x: number; y: number; z: number }[]): number[] {
  const indices: number[] = [];
  const n = points.length;

  if (n < 3) return indices;

  const remaining = Array.from({ length: n }, (_, i) => i);

  while (remaining.length > 2) {
    let earFound = false;

    // Try to find an "ear" - a triangle that doesn't contain any other points
    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[(i - 1 + remaining.length) % remaining.length];
      const b = remaining[i];
      const c = remaining[(i + 1) % remaining.length];

      if (isEar(points, a, b, c, remaining, points)) {
        indices.push(a, b, c);
        remaining.splice(i, 1);
        earFound = true;
        break;
      }
    }

    if (!earFound) {
      // Fallback to simple fan triangulation if ear clipping fails
      const first = remaining[0];
      for (let i = 1; i < remaining.length - 1; i++) {
        indices.push(first, remaining[i], remaining[i + 1]);
      }
      break;
    }
  }

  return indices;
}

/**
 * Checks if three points form an "ear" of the polygon
 * An ear is a triangle that doesn't contain any other polygon vertices
 */
function isEar(
  points: { x: number; y: number; z: number }[],
  a: number,
  b: number,
  c: number,
  remaining: number[],
  allPoints: { x: number; y: number; z: number }[]
): boolean {
  const pa = points[a];
  const pb = points[b];
  const pc = points[c];

  // Check for counter-clockwise orientation (positive area)
  const area = (pb.y - pa.y) * (pc.z - pa.z) - (pc.y - pa.y) * (pb.z - pa.z);
  if (area <= 0) return false;

  // Check if any other point is inside this triangle
  for (const idx of remaining) {
    if (idx === a || idx === b || idx === c) continue;

    if (pointInTriangle(allPoints[idx], pa, pb, pc)) {
      return false;
    }
  }

  return true;
}

/**
 * Determines if point p is inside triangle formed by points a, b, c
 * Uses area comparison method for accurate point-in-triangle test
 */
function pointInTriangle(
  p: { x: number; y: number; z: number },
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number }
): boolean {
  // Calculate area of the main triangle
  const area = Math.abs(
    (b.y - a.y) * (c.z - a.z) - (c.y - a.y) * (b.z - a.z)
  );
  
  // Calculate areas of the three sub-triangles
  const area1 = Math.abs(
    (p.y - b.y) * (c.z - b.z) - (c.y - b.y) * (p.z - b.z)
  );
  const area2 = Math.abs(
    (a.y - p.y) * (c.z - p.z) - (c.y - p.y) * (a.z - p.z)
  );
  const area3 = Math.abs(
    (a.y - b.y) * (p.z - b.z) - (p.y - b.y) * (a.z - b.z)
  );

  // Point is inside if sum of sub-areas equals main area (within tolerance)
  return Math.abs(area - (area1 + area2 + area3)) < 0.0001;
}

/**
 * Interpolates hull grid data to increase resolution for smoother geometry
 * Uses linear interpolation between stations and waterlines
 */
export function interpolateHullGrid(
  table: QuoteTable,
  config: LODConfig
): QuoteTable {
  // Return original table if no interpolation needed
  if (config.stationMultiplier <= 1 && config.waterlineMultiplier <= 1) {
    return table;
  }

  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);
  
  if (sortedStations.length === 0 || sortedWaterlines.length === 0) {
    console.warn('No valid stations or waterlines found for interpolation');
    return table;
  }

  console.log(`Interpolating with LOD: stations ${config.stationMultiplier}x, waterlines ${config.waterlineMultiplier}x`);

  const newTable: QuoteTable = {
    metadata: { ...table.metadata },
    stations: [],
  };

  // Generate dense station positions through linear interpolation
  const denseStationCount = Math.max(
    2, // Minimum 2 stations for any interpolation
    Math.round((sortedStations.length - 1) * config.stationMultiplier) + 1
  );
  
  const denseStations: number[] = [];
  for (let i = 0; i < denseStationCount; i++) {
    const t = i / (denseStationCount - 1);
    const globalPos = t * (sortedStations[sortedStations.length - 1].position - sortedStations[0].position) + sortedStations[0].position;
    denseStations.push(globalPos);
  }

  // Generate dense waterline positions through linear interpolation
  const denseWaterlineCount = Math.max(
    2, // Minimum 2 waterlines for any interpolation
    Math.round((sortedWaterlines.length - 1) * config.waterlineMultiplier) + 1
  );
  
  const denseWaterlines: number[] = [];
  for (let i = 0; i < denseWaterlineCount; i++) {
    const t = i / (denseWaterlineCount - 1);
    const globalPos = t * (sortedWaterlines[sortedWaterlines.length - 1] - sortedWaterlines[0]) + sortedWaterlines[0];
    denseWaterlines.push(globalPos);
  }

  // Process each new station position
  denseStations.forEach(stationPos => {
    const newStation: Station = {
      position: stationPos,
      waterlines: []
    };

    // Find bounding stations for interpolation
    let lowerStation: Station | null = null;
    let upperStation: Station | null = null;
    let stationRatio = 0;

    // Locate the two stations that bracket the current position
    for (let i = 0; i < sortedStations.length - 1; i++) {
      if (stationPos >= sortedStations[i].position && stationPos <= sortedStations[i + 1].position) {
        lowerStation = sortedStations[i];
        upperStation = sortedStations[i + 1];
        stationRatio = (stationPos - lowerStation.position) / (upperStation.position - lowerStation.position);
        break;
      }
    }

    // Fallback to nearest station if position is outside range
    if (!lowerStation || !upperStation) {
      let nearestStation = sortedStations[0];
      let minDist = Math.abs(stationPos - nearestStation.position);
      
      sortedStations.forEach(station => {
        const dist = Math.abs(stationPos - station.position);
        if (dist < minDist) {
          minDist = dist;
          nearestStation = station;
        }
      });
      
      lowerStation = nearestStation;
      upperStation = nearestStation;
      stationRatio = 0;
    }

    // Interpolate waterline data for each dense waterline
    denseWaterlines.forEach(waterlineHeight => {
      // Find waterline data in bounding stations
      const lowerWlData = lowerStation!.waterlines.find(wl => Math.abs(wl.height - waterlineHeight) < 0.001);
      const upperWlData = upperStation!.waterlines.find(wl => Math.abs(wl.height - waterlineHeight) < 0.001);

      let halfBreadthPort = 0;
      let halfBreadthStarboard: number | undefined = undefined;

      if (lowerWlData && upperWlData) {
        // Linear interpolation between stations
        halfBreadthPort = lowerWlData.halfBreadthPort + 
          (upperWlData.halfBreadthPort - lowerWlData.halfBreadthPort) * stationRatio;
        
        if (lowerWlData.halfBreadthStarboard !== undefined && upperWlData.halfBreadthStarboard !== undefined) {
          halfBreadthStarboard = lowerWlData.halfBreadthStarboard + 
            (upperWlData.halfBreadthStarboard - lowerWlData.halfBreadthStarboard) * stationRatio;
        }
      } else if (lowerWlData) {
        // Use lower station data if upper not available
        halfBreadthPort = lowerWlData.halfBreadthPort;
        halfBreadthStarboard = lowerWlData.halfBreadthStarboard;
      } else if (upperWlData) {
        // Use upper station data if lower not available
        halfBreadthPort = upperWlData.halfBreadthPort;
        halfBreadthStarboard = upperWlData.halfBreadthStarboard;
      } else {
        // Bilinear interpolation when waterline doesn't exist in either station
        const lowerWaterlines = getSortedWaterlines(table);
        let lowerWl = 0, upperWl = 0;
        let waterlineRatio = 0;
        
        // Find bounding waterlines
        for (let i = 0; i < lowerWaterlines.length - 1; i++) {
          if (waterlineHeight >= lowerWaterlines[i] && waterlineHeight <= lowerWaterlines[i + 1]) {
            lowerWl = lowerWaterlines[i];
            upperWl = lowerWaterlines[i + 1];
            waterlineRatio = (waterlineHeight - lowerWl) / (upperWl - lowerWl);
            break;
          }
        }
        
        // Get waterline data for all four corners of interpolation grid
        const lowerStationLowerWl = lowerStation!.waterlines.find(wl => Math.abs(wl.height - lowerWl) < 0.001);
        const lowerStationUpperWl = lowerStation!.waterlines.find(wl => Math.abs(wl.height - upperWl) < 0.001);
        const upperStationLowerWl = upperStation!.waterlines.find(wl => Math.abs(wl.height - lowerWl) < 0.001);
        const upperStationUpperWl = upperStation!.waterlines.find(wl => Math.abs(wl.height - upperWl) < 0.001);
        
        if (lowerStationLowerWl && lowerStationUpperWl && upperStationLowerWl && upperStationUpperWl) {
          // Perform bilinear interpolation
          const lowerStationValue = lowerStationLowerWl.halfBreadthPort + 
            (lowerStationUpperWl.halfBreadthPort - lowerStationLowerWl.halfBreadthPort) * waterlineRatio;
          const upperStationValue = upperStationLowerWl.halfBreadthPort + 
            (upperStationUpperWl.halfBreadthPort - upperStationLowerWl.halfBreadthPort) * waterlineRatio;
          
          halfBreadthPort = lowerStationValue + (upperStationValue - lowerStationValue) * stationRatio;
        }
      }

      newStation.waterlines.push({
        height: waterlineHeight,
        halfBreadthPort,
        halfBreadthStarboard
      });
    });

    newTable.stations.push(newStation);
  });

  console.log('Linear interpolation completed');
  return newTable;
}

/**
 * Calculates the axis-aligned bounding box for a set of vertices
 * Returns min/max coordinates and range for each axis
 */
export function calculateBoundingBox(vertices: THREE.Vector3[]) {
  const minX = Math.min(...vertices.map(v => v.x));
  const maxX = Math.max(...vertices.map(v => v.x));
  const minY = Math.min(...vertices.map(v => v.y));
  const maxY = Math.max(...vertices.map(v => v.y));
  const minZ = Math.min(...vertices.map(v => v.z));
  const maxZ = Math.max(...vertices.map(v => v.z));

  return {
    minX, maxX, minY, maxY, minZ, maxZ,
    xRange: maxX - minX,
    yRange: maxY - minY,
    zRange: maxZ - minZ
  };
}

// ------------------------------
// Array search and interpolation helpers

/**
 * Finds the closest value in array that is less than or equal to target value
 * Returns null if no suitable value found
 */
export function findClosestLower(array: number[], value: number): number | null {
  let closest = null;
  for (const item of array) {
    if (item <= value && (closest === null || item > closest)) {
      closest = item;
    }
  }
  return closest;
}

/**
 * Finds the closest value in array that is greater than or equal to target value
 * Returns null if no suitable value found
 */
export function findClosestHigher(array: number[], value: number): number | null {
  let closest = null;
  for (const item of array) {
    if (item >= value && (closest === null || item < closest)) {
      closest = item;
    }
  }
  return closest;
}

/**
 * Finds the nearest value in array to target value
 * Returns the closest match by absolute distance
 */
export function findNearest(array: number[], value: number): number {
  if (array.length === 0) return value;
  return array.reduce((prev, curr) => 
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

/**
 * Performs bilinear interpolation between four corner values
 * Used for 2D interpolation in station/waterline grids
 */
export function bilinearInterpolate(
  f11: number, f12: number, f21: number, f22: number,
  x: number, y: number
): number {
  return (1 - x) * (1 - y) * f11 + 
         (1 - x) * y * f12 + 
         x * (1 - y) * f21 + 
         x * y * f22;
}

/**
 * Retrieves waterline data for specific station and waterline height
 * Returns undefined if no matching data found
 */
export function getWaterlineData(
  table: QuoteTable, 
  stationPosition: number, 
  waterlineHeight: number
): WaterlineData | undefined {
  const station = table.stations.find(s => s.position === stationPosition);
  if (!station) return undefined;
  
  return station.waterlines.find(wl => wl.height === waterlineHeight);
}

/**
 * Gets half-breadth measurement for specific station, waterline, and side
 * Returns 0 if no data found, handles symmetric hulls (starboard = port)
 */
export function getHalfBreadth(
  table: QuoteTable,
  stationPosition: number,
  waterlineHeight: number,
  side: 'port' | 'starboard'
): number {
  const wlData = getWaterlineData(table, stationPosition, waterlineHeight);
  if (!wlData) return 0;
  
  if (side === 'port') {
    return wlData.halfBreadthPort;
  } else {
    return wlData.halfBreadthStarboard !== undefined 
      ? wlData.halfBreadthStarboard 
      : wlData.halfBreadthPort;
  }
}