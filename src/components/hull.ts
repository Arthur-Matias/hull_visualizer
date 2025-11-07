import * as Types from "../types";
import * as THREE from 'three';
import {
    sortPointsInCircle,
    triangulatePolygon
} from "../scripts/utils/geometry/helpers"
import { stateManager } from "../scripts/state_manager";
import Physics from "../scripts/physics/physics";
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { generateStructuredHullGeometry } from "../scripts/utils/geometry/generators/hull";

/**
 * Main Hull class that manages 3D hull geometry generation, visualization, and physics
 * Extends Physics to incorporate weight management and hydrostatic calculations
 */
class Hull extends Physics {
    private quoteTable: Types.QuoteTable;
    hullGeometry!: THREE.BufferGeometry;
    private hullContainer: THREE.Group | null = null;
    private hullMesh!: THREE.Mesh;
    private bowMesh!: THREE.Mesh;
    private deckMesh!: THREE.Mesh;
    private transomMesh!: THREE.Mesh;

    private onMeshGenerated: ((mesh: THREE.Object3D) => void)[] = [];
    private waterlinesGroup!: THREE.Group;
    private stationsGroup!: THREE.Group;

    private lod: THREE.LOD = new THREE.LOD();

    constructor(quoteTable: Types.QuoteTable, onMeshGenerated: ((mesh: THREE.Object3D) => void)[]) {
        super();
        this.quoteTable = quoteTable;
        this.onMeshGenerated = onMeshGenerated.map(func => func.bind(this));
        this.onMeshGenerated.push(this.centerHull.bind(this));
        this.waterlinesGroup = new THREE.Group();
        this.waterlinesGroup.name = 'waterlines';
        this.stationsGroup = new THREE.Group();
        this.stationsGroup.name = 'stations';
        stateManager.Debug && console.log("Quote table received:", quoteTable);
        this.generateGeometry();
        stateManager.addObserver(this.updateVisibility.bind(this));
    }

    /** Centers the hull geometry at the world origin for consistent positioning */
    public centerHull(): void {
        const hullMesh = this.getFullHullMesh();
        const bbox = new THREE.Box3().setFromObject(hullMesh);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        hullMesh.position.sub(center);
    }

    /**
     * Sets the Level of Detail for hull geometry generation
     * @param level - 1: Optimized, 2: Medium, 3: High, 4: Very High
     */
    public setLODLevel(level: number): void {
        if (level < 1 || level > 4) {
            stateManager.Debug && console.warn('LOD level must be between 1 and 4');
            return;
        }
        const lodLevel: Types.LODConfig = {
            enableSmoothing: true,
            stationMultiplier: level,
            waterlineMultiplier: level
        }
        stateManager.HullDetailLevel = lodLevel;
        stateManager.Debug && console.log(`Setting LOD level to: ${level}`);
        this.regenerateGeometry();
    }

    /**
     * Gets current LOD configuration
     */
    public getLODLevel(): Types.LODConfig {
        return stateManager.HullDetailLevel;
    }

    /**
     * Gets statistics about current geometry including vertex and face counts
     */
    public getGeometryStats(): { vertices: number; faces: number; lod: Types.LODConfig } {
        if (!this.hullMesh) {
            return { vertices: 0, faces: 0, lod: stateManager.HullDetailLevel };
        }

        const geometry = this.hullMesh.geometry;
        const vertices = geometry.attributes.position.count;
        const faces = geometry.index ? geometry.index.count / 3 : 0;

        return {
            vertices,
            faces,
            lod: stateManager.HullDetailLevel
        };
    }

    /**
     * Regenerates geometry with current LOD settings and cleans up old resources
     */
    private regenerateGeometry(): void {
        stateManager.Debug && console.log(`Regenerating geometry with LOD level: ${stateManager.HullDetailLevel}`);

        // Clean up existing geometry resources
        if (this.hullContainer) {
            this.hullContainer.remove(this.lod);
            this.lod.levels.forEach(level => {
                (level.object as THREE.Mesh).geometry.dispose();
                const material = (level.object as THREE.Mesh).material as THREE.Material;
                if (Array.isArray(material)) {
                    material.forEach(mat => mat.dispose());
                } else {
                    material.dispose();
                }
            });
            this.lod = new THREE.LOD();
        }

        // Clear existing visualization overlays
        this.waterlinesGroup.clear();
        this.stationsGroup.clear();

        // Regenerate with new LOD settings
        this.generateGeometry();
    }

    /** Generates hull geometry using the structured generation pipeline */
    private generateGeometry(): Types.HullGeometry {
        let data: Types.HullGeometry = generateStructuredHullGeometry(this.quoteTable, stateManager.HullDetailLevel);
        this.handleGeometryResult(data);
        return data;
    }

