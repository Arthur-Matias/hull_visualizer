import * as THREE from 'three';

export interface GeometryGroups {
  stations: Record<string, number[]>;
  waterlines: Record<string, number[]>;
  deck: number[];
}

export interface VertexGenerationResult {
  vertices: THREE.Vector3[];
  vertexMap: Record<string, number>;
  keelVertices: number[];
}

export interface VertexGenerationResult {
  vertices: THREE.Vector3[];
  vertexMap: Record<string, number>;
  keelVertices: number[];
}

export interface LODConfig {
  stationMultiplier: number;  // How many intermediate stations between original stations
  waterlineMultiplier: number; // How many intermediate waterlines between original waterlines
  enableSmoothing: boolean;    // Whether to apply smoothing to the mesh
}