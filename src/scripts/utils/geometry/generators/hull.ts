import * as Types from "../../../../types";
import { stateManager } from "../../../state_manager";
import { generateColors } from "../../../color_generator";
import { organizeGeometryGroups } from "../../../group_organizer";
import { getSortedStations, getSortedWaterlines } from "../getters";
import { interpolateHullGrid } from "../helpers";
import { generateFaces } from "./faces";
import { generateVertices } from "./vertices";
import { generateWaterlineCurves } from "./waterlines";
import { generateStationCurves } from "./stations";
import { generateDeckIndices, generateDeckPoints } from "./deck";
import { generateTransomIndices, generateTransomPoints } from "./transom";
import { generateBowIndices, generateBowPoints } from "./bow";

/**
 * Main hull geometry generation pipeline
 * Orchestrates the complete process from table data to 3D geometry with LOD support
 */
export function generateStructuredHullGeometry(
  table: Types.QuoteTable, 
  lodConfig: Types.LODConfig
): Types.HullGeometry {
  
  stateManager.Debug && console.log("=== Generating Hull Geometry ===");
  
  // Get sorted data from the original table for baseline metrics
  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);
  
  stateManager.Debug && console.log(`Original: ${sortedStations.length} stations and ${sortedWaterlines.length} waterlines`);

  // Apply LOD interpolation if multipliers are greater than 1
  const refinedData = (lodConfig.stationMultiplier > 1 || lodConfig.waterlineMultiplier > 1) 
    ? interpolateHullGrid(table, lodConfig)
    : table;

  // Get sorted data from the refined table (in case interpolation was applied)
  const refinedStations = getSortedStations(refinedData);
  const refinedWaterlines = getSortedWaterlines(refinedData);

  stateManager.Debug && console.log(`Refined: ${refinedStations.length} stations and ${refinedWaterlines.length} waterlines`);

  // Generate core geometry components
  const { vertices, vertexMap, keelVertices } = generateVertices(refinedData);
  const indices = generateFaces(refinedData, vertexMap, keelVertices);

  // Early validation to prevent processing invalid geometry
  if (vertices.length === 0 || indices.length === 0) {
    stateManager.Debug && console.error("No valid geometry generated");
    return createEmptyHullGeometry();
  }

  // Convert THREE.Vector3 array to Float32Array for WebGL
  const vertexArray = new Float32Array(vertices.length * 3);
  vertices.forEach((vertex, i) => {
    vertexArray[i * 3] = vertex.x;
    vertexArray[i * 3 + 1] = vertex.y;
    vertexArray[i * 3 + 2] = vertex.z;
  });

  // Validate no NaN values in final vertex data
  for (let i = 0; i < vertexArray.length; i++) {
    if (isNaN(vertexArray[i])) {
      stateManager.Debug && console.error(`NaN detected in final vertex array at index ${i}`);
      return createEmptyHullGeometry();
    }
  }

  // Organize geometry into logical groups for selective rendering
  stateManager.Debug && console.log("Organizing geometry groups...");
  const groups = organizeGeometryGroups(vertices, indices, refinedStations, refinedWaterlines);
  
  // Validate groups structure to ensure robust downstream processing
  if (!groups || typeof groups !== 'object') {
    stateManager.Debug && console.error("Groups is undefined or not an object:", groups);
    return createEmptyHullGeometry();
  }
  
  if (!groups.stations || typeof groups.stations !== 'object') {
    stateManager.Debug && console.error("Groups.stations is invalid:", groups.stations);
    groups.stations = {};
  }
  
  if (!groups.waterlines || typeof groups.waterlines !== 'object') {
    stateManager.Debug && console.error("Groups.waterlines is invalid:", groups.waterlines);
    groups.waterlines = {};
  }
  
  if (!groups.deck || !Array.isArray(groups.deck)) {
    stateManager.Debug && console.error("Groups.deck is invalid:", groups.deck);
    groups.deck = [];
  }

  stateManager.Debug && console.log("Groups structure validated:", {
    stationsCount: Object.keys(groups.stations).length,
    waterlinesCount: Object.keys(groups.waterlines).length,
    deckFaces: groups.deck.length / 3
  });

  // Generate vertex colors for visual differentiation of hull components
  stateManager.Debug && console.log("Generating colors...");
  const colors = generateColors(vertices.length, new Uint32Array(indices), groups);

  stateManager.Debug && console.log(`Successfully generated ${vertices.length} vertices and ${indices.length / 3} faces`);

  // Assemble complete hull geometry with all components
  return {
    // Core geometry data
    vertices: vertexArray,
    indices: new Uint16Array(indices),
    groups,
    
    // Statistics for debugging and UI display
    stats: {
      vertexCount: vertices.length,
      faceCount: indices.length / 3,
      stationCount: refinedStations.length,
      waterlineCount: refinedWaterlines.length
    },
    
    // Visualization overlays and additional components
    // Using original table for overlays to maintain clarity at base resolution
    waterlinePoints: generateWaterlineCurves(table),
    stationPoints: generateStationCurves(table),
    deckPoints: generateDeckPoints(table),
    deckIndices: generateDeckIndices(generateDeckPoints(table)),
    transomPoints: generateTransomPoints(table),
    transomIndices: generateTransomIndices(generateTransomPoints(table)),
    bowPoints: generateBowPoints(table),
    bowIndices: generateBowIndices(generateBowPoints(table)),
    colors
  };
}

/**
 * Creates an empty hull geometry structure as fallback for error cases
 * Ensures consistent return type even when generation fails
 */
function createEmptyHullGeometry(): Types.HullGeometry {
  return {
    vertices: new Float32Array(0),
    indices: new Uint16Array(0),
    groups: { stations: {}, waterlines: {}, deck: [] },
    stats: { vertexCount: 0, faceCount: 0, stationCount: 0, waterlineCount: 0 },
    waterlinePoints: {},
    stationPoints: {},
    deckPoints: [],
    deckIndices: new Uint16Array(0),
    transomPoints: [],
    transomIndices: new Uint16Array(0),
    bowPoints: [],
    bowIndices: new Uint16Array(0),
    colors: new Float32Array(0)
  };
}