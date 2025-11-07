import * as THREE from "three"
import { Water } from 'three-stdlib';
import waterNormals from "../assets/water/Water_001_NORM.jpg?url"

export default class WaterBody {
    private geometry: THREE.PlaneGeometry;
    private position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    private size: THREE.Vector3 = new THREE.Vector3(1000, 0.1, 1000);
    private color: number = 0x1e90ff;
    private water: Water;

    constructor() {        
        this.geometry = new THREE.PlaneGeometry(this.size.x, this.size.z, 1024, 1024);
        this.geometry.rotateX(-Math.PI / 2);
        
        // Get sun direction from light if provided, otherwise use default
        const sunDirection = new THREE.Vector3(0, 0, 0).normalize();

        this.water = new Water(this.geometry, {
            textureWidth: 1024, // Higher resolution for better quality
            textureHeight: 1024,
            waterNormals: new THREE.TextureLoader().load(waterNormals, (texture) => {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: sunDirection,
            eye: new THREE.Vector3(0,0, 1),
            sunColor: 0xffffff,
            waterColor: this.color,
            distortionScale: 0.5,
            time: 0,
            fog: true,
            // Additional parameters for better visuals
            alpha: 0.8,
            // clipBias: 10
            // size: 10
        });

        // Position the water
        this.water.position.y = this.position.y;
        
        // Enable receiving shadows
        this.water.receiveShadow = true;
    }

    public updateSize(size: THREE.Vector3) {
        this.size = size;
        
        // Dispose old geometry
        this.geometry.dispose();
        
        // Create new plane geometry with more segments for better wave interaction
        this.geometry = new THREE.PlaneGeometry(this.size.x, this.size.z, 1024, 1024);
        this.geometry.rotateX(-Math.PI / 2);
        
        // Update water geometry
        this.water.geometry = this.geometry;
    }

    public animateFunction(t: number) {
        const time = t / 1000;
        
        // Animate water
        this.water.material.uniforms['time'].value = time;
    }

    // Dispose method for cleanup
    public dispose() {
        this.geometry.dispose();
        this.water.material.dispose();
        if (this.water.material.uniforms.waterNormals) {
            this.water.material.uniforms.waterNormals.value.dispose();
        }
    }

    public getObject(){
        return this.water;
    }
}