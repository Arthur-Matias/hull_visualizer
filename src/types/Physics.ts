import * as THREE  from 'three';

export interface Weight {
    position: THREE.Vector3;
    // direction: THREE.Vector3;
    magnitude: number;
}

export interface HydrostaticProperties {
  volume: number;
  displacement: number;
  centerOfBuoyancy: {
    longitudinal: number; // LCB
    vertical: number;     // VCB
    transverse: number;   // TCB
  };
  wettedSurfaceArea: number;
  waterplaneArea: number;
  centerOfFloatation: {
    longitudinal: number; // LCF
    transverse: number;
  };
  blockCoefficient: number;
  prismaticCoefficient: number;
  midshipCoefficient: number;
  waterplaneCoefficient: number;
  maxSectionArea: number;
  lengthOverall: number;
  beamOverall: number;
  draft: number;
}

export interface WaterIntersectionData {
  points: THREE.Vector3[];
  area: number;
  volume: number;
  centerOfBuoyancy: THREE.Vector3;
  metacenter: number;
  buoyancyForce: THREE.Vector3;
  buoyancyCenter: THREE.Vector3;
}