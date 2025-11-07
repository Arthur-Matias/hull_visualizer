// physics.ts
import type { Weight } from "../../types";
import * as THREE from 'three';
import { stateManager } from "../state_manager";

/**
 * Physics system for managing weight calculations and distributions
 * Handles base weight, custom weights, and paint-distributed weights for hydrostatic calculations
 */
export default class Physics {
    thickness: number = 0;
    weight: number = 0;
    customWeights: Weight[] = [];
    
    // Store paint-distributed weights separately from custom weights
    private paintedWeights: Weight[] = [];

    /**
     * Adds custom weight objects to the physics system
     * @param weights - One or more Weight objects to add
     */
    addCustomWeight(...weights: Weight[]){
        for (const weight of weights){
            if(!this.customWeights.includes(weight)){
                this.customWeights.push(weight)
            }
        }
    }

    /**
     * Sets painted weights from weight painting tool
     * @param weights - Array of Weight objects representing painted face weights
     */
    setPaintedWeights(weights: Weight[]): void {
        this.paintedWeights = [...weights]; // Create a copy to prevent external modification
        stateManager.Debug && console.log(`📦 Stored ${weights.length} painted weights in physics`);
    }

    /**
     * Gets all painted weights (returns a copy to prevent external modification)
     * @returns Copy of the painted weights array
     */
    getPaintedWeights(): Weight[] {
        return [...this.paintedWeights]; // Return a copy to prevent external modification
    }

    /**
     * Clears all painted weights from the physics system
     */
    clearPaintedWeights(): void {
        this.paintedWeights = [];
        stateManager.Debug && console.log('🧹 Cleared painted weights from physics');
    }

    /**
     * Calculates total weight including base weight, custom weights, and painted weights
     * @returns Total weight magnitude
     */
    getTotalWeight(): number {
        const baseWeight = this.weight;
        const customWeight = this.customWeights.reduce((sum, w) => sum + w.magnitude, 0);
        const paintedWeight = this.paintedWeights.reduce((sum, w) => sum + w.magnitude, 0);
        return baseWeight + customWeight + paintedWeight;
    }

    /**
     * Gets weight distribution for hydrostatic calculations
     * Returns positions and magnitudes of all distributed weights
     * @returns Object containing weight positions and magnitudes arrays
     */
    getWeightDistribution(): { positions: THREE.Vector3[]; magnitudes: number[] } {
        const positions: THREE.Vector3[] = [];
        const magnitudes: number[] = [];

        // Add painted weights (distributed across faces)
        this.paintedWeights.forEach(weight => {
            positions.push(weight.position);
            magnitudes.push(weight.magnitude);
        });

        // Add custom weights (point loads)
        this.customWeights.forEach(weight => {
            positions.push(weight.position);
            magnitudes.push(weight.magnitude);
        });

        return { positions, magnitudes };
    }
}