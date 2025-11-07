import * as THREE from 'three';
import CustomPerspectiveCamera from '../camera/custom_perspective_camera';
import CustomOrthographicCamera from '../camera/custom_ortho_camera';
import type CameraHelper from '../../utils/camera/camera_helper';
import { stateManager } from '../../state_manager';

export type CameraUnion = CustomPerspectiveCamera | CustomOrthographicCamera;

/**
 * Orbit controls system for both perspective and orthographic cameras
 * Provides unified camera control interface with spherical coordinate navigation
 */
export default class CustomOrbitControls {
    public camera: CameraHelper;
    private target: THREE.Vector3;
    public isPerspective: boolean;

    // Spherical coordinate state
    private azimuthAngle: number = 0;      // Horizontal rotation (theta)
    private polarAngle: number = Math.PI / 3; // Vertical rotation (phi)
    private distance: number = 10;         // Distance from target

    // Control parameters and constraints
    private minDistance: number = 1;
    private maxDistance: number = 1000;
    private minPolarAngle: number = 0.1;   // Prevent camera from going straight up/down
    private maxPolarAngle: number = Math.PI - 0.1;
    private zoomSpeed: number = 1.0;
    private rotateSpeed: number = 1.0;

    constructor(camera: CameraHelper) {
        this.camera = camera;
        this.target = new THREE.Vector3();
        this.isPerspective = camera.getCamera() instanceof CustomPerspectiveCamera;

        this.initializeFromCamera();
    }

    /**
     * Switches between camera types while preserving current view state
     * @param camera - New camera helper instance
     */
    public setCamera(camera: CameraHelper): void {
        stateManager.Debug && console.log('🔄 Setting camera in controls:', camera.constructor.name);

        // Store current state before switching cameras
        const currentTarget = this.target.clone();
        const currentDistance = this.distance;

        this.camera = camera;
        this.isPerspective = camera.getCamera() instanceof CustomPerspectiveCamera;

        // Restore previous state to new camera
        this.target.copy(currentTarget);
        this.distance = currentDistance;

        // Re-initialize from the new camera
        this.initializeFromCamera();

        stateManager.Debug && console.log('✅ Camera set in controls');
    }

    /**
     * Initializes control state from current camera position and orientation
     */
    public initializeFromCamera(): void {
        if (this.isPerspective) {
            const perspectiveCam = this.camera.getCamera() as CustomPerspectiveCamera;
            this.target.copy(perspectiveCam.getTarget());
            const spherical = perspectiveCam.getSpherical();
            this.azimuthAngle = spherical.theta;
            this.polarAngle = spherical.phi;
            this.distance = spherical.radius;
        } else {
            // Handle orthographic camera initialization
            const orthoCam = this.camera.getCamera() as CustomOrthographicCamera;
            this.target.copy(orthoCam.getTarget());
            this.distance = orthoCam.getDistance();

            // Convert orthographic direction to spherical coordinates
            const direction = orthoCam.getDirection();
            const spherical = new THREE.Spherical().setFromVector3(direction);
            this.azimuthAngle = spherical.theta;
            this.polarAngle = spherical.phi;
        }

        this.updateCamera();
    }

    /** Gets the current camera target point */
    public getTarget(): THREE.Vector3 {
        return this.target.clone();
    }

    /** Sets the camera target point */
    public setTarget(target: THREE.Vector3): void {
        this.target.copy(target);
        this.updateCamera();
    }

