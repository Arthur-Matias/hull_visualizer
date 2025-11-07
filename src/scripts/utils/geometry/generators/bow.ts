import * as Types from "../../../../types";
import { stateManager } from "../../../state_manager";
import * as THREE from "three";
import { getSortedStations, getSortedWaterlines } from "../getters";

/**
 * Generates 3D points for the bow (front) surface of the hull
 * Creates points along the first station from bottom to top for both port and starboard
 */
export function generateBowPoints(table: Types.QuoteTable): THREE.Vector3[] {
  const scale = stateManager.getUnits();
  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);
  
  // Return empty array if no stations available
  if (sortedStations.length === 0) {
    stateManager.Debug && console.warn("No stations available for bow generation");
    return [];
  }
  
  // Use the first station (bow) for the front surface
  const firstStation = sortedStations[0];
  const zPos = firstStation.position * scale; // Fixed longitudinal position at bow

  const points: THREE.Vector3[] = [];

  // Build bow surface from bottom to top waterlines
  sortedWaterlines.forEach(waterlineHeight => {
    const wlData = firstStation.waterlines.find(wl => wl.height === waterlineHeight);
    
    if (wlData) {
      const yPos = waterlineHeight * scale;
      const xPort = wlData.halfBreadthPort * scale;
      const xStarboard = wlData.halfBreadthStarboard !== undefined 
        ? wlData.halfBreadthStarboard * scale 
        : xPort; // Use port value for symmetric hulls

      // Add port point (negative X) then starboard point (positive X)
      points.push(new THREE.Vector3(-xPort, yPos, zPos));
      points.push(new THREE.Vector3(xStarboard, yPos, zPos));
    }
  });

  stateManager.Debug && console.log(`Generated ${points.length} bow points from ${sortedWaterlines.length} waterlines`);
  return points;
}

/**
 * Generates triangle indices for the bow surface mesh
 * Creates quad strips from bottom to top and triangulates them
 */
export function generateBowIndices(points: THREE.Vector3[]): Uint16Array {
  // Need at least 4 points (2 waterlines) to form triangles
  if (points.length < 4) {
    stateManager.Debug && console.warn(`Insufficient points for bow indices: ${points.length}`);
    return new Uint16Array(0);
  }
  
  const indices: number[] = [];
  const waterlineCount = points.length / 2; // Each waterline has port + starboard points
  
  // Create triangle pairs for each quad between waterlines
  for (let i = 0; i < waterlineCount - 1; i++) {
    // Calculate indices for current waterline quad
    const portBottom = i * 2;       // Port point at current waterline
    const starboardBottom = i * 2 + 1; // Starboard point at current waterline
    const portTop = (i + 1) * 2;    // Port point at next waterline
    const starboardTop = (i + 1) * 2 + 1; // Starboard point at next waterline
    
    // First triangle: portBottom → starboardBottom → portTop
    indices.push(portBottom, starboardBottom, portTop);
    // Second triangle: starboardBottom → starboardTop → portTop
    indices.push(starboardBottom, starboardTop, portTop);
  }

  stateManager.Debug && console.log(`Generated ${indices.length} bow indices for ${waterlineCount} waterlines`);
  return new Uint16Array(indices);
}