import * as THREE from 'three';
import CameraHelper from '../scripts/utils/camera/camera_helper';
import MouseHelper from '../scripts/utils/controls/mouse_helper';
import { stateManager } from '../scripts/state_manager';

/**
 * Interactive rotation cube overlay for 3D camera orientation control
 * Provides visual feedback and quick view switching through an overlay canvas
 */
export default class RotationCube {
    private cameraHelperRef: CameraHelper;
    private mouseHelper: MouseHelper;

    // Overlay THREE.js rendering components
    private overlayRenderer!: THREE.WebGLRenderer;
    private overlayScene!: THREE.Scene;
    private overlayCamera!: THREE.PerspectiveCamera;
    private overlayCanvas: HTMLCanvasElement;

    // 3D visualization objects
    private cubeMesh!: THREE.Mesh;
    private edges!: THREE.LineSegments;
    private sprites: THREE.Sprite[] = [];
    
    // Interaction state tracking
    private dragStartedOnCanvas: boolean = false;
    private isDragging: boolean = false;

    constructor(cameraHelper: CameraHelper, mouseHelper: MouseHelper) {
        this.cameraHelperRef = cameraHelper;
        this.mouseHelper = mouseHelper;

        // Create and configure overlay canvas
        this.overlayCanvas = document.createElement('canvas');
        this.setupOverlayCanvas();

        this.setupOverlayThreeJS();
        this.createSprites();
        this.setupListeners();

        this.syncOverlayCamera();
    }

    /** Sets up the overlay canvas element with styling and positioning */
    private setupOverlayCanvas() {
        const size = 120;

        this.overlayCanvas.width = size;
        this.overlayCanvas.height = size;
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.right = '20px';
        this.overlayCanvas.style.top = 'calc(7rem + 20px)';
        this.overlayCanvas.style.zIndex = '1002';
        this.overlayCanvas.style.border = '1px solid rgba(255,255,255,0.3)';
        this.overlayCanvas.style.borderRadius = '4px';
        this.overlayCanvas.style.backgroundColor = 'rgba(0,0,0,0.3)';
        this.overlayCanvas.style.cursor = 'grab';
        this.overlayCanvas.style.pointerEvents = 'auto';

        document.body.appendChild(this.overlayCanvas);
    }

    /** Creates a text sprite for directional labels */
    private createSprite(text: string, color: number = 0xffffff): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        const size = 128;
        
        canvas.width = size;
        canvas.height = size;
        
