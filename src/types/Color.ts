import * as THREE from 'three';

export interface ColorMap {
  station: THREE.Vector3;
  waterline: THREE.Vector3;
  deck: THREE.Vector3;
  default: THREE.Vector3;
}