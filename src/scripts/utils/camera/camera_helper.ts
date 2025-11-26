import * as THREE from "three";
import Hull from "../../../components/hull";
import { stateManager } from "../../state_manager";
import type { CameraModes, CameraUnion, Views } from "../../../types";

/**
 * Unified camera management with simplified state handling
 */
export default class CameraHelper {
    private perspectiveCamera: THREE.PerspectiveCamera;
    private orthographicCamera: THREE.OrthographicCamera;
    private targetElement: HTMLElement;
    
    // Single source of truth for camera state
    private target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    private spherical: THREE.Spherical = new THREE.Spherical(10, Math.PI / 3, 0);
    private currentCameraMode: CameraModes = stateManager.CameraMode;

    // Orthographic camera state
    private orthographicFrustumSize: number = 5;
    private orthographicAspect: number = 1;

    // Control constraints
    private minDistance: number = 1;
    private maxDistance: number = 1000;
    private minPolarAngle: number = 0.1;
    private maxPolarAngle: number = Math.PI - 0.1;

    constructor(targetElement: HTMLElement) {
        this.targetElement = targetElement;
        const { aspect } = this.getCanvasDimensions();
        this.orthographicAspect = aspect;

        // Create basic Three.js cameras
        this.perspectiveCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.orthographicCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);

