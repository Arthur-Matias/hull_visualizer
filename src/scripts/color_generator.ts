import * as Types from "../types"
import * as THREE from "three"

/**
 * Generates vertex colors for hull geometry based on component groups
 * Applies different colors to stations, waterlines, deck, and default hull areas
 */
export function generateColors(
  vertexCount: number,
  indices: Uint32Array,
  groups: Types.GeometryGroups,
  colorMap?: Partial<Types.ColorMap>
): Float32Array {
  // Default color scheme for hull components
  const defaultColorMap: Types.ColorMap = {
    station: new THREE.Vector3(0.2, 0.4, 0.8),    // Blue for stations
    waterline: new THREE.Vector3(0.4, 0.8, 0.8),  // Aqua blue for waterlines
    deck: new THREE.Vector3(0.8, 0.2, 0.2),       // Red for deck
    default: new THREE.Vector3(0.7, 0.7, 0.7)     // Gray for default hull
  };

  // Merge custom color map with defaults (custom takes precedence)
  const finalColorMap = { ...defaultColorMap, ...colorMap };
  const colors = new Float32Array(vertexCount * 3);

  // Apply colors in order of precedence: default → stations → waterlines → deck
  initializeDefaultColors(colors, finalColorMap.default);
  applyStationColors(colors, indices, groups.stations, finalColorMap.station);
  applyWaterlineColors(colors, indices, groups.waterlines, finalColorMap.waterline);
  applyDeckColors(colors, indices, groups.deck, finalColorMap.deck);

  return colors;
}

/**
 * Initializes all vertices with the default hull color
 * This provides a base color that gets overridden by specific component colors
 */
function initializeDefaultColors(colors: Float32Array, defaultColor: THREE.Vector3) {
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = defaultColor.x;     // Red channel
    colors[i + 1] = defaultColor.y; // Green channel  
    colors[i + 2] = defaultColor.z; // Blue channel
  }
}

/**
 * Applies station color to all faces belonging to station groups
 * Station faces are colored blue by default
 */
function applyStationColors(
  colors: Float32Array,
  indices: Uint32Array,
  stationFaces: Record<string, number[]>,
  stationColor: THREE.Vector3
) {
  for (const station in stationFaces) {
    stationFaces[station].forEach(faceIndex => {
      applyColorToFace(colors, indices, faceIndex, stationColor);
    });
  }
}

/**
 * Applies waterline color to all faces belonging to waterline groups
 * Waterline faces are colored aqua blue by default
 */
function applyWaterlineColors(
  colors: Float32Array,
  indices: Uint32Array,
  waterlineFaces: Record<string, number[]>,
  waterlineColor: THREE.Vector3
) {
  for (const waterline in waterlineFaces) {
    waterlineFaces[waterline].forEach(faceIndex => {
      applyColorToFace(colors, indices, faceIndex, waterlineColor);
    });
  }
}

/**
 * Applies deck color to all deck faces
 * Deck faces are colored red by default and typically override other colors
 */
function applyDeckColors(
  colors: Float32Array,
  indices: Uint32Array,
  deckFaces: number[],
  deckColor: THREE.Vector3
) {
  deckFaces.forEach(faceIndex => {
    applyColorToFace(colors, indices, faceIndex, deckColor);
  });
}

/**
 * Applies a color to all three vertices of a triangular face
 * Overwrites any previous colors assigned to these vertices
 */
function applyColorToFace(
  colors: Float32Array,
  indices: Uint32Array,
  faceIndex: number,
  color: THREE.Vector3
) {
  // Each face consists of 3 consecutive indices in the indices array
  const baseIndex = faceIndex * 3;
  
  // Apply color to all three vertices of the face
  for (let i = 0; i < 3; i++) {
    const vertexIndex = indices[baseIndex + i];
    const colorOffset = vertexIndex * 3;
    
    // Set RGB values for this vertex
    colors[colorOffset] = color.x;     // Red
    colors[colorOffset + 1] = color.y; // Green
    colors[colorOffset + 2] = color.z; // Blue
  }
}