    /** Processes geometry generation results and creates 3D visualization */
    private handleGeometryResult(data: Types.HullGeometry) {
        const { vertices, indices, stats } = data;

        if (stats.faceCount === 0) {
            this.createGeometryError("No faces were generated since face count is 0");
            return;
        }

        stateManager.Debug && console.log(`Generated geometry: ${stats.vertexCount} vertices, ${stats.faceCount} faces`);

        // --- Create full hull geometry ---
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        if (data.colors) {
            geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
        }
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();

        // --- Create base mesh with improved material ---
        const material = new THREE.MeshStandardMaterial({
            color: 0xe0e0e0, // Lighter gray for better contrast
            wireframe: stateManager.WireframeActive,
            side: THREE.DoubleSide,
            roughness: 0.8,    // More matte finish
            metalness: 0.05,   // Less metallic
            flatShading: false
        });
        this.hullMesh = new THREE.Mesh(geometry, material);
        this.hullMesh.castShadow = true;
        this.hullMesh.receiveShadow = true;
        this.hullMesh.name = 'hull';

        // --- Create LOD levels for rendering optimization ---
        this.createLODLevels(geometry);

        // --- Create other hull components ---
        this.createWaterlineOverlays(data);
        this.createStationOverlays(data);
        this.createDeck(data);
        this.createTransom(data);
        this.createBow(data);

        // --- Update visibility & notify ---
        this.updateVisibility();
        this.notifyMeshGenerated();

        return this.getFullHullMesh();
    }

    /**
     * Creates LOD levels for rendering optimization (different from generation LOD)
     * Uses geometry simplification for distant viewing
     */
    private createLODLevels(baseGeometry: THREE.BufferGeometry): void {
        // Level 0: Full detail (0 distance)
        this.lod.addLevel(this.hullMesh, 0);

        // Only create simplified LODs for high-detail geometries
        if (stateManager.HullDetailLevel.waterlineMultiplier >= 3) {
            const modifier = new SimplifyModifier();
            const vertexCount = baseGeometry.attributes.position.count;

            // Level 1: 60% vertices (20 units distance)
            if (vertexCount > 1000) {
                const simplified60 = this.hullMesh.clone();
                simplified60.geometry = modifier.modify(baseGeometry.clone(), Math.floor(vertexCount * 0.6));
                // Ensure cloned mesh has proper shadow settings
                simplified60.castShadow = true;
                simplified60.receiveShadow = true;
                this.lod.addLevel(simplified60, 20);
            }

            // Level 2: 30% vertices (50 units distance)
            if (vertexCount > 500) {
                const simplified30 = this.hullMesh.clone();
                simplified30.geometry = modifier.modify(baseGeometry.clone(), Math.floor(vertexCount * 0.3));
                // Ensure cloned mesh has proper shadow settings
                simplified30.castShadow = true;
                simplified30.receiveShadow = true;
                this.lod.addLevel(simplified30, 50);
            }
        }

        stateManager.Debug && console.log(`Created ${this.lod.levels.length} LOD levels for rendering`);
    }

    /** Updates visibility of all hull components based on state manager settings */
    private updateVisibility() {
        // Hull visibility & wireframe for all LOD levels
        if (this.lod) {
            this.lod.visible = stateManager.ShowHull;
            this.lod.levels.forEach(level => {
                const mat = (level.object as THREE.Mesh).material as THREE.MeshStandardMaterial;
                mat.wireframe = stateManager.WireframeActive;
            });
        }

        // Other hull parts visibility
        if (this.transomMesh) this.transomMesh.visible = stateManager.ShowHull;
        if (this.bowMesh) this.bowMesh.visible = stateManager.ShowHull;
        if (this.deckMesh) this.deckMesh.visible = stateManager.ShowDeck;
        if (this.stationsGroup) this.stationsGroup.visible = stateManager.ShowStations;
        if (this.waterlinesGroup) this.waterlinesGroup.visible = stateManager.ShowWaterlines;
    }

    /** Creates waterline overlay visualization for hull cross-sections */
    private createWaterlineOverlays(data: Types.HullGeometry) {
        if (!data.waterlinePoints) return;

        this.waterlinesGroup.clear();
        const material = new THREE.LineBasicMaterial({
            color: 0x4ecdc4,
            linewidth: 2,
            transparent: true,
            opacity: 0.9
        });

        Object.entries(data.waterlinePoints).forEach(([id, points]) => {
            if (!points || points.length < 2) return;

            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(points.length * 3);
            points.forEach((p, i) => {
                positions[i * 3] = p.x;
                positions[i * 3 + 1] = p.y;
                positions[i * 3 + 2] = p.z;
            });
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const line = new THREE.LineLoop(geometry, material);
            line.name = `waterline-${id}`;
            this.waterlinesGroup.add(line);
        });

        stateManager.Debug && console.log(`Created ${this.waterlinesGroup.children.length} waterline overlays`);
    }

