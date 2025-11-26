import * as THREE from "three";
import WaterBody from './components/water_body';
import * as Types from './types';
import { stateManager } from './scripts/state_manager';
import WeightManager from './components/weight_manager';
import RotationCube from './components/rotation_cube';
import CameraHelper from "./scripts/utils/camera/camera_helper";
import Hull from "./components/hull";
import ThreeHelper from "./scripts/three_helper";
import MouseHelper from "./scripts/utils/controls/mouse_helper";
import { PaintSelectionTool } from "./scripts/utils/controls/paint_selection_tool";
import KeyboardHelper from "./scripts/utils/controls/keyborad_helper";

class HullVisualizer {
  private canvasRef: HTMLCanvasElement;
  private hull?: Hull;
  private threeHelper: ThreeHelper;
  private waterBody?: WaterBody;
  private mouseHelper: MouseHelper;
  private keyboardHelper: KeyboardHelper;
  public stateManagerRef = stateManager;
  private rotationCube: RotationCube;
  private cameraHelper: CameraHelper;
  private paintSelectionTool: PaintSelectionTool;
  private lastMousePosition = { x: 0, y: 0 };

  weightManager?: WeightManager;
  private isAltPressed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasRef = canvas;
    this.waterBody = new WaterBody();
    this.cameraHelper = new CameraHelper(this.canvasRef);
    this.threeHelper = new ThreeHelper(this.canvasRef, this.cameraHelper);
    this.mouseHelper = new MouseHelper(this.cameraHelper);
    this.rotationCube = new RotationCube(this.cameraHelper, this.mouseHelper);
    this.keyboardHelper = new KeyboardHelper();

    // Add water body to scene
    this.threeHelper.addToScene(this.waterBody.getObject())

    // Initialize paint selection tool for weight painting
    this.paintSelectionTool = new PaintSelectionTool(
      this.threeHelper.getScene(),
      this.cameraHelper.getCamera()
    );

    // Set up canvas focus on click
    this.canvasRef.addEventListener('click', () => {
        this.canvasRef.focus();
    });
    
    // Set up keyboard shortcuts and state observers
    this.setupKeyboardShortcuts();
    this.setupStateObservers();

    // Add rotation cube to DOM for camera control visualization
    const rotationCubeCanvas = this.rotationCube.getCanvas();
    document.body.appendChild(rotationCubeCanvas);

    // Set up animation loop for water and rotation cube
    this.threeHelper.addAnimateFunction(this.waterBody.animateFunction.bind(this.waterBody));
    this.threeHelper.addAnimateFunction(this.rotationCube.animateFunction.bind(this.rotationCube));
    this.threeHelper.animate(0);
    
    // Initialize weight manager (hull will be set when loaded)
    this.weightManager = new WeightManager(
      this.threeHelper,
      this.mouseHelper,
      this.hull,
      this.paintSelectionTool
    );

    // Update rotation cube when camera mode changes
    // this.cameraHelper.onModeChange(() => {
    //   this.rotationCube.onCameraModeChanged();
    // });