    /**
     * Rotates the camera around the target point
     * @param deltaX - Horizontal rotation delta
     * @param deltaY - Vertical rotation delta
     */
    public rotate(deltaX: number, deltaY: number): void {
        const rotationSpeed = 0.01 * this.rotateSpeed;

        this.azimuthAngle -= deltaX * rotationSpeed;
        this.polarAngle -= deltaY * rotationSpeed;

        // Clamp polar angle to prevent camera flipping
        this.polarAngle = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.polarAngle));

        this.updateCamera();
    }

    /**
     * Pans the camera and target together
     * @param deltaX - Horizontal pan delta
     * @param deltaY - Vertical pan delta
     */
    public pan(deltaX: number, deltaY: number): void {
        if (this.isPerspective) {
            this.panPerspective(deltaX, deltaY);
        } else {
            this.panOrthographic(deltaX, deltaY);
        }
    }

    /** Perspective camera panning - moves target point in camera-relative space */
    private panPerspective(deltaX: number, deltaY: number): void {
        const panSpeed = this.distance * 0.001;
        const direction = new THREE.Vector3().subVectors(this.camera.getCamera().position, this.target).normalize();
        const right = new THREE.Vector3().crossVectors(direction, this.camera.getCamera().up).normalize();
        const up = new THREE.Vector3().crossVectors(right, direction).normalize();

        const panVector = new THREE.Vector3()
            .addScaledVector(right, -deltaX * panSpeed)
            .addScaledVector(up, -deltaY * panSpeed);

        this.target.add(panVector);
        this.updateCamera();
    }

    /** Orthographic camera panning - delegates to orthographic camera implementation */
    private panOrthographic(deltaX: number, deltaY: number): void {
        const orthoCam = this.camera.getCamera() as CustomOrthographicCamera;
        orthoCam.pan(deltaX, deltaY);
        this.target.copy(orthoCam.getTarget());
    }

    /**
     * Zooms the camera in/out
     * @param delta - Zoom delta (positive = zoom in, negative = zoom out)
     */
    public zoom(delta: number): void {
        if (this.isPerspective) {
            this.zoomPerspective(delta);
        } else {
            this.zoomOrthographic(delta);
        }
    }

    /** Perspective camera zooming - adjusts distance from target */
    private zoomPerspective(delta: number): void {
        this.distance *= (1 + delta * this.zoomSpeed * 0.1);
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
        this.updateCamera();
    }

    /** Orthographic camera zooming - adjusts orthographic camera zoom level */
    private zoomOrthographic(delta: number): void {
        const orthoCam = this.camera.getCamera() as CustomOrthographicCamera;
        const zoomFactor = 1 + delta * this.zoomSpeed * 0.1;
        orthoCam.zoomCamera(zoomFactor);
    }

    /** Updates the underlying camera with current control state */
    private updateCamera(): void {
        if (this.isPerspective) {
            const perspectiveCam = this.camera.getCamera() as CustomPerspectiveCamera;
            
            // Calculate position from spherical coordinates
            const spherical = new THREE.Spherical(this.distance, this.polarAngle, this.azimuthAngle);
            const position = new THREE.Vector3().setFromSpherical(spherical);
            position.add(this.target);
            
            // Set position and target on perspective camera
            perspectiveCam.setPosition(position);
            perspectiveCam.setTarget(this.target);
        } else {
            const orthoCam = this.camera.getCamera() as CustomOrthographicCamera;
            
            // For orthographic, calculate direction from spherical angles
            const spherical = new THREE.Spherical(1, this.polarAngle, this.azimuthAngle);
            const direction = new THREE.Vector3().setFromSpherical(spherical);

            orthoCam.setDirection(direction);
            orthoCam.setDistance(this.distance);
            orthoCam.setTarget(this.target);
        }
    }

    /** Gets current distance from target */
    public getDistance(): number {
        return this.distance;
    }

    /** Sets distance from target with constraints */
    public setDistance(distance: number): void {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
        this.updateCamera();
    }

    /** Gets current spherical angles */
    public getAngles(): { azimuth: number, polar: number } {
        return {
            azimuth: this.azimuthAngle,
            polar: this.polarAngle
        };
    }

    /** Sets spherical angles with polar angle constraints */
    public setAngles(azimuth: number, polar: number): void {
        this.azimuthAngle = azimuth;
        this.polarAngle = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, polar));
        this.updateCamera();
    }

    /** Gets current camera position */
    public getPosition(): THREE.Vector3 {
        return this.camera.getCamera().position.clone();
    }

    /** Sets camera position (primarily for perspective cameras) */
    public setPosition(position: THREE.Vector3): void {
        if (this.isPerspective) {
            const perspectiveCam = this.camera.getCamera() as CustomPerspectiveCamera;
            perspectiveCam.setPosition(position);
            this.initializeFromCamera(); // Re-initialize control state from new position
        }
        // Note: Orthographic camera position is determined by direction and distance
    }

    /** Syncs control state with current camera state (useful for external camera modifications) */
    public update(): void {
        this.initializeFromCamera();
    }

    /** Cleans up resources */
    public dispose(): void {
        stateManager.Debug && console.log('🧹 Disposing orbit controls');
    }
}