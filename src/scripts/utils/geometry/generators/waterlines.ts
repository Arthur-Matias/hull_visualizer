import * as Types from "../../../../types";
import { stateManager } from "../../../state_manager";
import * as THREE from "three";
import { getSortedStations, getSortedWaterlines } from "../getters";

/**
 * Generates 3D waterline curves from hull table data
 * Creates closed loops for each waterline level around the hull
 */
export function generateWaterlineCurves(table: Types.QuoteTable): { [waterlineId: string]: THREE.Vector3[] } {
  const scale = stateManager.getUnits();
  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);
  const waterlinePoints: { [waterlineId: string]: THREE.Vector3[] } = {};

  // Process each waterline level to create a complete hull cross-section
  sortedWaterlines.forEach(waterlineHeight => {
    const points: THREE.Vector3[] = [];
    const yPos = waterlineHeight * scale; // Vertical position remains constant for this waterline

    // First pass: starboard side (from bow to stern, positive X)
    sortedStations.forEach(station => {
      const wlData = station.waterlines.find(wl => wl.height === waterlineHeight);
      
      if (wlData) {
        const zPos = station.position * scale; // Longitudinal position (bow to stern)
        const xStarboard = wlData.halfBreadthStarboard !== undefined 
          ? wlData.halfBreadthStarboard * scale 
          : wlData.halfBreadthPort * scale; // Use port value for symmetric hulls

        points.push(new THREE.Vector3(xStarboard, yPos, zPos));
      }
    });

    // Second pass: port side (from stern to bow, negative X)
    for (let i = sortedStations.length - 1; i >= 0; i--) {
      const station = sortedStations[i];
      const wlData = station.waterlines.find(wl => wl.height === waterlineHeight);
      
      if (wlData) {
        const zPos = station.position * scale;
        const xPort = wlData.halfBreadthPort * scale;

        // Negative X for port side to create symmetrical hull
        points.push(new THREE.Vector3(-xPort, yPos, zPos));
      }
    }

    // Close the loop by connecting back to the first point
    if (points.length > 0) {
      points.push(points[0].clone());
    }

    // Store waterline points with height as key
    waterlinePoints[waterlineHeight.toString()] = points;
  });

  stateManager.Debug && console.log(`Generated ${Object.keys(waterlinePoints).length} waterline curves`);
  return waterlinePoints;
}