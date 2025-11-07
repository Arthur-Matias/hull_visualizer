import * as Types from "../../../../types";
import { stateManager } from "../../../state_manager";
import * as THREE from "three";
import { getSortedStations, getSortedWaterlines } from "../getters";

/**
 * Generates 3D points for the deck surface along the top waterline
 * Creates points at each station for both port and starboard sides
 */
export function generateDeckPoints(table: Types.QuoteTable): THREE.Vector3[] {
  const scale = stateManager.getUnits();
  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);
  
  // Return empty array if no waterlines available
  if (sortedWaterlines.length === 0) {
    stateManager.Debug && console.warn("No waterlines available for deck generation");
    return [];
  }
  
  // Use the top waterline height for deck surface
  const topWaterlineHeight = sortedWaterlines[sortedWaterlines.length - 1];
  const points: THREE.Vector3[] = [];

  // Generate deck points at each station along the top waterline
  sortedStations.forEach(station => {
    const wlData = station.waterlines.find(wl => wl.height === topWaterlineHeight);
    
    if (wlData) {
      const zPos = station.position * scale; // Longitudinal position
      const yPos = topWaterlineHeight * scale; // Fixed deck height
      const xPort = wlData.halfBreadthPort * scale;
      const xStarboard = wlData.halfBreadthStarboard !== undefined 
        ? wlData.halfBreadthStarboard * scale 
        : xPort; // Use port value for symmetric hulls

      // Add port point (negative X) then starboard point (positive X)
      points.push(new THREE.Vector3(-xPort, yPos, zPos));
      points.push(new THREE.Vector3(xStarboard, yPos, zPos));
    }
  });

  stateManager.Debug && console.log(`Generated ${points.length} deck points from ${sortedStations.length} stations`);
  return points;
}

/**
 * Generates triangle indices for the deck surface mesh
 * Creates quad strips between stations and triangulates them
 */
export function generateDeckIndices(points: THREE.Vector3[]): Uint16Array {
  // Need at least 4 points (2 stations) to form triangles
  if (points.length < 4) {
    stateManager.Debug && console.warn(`Insufficient points for deck indices: ${points.length}`);
    return new Uint16Array(0);
  }
  
  const indices: number[] = [];
  const stationCount = points.length / 2; // Each station has port + starboard points
  
  // Create triangle pairs for each quad between stations
  for (let i = 0; i < stationCount - 1; i++) {
    // Calculate indices for current station quad
    const portCurrent = i * 2;       // Port point at current station
    const starboardCurrent = i * 2 + 1; // Starboard point at current station
    const portNext = (i + 1) * 2;    // Port point at next station
    const starboardNext = (i + 1) * 2 + 1; // Starboard point at next station
    
    // First triangle: portCurrent → starboardCurrent → portNext
    indices.push(portCurrent, starboardCurrent, portNext);
    // Second triangle: starboardCurrent → starboardNext → portNext
    indices.push(starboardCurrent, starboardNext, portNext);
  }

  stateManager.Debug && console.log(`Generated ${indices.length} deck indices for ${stationCount} stations`);
  return new Uint16Array(indices);
}