    /** Creates station overlay visualization for longitudinal cross-sections */
    private createStationOverlays(data: Types.HullGeometry) {
        if (!data.stationPoints) return;
        this.stationsGroup.clear();

        const material = new THREE.MeshStandardMaterial({
            color: 0xff6b6b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7,
            roughness: 0.6,
            metalness: 0.1
        });

        Object.entries(data.stationPoints).forEach(([id, points]) => {
            if (!points || points.length < 3) return;
            const sorted = sortPointsInCircle(points);

            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(sorted.length * 3);
            sorted.forEach((p, i) => {
                positions[i * 3] = p.x;
                positions[i * 3 + 1] = p.y;
                positions[i * 3 + 2] = p.z;
            });
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const indices = triangulatePolygon(sorted);
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
            geometry.computeVertexNormals();

            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = `station-${id}`;
            this.stationsGroup.add(mesh);
        });

        stateManager.Debug && console.log(`Created ${this.stationsGroup.children.length} station overlays`);
    }

    /** Creates deck surface visualization */
    private createDeck(data: Types.HullGeometry) {
        if (!data.deckPoints || data.deckPoints.length < 3) return;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(data.deckPoints.length * 3);
        data.deckPoints.forEach((p, i) => {
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
        });
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        if (data.deckIndices) {
            geometry.setIndex(new THREE.BufferAttribute(data.deckIndices, 1));
        } else {
            const indices = [];
            for (let i = 1; i < data.deckPoints.length - 1; i++) indices.push(0, i, i + 1);
            geometry.setIndex(indices);
        }
        geometry.computeVertexNormals();

        this.deckMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            color: 0x45b7d1,
            wireframe: stateManager.WireframeActive,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            roughness: 0.7,
            metalness: 0.05
        }));
        this.deckMesh.castShadow = true;
        this.deckMesh.receiveShadow = true;
        this.deckMesh.name = 'deck';
    }

    /** Gets all separated hull components for selective rendering and interaction */
    getSeparatedHullMesh() {
        return {
            hullMesh: this.hullMesh,
            bowMesh: this.bowMesh,
            transomMesh: this.transomMesh,
            deckMesh: this.deckMesh,
            stationsMesh: this.stationsGroup,
            waterlines: this.waterlinesGroup
        }
    }

    /** Creates transom (stern) surface visualization */
    private createTransom(data: Types.HullGeometry) {
        if (!data.transomPoints || data.transomPoints.length < 3) return;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(data.transomPoints.length * 3);
        data.transomPoints.forEach((p, i) => {
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z
        });
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        if (data.transomIndices) {
            geometry.setIndex(new THREE.BufferAttribute(data.transomIndices, 1));
        } else {
            const indices = [];
            for (let i = 1; i < data.transomPoints.length - 1; i++) indices.push(0, i, i + 1);
            geometry.setIndex(indices);
        }
        geometry.computeVertexNormals();

        this.transomMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            wireframe: stateManager.WireframeActive,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            roughness: 0.6,
            metalness: 0.1
        }));
        this.transomMesh.castShadow = true;
        this.transomMesh.receiveShadow = true;
        this.transomMesh.name = 'transom';
    }

    /** Creates bow (front) surface visualization */
    private createBow(data: Types.HullGeometry) {
        if (!data.bowPoints || data.bowPoints.length < 3) return;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(data.bowPoints.length * 3);
        data.bowPoints.forEach((p, i) => {
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z
        });
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        if (data.bowIndices) {
            geometry.setIndex(new THREE.BufferAttribute(data.bowIndices, 1));
        } else {
            const indices = [];
            for (let i = 1; i < data.bowPoints.length - 1; i++) indices.push(0, i, i + 1);
            geometry.setIndex(indices);
        }
        geometry.computeVertexNormals();

        this.bowMesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            color: 0xffcc00,
            wireframe: stateManager.WireframeActive,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
            roughness: 0.5,
            metalness: 0.1
        }));
        this.bowMesh.castShadow = true;
        this.bowMesh.receiveShadow = true;
        this.bowMesh.name = 'bow';
    }

    /** Notifies all registered callbacks that mesh generation is complete */
    private notifyMeshGenerated() {
        this.onMeshGenerated.forEach(func => func(this.getFullHullMesh()));
    }

    /** Gets the complete hull assembly as a THREE.Group containing all components */
    public getFullHullMesh(): THREE.Group {
        if (!this.hullContainer) {
            this.hullContainer = new THREE.Group();
            this.hullContainer.name = 'hullContainer';
            this.hullContainer.add(this.lod);
            this.hullContainer.add(this.waterlinesGroup);
            this.hullContainer.add(this.stationsGroup);
            if (this.deckMesh) this.hullContainer.add(this.deckMesh);
            if (this.transomMesh) this.hullContainer.add(this.transomMesh);
            if (this.bowMesh) this.hullContainer.add(this.bowMesh);
        }
        return this.hullContainer;
    }

    /** Creates error geometry as fallback when generation fails */
    private createGeometryError(msg: string) {
        stateManager.Debug && console.error(msg);
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.hullMesh = new THREE.Mesh(geometry, material);
    }
}

export default Hull;