        this.initializeCameras();
        stateManager.CameraMode = this.currentCameraMode;
    }

    private getCanvasDimensions() {
        const width = this.targetElement.clientWidth || 800;
        const height = this.targetElement.clientHeight || 600;
        const aspect = width / height;
        return { width, height, aspect };
    }

    private initializeCameras() {
        const initialPosition = new THREE.Vector3(10, 5, 10);
        
        // Set up perspective camera
        this.perspectiveCamera.position.copy(initialPosition);
        this.perspectiveCamera.lookAt(this.target);

        // Set up orthographic camera
        this.orthographicCamera.position.copy(initialPosition);
        this.orthographicCamera.lookAt(this.target);
        this.updateOrthographicFrustum();

        // Initialize spherical state from current camera
        this.updateSphericalFromCamera();
    }

    // ---------------------------- Core Camera Control ----------------------------

    /** Gets the currently active camera */
    getCamera(): CameraUnion {
        return this.currentCameraMode === "perspective" 
            ? this.perspectiveCamera 
            : this.orthographicCamera;
    }

    /** Gets current camera mode */
    getMode(): CameraModes {
        return this.currentCameraMode;
    }

    /** Toggle between camera modes */
    toggleCameraMode(mode: CameraModes) {
        if (this.currentCameraMode === mode) return;
        
        stateManager.Debug && console.log(`🔄 Switching to ${mode.toUpperCase()} mode`);
        
        // Update spherical state from current camera before switching
        this.updateSphericalFromCamera();
        
        this.currentCameraMode = mode;
        stateManager.CameraMode = mode;
        
        // Update the new camera with current state
        this.updateCameraFromSpherical();
    }

    // ---------------------------- Camera Movement ----------------------------

    /**
     * Rotates camera around target using spherical coordinates
     */
    public rotate(deltaX: number, deltaY: number): void {
        const rotationSpeed = 0.01;

        this.spherical.theta -= deltaX * rotationSpeed;
        this.spherical.phi -= deltaY * rotationSpeed;

        // Clamp polar angle
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
        
        this.updateCameraFromSpherical();
    }

    /**
     * Zooms camera in/out
     */
    public zoom(delta: number): void {
        if (this.currentCameraMode === "perspective") {
            // Perspective: adjust distance
            this.spherical.radius *= (1 + delta * 0.1);
            this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
        } else {
            // Orthographic: adjust frustum size
            this.orthographicFrustumSize *= (1 + delta * 0.1);
            this.orthographicFrustumSize = Math.max(0.1, Math.min(100, this.orthographicFrustumSize));
            this.updateOrthographicFrustum();
        }
        
        this.updateCameraFromSpherical();
    }

    /**
     * Pans the camera view
     */
    public pan(deltaX: number, deltaY: number): void {
        const panSpeed = this.currentCameraMode === "perspective" 
            ? this.spherical.radius * 0.001 
            : this.orthographicFrustumSize * 0.01;

        const camera = this.getCamera();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3();
        
        camera.getWorldDirection(right).cross(camera.up).normalize();
        up.copy(camera.up).normalize();
        
        const panVector = new THREE.Vector3()
            .addScaledVector(right, -deltaX * panSpeed)
            .addScaledVector(up, deltaY * panSpeed);
            
        this.target.add(panVector);
        this.updateCameraFromSpherical();
    }

    // ---------------------------- View Presets ----------------------------

    /** Set predefined orthographic views */
    setView(view: Views) {
        stateManager.Debug && console.log(`🎯 Switching to ${view} view`);
        
        // Ensure we're in orthographic mode for orthographic views
        if (this.currentCameraMode !== "orthographic") {
            this.toggleCameraMode("orthographic");
        }

        const directions = {
            front: new THREE.Vector3(0, 0, -1),
            back: new THREE.Vector3(0, 0, 1),
            left: new THREE.Vector3(1, 0, 0),
            right: new THREE.Vector3(-1, 0, 0),
            top: new THREE.Vector3(0, 1, 0),
            bottom: new THREE.Vector3(0, -1, 0)
        };

        const direction = directions[view];
        const spherical = new THREE.Spherical().setFromVector3(direction);
        
        this.spherical.theta = spherical.theta;
        this.spherical.phi = spherical.phi;
        
        this.updateCameraFromSpherical();
    }

    // Convenience methods for the rotation cube
    frontView() { this.setView('front'); }
    backView() { this.setView('back'); }
    leftView() { this.setView('left'); }
    rightView() { this.setView('right'); }
    topView() { this.setView('top'); }
    bottomView() { this.setView('bottom'); }

    // ---------------------------- State Synchronization ----------------------------

    /** Update spherical coordinates from current camera position */
    private updateSphericalFromCamera(): void {
        const camera = this.getCamera();
        const direction = new THREE.Vector3().subVectors(camera.position, this.target);
        this.spherical.setFromVector3(direction);
    }

    /** Update camera position from current spherical coordinates */
    private updateCameraFromSpherical(): void {
        const camera = this.getCamera();
        const position = new THREE.Vector3().setFromSpherical(this.spherical).add(this.target);
        
        camera.position.copy(position);
        camera.lookAt(this.target);
        
        if (this.currentCameraMode === "orthographic") {
            camera.updateProjectionMatrix();
        }
    }

    /** Update orthographic camera frustum based on current size and aspect */
    private updateOrthographicFrustum(): void {
        const halfWidth = this.orthographicFrustumSize * this.orthographicAspect;
        const halfHeight = this.orthographicFrustumSize;
        
        this.orthographicCamera.left = -halfWidth;
        this.orthographicCamera.right = halfWidth;
        this.orthographicCamera.top = halfHeight;
        this.orthographicCamera.bottom = -halfHeight;
        this.orthographicCamera.updateProjectionMatrix();
    }

    // ---------------------------- Hull Integration ----------------------------

    /** Set hull object for automatic camera positioning */
    setHullObject(hull: Hull) {
        const bbox = new THREE.Box3().setFromObject(hull.getFullHullMesh());
        bbox.getCenter(this.target);

        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        this.spherical.radius = maxDim * 2;
        this.orthographicFrustumSize = maxDim * 1.2;

        // Update both cameras
        this.updateCameraFromSpherical();
        this.updateOrthographicFrustum();
    }

    /** Handle window resize */
    handleResize(width: number, height: number): void {
        const aspect = width / height;

        // Update perspective camera
        this.perspectiveCamera.aspect = aspect;
        this.perspectiveCamera.updateProjectionMatrix();

        // Update orthographic camera
        this.orthographicAspect = aspect;
        this.updateOrthographicFrustum();
    }

    // ---------------------------- Getters for External Use ----------------------------

    getTarget(): THREE.Vector3 {
        return this.target.clone();
    }

    setTarget(target: THREE.Vector3): void {
        this.target.copy(target);
        this.updateCameraFromSpherical();
    }

    getDistance(): number {
        return this.spherical.radius;
    }

    setDistance(distance: number): void {
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
        this.updateCameraFromSpherical();
    }

    getAngles(): { azimuth: number, polar: number } {
        return {
            azimuth: this.spherical.theta,
            polar: this.spherical.phi
        };
    }

    setAngles(azimuth: number, polar: number): void {
        this.spherical.theta = azimuth;
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, polar));
        this.updateCameraFromSpherical();
    }

    dispose(): void {
        // Clean up if needed
    }
}