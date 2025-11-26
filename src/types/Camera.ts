import * as THREE from "three"

export type Views = "front" | "back" | "left" | "right" | "top" | "bottom";
export type CameraModes = "perspective" | "orthographic";
export type CameraUnion = THREE.PerspectiveCamera | THREE.OrthographicCamera;