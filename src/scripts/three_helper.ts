import * as THREE from "three"
import { stateManager } from "../scripts/state_manager";
import CameraHelper from "./utils/camera/camera_helper";

export default class ThreeHelper {
    private canvas: HTMLCanvasElement;
    private renderer: THREE.WebGLRenderer;
    private cameraHelperRef: CameraHelper;
    private scene: THREE.Scene;
    private animation!: number;
    private animateFunctions: Array<(t: number) => void>;

    // Lighting components
    private directionalLight!: THREE.DirectionalLight;
    private hemisphereLight!: THREE.HemisphereLight;

    constructor(canvas: HTMLCanvasElement, cameraHelper: CameraHelper, animateFunctions: Array<(t: number) => void> = []) {
        this.animateFunctions = animateFunctions;
        this.canvas = canvas;
        
        // Initialize WebGL renderer with performance and quality settings
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false, // Disable transparency for better performance
        });
        
        // Configure enhanced shadow and rendering settings
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit for performance
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // Create scene with sky background and fog for depth perception
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

        this.cameraHelperRef = cameraHelper;

        // Set up lighting and environment
        this.setupLighting();
        this.setupEnvironment();

        // Set up event listeners and initial rendering
        canvas.addEventListener('resize', this.handleResize.bind(this));
        this.handleResize(null);
        this.animate(0);

        // Enable detailed shader error logging in debug mode
        if (stateManager.Debug) {
            this.renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
                const vertexError = gl.getShaderInfoLog(vertexShader);
                const fragmentError = gl.getShaderInfoLog(fragmentShader);
                const programError = gl.getProgramInfoLog(program);

                stateManager.Debug && console.groupCollapsed("Detailed Shader Compilation Errors");
                if (vertexError) stateManager.Debug && console.error("Vertex Shader Error:", vertexError);
                if (fragmentError) stateManager.Debug && console.error("Fragment Shader Error:", fragmentError);
                if (programError) stateManager.Debug && console.error("Program Linking Error:", programError);
                stateManager.Debug && console.groupEnd();
            };
        }
    }

    /** Get the WebGL renderer instance */
    public getRenderer(){
        return this.renderer;
    }

    private setupLighting() {
        // Main directional light (sun simulation)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.directionalLight.position.set(50, 100, 50);
        this.directionalLight.castShadow = true;
        
        // Configure high-quality shadow settings
        this.directionalLight.shadow.mapSize.width = 4096; // High resolution for crisp shadows
        this.directionalLight.shadow.mapSize.height = 4096;
        this.directionalLight.shadow.camera.near = 1;
        this.directionalLight.shadow.camera.far = 500;
        
        // Set shadow camera bounds to cover expected hull size
        this.directionalLight.shadow.camera.left = -150;
        this.directionalLight.shadow.camera.right = 150;
        this.directionalLight.shadow.camera.top = 150;
        this.directionalLight.shadow.camera.bottom = -150;
        
        // Fine-tune shadow quality
        this.directionalLight.shadow.radius = 1; // Soft shadow edges
        this.directionalLight.shadow.bias = -0.0001; // Reduce shadow acne
        this.directionalLight.shadow.normalBias = 0.02; // Improve quality on curved surfaces

        // Hemisphere light for natural outdoor ambient lighting
        this.hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.4);
        
        // Fill light to soften shadows and reduce contrast
        const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
        fillLight.position.set(-30, 50, -30);

        // Add all lights to the scene
        this.scene.add(this.directionalLight);
        this.scene.add(this.hemisphereLight);
        this.scene.add(fillLight);
    }

    /** Adjust shadow camera to fit specific hull dimensions with padding */
    public adjustShadowCameraForHull(hullMesh: THREE.Object3D) {
        const bbox = new THREE.Box3().setFromObject(hullMesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const padding = maxDim * 0.5; // 50% padding around hull
        
        // Update shadow camera bounds to encompass entire hull
        this.directionalLight.shadow.camera.left = -maxDim - padding;
        this.directionalLight.shadow.camera.right = maxDim + padding;
        this.directionalLight.shadow.camera.top = maxDim + padding;
        this.directionalLight.shadow.camera.bottom = -maxDim - padding;
        this.directionalLight.shadow.camera.near = 1;
        this.directionalLight.shadow.camera.far = maxDim * 3;
        
        // Recalculate projection matrix with new bounds
        this.directionalLight.shadow.camera.updateProjectionMatrix();
    }

    private setupEnvironment() {
        // Create subtle ground plane for shadow reception
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x7ec850,
            transparent: true,
            opacity: 0.1 // Very subtle visibility
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -10;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add axes helper for orientation in debug mode
        if (stateManager.Debug) {
            const axesHelper = new THREE.AxesHelper(20);
            this.scene.add(axesHelper);
        }
    }

    /** Add function to animation loop */
    public addAnimateFunction(func: (time: number) => void) {
        this.animateFunctions.push(func);
    }

    /** Handle canvas resize events */
    public handleResize(_: Event | null) {
        if (!this.canvas || !this.cameraHelperRef || !this.renderer) return;
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.renderer.setSize(width, height, false);
        this.cameraHelperRef.handleResize(width, height);
    }

    /** Main animation loop */
    public animate(_t: number) {
        this.animation = requestAnimationFrame(this.animate.bind(this));
        
        // Execute all registered animation functions
        this.animateFunctions.forEach(func => func(_t));
        
        // Render the scene with current camera
        this.renderer.render(this.scene, this.cameraHelperRef.getCamera());
    }

    /** Add objects to scene with automatic shadow configuration */
    public addToScene(...objects: THREE.Object3D[]) {
        for (const object of objects) {
            stateManager.Debug && console.log("Adding to scene:", object.name, "Already in scene?", this.scene.children.includes(object));

            // Skip if object is already in scene
            if (this.scene.children.includes(object)) {
                stateManager.Debug && console.log("Skipping - already in scene");
                continue;
            }

            // Configure object and its children for shadow rendering
            this.enableShadows(object);

            this.scene.add(object);
            stateManager.Debug && console.log("Added successfully. Scene children count:", this.scene.children.length);
        }
    }

    /** Recursively enable shadows for object and all children */
    private enableShadows(object: THREE.Object3D) {
        object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // Optimize materials for shadow rendering
                if (child.material instanceof THREE.MeshStandardMaterial) {
                    child.material.roughness = 0.8;
                    child.material.metalness = 0.2;
                }
            }
        });
    }

    /** Remove object from scene */
    public removeFromScene(object: THREE.Object3D) {
        this.scene.remove(object);
    }

    /** Get the canvas element */
    public getCanvas(){
        return this.canvas;
    }

    /** Get the THREE.js scene */
    public getScene() {
        return this.scene;
    }

    /** Update lighting positions relative to camera */
    public updateLighting() {
        // Update light positions based on camera for consistent lighting
        const camera = this.cameraHelperRef.getCamera();
        if (camera) {
            // Keep directional light relative to camera but fixed in world Y
            const lightPos = camera.position.clone();
            lightPos.y = 100; // Keep light high above scene
            lightPos.x += 50;
            lightPos.z += 50;
            this.directionalLight.position.copy(lightPos);
            this.directionalLight.target.position.set(0, 0, 0);
            this.directionalLight.target.updateMatrixWorld();
        }
    }

    /** Clean up resources and stop animation loop */
    public dispose(){
        cancelAnimationFrame(this.animation);
        this.renderer.dispose();
        this.cameraHelperRef.dispose();
    }
}