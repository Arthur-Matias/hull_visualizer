import * as THREE from "three";
import Hull from "../../../components/hull";
import CustomOrthographicCamera from "./custom_ortho_camera";
import CustomPerspectiveCamera from "./custom_perspective_camera";
import { stateManager } from "../../state_manager";
import type { CameraModes, CameraUnion, Views } from "../../../types";

/**
 * Camera management helper that provides unified control over both perspective and orthographic cameras
 * Handles camera switching, view controls, and state synchronization with the application
 */
export default class CameraHelper {
    private perspectiveCamera: CustomPerspectiveCamera;
    private orthographicCamera: CustomOrthographicCamera;
    private targetElement: HTMLElement;
    private startingCameraDistance: number = 10;
    private hullObject?: Hull;
    private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    private currentCameraMode: CameraModes = stateManager.CameraMode;

    // Spherical coordinate control state
    private azimuthAngle: number = 0;      // Horizontal rotation
    private polarAngle: number = Math.PI / 3; // Vertical rotation
    private distance: number = 10;         // Distance from target

    // Control parameters and constraints
    private minDistance: number = 1;
    private maxDistance: number = 1000;
    private minPolarAngle: number = 0.1;   // Prevent camera from going straight up/down
    private maxPolarAngle: number = Math.PI - 0.1;
    private zoomSpeed: number = 1.0;
    private rotateSpeed: number = 1.0;

    private onModeChangeCallbacks: (() => void)[] = [];

    constructor(targetElement: HTMLElement) {
        this.targetElement = targetElement;

        const width = this.targetElement.clientWidth || 800;
        const height = this.targetElement.clientHeight || 600;
        const aspect = width / height;

        // Create both camera types
        this.perspectiveCamera = new CustomPerspectiveCamera(75, aspect, 0.1, 1000);
        this.orthographicCamera = new CustomOrthographicCamera(-5, 5, 5, -5, 0.1, 1000);

        // Set initial camera positions
        const initialPosition = new THREE.Vector3(10, 5, 10);
        this.perspectiveCamera.setPosition(initialPosition);
        this.perspectiveCamera.setTarget(this.target);

        this.orthographicCamera.position.copy(initialPosition);
        const direction = new THREE.Vector3().subVectors(initialPosition, this.target).normalize();
        this.orthographicCamera.setDirection(direction);
        this.orthographicCamera.setDistance(initialPosition.length());
        this.orthographicCamera.setTarget(this.target);

        // Initialize control state from current camera
        this.initializeControlState();

        // Sync state manager with initial camera mode
        stateManager.CameraMode = this.currentCameraMode;
    }

    /** Registers callback for camera mode changes */
    public onModeChange(callback: () => void): void {
        this.onModeChangeCallbacks.push(callback.bind(this));
        this.onModeChangeCallbacks.push(this.updateState.bind(this));
    }

    /** Updates state manager with current camera mode */
    updateState(){
        stateManager.CameraMode = this.getMode()
    }

    // ----------------------------
    // Control State Initialization
    // ----------------------------

    /** Initializes control state from current camera position and orientation */
    private initializeControlState(): void {
        if (this.currentCameraMode === "perspective") {
            const spherical = this.perspectiveCamera.getSpherical();
            this.azimuthAngle = spherical.theta;
            this.polarAngle = spherical.phi;
            this.distance = spherical.radius;
        } else {
            const direction = this.orthographicCamera.getDirection();
            const spherical = new THREE.Spherical().setFromVector3(direction);
            this.azimuthAngle = spherical.theta;
            this.polarAngle = spherical.phi;
            this.distance = this.orthographicCamera.getDistance();
        }
    }

    // ----------------------------
    // Public Getters / Setters
    // ----------------------------

    /** Gets the currently active camera */
    getCamera(): CameraUnion {
        return this.currentCameraMode === "perspective"
            ? this.perspectiveCamera
            : this.orthographicCamera;
    }

    /** Gets current camera mode */
    getMode(): "perspective" | "orthographic" {
        return this.currentCameraMode;
    }

    /** Sets camera mode without triggering callbacks (for internal use) */
    setMode(mode: CameraModes) {
        this.currentCameraMode = mode;
    }

    /** Gets current camera target point */
    getTarget(): THREE.Vector3 {
        return this.target.clone();
    }

    /** Sets camera target for both camera types */
    setTarget(target: THREE.Vector3): void {
        this.target.copy(target);
        this.perspectiveCamera.setTarget(this.target);
        this.orthographicCamera.setTarget(this.target);
        this.updateCameraPosition();
    }

