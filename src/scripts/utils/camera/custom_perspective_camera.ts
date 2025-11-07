import * as THREE from 'three';

/**
 * Extended Perspective Camera with spherical coordinate controls
 * Adds target tracking and spherical coordinate manipulation to THREE.PerspectiveCamera
 */
export default class CustomPerspectiveCamera extends THREE.PerspectiveCamera {
    private target: THREE.Vector3;
    private spherical: THREE.Spherical;

    constructor(fov: number, aspect: number, near: number, far: number) {
        super(fov, aspect, near, far);
        this.target = new THREE.Vector3(0, 0, 0);
        this.spherical = new THREE.Spherical();
        this.updateSphericalFromPosition();
    }

    /** Gets the current camera target point */
    public getTarget(): THREE.Vector3 {
        return this.target.clone();
    }

    /** Sets the camera target and automatically points camera at it */
    public setTarget(target: THREE.Vector3): void {
        this.target.copy(target);
        this.lookAt(this.target);
    }

    /** Updates spherical coordinates from current camera position relative to target */
    public updateSphericalFromPosition(): void {
        const direction = new THREE.Vector3().subVectors(this.position, this.target);
        this.spherical.setFromVector3(direction);
    }

    /** Gets a copy of the current spherical coordinates */
    public getSpherical(): THREE.Spherical {
        return this.spherical.clone();
    }

    /** Sets camera position using spherical coordinates relative to target */
    public setFromSpherical(spherical: THREE.Spherical): void {
        this.spherical.copy(spherical);
        this.updatePositionFromSpherical();
    }

    /** Updates camera position from current spherical coordinates */
    private updatePositionFromSpherical(): void {
        const newPosition = new THREE.Vector3().setFromSpherical(this.spherical).add(this.target);
        this.position.copy(newPosition);
        this.lookAt(this.target);
    }

    /**
     * Rotates camera around target using spherical coordinates
     * @param deltaAzimuth - Change in horizontal angle (theta)
     * @param deltaPolar - Change in vertical angle (phi)
     */
    public rotate(deltaAzimuth: number, deltaPolar: number): void {
        this.spherical.theta += deltaAzimuth;
        this.spherical.phi += deltaPolar;
        
        // Clamp polar angle to prevent camera from going straight up/down
        this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
        
        this.updatePositionFromSpherical();
    }

    /** Sets distance from camera to target */
    public setDistance(distance: number): void {
        this.spherical.radius = distance;
        this.updatePositionFromSpherical();
    }

    /** Gets current distance from camera to target */
    public getDistance(): number {
        return this.spherical.radius;
    }

    /** Sets camera position directly and updates spherical coordinates accordingly */
    public setPosition(position: THREE.Vector3): void {
        this.position.copy(position);
        this.updateSphericalFromPosition();
        this.lookAt(this.target);
    }
}