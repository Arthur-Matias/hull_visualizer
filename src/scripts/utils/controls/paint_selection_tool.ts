// paint_selection_tool.ts - Fixed version
import * as THREE from 'three';
import Hull from '../../../components/hull';
import { stateManager } from '../../../scripts/state_manager';

interface FaceData {
    worldCenter: THREE.Vector3;
    mesh: THREE.Mesh;
    faceIndex: number;
    meshType: string;
    localCenter: THREE.Vector3;
}

/**
 * Tool for interactive face selection and painting on hull geometry
 * Supports brush-based selection with continuous painting and remove mode
 */
export class PaintSelectionTool {
    private scene: THREE.Scene;
    private camera: THREE.Camera;
    private hull: Hull | null = null;

    private isPainting = false;
    private isRemoving = false;
    public selectedFaces = new Set<number>();
    private brushSize = 0.5;

    private faceData = new Map<number, FaceData>();
    private highlightMaterial: THREE.Material;
    private highlightMesh: THREE.LineSegments | null = null;
    private brushHelper: THREE.Mesh | null = null;

    private lastPaintPosition: THREE.Vector3 | null = null;
    private raycaster: THREE.Raycaster;

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.scene = scene;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();

        // Create material for selection highlights (wireframe overlay)
        this.highlightMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        });

        // Clear selection when weight painting mode is deactivated
        stateManager.addObserver((state) => {
            if (!state.AddWeightActive) {
                this.clearSelection();
                this.hideBrushHelper();
                this.lastPaintPosition = null;
            }
        }, ['AddWeightActive']);

        // Update selection display when visibility changes (don't clear selection data)
        stateManager.addObserver((_) => {
            stateManager.Debug && console.log('👁️ Visibility changed, updating selection display');
            this.updateHighlight();
        }, ['ShowHull', 'ShowDeck', 'ShowStations', 'ShowWaterlines']);

        this.createBrushHelper();
    }

    /** Creates geometry for highlighting selected faces */
    private createHighlightGeometry() {
        const geometry = new THREE.BufferGeometry();
        this.highlightMesh = new THREE.LineSegments(geometry, this.highlightMaterial);
        this.highlightMesh.name = 'paint-selection-highlight';
        this.highlightMesh.renderOrder = 999; // Render on top of other geometry
        this.scene.add(this.highlightMesh);
        stateManager.Debug && console.log('✅ Created highlight geometry as LineSegments');
    }

    /** Creates visual brush helper for painting feedback */
    private createBrushHelper() {
        const brushGeometry = new THREE.SphereGeometry(1, 12, 8);
        const brushMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.4,
            wireframe: true
        });
        this.brushHelper = new THREE.Mesh(brushGeometry, brushMaterial);
        this.brushHelper.visible = false;
        this.scene.add(this.brushHelper);
    }

    /** Hides the brush helper visualization */
    hideBrushHelper() {
        if (this.brushHelper) {
            this.brushHelper.visible = false;
        }
    }

    /** Sets the hull reference for face selection */
    setHull(hull: Hull) {
        this.hull = hull;
        // Only create highlight geometry once we have a hull
        if (!this.highlightMesh) {
            this.createHighlightGeometry();
        }
        stateManager.Debug && console.log('✅ Hull set in PaintSelectionTool');
    }

    /** Sets the brush size for selection */
    setBrushSize(size: number) {
        this.brushSize = size;
        if (this.brushHelper) {
            this.brushHelper.scale.setScalar(size);
        }
        stateManager.Debug && console.log(`🖌️ Brush size set to: ${size}`);
    }

    /** Starts the painting interaction */
    startPainting() {
        if (!stateManager.AddWeightActive) return;

        this.isPainting = true;
        // isRemoving is managed separately by setRemoveMode
        this.lastPaintPosition = null;
        stateManager.Debug && console.log(`🎨 Started painting (removing: ${this.isRemoving})`);
    }

    /** Stops the painting interaction */
    stopPainting() {
        this.isPainting = false;
        this.hideBrushHelper();
        this.lastPaintPosition = null;
        stateManager.Debug && console.log('🛑 Stopped painting');
    }

    /** Main painting method - selects faces at mouse position */
    paintAt(mousePosition: THREE.Vector2) {
        if (!this.isPainting || !this.hull || !stateManager.AddWeightActive) return;

        this.raycaster.setFromCamera(mousePosition, this.camera);
        const hullMeshes = this.getVisibleHullMeshesForSelection();

        if (hullMeshes.length === 0) {
            this.hideBrushHelper();
            return;
        }

        const intersects = this.raycaster.intersectObjects(hullMeshes, true);
        intersects.sort((a, b) => a.distance - b.distance);

        if (intersects.length > 0) {
            const intersection = intersects[0];

            // Update brush helper position for visual feedback
            if (this.brushHelper) {
                this.brushHelper.position.copy(intersection.point);
                this.brushHelper.visible = true;
            }

            if (intersection.face && intersection.object instanceof THREE.Mesh) {
                // Interpolate between points for continuous painting
                if (this.lastPaintPosition) {
                    this.paintBetweenPoints(this.lastPaintPosition, intersection.point);
                }

                // Always paint at the current position
                this.selectFacesAroundPoint(intersection.point, intersection.object as THREE.Mesh);

                // Update last position for next interpolation
                this.lastPaintPosition = intersection.point.clone();
            }
        } else {
            this.hideBrushHelper();
            this.lastPaintPosition = null;
        }
    }

    /** Interpolates between two points to create continuous painting strokes */
    private paintBetweenPoints(start: THREE.Vector3, end: THREE.Vector3) {
        const distance = start.distanceTo(end);
        const steps = Math.ceil(distance / (this.brushSize * 0.3));

        if (steps <= 1) return;

        const direction = new THREE.Vector3().subVectors(end, start).normalize();
        const stepSize = distance / steps;

        // Create intermediate points along the stroke path
        for (let i = 1; i < steps; i++) {
            const point = start.clone().add(direction.clone().multiplyScalar(stepSize * i));

            // Find closest mesh at interpolated point
            const meshes = this.getVisibleHullMeshesForSelection();
            const tempRaycaster = new THREE.Raycaster();
            tempRaycaster.set(point, direction);

            const intersects = tempRaycaster.intersectObjects(meshes, true);
            intersects.sort((a, b) => a.distance - b.distance);

            if (intersects.length > 0 && intersects[0].object instanceof THREE.Mesh) {
                this.selectFacesAroundPoint(point, intersects[0].object);
            } else {
                // Fallback: try shooting in opposite direction
                tempRaycaster.set(point, direction.clone().negate());
                const reverseIntersects = tempRaycaster.intersectObjects(meshes, true);
                reverseIntersects.sort((a, b) => a.distance - b.distance);

                if (reverseIntersects.length > 0 && reverseIntersects[0].object instanceof THREE.Mesh) {
                    this.selectFacesAroundPoint(point, reverseIntersects[0].object);
                }
            }
        }
    }

    /** Sets remove mode (true = removing faces, false = adding faces) */
    setRemoveMode(removing: boolean) {
        this.isRemoving = removing;
        stateManager.Debug && console.log(`🎨 Remove mode: ${removing ? 'ON' : 'OFF'}`);
    }

    /** Gets current remove mode state */
    getRemoveMode(): boolean {
        return this.isRemoving;
    }

    /** Updates brush helper position for preview (without painting) */
    updateBrushHelper(position: THREE.Vector3) {
        if (this.brushHelper) {
            this.brushHelper.position.copy(position);
            this.brushHelper.visible = true;
        }
    }

    /** Gets selection information for UI display */
    getSelectionInfo() {
        return {
            faceCount: this.getSelectedFaceCount(),
            breakdown: this.getSelectionBreakdown(),
            totalWeight: this.getSelectedFaceCount() * 10 // Example: 10kg per face
        };
    }

    /** Gets visible hull meshes based on current state manager settings */
    private getVisibleHullMeshesForSelection(): THREE.Object3D[] {
        if (!this.hull) return [];

        const { hullMesh, transomMesh, bowMesh, deckMesh, stationsMesh } = this.hull.getSeparatedHullMesh();
        const meshes: THREE.Object3D[] = [];

        // Helper to check if mesh is visible in scene hierarchy
        const isMeshVisible = (mesh: THREE.Object3D): boolean => {
            if (!mesh) return false;
            let current = mesh;
            while (current) {
                if (!current.visible) return false;
                current = current.parent as THREE.Object3D;
                if (!current) break;
            }
            return true;
        };

        // Include meshes only if enabled in state manager AND visible in scene
        if (stateManager.ShowHull) {
            if (isMeshVisible(hullMesh)) meshes.push(hullMesh);
            if (transomMesh && isMeshVisible(transomMesh)) meshes.push(transomMesh);
            if (bowMesh && isMeshVisible(bowMesh)) meshes.push(bowMesh);
        }

        if (stateManager.ShowDeck && deckMesh && isMeshVisible(deckMesh)) {
            meshes.push(deckMesh);
        }

        if (stateManager.ShowStations && stationsMesh && isMeshVisible(stationsMesh)) {
            // Add all visible station meshes from the group
            stationsMesh.traverse((child) => {
                if (child instanceof THREE.Mesh && isMeshVisible(child)) {
                    meshes.push(child);
                }
            });
        }

        return meshes;
    }

    /** Determines the type of mesh for categorization */
    private getMeshType(mesh: THREE.Mesh): string {
        if (!this.hull) return 'unknown';

        const { hullMesh, transomMesh, bowMesh, deckMesh, stationsMesh } = this.hull.getSeparatedHullMesh();

        if (mesh === hullMesh) return 'hull';
        if (mesh === transomMesh) return 'transom';
        if (mesh === bowMesh) return 'bow';
        if (mesh === deckMesh) return 'deck';

        // Check if it's a station mesh
        let isStation = false;
        stationsMesh.traverse((child) => {
            if (child === mesh) isStation = true;
        });
        if (isStation) return 'station';

        return 'unknown';
    }

    /** Selects faces within brush radius around a world point */
    private selectFacesAroundPoint(worldPoint: THREE.Vector3, hitMesh: THREE.Mesh) {
        if (!this.hull) return;

        const meshType = this.getMeshType(hitMesh);
        const geometry = hitMesh.geometry;

        if (!geometry.index) {
            stateManager.Debug && console.warn(`Mesh ${hitMesh.name} has no index geometry`);
            return;
        }

        const positions = geometry.attributes.position.array;
        const index = geometry.index.array;

        // Convert world point to mesh's local space for accurate distance calculation
        const localPoint = hitMesh.worldToLocal(worldPoint.clone());
        let facesSelected = 0;

        // Process each face in the mesh
        for (let i = 0; i < index.length; i += 3) {
            const faceIndex = i / 3;

            // Get face vertices in local space
            const v1 = new THREE.Vector3(
                positions[index[i] * 3],
                positions[index[i] * 3 + 1],
                positions[index[i] * 3 + 2]
            );
            const v2 = new THREE.Vector3(
                positions[index[i + 1] * 3],
                positions[index[i + 1] * 3 + 1],
                positions[index[i + 1] * 3 + 2]
            );
            const v3 = new THREE.Vector3(
                positions[index[i + 2] * 3],
                positions[index[i + 2] * 3 + 1],
                positions[index[i + 2] * 3 + 2]
            );

            // Calculate face center in local space
            const faceCenter = new THREE.Vector3()
                .add(v1)
                .add(v2)
                .add(v3)
                .multiplyScalar(1 / 3);

            // Select face if within brush radius
            if (faceCenter.distanceTo(localPoint) <= this.brushSize) {
                const uniqueFaceId = this.getFaceUniqueId(hitMesh, faceIndex);

                if (!this.isRemoving) {
                    // Add face to selection
                    if (!this.faceData.has(uniqueFaceId)) {
                        const worldCenter = faceCenter.clone().applyMatrix4(hitMesh.matrixWorld);
                        this.faceData.set(uniqueFaceId, {
                            worldCenter,
                            mesh: hitMesh,
                            faceIndex,
                            meshType,
                            localCenter: faceCenter.clone()
                        });
                    }
                    this.selectedFaces.add(uniqueFaceId);
                    facesSelected++;
                } else {
                    // Remove face from selection
                    if (this.selectedFaces.delete(uniqueFaceId)) {
                        this.faceData.delete(uniqueFaceId);
                    }
                }
            }
        }

        if (facesSelected > 0) {
            this.updateHighlight();
        }
    }

    /** Generates unique ID for a face across all meshes */
    private getFaceUniqueId(mesh: THREE.Mesh, faceIndex: number): number {
        return mesh.id * 1000000 + faceIndex;
    }

    /** Updates the visual highlight overlay for selected faces */
    private updateHighlight() {
        if (!this.highlightMesh || !this.hull) return;

        const positions: number[] = [];
        const indices: number[] = [];

        let vertexCount = 0;
        let visibleFaceCount = 0;

        // Process all selected faces
        this.faceData.forEach((faceData, faceId) => {
            if (!this.selectedFaces.has(faceId)) return;

            const { mesh, faceIndex } = faceData;

            // Skip if mesh is not currently visible
            if (!this.isMeshVisible(mesh)) {
                return;
            }

            const geometry = mesh.geometry;
            if (!geometry.index) return;

            const meshPositions = geometry.attributes.position.array;
            const meshIndex = geometry.index.array;

            const startIdx = faceIndex * 3;
            if (startIdx + 2 >= meshIndex.length) return;

            const v1Index = meshIndex[startIdx];
            const v2Index = meshIndex[startIdx + 1];
            const v3Index = meshIndex[startIdx + 2];

            // Get vertices in local space
            const v1 = new THREE.Vector3(
                meshPositions[v1Index * 3],
                meshPositions[v1Index * 3 + 1],
                meshPositions[v1Index * 3 + 2]
            );
            const v2 = new THREE.Vector3(
                meshPositions[v2Index * 3],
                meshPositions[v2Index * 3 + 1],
                meshPositions[v2Index * 3 + 2]
            );
            const v3 = new THREE.Vector3(
                meshPositions[v3Index * 3],
                meshPositions[v3Index * 3 + 1],
                meshPositions[v3Index * 3 + 2]
            );

            // Transform to world space with slight offset to prevent z-fighting
            mesh.localToWorld(v1);
            mesh.localToWorld(v2);
            mesh.localToWorld(v3);

            // Calculate normal for offset direction
            const normal = new THREE.Vector3()
                .crossVectors(
                    new THREE.Vector3().subVectors(v2, v1),
                    new THREE.Vector3().subVectors(v3, v1)
                )
                .normalize();

            const offset = 0.02;
            v1.add(normal.clone().multiplyScalar(offset));
            v2.add(normal.clone().multiplyScalar(offset));
            v3.add(normal.clone().multiplyScalar(offset));

            // Add vertices for wireframe (6 vertices for 3 lines)
            const baseIndex = vertexCount;

            positions.push(
                v1.x, v1.y, v1.z, v2.x, v2.y, v2.z,  // line 1: v1-v2
                v2.x, v2.y, v2.z, v3.x, v3.y, v3.z,  // line 2: v2-v3  
                v3.x, v3.y, v3.z, v1.x, v1.y, v1.z   // line 3: v3-v1
            );

            // Add indices for line segments
            indices.push(
                baseIndex, baseIndex + 1,     // line 1
                baseIndex + 2, baseIndex + 3, // line 2
                baseIndex + 4, baseIndex + 5  // line 3
            );

            vertexCount += 6;
            visibleFaceCount++;
        });

        if (visibleFaceCount === 0) {
            // Clear geometry when no visible faces
            this.highlightMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
            this.highlightMesh.geometry.setIndex([]);
            return;
        }

        // Update highlight geometry with current selection
        const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
        this.highlightMesh.geometry.setAttribute('position', positionAttribute);
        this.highlightMesh.geometry.setIndex(indices);
        this.highlightMesh.geometry.computeBoundingSphere();

        // Force attribute updates
        positionAttribute.needsUpdate = true;
        this.highlightMesh.geometry.attributes.position.needsUpdate = true;
    }

    /** Checks if a mesh is visible in the scene hierarchy */
    private isMeshVisible(mesh: THREE.Object3D): boolean {
        let current = mesh;
        while (current) {
            if (!current.visible) return false;
            current = current.parent as THREE.Object3D;
            if (!current) break;
        }
        return true;
    }

    /** Gets map of face data for external use */
    getFaceData(): Map<number, FaceData> {
        return new Map(this.faceData);
    }

    /** Gets count of currently selected faces */
    getSelectedFaceCount(): number {
        return this.selectedFaces.size;
    }

    /** Gets breakdown of selected faces by mesh type */
    getSelectionBreakdown(): { [key: string]: number } {
        const breakdown: { [key: string]: number } = {
            hull: 0,
            deck: 0,
            station: 0,
            transom: 0,
            bow: 0,
            unknown: 0
        };

        this.faceData.forEach((faceData, faceId) => {
            if (this.selectedFaces.has(faceId)) {
                breakdown[faceData.meshType] = (breakdown[faceData.meshType] || 0) + 1;
            }
        });

        return breakdown;
    }

    /** Clears all selected faces and updates display */
    clearSelection() {
        this.selectedFaces.clear();
        this.faceData.clear();
        this.updateHighlight();
        this.hideBrushHelper();
        this.lastPaintPosition = null;
        stateManager.Debug && console.log('🧹 Cleared selection');
    }

    /** Cleans up resources and removes from scene */
    dispose() {
        if (this.highlightMesh) {
            this.scene.remove(this.highlightMesh);
            this.highlightMesh.geometry.dispose();
            (this.highlightMesh.material as THREE.Material).dispose();
        }
        if (this.brushHelper) {
            this.scene.remove(this.brushHelper);
            this.brushHelper.geometry.dispose();
            (this.brushHelper.material as THREE.Material).dispose();
        }
        this.highlightMaterial.dispose();
    }
}