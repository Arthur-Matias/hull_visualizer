import * as THREE from 'three';

/**
 * Extended Orthographic Camera with target tracking and view controls
 * Adds directional viewing, panning, and zooming to THREE.OrthographicCamera
 */
export default class CustomOrthographicCamera extends THREE.OrthographicCamera {
    private target: THREE.Vector3;
    private direction: THREE.Vector3;
    private distance: number;
    private baseFrustumSize: number;

    constructor(left: number, right: number, top: number, bottom: number, near: number, far: number) {
        super(left, right, top, bottom, near, far);
        this.target = new THREE.Vector3(0, 0, 0);
        this.direction = new THREE.Vector3(0, 0, -1); // Default looking down negative Z
        this.distance = 10;
        this.baseFrustumSize = 5;
        this.updatePosition();
    }

    /** Gets the current camera target point */
    public getTarget(): THREE.Vector3 {
        return this.target.clone();
    }

    /** Sets the camera target and updates camera position to maintain view direction */
    public setTarget(target: THREE.Vector3): void {
        this.target.copy(target);
        this.updatePosition();
    }

    /** Gets the current view direction vector */
    public getDirection(): THREE.Vector3 {
        return this.direction.clone();
    }

    /** Sets the view direction and normalizes the vector */
    public setDirection(direction: THREE.Vector3): void {
        this.direction.copy(direction).normalize();
        this.updatePosition();
    }

    /** Sets the distance from camera to target */
    public setDistance(distance: number): void {
        this.distance = distance;
        this.updatePosition();
    }

    /** Gets the current distance from camera to target */
    public getDistance(): number {
        return this.distance;
    }

    /** Sets the base frustum size (controls zoom level) */
    public setFrustumSize(size: number): void {
        this.baseFrustumSize = size;
        this.updateFrustum();
    }

    /** Gets the current base frustum size */
    public getFrustumSize(): number {
        return this.baseFrustumSize;
    }

    /** Updates camera position based on target, direction, and distance */
    private updatePosition(): void {
        const position = this.target.clone().add(this.direction.clone().multiplyScalar(this.distance));
        this.position.copy(position);
        this.lookAt(this.target);
    }

    /** Updates camera frustum dimensions based on base size and aspect ratio */
    public updateFrustum(): void {
        const aspect = (this.right - this.left) / (this.top - this.bottom);
        const halfWidth = this.baseFrustumSize * aspect;
        const halfHeight = this.baseFrustumSize;

        // Update frustum bounds while maintaining aspect ratio
        this.left = -halfWidth;
        this.right = halfWidth;
        this.top = halfHeight;
        this.bottom = -halfHeight;
        
        this.updateProjectionMatrix();
    }

    /**
     * Pans the camera view by moving the target point
     * @param deltaX - Horizontal pan amount
     * @param deltaY - Vertical pan amount
     */
    public pan(deltaX: number, deltaY: number): void {
        const panSpeed = this.baseFrustumSize * 0.01;
        
        // Calculate camera-relative right and up vectors
        const right = new THREE.Vector3().crossVectors(this.direction, this.up).normalize();
        const up = new THREE.Vector3().crossVectors(right, this.direction).normalize();
        
        // Create pan vector in camera-relative space
        const panVector = new THREE.Vector3()
            .addScaledVector(right, deltaX * panSpeed)
            .addScaledVector(up, deltaY * panSpeed);
            
        this.target.add(panVector);
        this.updatePosition();
    }

    /**
     * Zooms the camera by adjusting frustum size
     * @param factor - Zoom multiplier (values > 1 zoom out, < 1 zoom in)
     */
    public zoomCamera(factor: number): void {
        this.baseFrustumSize *= factor;
        // Clamp frustum size to reasonable limits
        this.baseFrustumSize = Math.max(0.1, Math.min(100, this.baseFrustumSize));
        this.updateFrustum();
    }
}