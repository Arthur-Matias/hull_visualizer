import type CustomOrthographicCamera from "../scripts/utils/camera/custom_ortho_camera";
import type CustomPerspectiveCamera from "../scripts/utils/camera/custom_perspective_camera";

export type Views = "front" | "back" | "left" | "right" | "top" | "bottom";
export type CameraModes = "perspective" | "orthographic";
export type CameraUnion = CustomPerspectiveCamera | CustomOrthographicCamera;