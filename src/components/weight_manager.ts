// weight_manager.ts - Fixed version with weight visualization
import * as THREE from 'three';
import Hull from './hull';
import ThreeHelper from '../scripts/three_helper';
import MouseHelper from '../scripts/utils/controls/mouse_helper';
import { PaintSelectionTool } from '../scripts/utils/controls/paint_selection_tool';
import { stateManager } from '../scripts/state_manager';
import type { Weight } from '../types';

/**
 * Manages weight painting, application, and visualization on hull geometry
 * Handles interactive weight distribution and visual feedback
 */
export default class WeightManager {
    private threeHelper: ThreeHelper;
    private mouseHelper: MouseHelper;
    private hull: Hull | null = null;
    private paintSelectionTool: PaintSelectionTool;
    
    private weightPerFace: number = 10; // Default weight in kg per selected face
    private isPainting: boolean = false;
    
    // Weight visualization components
    private weightMarkers: THREE.Group;
    private weightMarkerMaterial: THREE.Material;
    
    constructor(
        threeHelper: ThreeHelper,
        mouseHelper: MouseHelper,
        hull: Hull | undefined,
        paintSelectionTool: PaintSelectionTool
    ) {
        this.threeHelper = threeHelper;
        this.mouseHelper = mouseHelper;
        this.hull = hull || null;
        this.paintSelectionTool = paintSelectionTool;
        
        // Create visualization group for weight markers
        this.weightMarkers = new THREE.Group();
        this.weightMarkers.name = 'weight-markers';
        this.threeHelper.getScene().add(this.weightMarkers);
        
        // Create material for weight visualization markers
        this.weightMarkerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000, // Red color for weight indicators
            transparent: true,
            opacity: 0.7
        });
        
        this.setupMouseEvents();
    }

    /** Sets up mouse event handlers for weight painting interaction */
    private setupMouseEvents() {
        // Handle mouse down - start painting immediately
        this.mouseHelper.addInteractionFunction("mouseDown", (e) => {
            if (!stateManager.AddWeightActive) return;
            
            // Remove mode is managed by keyboard handler, not here
            this.isPainting = true;
            this.paintSelectionTool.startPainting();
            
            // Paint immediately at start position for instant feedback
            const mousePos = this.mouseHelper.getMousePosition();
            stateManager.Debug && console.log('🎨 Mouse down - starting paint at:', mousePos);
            this.paintSelectionTool.paintAt(mousePos);
        }, "left");

        // Handle drag start (after movement threshold)
        this.mouseHelper.addInteractionFunction("dragStart", (e) => {
            if (!stateManager.AddWeightActive) return;
            stateManager.Debug && console.log('🎨 Drag started');
        }, "left");

        // Handle mouse move - continue painting during drag
        this.mouseHelper.addInteractionFunction("drag", (e) => {
            if (!stateManager.AddWeightActive || !this.isPainting) return;
            
            const mousePos = this.mouseHelper.getMousePosition();
            this.paintSelectionTool.paintAt(mousePos);
        }, "left");

        // Handle mouse up - stop painting
        this.mouseHelper.addInteractionFunction("mouseUp", (e) => {
            if (!stateManager.AddWeightActive) return;
            
            this.isPainting = false;
            this.paintSelectionTool.stopPainting();
            
            stateManager.Debug && console.log('🛑 Mouse up - stopped painting, selected faces:', this.getSelectedFaceCount());
        }, "left");

        // Handle mouse move without button pressed (for brush preview)
        this.mouseHelper.addInteractionFunction("mouseMove", (e) => {
            if (!stateManager.AddWeightActive) return;
            
            const mousePos = this.mouseHelper.getMousePosition();
            
            // Show brush helper for preview even when not actively painting
            if (!this.isPainting) {
                this.paintSelectionTool.paintAt(mousePos);
            }
        });

        // Stop painting if mouse leaves canvas to prevent stuck painting state
        const canvas = this.threeHelper.getRenderer().domElement;
        canvas.addEventListener('mouseleave', () => {
            if (this.isPainting) {
                stateManager.Debug && console.log('🚪 Mouse left canvas - stopping paint');
                this.isPainting = false;
                this.paintSelectionTool.stopPainting();
            }
        });
    }

    /** Sets the hull reference for weight application */
    setHull(hull: Hull) {
        this.hull = hull;
        this.paintSelectionTool.setHull(hull);
        stateManager.Debug && console.log('✅ Hull set in WeightManager');
    }

    /** Sets the weight value applied per selected face */
    setWeightPerFace(weight: number) {
        this.weightPerFace = weight;
        stateManager.Debug && console.log(`⚖️ Weight per face set to: ${weight} kg`);
    }

    /** Sets the brush size for weight painting selection */
    setBrushSize(size: number) {
        this.paintSelectionTool.setBrushSize(size);
    }

    /**
     * Applies weight to the current selection of faces
     * @returns True if weights were successfully applied, false otherwise
     */
    applyWeightToSelection(): boolean {
        if (!this.hull) {
            stateManager.Debug && console.warn('No hull available');
            return false;
        }

        const faceData = this.paintSelectionTool.getFaceData();
        if (faceData.size === 0) {
            stateManager.Debug && console.warn('No faces selected');
            return false;
        }

        const weights: Weight[] = [];
        
        // Convert selected faces to weight objects
        faceData.forEach((data, faceId) => {
            if (this.paintSelectionTool.selectedFaces.has(faceId)) {
                weights.push({
                    position: data.worldCenter,
                    magnitude: this.weightPerFace
                });
            }
        });

        // Apply weights to hull physics system
        this.hull.setPaintedWeights(weights);
        
        // Create visual markers for the applied weights
        this.createWeightMarkers(weights);
        
        stateManager.Debug && console.log(`✅ Applied ${weights.length} weights totaling ${this.getTotalWeight()} kg`);
        
        // Clear the selection after applying weights
        this.clearSelection();
        
        return true;
    }

    /** Creates visual markers for applied weights */
    private createWeightMarkers(weights: Weight[]) {
        // Clear existing markers before creating new ones
        this.clearWeightMarkers();
        
        // Create a visual marker for each weight
        weights.forEach((weight, index) => {
            // Create small sphere at weight position
            const geometry = new THREE.SphereGeometry(0.05, 8, 6);
            const marker = new THREE.Mesh(geometry, this.weightMarkerMaterial);
            marker.position.copy(weight.position);
            marker.userData = { weight: weight.magnitude, index };
            
            // Add to visualization group
            this.weightMarkers.add(marker);
        });
        
        stateManager.Debug && console.log(`📌 Created ${weights.length} weight markers`);
    }

    /** Clears all weight visualization markers */
    private clearWeightMarkers() {
        // Remove all existing markers and clean up resources
        while (this.weightMarkers.children.length > 0) {
            const child = this.weightMarkers.children[0];
            this.weightMarkers.remove(child);
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
            }
        }
    }

    /** Clears the current face selection */
    clearSelection() {
        this.paintSelectionTool.clearSelection();
        stateManager.Debug && console.log('🧹 Cleared selection');
    }

    /** Clears all weights and visualizations */
    clearAllWeights() {
        if (this.hull) {
            this.hull.clearPaintedWeights();
            stateManager.Debug && console.log('🗑️ Cleared all painted weights');
        }
        this.clearWeightMarkers();
        this.clearSelection();
    }

    /** Gets count of currently selected faces */
    getSelectedFaceCount(): number {
        return this.paintSelectionTool.getSelectedFaceCount();
    }

    /** Calculates total weight of current selection */
    getTotalWeight(): number {
        return this.getSelectedFaceCount() * this.weightPerFace;
    }

    /** Gets breakdown of selected faces by mesh type */
    getSelectionBreakdown(): { [key: string]: number } {
        return this.paintSelectionTool.getSelectionBreakdown();
    }

    /** Gets total weight already applied to the hull */
    getAppliedWeight(): number {
        if (!this.hull) return 0;
        
        const weights = this.hull.getPaintedWeights();
        return weights.reduce((total, weight) => total + weight.magnitude, 0);
    }

    /** Gets count of applied weight markers */
    getAppliedWeightCount(): number {
        return this.weightMarkers.children.length;
    }

    /** Cleans up resources and removes from scene */
    dispose() {
        this.clearWeightMarkers();
        this.weightMarkerMaterial.dispose();
        if (this.weightMarkers.parent) {
            this.weightMarkers.parent.remove(this.weightMarkers);
        }
    }
}