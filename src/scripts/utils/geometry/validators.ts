/**
 * Validates that all panel vertices are defined and valid
 * Checks the eight vertices that define a hull panel (starboard and port sides)
 */
export function areAllPanelVerticesValid(vertices: any): boolean {
  return areVerticesValid(
    vertices.topLeft,
    vertices.topRight,
    vertices.bottomRight,
    vertices.bottomLeft,
    vertices.topLeftPort,
    vertices.topRightPort,
    vertices.bottomRightPort,
    vertices.bottomLeftPort
  );
}

/**
 * Generic validation function that checks if all provided vertex indices are defined
 * Returns true only if ALL vertices are valid (not undefined)
 */
export function areVerticesValid(...indices: (number | undefined)[]): boolean {
  return indices.every(index => index !== undefined);
}

/**
 * Validates that all chine vertices are defined and valid
 * Chine vertices represent the intersections between hull panels
 */
export function areChineVerticesValid(chineVertices: any): boolean {
  return areVerticesValid(
    chineVertices.chineTopLeft,
    chineVertices.chineTopRight,
    chineVertices.chineBottomLeft,
    chineVertices.chineBottomRight,
    chineVertices.chineTopLeftPort,
    chineVertices.chineTopRightPort,
    chineVertices.chineBottomLeftPort,
    chineVertices.chineBottomRightPort
  );
}