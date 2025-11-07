import { getUnitScale } from "./utils/geometry/getters";
import * as Types from "../types";
import type { Views, CameraModes } from "../types";

// Define the change types for more granular notifications
export type StateChangeType = 
  | 'CurrentOrthoView' 
  | 'CameraMode' 
  | 'AddWeightActive' 
  | 'ShowHull' 
  | 'ShowDeck' 
  | 'ShowStations' 
  | 'ShowWaterlines' 
  | 'Debug' 
  | 'WireframeActive' 
  | 'HullDetailLevel' 
  | 'ActiveGroups' 
  | 'Units';

// State interface defining all observable properties
interface State{
    getUnits: ()=>number;
    get CurrentOrthoView(): Views;
    set CurrentOrthoView(view: Views);
    get CameraMode(): CameraModes;
    set CameraMode(mode: CameraModes);
    get AddWeightActive(): boolean;
    set AddWeightActive(active: boolean);
    get ShowHull(): boolean;
    set ShowHull(show: boolean);
    get ShowDeck(): boolean;
    set ShowDeck(show: boolean);
    get ShowStations(): boolean;
    set ShowStations(sohw: boolean);
    get ShowWaterlines(): boolean;
    set ShowWaterlines(show: boolean);
    get Debug(): boolean;
    set Debug(debug: boolean);
    get WireframeActive(): boolean;
    set WireframeActive(active: boolean);
    get HullDetailLevel(): Types.LODConfig;
    set HullDetailLevel(lod: Types.LODConfig);
    get ActiveGroups(): Types.HullGroups;
    set ActiveGroups(activeGroups: Types.HullGroups);
}

// Configuration for state observers
interface ObserverConfig {
  callback: (state: State, changedProperties: StateChangeType[]) => void;
  properties?: StateChangeType[]; // Specific properties to listen to, undefined = all
}

/**
 * Central state management system for hull visualization
 * Implements observer pattern for reactive state updates
 */
class StateManager implements State {
    // Internal state properties with default values
    private units: "m" | "mm" | "ft" = "m";
    private debug = false;
    private wireframe = false;
    private addWeightActive = false;
    private hullDetailLevel: Types.LODConfig = {
        enableSmoothing: true,
        stationMultiplier: 2,
        waterlineMultiplier: 2
    };

    private activeGroups: Types.HullGroups = {
        deck: true,
        hull: true,
        stations: false,
        waterlines: false,
    };

    private observers: ObserverConfig[] = [];
    private cameraMode: CameraModes = "perspective";
    private currentOrthoView: Views = "front";

    /**
     * Add observer for state changes with optional property filtering
     * Overloaded to accept either function or config object
     */
    addObserver(callback: (state: State, changedProperties: StateChangeType[]) => void, properties?: StateChangeType[]): void;
    addObserver(config: ObserverConfig): void;
    addObserver(arg1: ((state: State, changedProperties: StateChangeType[]) => void) | ObserverConfig, properties?: StateChangeType[]): void {
        if (typeof arg1 === 'function') {
            this.observers.push({
                callback: arg1,
                properties: properties
            });
        } else {
            this.observers.push(arg1);
        }
    }
    
    /** Remove observer by callback reference */
    removeObserver(callback: (state: State, changedProperties: StateChangeType[]) => void) {
        this.observers = this.observers.filter(obs => obs.callback !== callback);
    }
    
    /** Notify observers of state changes with property filtering */
    private notifyObservers(changedProperties: StateChangeType[]) {
        this.observers.forEach(observer => {
            // Notify for all changes if no specific properties defined
            if (!observer.properties) {
                observer.callback(this, changedProperties);
            } 
            // Only notify if any of the observer's specified properties changed
            else if (changedProperties.some(prop => observer.properties!.includes(prop))) {
                observer.callback(this, changedProperties);
            }
        });
    }
    
    /** Manually trigger notifications for specific properties */
    notifySpecificProperties(properties: StateChangeType[]) {
        this.notifyObservers(properties);
    }
    
    /** Manually trigger notifications for all properties */
    notifyAll() {
        this.notifyObservers(['CurrentOrthoView', 'CameraMode', 'AddWeightActive', 'ShowHull', 'ShowDeck', 'ShowStations', 'ShowWaterlines', 'Debug', 'WireframeActive', 'HullDetailLevel', 'ActiveGroups', 'Units']);
    }

    // === VIEW AND CAMERA PROPERTIES ===

    /** Get current orthogonal view (front, side, top, etc.) */
    get CurrentOrthoView(): Views {
        return this.currentOrthoView;
    }

