import * as THREE from 'three';

export interface HullGeometry{
    vertices: Float32Array;
    indices: Uint16Array;
    groups: { stations: {}, waterlines: {}, deck: number[] };
    stats: { vertexCount: number, faceCount: number, stationCount: number, waterlineCount: number };
    
    // New properties for line overlays and additional components:
    waterlinePoints?: { [waterlineId: string]: THREE.Vector3[] };
    stationPoints?: { [stationId: string]: THREE.Vector3[] };
    deckPoints?: THREE.Vector3[];
    deckIndices?: Uint16Array;
    transomPoints?: THREE.Vector3[];
    transomIndices?: Uint16Array;
    bowPoints?: THREE.Vector3[];
    bowIndices?: Uint16Array;
    colors?: Float32Array;
}

export type HullGroups = {
    stations: boolean;
    waterlines: boolean;
    deck: boolean;
    hull: boolean;
};