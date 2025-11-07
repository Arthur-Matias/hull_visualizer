import { getChineVertices, getPanelVertices } from "../getters";
import { areChineVerticesValid } from "../validators";

/**
 * Generates triangular faces for a chine panel - specialized hull section with curved transitions
 * Chine panels create smoother transitions between hull surfaces at the bottom edges
 */
export function generateChinePanel(
  indices: number[],
  vertexMap: Record<string, number>,
  s: number,
  w: number
) {
  // Get standard panel vertices and specialized chine vertices
  const vertices = getPanelVertices(vertexMap, s, w);
  const chineVertices = getChineVertices(vertexMap, s, w);

  // Skip generation if chine vertices are incomplete
  if (!areChineVerticesValid(chineVertices)) {
    return;
  }

  // Starboard side triangles - creates two quad sections divided into triangles
  // Upper starboard triangle: topLeft → topRight → chineTopRight
  indices.push(vertices.topLeft, vertices.topRight, chineVertices.chineTopRight);
  // Lower starboard triangle: topLeft → chineTopRight → chineTopLeft
  indices.push(vertices.topLeft, chineVertices.chineTopRight, chineVertices.chineTopLeft);
  // Middle starboard triangle: chineTopLeft → chineTopRight → chineBottomRight
  indices.push(chineVertices.chineTopLeft, chineVertices.chineTopRight, chineVertices.chineBottomRight);
  // Bottom starboard triangle: chineTopLeft → chineBottomRight → chineBottomLeft
  indices.push(chineVertices.chineTopLeft, chineVertices.chineBottomRight, chineVertices.chineBottomLeft);

  // Port side triangles - creates two quad sections divided into triangles (reverse winding)
  // Upper port triangle: topLeftPort → chineTopLeftPort → chineTopRightPort
  indices.push(vertices.topLeftPort, chineVertices.chineTopLeftPort, chineVertices.chineTopRightPort);
  // Lower port triangle: topLeftPort → chineTopRightPort → topRightPort
  indices.push(vertices.topLeftPort, chineVertices.chineTopRightPort, vertices.topRightPort);
  // Middle port triangle: chineTopLeftPort → chineBottomLeftPort → chineBottomRightPort
  indices.push(chineVertices.chineTopLeftPort, chineVertices.chineBottomLeftPort, chineVertices.chineBottomRightPort);
  // Bottom port triangle: chineTopLeftPort → chineBottomRightPort → chineTopRightPort
  indices.push(chineVertices.chineTopLeftPort, chineVertices.chineBottomRightPort, chineVertices.chineTopRightPort);
}