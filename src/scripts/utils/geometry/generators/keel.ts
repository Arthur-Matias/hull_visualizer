import { areVerticesValid } from "../validators";

export function generateKeelConnection(
  indices: number[],
  vertexMap: Record<string, number>,
  keelVertices: number[],
  s: number,
  w: number
) {
  const keelLeft = keelVertices[s];
  const keelRight = keelVertices[s + 1];
  const bottomCenterLeft = vertexMap[`${s}_${w}_star`];
  const bottomCenterRight = vertexMap[`${s + 1}_${w}_star`];
  const bottomCenterLeftPort = vertexMap[`${s}_${w}_port`];
  const bottomCenterRightPort = vertexMap[`${s + 1}_${w}_port`];

  if (!areVerticesValid(
    keelLeft, keelRight,
    bottomCenterLeft, bottomCenterRight,
    bottomCenterLeftPort, bottomCenterRightPort
  )) {
    return;
  }

  // Connect keel to hull bottom
  indices.push(bottomCenterLeft, bottomCenterRight, keelRight);
  indices.push(bottomCenterLeft, keelRight, keelLeft);
  indices.push(bottomCenterLeftPort, keelLeft, keelRight);
  indices.push(bottomCenterLeftPort, keelRight, bottomCenterRightPort);
}