    /** Gets current distance from target */
    getDistance(): number {
        return this.distance;
    }

    /** Sets distance from target with constraints */
    setDistance(distance: number): void {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
        this.updateCameraPosition();
    }

    /** Gets current spherical angles */
    getAngles(): { azimuth: number, polar: number } {
        return {
            azimuth: this.azimuthAngle,
            polar: this.polarAngle
        };
    }

    /** Sets spherical angles with polar angle constraints */
    setAngles(azimuth: number, polar: number): void {
        this.azimuthAngle = azimuth;
        this.polarAngle = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, polar));
        this.updateCameraPosition();
    }

    /** Sets hull object for automatic camera positioning and view setup */
    setHullObject(hull: Hull) {
        this.hullObject = hull;
        const bbox = new THREE.Box3().setFromObject(this.hullObject.getFullHullMesh());
        bbox.getCenter(this.target);

        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        this.startingCameraDistance = maxDim * 2;
        this.distance = this.startingCameraDistance;

        // Update both cameras with new target
        this.perspectiveCamera.setTarget(this.target);
        this.orthographicCamera.setTarget(this.target);

        // Set optimal initial position for perspective camera
        const initialPosition = new THREE.Vector3(
            this.startingCameraDistance * 0.7,
            this.startingCameraDistance * 0.3,
            this.startingCameraDistance * 0.7
        );

        this.perspectiveCamera.setPosition(initialPosition);

        // Configure orthographic camera for hull viewing
        this.orthographicCamera.position.copy(initialPosition);
        const direction = new THREE.Vector3().subVectors(initialPosition, this.target).normalize();
        this.orthographicCamera.setDirection(direction);
        this.orthographicCamera.setDistance(this.startingCameraDistance);
        this.orthographicCamera.setFrustumSize(maxDim * 1.2);

        // Re-initialize control state from new camera positions
        this.initializeControlState();
    }

    // ----------------------------
    // Mouse Control Methods
    // ----------------------------

    /**
     * Rotates camera around target using spherical coordinates
     * @param deltaX - Horizontal rotation delta
     * @param deltaY - Vertical rotation delta
     */
    public rotate(deltaX: number, deltaY: number): void {
        const rotationSpeed = 0.01 * this.rotateSpeed;

        this.azimuthAngle -= deltaX * rotationSpeed;
        this.polarAngle -= deltaY * rotationSpeed;

        // Clamp polar angle to prevent camera flipping
        this.polarAngle = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.polarAngle));

        this.updateCameraPosition();
    }

    /**
     * Zooms camera in/out
     * @param delta - Zoom delta (positive = zoom in, negative = zoom out)
     */
    public zoom(delta: number): void {
        if (this.currentCameraMode === "perspective") {
            // Perspective zoom: adjust distance from target
            this.distance *= (1 + delta * this.zoomSpeed * 0.4);
            this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
            this.updateCameraPosition();
        } else {
            // Orthographic zoom: adjust frustum size
            const zoomFactor = 1 + delta * this.zoomSpeed * 0.1;
            this.orthographicCamera.zoomCamera(zoomFactor);
        }
    }

    /** Updates camera position based on current control state */
    private updateCameraPosition(): void {
        if (this.currentCameraMode === "perspective") {
            // Calculate position from spherical coordinates
            const spherical = new THREE.Spherical(this.distance, this.polarAngle, this.azimuthAngle);
            const position = new THREE.Vector3().setFromSpherical(spherical);
            position.add(this.target);

            // Update perspective camera
            this.perspectiveCamera.setPosition(position);
            this.perspectiveCamera.setTarget(this.target);
        } else {
            // Calculate direction from spherical angles for orthographic camera
            const spherical = new THREE.Spherical(1, this.polarAngle, this.azimuthAngle);
            const direction = new THREE.Vector3().setFromSpherical(spherical);

            this.orthographicCamera.setDirection(direction);
            this.orthographicCamera.setDistance(this.distance);
            this.orthographicCamera.setTarget(this.target);
        }
    }

    // ----------------------------
    // View Methods - Direct camera control
    // ----------------------------

    /** Sets front orthographic view */
    frontView() {
        this.switchToOrthoView(new THREE.Vector3(0, 0, 1), 'front');
    }

    /** Sets back orthographic view */
    backView() {
        this.switchToOrthoView(new THREE.Vector3(0, 0, -1), 'back');
    }

    /** Sets left orthographic view */
    leftView() {
        this.switchToOrthoView(new THREE.Vector3(-1, 0, 0), 'left');
    }

    /** Sets right orthographic view */
    rightView() {
        this.switchToOrthoView(new THREE.Vector3(1, 0, 0), 'right');
    }

    /** Sets top orthographic view */
    topView() {
        this.switchToOrthoView(new THREE.Vector3(0, 1, 0), 'top');
    }

    /** Sets bottom orthographic view */
    bottomView() {
        this.switchToOrthoView(new THREE.Vector3(0, -1, 0), 'bottom');
    }

    /** Switches to perspective camera mode */
    switchToPerspective() {
        stateManager.Debug && console.log('🔄 Switching to PERSPECTIVE mode');
        
        if (this.currentCameraMode === "orthographic") {
            // Convert orthographic direction to spherical coordinates
            const direction = this.orthographicCamera.getDirection();
            const spherical = new THREE.Spherical().setFromVector3(direction);
            this.azimuthAngle = spherical.theta;
            this.polarAngle = spherical.phi;
            this.updateCameraPosition();
        }
        
        this.currentCameraMode = "perspective";
        
        // Trigger mode change callbacks
        this.onModeChangeCallbacks.forEach(callback => callback());
        
        stateManager.Debug && console.log('✅ Switched to perspective');
    }

    /** Switches to orthographic camera mode */
    switchToOrthographic() {
        stateManager.Debug && console.log('🔄 Switching to ORTHOGRAPHIC mode');
        
        if (this.currentCameraMode === "perspective") {
            // Convert perspective spherical coordinates to orthographic direction
            const spherical = this.perspectiveCamera.getSpherical();
            this.azimuthAngle = spherical.theta;
            this.polarAngle = spherical.phi;
            this.updateCameraPosition();
        }
        
        this.currentCameraMode = "orthographic";
        
        // Trigger mode change callbacks
        this.onModeChangeCallbacks.forEach(callback => callback());
        
        stateManager.Debug && console.log('✅ Switched to orthographic');
    }

    /** Toggles between camera modes */
    toggleCameraMode(mode: "perspective" | "orthographic") {
        if (mode === "perspective") {
            this.switchToPerspective();
        } else {
            this.switchToOrthographic();
        }
    }

    // ----------------------------
    // Private Methods
    // ----------------------------

    /** Switches to specific orthographic view direction */
    private switchToOrthoView(direction: THREE.Vector3, viewName: Views) {
        stateManager.Debug && console.log(`🎯 Switching to ${viewName} view`);

        // Ensure we're in orthographic mode
        if (this.currentCameraMode !== "orthographic") {
            this.switchToOrthographic();
        }

        const position = direction.clone().multiplyScalar(this.startingCameraDistance).add(this.target);

        stateManager.Debug && console.log('🔹 Orthographic view setup:', {
            view: viewName,
            direction: direction,
            position: position,
            target: this.target,
            distance: this.startingCameraDistance
        });

        // Configure orthographic camera for the specific view
        this.orthographicCamera.setDirection(direction);
        this.orthographicCamera.position.copy(position);
        this.orthographicCamera.setDistance(this.startingCameraDistance);
        this.orthographicCamera.lookAt(this.target);

        // Update orthographic frustum to fit hull
        this.updateOrthographicFrustum();

        // Update control state to match new view
        const spherical = new THREE.Spherical().setFromVector3(direction);
        this.azimuthAngle = spherical.theta;
        this.polarAngle = spherical.phi;

        stateManager.Debug && console.log(`✅ ${viewName} view set`);
    }

    /** Updates orthographic camera frustum to fit the hull object */
    private updateOrthographicFrustum() {
        if (!this.hullObject) return;

        const bbox = new THREE.Box3().setFromObject(this.hullObject.getFullHullMesh());
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        this.orthographicCamera.setFrustumSize(maxDim * 1.2);
    }

    /** Handles window resize events */
    handleResize(width: number, height: number): void {
        const aspect = width / height;

        // Update perspective camera aspect ratio
        this.perspectiveCamera.aspect = aspect;
        this.perspectiveCamera.updateProjectionMatrix();

        // Update orthographic camera frustum
        this.orthographicCamera.updateFrustum();
    }

    /** Cleans up resources */
    dispose(): void {
        // Clean up any resources if needed
    }
}