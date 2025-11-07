import * as Types from "../../../../types";
import { stateManager } from "../../../state_manager";
import * as THREE from "three";
import { getSortedStations, getSortedWaterlines } from "../getters";

/**
 * Generates 3D points for the transom (stern) surface of the hull
 * Creates points along the last station from bottom to top for both port and starboard
 */
export function generateTransomPoints(table: Types.QuoteTable): THREE.Vector3[] {
  const scale = stateManager.getUnits();
  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);
  
  // Return empty array if no stations available
  if (sortedStations.length === 0) {
    stateManager.Debug && console.warn("No stations available for transom generation");
    return [];
  }
  
  // Use the last station (stern) for transom
  const lastStation = sortedStations[sortedStations.length - 1];
  const zPos = lastStation.position * scale; // Fixed longitudinal position at stern

  const points: THREE.Vector3[] = [];

  // Build transom surface from bottom to top waterlines
  sortedWaterlines.forEach(waterlineHeight => {
    const wlData = lastStation.waterlines.find(wl => wl.height === waterlineHeight);
    
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

  stateManager.Debug && console.log(`Generated ${points.length} transom points from ${sortedWaterlines.length} waterlines`);
  return points;
}

/**
 * Generates triangle indices for the transom surface mesh
 * Creates quad strips from bottom to top and triangulates them
 */
export function generateTransomIndices(points: THREE.Vector3[]): Uint16Array {
  // Need at least 4 points (2 waterlines) to form triangles
  if (points.length < 4) {
    stateManager.Debug && console.warn(`Insufficient points for transom indices: ${points.length}`);
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

  stateManager.Debug && console.log(`Generated ${indices.length} transom indices for ${waterlineCount} waterlines`);
  return new Uint16Array(indices);
}