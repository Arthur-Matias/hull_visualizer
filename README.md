# ⚓ Hull Visualizer

**A TypeScript Library for Interactive Naval Hull Visualization and FEA Pre-Processing**

---

## Overview

`hull-visualizer` is a **TypeScript/WebGL library** for **interactive 3D hull visualization**, **weight distribution painting**, and **geometry inspection**, designed for **finite element analysis (FEA)** and **naval design applications**.

Developed in collaboration with **naval engineers**, this project provides a modular visualization engine that can integrate into design pipelines or serve as the visualization layer of larger simulation tools.

---

## 📦 Installation

> 🚧 Not yet published to npm — clone and build locally for now.

```cmd
git clone https://github.com/Arthur-Matias/hull-visualizer 
cd hull-visualizer 
npm install npm run dev
```

Example usage can be found in `/example`.

---

## 🧩 Exports

`export { HullVisualizer, Types };`

|Export|Description|
|---|---|
|**`HullVisualizer`**|The main class for rendering, camera control, hull generation, and weight painting.|
|**`Types`**|A collection of type definitions used throughout the library (geometry, color, math, physics, camera, etc.), including `QuoteTable`.|

You can import directly:

`import { HullVisualizer, Types } from "hull-visualizer";`

---

## ⚙️ Basic Usage

```ts
import { HullVisualizer, Types } from "../src/main";

import { Tables } from "./tables";
const canvas = document.getElementById("hullCanvas") as HTMLCanvasElement;
const visualizer = new HullVisualizer(canvas);  // Load a hull geometry from a QuoteTable definition
visualizer.loadHullFromQuoteTable(Tables.getMetersTable());  // Activate weight-painting mode
visualizer.stateManagerRef.AddWeightActive = true;
```

---

## 🧮 QuoteTable Definition (`Types.QuoteTable`)

A **QuoteTable** describes the hull geometry as a grid of **stations** (longitudinal slices) and **waterlines** (transverse profiles at constant height).  
It’s conceptually similar to an **offset table** used in traditional naval architecture.

### Type Definition

```ts
export interface QuoteTable {

 /** Array of longitudinal stations defining the hull */
stations: Station[];

/** Additional global information about the table and hull characteristics */
metadata: QuoteTableMetadata;

 }


export interface Station {

/** Longitudinal position (X-axis) of this station */
position: number;

/** Waterlines defining the half-breadths at various heights */
waterlines: Waterline[];

}


export interface Waterline {

/** Vertical coordinate (Z-axis) at this point */
height: number;

/** Half-breadth (Y-axis) at the port side — starboard is mirrored if symmetric */
halfBreadthPort: number;

}

export interface QuoteTableMetadata {

/** Hull weight in consistent units */
weight: number;

/** Unit system for all dimensions ('m', 'mm', 'ft', etc.) */
units: "m" | "mm" | "ft";

/** Whether geometry is mirrored across the centerline */
symmetry: "symmetric" | "asymmetric";

/** True if hull includes a keel (affects baseline handling) */
hasKeel: boolean;

/** True if hull includes a chine (non-fair break in hull surface) */
hasChine: boolean;

/** Plate or shell thickness, relevant for FEA or hydrostatics */
thickness: number;

}
```

---

### Example QuoteTables

#### Meters (Symmetric Hull)

`Tables.getMetersTable();`

Defines a 6-meter hull with fine waterline spacing and smooth curvature.

#### Feet (Asymmetric Hull)

`Tables.getFtTable();`

Shows an asymmetric configuration (no mirroring), demonstrating how the library supports unbalanced hulls.

#### Millimeters (Detailed Model)

`Tables.getMilimetersTable();`

Useful for testing high-resolution, small-scale hull geometries.

---

### How the QuoteTable Works

- Each **station** defines a vertical slice of the hull along the **longitudinal axis (X)**.
    
- Each **waterline** within a station defines the **half-breadth (Y)** at a specific **height (Z)**.
    
- The visualizer interpolates between stations to construct a 3D surface.
    
- If `metadata.symmetry === "symmetric"`, the starboard side is mirrored automatically.
    
- Units are normalized internally for consistent scaling and physics calculations.
    

---

## 🎨 Weight Painting System

The **paint selection** system enables local application of weights directly onto hull geometry, simulating distributed loads for analysis or mass distribution estimation.

|Action|Description|
|---|---|
|🖱️ **Click + drag**|Add weight to selected faces|
|⌥ **Alt + drag**|Remove weights|
|⎋ **Esc**|Clear current selection|
|✅ **Apply Weight**|Commit weights to geometry|
|💥 **Clear All**|Remove all weights|

### Adjustable Controls

- **Weight per face (kg)**
    
- **Brush size (m)**
    
- **Mode indicator** (ADD 🟢 / REMOVE 🔴)
    
- **Selection Info** (face count, total weight, section breakdown)
    

The `WeightManager` handles all spatial selections, maintaining a face-index–to-weight map internally.  
All interactions are constrained to visible geometry to avoid back-face painting.

---

## 🧠 Library Architecture

```flowchart TD
A[Types.QuoteTable] --> B[HullVisualizer.loadHullFromQuoteTable()]
B --> C[Geometry Builder]
C --> D[WebGL Renderer]
D --> E[User Interaction Layer]
E --> F[WeightManager]
F --> G[FEA/Export Data]
E --> H[StateManagerRef (Reactive State)]
```

**Flow summary:**

1. **QuoteTable** defines the input geometry.
    
2. **HullVisualizer** constructs meshes and renders them.
    
3. **WeightManager** handles brush-based interactions and stores applied weights.
    
4. **StateManagerRef** propagates UI-state changes (camera, toggles, modes).
    
5. Optional **export step** (planned) converts hull and weights to simulation inputs.
    

---

## 🔧 Development & Debugging

Enable internal debugging visualizations:

`visualizer.stateManagerRef.Debug = true;`

Subscribe to state changes:

```
visualizer.stateManagerRef.addObserver((state) => {   
    console.log("Camera mode:", state.CameraMode);
}, ["CameraMode"]);
```

Switch between camera projections:

`visualizer.stateManagerRef.CameraMode = "orthographic";`

---

## 🧭 Roadmap

|Feature|Status|
|---|---|
|Hull generation from QuoteTable|✅|
|Toggleable hull components (deck, stations, waterlines)|✅|
|Weight painting|✅|
|Unit management & table switching|✅|
|FEA weight export|🔄 Planned|
|Hull curvature visualization|🔄 Planned|
|Contour stress visualization|🔄 Planned|
|NPM packaging & typed docs|🔄 Planned|

---

## 📜 License

MIT © 2025 [Your Name]

---

## 🧩 Summary

`hull-visualizer` provides the **core visualization, interaction, and data-handling layer** for browser-based naval engineering tools.  
With `QuoteTable` defining the hull geometry and `HullVisualizer` driving real-time rendering and weight manipulation, it serves as a **foundation for interactive FEA pre-processing**, simulation setup, or educational hydrodynamics applications.
