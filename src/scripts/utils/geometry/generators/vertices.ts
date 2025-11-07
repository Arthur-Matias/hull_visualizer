import * as Types from "../../../../types";
import { stateManager } from "../../../state_manager";
import * as THREE from "three";
import { getSortedStations, getSortedWaterlines } from "../getters";

/**
 * Generates 3D vertices from hull table data for mesh construction
 * Creates starboard/port vertices, keel vertices, and chine vertices as needed
 */
export function generateVertices(
  table: Types.QuoteTable
): Types.VertexGenerationResult {

  // Extract hull configuration from metadata
  const hasKeel = table.metadata.hasKeel || false;
  const hasChine = table.metadata.hasChine || false;
  const scale = stateManager.getUnits();

  const vertexMap: Record<string, number> = {};
  const allVertices: THREE.Vector3[] = [];
  const keelVertices: number[] = [];

  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);

  stateManager.Debug && console.log(`Generating vertices from ${sortedStations.length} stations`);

  // Process each station (longitudinal sections)
  sortedStations.forEach((station, sIdx) => {
    const zPos = station.position * scale; // Longitudinal position (bow to stern)

    // Process each waterline (vertical sections) at this station
    sortedWaterlines.forEach((waterlineHeight, wIdx) => {
      // Find waterline data for this specific height
      const wlData = station.waterlines.find(wl => wl.height === waterlineHeight);
      if (!wlData) {
        stateManager.Debug && console.warn(`Missing waterline data for station ${station.position}, height ${waterlineHeight}`);
        return;
      }

      const yPos = waterlineHeight * scale; // Vertical position

      // Handle symmetric hulls (use port value for starboard if not specified)
      const halfBreadthPort = wlData.halfBreadthPort;
      const halfBreadthStarboard = wlData.halfBreadthStarboard !== undefined 
        ? wlData.halfBreadthStarboard 
        : halfBreadthPort;

      const xPort = halfBreadthPort * scale;
      const xStarboard = halfBreadthStarboard * scale;

      // Validate numerical values to prevent corrupted geometry
      if ([xPort, xStarboard, yPos, zPos].some(isNaN)) {
        stateManager.Debug && console.error(`Invalid vertex data for station ${station.position}, height ${waterlineHeight}`);
        return;
      }

      // Add keel vertex at bottom waterline for hulls with keel structure
      if (hasKeel && wIdx === 0) {
        const keelVertex = new THREE.Vector3(0, yPos - (0.05 * scale), zPos);
        const keelIndex = allVertices.length;
        allVertices.push(keelVertex);
        keelVertices.push(keelIndex);
      }

      // Create starboard vertex (positive X side)
      const starboardVertex = new THREE.Vector3(xStarboard, yPos, zPos);
      const starboardIndex = allVertices.length;
      allVertices.push(starboardVertex);

      // Create port vertex (negative X side)
      const portVertex = new THREE.Vector3(-xPort, yPos, zPos);
      const portIndex = allVertices.length;
      allVertices.push(portVertex);

      // Store vertex indices for panel construction
      vertexMap[`${sIdx}_${wIdx}_star`] = starboardIndex;
      vertexMap[`${sIdx}_${wIdx}_port`] = portIndex;

      // Add chine vertices for hulls with chine structure (bottom waterline only)
      if (hasChine && wIdx === 0) {
        // Chine vertices are inset from the hull surface for curved transitions
        const chineStarboard = new THREE.Vector3(xStarboard * 0.8, yPos, zPos);
        const chineStarboardIndex = allVertices.length;
        allVertices.push(chineStarboard);

        const chinePort = new THREE.Vector3(-xPort * 0.8, yPos, zPos);
        const chinePortIndex = allVertices.length;
        allVertices.push(chinePort);

        vertexMap[`${sIdx}_${wIdx}_chine_star`] = chineStarboardIndex;
        vertexMap[`${sIdx}_${wIdx}_chine_port`] = chinePortIndex;
      }
    });
  });

  stateManager.Debug && console.log(`Generated ${allVertices.length} vertices`);
  return { vertices: allVertices, vertexMap, keelVertices };
}