    /** Set orthogonal view and notify observers if changed */
    set CurrentOrthoView(view: Views) {
        if (this.currentOrthoView !== view) {
            this.currentOrthoView = view;
            this.notifyObservers(['CurrentOrthoView']);
        }
    }

    /** Set camera mode (perspective/orthographic) and notify observers if changed */
    set CameraMode(cameraType: CameraModes) {
        if (this.cameraMode !== cameraType) {
            this.cameraMode = cameraType;
            this.notifyObservers(['CameraMode']);
        }
    }
    
    /** Get current camera mode */
    get CameraMode() {
        return this.cameraMode;
    }

    // === APPLICATION STATE ===

    /** Set weight painting mode and notify observers if changed */
    set AddWeightActive(value: boolean) {
        if (this.addWeightActive !== value) {
            this.addWeightActive = value;
            this.notifyObservers(['AddWeightActive']);
        }
    }
    
    /** Get weight painting mode state */
    get AddWeightActive() {
        return this.addWeightActive;
    }

    // === VISIBILITY CONTROLS ===

    /** Get hull visibility state */
    get ShowHull() {
        return this.activeGroups.hull;
    }
    
    /** Set hull visibility and notify observers if changed */
    set ShowHull(show: boolean) {
        if (this.activeGroups.hull !== show) {
            this.activeGroups.hull = show;
            this.notifyObservers(['ShowHull']);
        }
    }

    /** Get deck visibility state */
    get ShowDeck() {
        return this.activeGroups.deck;
    }
    
    /** Set deck visibility and notify observers if changed */
    set ShowDeck(show: boolean) {
        if (this.activeGroups.deck !== show) {
            this.activeGroups.deck = show;
            this.notifyObservers(['ShowDeck']);
        }
    }

    /** Set stations visibility and notify observers if changed */
    set ShowStations(show: boolean) {
        if (this.activeGroups.stations !== show) {
            this.activeGroups.stations = show;
            this.notifyObservers(['ShowStations']);
        }
    }
    
    /** Get stations visibility state */
    get ShowStations() {
        return this.activeGroups.stations;
    }

    /** Set waterlines visibility and notify observers if changed */
    set ShowWaterlines(show: boolean) {
        if (this.activeGroups.waterlines !== show) {
            this.activeGroups.waterlines = show;
            this.notifyObservers(['ShowWaterlines']);
        }
    }
    
    /** Get waterlines visibility state */
    get ShowWaterlines() {
        return this.activeGroups.waterlines;
    }

    // === APPLICATION SETTINGS ===

    /** Set measurement units and notify observers if changed */
    set Units(units: "m" | "mm" | "ft") {
        if (this.units !== units) {
            this.units = units;
            this.notifyObservers(['Units']);
        }
    }
    
    /** Set debug mode and notify observers if changed */
    set Debug(debug: boolean) {
        if (this.debug !== debug) {
            this.debug = debug;
            this.notifyObservers(['Debug']);
        }
    }
    
    /** Set wireframe rendering mode and notify observers if changed */
    set WireframeActive(wireframe: boolean) {
        if (this.wireframe !== wireframe) {
            this.wireframe = wireframe;
            this.notifyObservers(['WireframeActive']);
        }
    }

    /** Get wireframe rendering state */
    get WireframeActive() {
        return this.wireframe;
    }
    
    /** Get debug mode state */
    get Debug() {
        return this.debug;
    }
    
    /** Get current active hull component groups */
    get ActiveGroups() {
        return this.activeGroups;
    }
    
    /** Set active hull component groups and notify observers if changed */
    set ActiveGroups(activeGroups: Types.HullGroups) {
        // Simple object comparison - consider deep comparison for complex objects
        if (JSON.stringify(this.activeGroups) !== JSON.stringify(activeGroups)) {
            this.activeGroups = activeGroups;
            this.notifyObservers(['ActiveGroups']);
        }
    }
    
    /** Get unit scale factor for current units */
    getUnits() {
        return getUnitScale(this.units);
    }

    // === LEVEL OF DETAIL CONTROLS ===

    /** Set hull level of detail configuration and notify observers if changed */
    set HullDetailLevel(level: Types.LODConfig) {
        // Simple object comparison - consider more robust comparison for production
        if (JSON.stringify(this.hullDetailLevel) !== JSON.stringify(level)) {
            this.hullDetailLevel = level;
            this.notifyObservers(['HullDetailLevel']);
        }
    }
    
    /** Get current hull level of detail configuration */
    get HullDetailLevel() {
        return this.hullDetailLevel;
    }

    /** Output current state to console (debug mode only) */
    debugState(){
        this.debug && console.log(this)
    }
}

// Singleton instance for global state management
export const stateManager = new StateManager();