        // Draw semi-transparent background
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, size, size);
        
        // Draw directional text
        context.font = 'bold 24px Arial';
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, size / 2, size / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 0.9
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.8, 0.8, 1);
        sprite.userData = { isSprite: true, direction: text };
        
        return sprite;
    }

    /** Creates directional sprites for all cube faces */
    private createSprites() {
        const spriteConfigs = [
            { text: 'FRONT', position: new THREE.Vector3(0, 0, 0.51), color: 0xffffff },
            { text: 'BACK', position: new THREE.Vector3(0, 0, -0.51), color: 0xffffff },
            { text: 'LEFT', position: new THREE.Vector3(-0.51, 0, 0), color: 0xffffff },
            { text: 'RIGHT', position: new THREE.Vector3(0.51, 0, 0), color: 0xffffff },
            { text: 'TOP', position: new THREE.Vector3(0, 0.51, 0), color: 0xffffff },
            { text: 'BOTTOM', position: new THREE.Vector3(0, -0.51, 0), color: 0xffffff }
        ];

        spriteConfigs.forEach(config => {
            const sprite = this.createSprite(config.text, config.color);
            sprite.position.copy(config.position);
            this.overlayScene.add(sprite);
            this.sprites.push(sprite);
        });
    }

    /** Sets up mouse event listeners for interaction */
    private setupListeners() {
        // Track cursor changes based on mouse position
        this.mouseHelper.addInteractionFunction('mouseMove', (event: any) => {
            const mouseEvent = event.originalEvent || event;
            const isOverCanvas = this.isMouseOverCanvas(mouseEvent);

            if (isOverCanvas && !this.isDragging) {
                this.overlayCanvas.style.cursor = 'grab';
            } else if (this.isDragging && this.dragStartedOnCanvas) {
                this.overlayCanvas.style.cursor = 'grabbing';
            } else {
                this.overlayCanvas.style.cursor = 'default';
            }
        });

        // Mouse down to start potential drag
        this.mouseHelper.addInteractionFunction('mouseDown', (event: any) => {
            const mouseEvent = event.originalEvent || event;
            if (this.isMouseOverCanvas(mouseEvent) && event.dragType === 'left') {
                this.dragStartedOnCanvas = true;
                this.overlayCanvas.style.cursor = 'grabbing';
            }
        }, 'left');

        // Drag start (when movement exceeds threshold)
        this.mouseHelper.addInteractionFunction('dragStart', (event: any) => {
            if (this.dragStartedOnCanvas && event.dragType === 'left') {
                this.isDragging = true;
                this.overlayCanvas.style.cursor = 'grabbing';
            }
        }, 'left');

        // Actual drag movement - delegates to CameraHelper
        this.mouseHelper.addInteractionFunction('drag', (event: any) => {
            if (this.dragStartedOnCanvas && event.dragType === 'left' && this.isDragging) {
                this.handleCameraDrag(event);
            }
        }, 'left');

        // Drag end
        this.mouseHelper.addInteractionFunction('dragEnd', (event: any) => {
            if (event.dragType === 'left') {
                const mouseEvent = event.originalEvent || event;
                this.dragStartedOnCanvas = false;
                this.isDragging = false;
                if (this.isMouseOverCanvas(mouseEvent)) {
                    this.overlayCanvas.style.cursor = 'grab';
                } else {
                    this.overlayCanvas.style.cursor = 'default';
                }
            }
        }, 'left');

        // Mouse up (for non-drag clicks)
        this.mouseHelper.addInteractionFunction('mouseUp', (event: any) => {
            if (event.dragType === 'left') {
                const mouseEvent = event.originalEvent || event;
                this.dragStartedOnCanvas = false;
                this.isDragging = false;
                if (this.isMouseOverCanvas(mouseEvent)) {
                    this.overlayCanvas.style.cursor = 'grab';
                }
            }
        }, 'left');

        // Click (for non-drag face/sprite selection)
        this.mouseHelper.addInteractionFunction('click', (event: any) => {
            const mouseEvent = event.originalEvent || event;
            if (this.isMouseOverCanvas(mouseEvent) &&
                event.dragType === 'left' &&
                !this.mouseHelper.getIsDragging()) {
                this.handleCanvasClick(mouseEvent);
            }
        }, 'left');

        // Direct canvas event listeners as fallback
        this.overlayCanvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.dragStartedOnCanvas = true;
                this.overlayCanvas.style.cursor = 'grabbing';
            }
        });

        this.overlayCanvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.dragStartedOnCanvas = false;
                this.isDragging = false;
                this.overlayCanvas.style.cursor = 'grab';
            }
        });
    }

    /** Checks if mouse is currently over the overlay canvas */
    private isMouseOverCanvas(event: MouseEvent): boolean {
        const rect = this.overlayCanvas.getBoundingClientRect();
        return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
        );
    }

    /** Handles camera rotation during drag operations */
    private handleCameraDrag(event: any): void {
        const deltaX = event.deltaX || 0;
        const deltaY = event.deltaY || 0;

        // Delegate rotation to CameraHelper (handles both camera types)
        this.cameraHelperRef.rotate(deltaX, deltaY);
        
        // Sync overlay camera to match the updated orientation
        this.syncOverlayCamera();
    }

    /** Handles click events on the overlay canvas */
    private handleCanvasClick(event: MouseEvent): void {
        const rect = this.overlayCanvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        // Raycasting to detect clicks on sprites or cube faces
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.overlayCamera);

        // Check for sprite clicks first (directional labels)
        const spriteIntersects = raycaster.intersectObjects(this.sprites);
        if (spriteIntersects.length > 0) {
            const sprite = spriteIntersects[0].object as THREE.Sprite;
            const direction = sprite.userData.direction;
            this.handleSpriteClick(direction);
            return;
        }

        // Check for cube face clicks
        const cubeIntersects = raycaster.intersectObject(this.cubeMesh);
        if (cubeIntersects.length > 0) {
            const face = cubeIntersects[0].face;
            if (face) {
                const normal = face.normal.clone();
                normal.transformDirection(this.cubeMesh.matrixWorld);
                this.setCameraToOrientation(normal);
            }
        }
    }

    /** Handles directional sprite clicks for quick view switching */
    private handleSpriteClick(direction: string) {
        stateManager.Debug && console.log(`Sprite clicked: ${direction}`);

        // Use CameraHelper's built-in view methods for orthographic views
        switch (direction) {
            case 'FRONT':
                this.cameraHelperRef.frontView();
                break;
            case 'BACK':
                this.cameraHelperRef.backView();
                break;
            case 'LEFT':
                this.cameraHelperRef.leftView();
                break;
            case 'RIGHT':
                this.cameraHelperRef.rightView();
                break;
            case 'TOP':
                this.cameraHelperRef.topView();
                break;
            case 'BOTTOM':
                this.cameraHelperRef.bottomView();
                break;
        }

        this.syncOverlayCamera();
    }

    /** Sets camera orientation based on face normal for arbitrary rotations */
    private setCameraToOrientation(direction: THREE.Vector3): void {
        // Convert direction to spherical coordinates
        const spherical = new THREE.Spherical().setFromVector3(direction);
        
        // Use CameraHelper to set the orientation angles
        this.cameraHelperRef.setAngles(spherical.theta, spherical.phi);
        this.syncOverlayCamera();
    }

    /** Syncs overlay camera with main camera orientation */
    private syncOverlayCamera(): void {
        // Get current orientation from CameraHelper
        const angles = this.cameraHelperRef.getAngles();
        
        // Convert to spherical coordinates for overlay camera
        const spherical = new THREE.Spherical();
        spherical.radius = 3; // Fixed distance for overlay visualization
        spherical.phi = angles.polar; // Vertical angle
        spherical.theta = angles.azimuth; // Horizontal angle
        
        // Update overlay camera position to match main camera orientation
        this.overlayCamera.position.setFromSpherical(spherical);
        this.overlayCamera.lookAt(0, 0, 0);
    }

    /** Called when camera mode changes to update overlay display */
    public onCameraModeChanged(): void {
        stateManager.Debug && console.log('Camera mode changed, syncing overlay camera...');
        this.syncOverlayCamera();
    }

    /** Gets the overlay canvas element */
    getCanvas(): HTMLCanvasElement {
        return this.overlayCanvas;
    }

    /** Cleans up resources and removes from DOM */
    dispose() {
        this.overlayCanvas.remove();

        // Dispose Three.js resources
        if (this.cubeMesh.geometry) this.cubeMesh.geometry.dispose();
        if ((this.cubeMesh.material as THREE.Material).dispose) {
            (this.cubeMesh.material as THREE.Material).dispose();
        }
        
        if (this.edges) {
            (this.edges.material as THREE.Material).dispose();
            (this.edges.geometry as THREE.BufferGeometry).dispose();
        }
        
        // Dispose sprite materials and textures
        this.sprites.forEach(sprite => {
            if (sprite.material instanceof THREE.SpriteMaterial) {
                if (sprite.material.map) sprite.material.map.dispose();
                sprite.material.dispose();
            }
        });

        this.overlayRenderer.dispose();
    }

    /** Sets up Three.js rendering components for the overlay */
    private setupOverlayThreeJS() {
        // Renderer for overlay with transparency
        this.overlayRenderer = new THREE.WebGLRenderer({
            canvas: this.overlayCanvas,
            alpha: true,
            antialias: true
        });
        this.overlayRenderer.setSize(this.overlayCanvas.width, this.overlayCanvas.height);
        this.overlayRenderer.setClearColor(0x000000, 0);

        // Scene for cube visualization
        this.overlayScene = new THREE.Scene();

        // Camera that orbits around the cube
        this.overlayCamera = new THREE.PerspectiveCamera(
            50,
            this.overlayCanvas.width / this.overlayCanvas.height,
            0.1,
            100
        );

        // Initial camera position - will be synced with main camera
        this.overlayCamera.position.set(0, 0, 3);
        this.overlayCamera.lookAt(0, 0, 0);

        // Create semi-transparent cube
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({
            color: 0x666666,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });

        this.cubeMesh = new THREE.Mesh(geometry, material);
        this.overlayScene.add(this.cubeMesh);

        // Create wireframe edges for better visibility
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            linewidth: 2
        });
        this.edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        this.overlayScene.add(this.edges);

        // Add ambient lighting for better visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.overlayScene.add(ambientLight);
    }

    /** Animation function called each frame to update and render the overlay */
    public animateFunction(t: number) {
        // Always sync overlay camera with main camera orientation
        this.syncOverlayCamera();

        // Sprites automatically face the camera due to THREE.Sprite behavior

        // Render the overlay scene
        this.overlayRenderer.render(this.overlayScene, this.overlayCamera);
    }
}