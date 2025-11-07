import * as Types from "../../../../types";
import { getPanelVertices, getSortedStations, getSortedWaterlines } from "../getters";
import { areAllPanelVerticesValid } from "../validators";
import { generateChinePanel } from "./chine";
import { generateKeelConnection } from "./keel";

/**
 * Generates triangular faces for a single hull panel defined by station and waterline indices
 * Handles different panel types based on hull features (chine, keel) and position
 */
export function generatePanelFaces(
  indices: number[],
  vertexMap: Record<string, number>,
  keelVertices: number[],
  s: number,
  w: number,
  hasKeel: boolean,
  hasChine: boolean
) {
  // Get all vertex indices for this panel (both starboard and port sides)
  const vertices = getPanelVertices(vertexMap, s, w);

  // Skip panel generation if any required vertices are missing
  if (!areAllPanelVerticesValid(vertices)) {
    return;
  }

  // Generate specialized chine panels for bottom row if chine is enabled
  if (hasChine && w === 0) {
    generateChinePanel(indices, vertexMap, s, w);
  } else {
    // Generate standard quadrilateral panel divided into triangles
    generateStandardPanel(indices, vertices);
  }

  // Add keel connection triangles for bottom row if keel is enabled
  if (hasKeel && w === 0) {
    generateKeelConnection(indices, vertexMap, keelVertices, s, w);
  }
}

/**
 * Main face generation orchestrator - creates all triangular faces for the entire hull
 * Processes each panel between stations and waterlines to build complete hull surface
 */
export function generateFaces(
  table: Types.QuoteTable,
  vertexMap: Record<string, number>,
  keelVertices: number[]
): number[] {
  const sortedStations = getSortedStations(table);
  const sortedWaterlines = getSortedWaterlines(table);
  const stationCount = sortedStations.length;
  const waterlineCount = sortedWaterlines.length;

  const indices: number[] = [];
  const hasKeel = table.metadata.hasKeel || false;
  const hasChine = table.metadata.hasChine || false;

  // Iterate through all station-waterline panels to generate faces
  for (let s = 0; s < stationCount - 1; s++) {
    for (let w = 0; w < waterlineCount - 1; w++) {
      generatePanelFaces(
        indices,
        vertexMap,
        keelVertices,
        s,
        w,
        hasKeel,
        hasChine
      );
    }
  }

  return indices;
}

/**
 * Generates standard quadrilateral panel as two triangles per side
 * Creates proper winding order for both starboard (CW) and port (CCW) sides
 */
function generateStandardPanel(indices: number[], vertices: any) {
  const {
    topLeft, topRight, bottomRight, bottomLeft,
    topLeftPort, topRightPort, bottomRightPort, bottomLeftPort
  } = vertices;

  // Starboard side triangles (clockwise winding for front-facing)
  // Top triangle: topLeft → topRight → bottomRight
  indices.push(topLeft, topRight, bottomRight);
  // Bottom triangle: topLeft → bottomRight → bottomLeft
  indices.push(topLeft, bottomRight, bottomLeft);

  // Port side triangles (counter-clockwise winding for front-facing)
  // Top triangle: topLeftPort → bottomLeftPort → bottomRightPort  
  indices.push(topLeftPort, bottomLeftPort, bottomRightPort);
  // Bottom triangle: topLeftPort → bottomRightPort → topRightPort
  indices.push(topLeftPort, bottomRightPort, topRightPort);
}