    // Set up all mouse and keyboard interactions
    this.setupListeners();
  }

  private setupKeyboardShortcuts() {
    // ALT press → enable remove mode for weight painting
    this.keyboardHelper.addCallback("keydown", (e: KeyboardEvent) => {
        if (e.altKey && !this.isAltPressed) {
            this.isAltPressed = true;
            this.paintSelectionTool.setRemoveMode(true);
            stateManager.Debug && console.log("⌥ ALT pressed → switch to remove mode");
        }
        
        // ESC → clear current selection
        if (e.key === "Escape") {
            stateManager.Debug && console.log("🧹 ESC pressed → clearing selection");
            this.paintSelectionTool.clearSelection();
        }
    });

    // ALT release → disable remove mode
    this.keyboardHelper.addCallback("keyup", (e: KeyboardEvent) => {
        if (!e.altKey && this.isAltPressed) {
            this.isAltPressed = false;
            this.paintSelectionTool.setRemoveMode(false);
            stateManager.Debug && console.log("⌥ ALT released → back to add mode");
        }
    });
  }

  private setupStateObservers() {
    // Update camera mode when state changes
    stateManager.addObserver((state, changedProps) => {
      if (changedProps.includes("CameraMode")) {
        this.cameraHelper.toggleCameraMode(state.CameraMode);
      }
      
      // Clear selection when weight painting is deactivated
      if (changedProps.includes("AddWeightActive") && !state.AddWeightActive) {
        this.paintSelectionTool.clearSelection();
      }
    }, ["CameraMode", "AddWeightActive"]);
  }

  setupListeners() {
    // Left-click painting - only active when weight mode is enabled
    this.mouseHelper.addInteractionFunction("mouseDown", (_: any) => {
      if (!stateManager.AddWeightActive) return;
      
      this.paintSelectionTool.startPainting();
      
      // Paint immediately at mouse down position
      const mouse = this.mouseHelper.getMousePosition();
      this.paintSelectionTool.paintAt(mouse);
    }, "left");

    // Continuous painting while dragging
    this.mouseHelper.addInteractionFunction("drag", (_: any) => {
      if (!stateManager.AddWeightActive) return;
      
      const mouse = this.mouseHelper.getMousePosition();
      this.paintSelectionTool.paintAt(mouse);
    }, "left");

    // Stop painting on mouse release
    this.mouseHelper.addInteractionFunction("mouseUp", (_: any) => {
      if (!stateManager.AddWeightActive) return;
      
      this.paintSelectionTool.stopPainting();
    }, "left");

    // Right-click camera rotation setup
    this.mouseHelper.addInteractionFunction("dragStart", (e: any) => {
      this.lastMousePosition = {
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY
      };
    }, "right");

    // Handle camera rotation during right-click drag
    this.mouseHelper.addInteractionFunction("drag", (e: any) => {
      this.handleCameraRotate(e);
    }, "right");

    // Zoom with mouse wheel
    this.mouseHelper.addInteractionFunction("wheel", (e: any) => {
      const delta = e.delta > 0 ? 0.1 : -0.1;
      this.cameraHelper.zoom(delta);
      e.originalEvent.preventDefault();
    });

    // Mouse move for brush preview (even when not actively painting)
    this.mouseHelper.addInteractionFunction("mouseMove", (_: any) => {
      if (!stateManager.AddWeightActive) return;
      
      const mouse = this.mouseHelper.getMousePosition();
      this.updateBrushPreview(mouse);
    });

    // Disable context menu on canvas
    this.canvasRef.addEventListener('contextmenu', (e) => e.preventDefault());

    // Handle window resize
    window.addEventListener('resize', this.threeHelper.handleResize.bind(this.threeHelper));

    // Stop painting if mouse leaves canvas
    this.canvasRef.addEventListener('mouseleave', () => {
      this.paintSelectionTool.stopPainting();
    });
  }

  private updateBrushPreview(mousePosition: THREE.Vector2) {
    if (!stateManager.AddWeightActive || !this.hull) return;

    // Use raycaster to position brush helper for preview
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePosition, this.cameraHelper.getCamera());
    
    const hullMeshes = this.getVisibleHullMeshesForSelection();
    const intersects = raycaster.intersectObjects(hullMeshes, true);
    
    if (intersects.length > 0) {
      this.paintSelectionTool.updateBrushHelper(intersects[0].point);
    } else {
      this.paintSelectionTool.hideBrushHelper();
    }
  }

  private getVisibleHullMeshesForSelection(): THREE.Object3D[] {
    if (!this.hull) return [];

    const { hullMesh, transomMesh, bowMesh, deckMesh, stationsMesh } = this.hull.getSeparatedHullMesh();
    const meshes: THREE.Object3D[] = [];

    // Helper function to check if mesh is visible in the scene hierarchy
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

    // Only include meshes that are both enabled in stateManager AND visible in scene
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

  private handleCameraRotate(e: any) {
    const deltaX = e.originalEvent.clientX - this.lastMousePosition.x;
    const deltaY = e.originalEvent.clientY - this.lastMousePosition.y;
    this.cameraHelper.rotate(deltaX, deltaY);
    this.lastMousePosition = {
      x: e.originalEvent.clientX,
      y: e.originalEvent.clientY
    };
  }

  public isRemovingMode(): boolean {
    return this.isAltPressed;
  }

  private handleHullLoad(mesh: THREE.Object3D) {
    // Set default camera mode and prepare hull for interaction
    stateManager.CameraMode = "perspective";
    
    // Set hull in paint selection tool for weight painting
    if (this.hull && this.paintSelectionTool) {
      this.paintSelectionTool.setHull(this.hull);
    }

    // Center the hull in the scene
    if (this.hull) {
      this.hull.centerHull();
    }

    // Adjust lighting and shadows for the new hull
    this.threeHelper.adjustShadowCameraForHull(mesh);

    // Set up camera for the new hull
    if (this.hull) {
      this.cameraHelper.setHullObject(this.hull);
      const bbox = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const distance = maxDim * 2;
      stateManager.Debug && console.log('✅ Hull loaded with distance:', distance);
    }
  }

  loadHullFromQuoteTable(quoteTable: Types.QuoteTable) {
    // Remove existing hull if any
    if (this.hull) {
      this.threeHelper.removeFromScene(this.hull.getFullHullMesh());
    }

    // Set units from quote table metadata
    stateManager.Units = quoteTable.metadata.units;

    // Create new hull with callback for post-load setup
    this.hull = new Hull(quoteTable, [
      (mesh) => {
        this.handleHullLoad(mesh);
        this.threeHelper.addToScene(mesh);
        stateManager.Debug && console.log('✅ Hull loaded and camera setup complete');
      }
    ]);

    // Set camera target and hull reference
    this.cameraHelper.setTarget(new THREE.Vector3(0, 0, 0));
    this.cameraHelper.setHullObject(this.hull);

    // Set hull in paint selection tool for weight painting
    if (this.paintSelectionTool) {
      this.paintSelectionTool.setHull(this.hull);
    }

    // Update weight manager with new hull reference
    if (this.weightManager) {
      this.weightManager.setHull(this.hull);
    } else {
      this.weightManager = new WeightManager(
        this.threeHelper,
        this.mouseHelper,
        this.hull,
        this.paintSelectionTool
      );
    }
  }

  // Public API methods for UI control

  /** Set brush size for weight painting */
  setBrushSize(size: number) {
    this.paintSelectionTool.setBrushSize(size);
  }

  /** Set weight value per face in kilograms */
  setWeightPerFace(weight: number) {
    if (this.weightManager) {
      this.weightManager.setWeightPerFace(weight);
    }
  }

  /** Apply weight to current selection, returns success status */
  applyWeightToSelection(): boolean {
    if (this.weightManager) {
      return this.weightManager.applyWeightToSelection();
    }
    return false;
  }

  /** Clear current face selection */
  clearSelection() {
    this.paintSelectionTool.clearSelection();
  }

  /** Remove all applied weights from the hull */
  clearAllWeights() {
    if (this.weightManager) {
      this.weightManager.clearAllWeights();
    }
  }

  /** Get information about current selection (face count, weight, etc.) */
  getSelectionInfo() {
    return this.paintSelectionTool.getSelectionInfo();
  }

  /** Get reference to the canvas element */
  getCanvasElement(): HTMLCanvasElement {
    return this.canvasRef;
  }

  /** Clean up resources and event listeners */
  dispose() {
    this.paintSelectionTool.dispose();
    this.threeHelper.dispose();
    this.mouseHelper.dispose();
  }
}

export { HullVisualizer, Types };