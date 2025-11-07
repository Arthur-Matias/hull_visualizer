import * as Types from "../../../../types";
import { stateManager } from "../../../state_manager";
import * as THREE from "three";
import { getSortedStations, getSortedWaterlines } from "../getters";

/**
 * Generates 3D station curves from hull table data
 * Creates vertical cross-sectional profiles at each station position
 */
export function generateStationCurves(table: Types.QuoteTable): { [stationId: string]: THREE.Vector3[] } {
  const scale = stateManager.getUnits();
  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);
  const stationPoints: { [stationId: string]: THREE.Vector3[] } = {};

  // Process each station to create vertical cross-sectional profiles
  sortedStations.forEach(station => {
    const points: THREE.Vector3[] = [];
    const zPos = station.position * scale; // Fixed longitudinal position for this station

    // Build station profile from bottom to top waterlines
    sortedWaterlines.forEach(waterlineHeight => {
      const wlData = station.waterlines.find(wl => wl.height === waterlineHeight);
      
      if (wlData) {
        const yPos = waterlineHeight * scale; // Vertical position
        const xPort = wlData.halfBreadthPort * scale;
        const xStarboard = wlData.halfBreadthStarboard !== undefined 
          ? wlData.halfBreadthStarboard * scale 
          : xPort; // Use port value for symmetric hulls

        // Add port point (negative X) then starboard point (positive X)
        // This creates a complete cross-section at this waterline level
        points.push(new THREE.Vector3(-xPort, yPos, zPos));
        points.push(new THREE.Vector3(xStarboard, yPos, zPos));
      }
    });

    // Store station points using position as key for easy retrieval
    stationPoints[station.position.toString()] = points;
  });

  stateManager.Debug && console.log(`Generated ${Object.keys(stationPoints).length} station curves`);
  return stationPoints;
}