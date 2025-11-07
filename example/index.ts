import "./index.css";
import { HullVisualizer, Types } from "../src/main";
import { Tables } from "./tables";

// Global state for table management
let currentTable = 0;
const tables = [Tables.getMetersTable(), Tables.getFtTable(), Tables.getMilimetersTable()];

function getCurrentTable() {
  return tables[currentTable];
}

function setCurrentTable(value: number) {
  currentTable = value;
}

// Global reference to visualizer for UI updates
let visualizer: HullVisualizer;

function setupWeightUI() {
  if (!visualizer?.weightManager) return;

  // Create weight UI panel
  const weightPanel = document.createElement("div");
  weightPanel.id = "weightPanel";
  weightPanel.style.cssText = `
        position: absolute;
        top: calc(7rem + 20px);
        left: 20px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: Arial, sans-serif;
        min-width: 250px;
        z-index: 1000;
        display: none;
        border: 2px solid #00ff00;
    `;

  weightPanel.innerHTML = `
        <h3 style="margin: 0 0 15px 0; color: #00ff00;">🎨 Weight Painting</h3>
        <div id="modeIndicator" style="margin-bottom: 10px; padding: 5px; border-radius: 3px; background: #00aa00; color: white; text-align: center; font-size: 12px;">
            Mode: ADD 🟢
        </div>
        <div style="margin-bottom: 10px;">
            <label>Weight per face (kg): </label>
            <input type="number" id="weightPerFace" value="10" min="0.1" step="0.1" 
                   style="width: 80px; color: black; padding: 2px;">
        </div>
        <div style="margin-bottom: 10px;">
            <label>Brush Size: </label>
            <input type="range" id="brushSize" min="0.1" max="3" step="0.1" value="0.5" 
                   style="width: 120px;">
            <span id="brushSizeValue">0.5m</span>
        </div>
        <div style="margin-bottom: 15px; padding: 10px; background: rgba(0,255,0,0.1); border-radius: 4px;">
            <div style="font-size: 14px; margin-bottom: 5px;"><strong>Selection Info:</strong></div>
            <div>Selected Faces: <span id="faceCount" style="color: #00ff00;">0</span></div>
            <div>Total Weight: <span id="totalWeight" style="color: #00ff00;">0</span> kg</div>
            <div style="font-size: 11px; margin-top: 5px;" id="breakdown">Hull: 0, Deck: 0, Stations: 0</div>
        </div>
        <div style="margin-bottom: 10px; display: flex; gap: 5px; flex-wrap: wrap;">
            <button id="applyWeight" style="padding: 8px 12px; background: #00aa00; color: white; border: none; border-radius: 4px; cursor: pointer;">✅ Apply Weight</button>
            <button id="clearSelection" style="padding: 8px 12px; background: #ffaa00; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️ Clear Selection</button>
            <button id="clearAllWeights" style="padding: 8px 12px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer;">💥 Clear All</button>
        </div>
        <div style="font-size: 12px; color: #ccc; border-top: 1px solid #444; padding-top: 10px;">
            <div>🖱️ Click & drag to paint selection</div>
            <div>⌥ Hold Alt + drag to remove</div>
            <div>⎋ Press ESC to clear selection</div>
            <div>👁️ Paint on visible surfaces only</div>
        </div>
    `;

  document.body.appendChild(weightPanel);

  // Get references to weight UI elements
  const weightPerFaceInput = document.getElementById('weightPerFace') as HTMLInputElement;
  const brushSizeInput = document.getElementById('brushSize') as HTMLInputElement;
  const brushSizeValue = document.getElementById('brushSizeValue') as HTMLSpanElement;
  const applyWeightBtn = document.getElementById('applyWeight') as HTMLButtonElement;
  const clearSelectionBtn = document.getElementById('clearSelection') as HTMLButtonElement;
  const clearAllWeightsBtn = document.getElementById('clearAllWeights') as HTMLButtonElement;

  // Set up weight per face input handler
  weightPerFaceInput?.addEventListener('change', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    if (value > 0) {
      visualizer.setWeightPerFace(value);
    }
  });

  // Set up brush size input handler
  brushSizeInput?.addEventListener('input', (e) => {
    const size = parseFloat((e.target as HTMLInputElement).value);
    visualizer.setBrushSize(size);
    brushSizeValue.textContent = size.toFixed(1) + 'm';
  });

  // Set up weight application button
  applyWeightBtn?.addEventListener('click', () => {
    const success = visualizer.applyWeightToSelection();
    if (success) {
      showTempMessage('✅ Weight applied successfully!', 'success');
    } else {
      showTempMessage('❌ No faces selected. Paint some areas first.', 'error');
    }
  });

  // Set up selection clearing button
  clearSelectionBtn?.addEventListener('click', () => {
    visualizer.clearSelection();
    showTempMessage('🗑️ Selection cleared', 'info');
  });

  // Set up all weights clearing button
  clearAllWeightsBtn?.addEventListener('click', () => {
    visualizer.clearAllWeights();
    showTempMessage('💥 All weights cleared', 'warning');
  });

  // Update UI when weight mode is activated/deactivated
  visualizer.stateManagerRef.addObserver((state) => {
    const weightPanel = document.getElementById('weightPanel');
    const app = document.getElementById("app");

    if (!app || !weightPanel) return;

    if (state.AddWeightActive) {
      app.style.cursor = "crosshair";
      weightPanel.style.display = 'block';
      showTempMessage('🎨 Weight painting mode activated', 'info');
    } else {
      app.style.cursor = "default";
      weightPanel.style.display = 'none';
      visualizer.clearSelection();
    }
  }, ['AddWeightActive']);

  // Update mode indicator (add/remove) based on current state
  visualizer.stateManagerRef.addObserver((state) => {
    const modeIndicator = document.getElementById('modeIndicator');
    if (modeIndicator) {
      const isRemoving = visualizer.isRemovingMode();
      if (isRemoving) {
        modeIndicator.innerHTML = 'Mode: REMOVE 🔴';
        modeIndicator.style.background = '#ff4444';
      } else {
        modeIndicator.innerHTML = 'Mode: ADD 🟢';
        modeIndicator.style.background = '#00aa00';
      }
    }
  });
}

function setupCameraToggle() {
  const cameraToggleBtn = document.createElement("button");
  cameraToggleBtn.textContent = "Switch to Orthographic";
  cameraToggleBtn.style.cssText = `
        margin-left: 10px;
        padding: 8px 12px;
        background: #444;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;

  // Update button text based on current camera mode
  visualizer.stateManagerRef.addObserver((state) => {
    if (state.CameraMode === "perspective") {
      cameraToggleBtn.textContent = "Switch to Orthographic";
    } else {
      cameraToggleBtn.textContent = "Switch to Perspective";
    }
  }, ['CameraMode']);

  // Toggle camera mode on button click
  cameraToggleBtn.addEventListener("click", () => {
    const currentMode = visualizer.stateManagerRef.CameraMode;
    if (currentMode === "perspective") {
      visualizer.stateManagerRef.CameraMode = "orthographic";
    } else {
      visualizer.stateManagerRef.CameraMode = "perspective";
    }
  });

  // Insert camera toggle button next to view button
  const viewButton = document.getElementById("viewButton");
  viewButton?.parentElement?.insertBefore(cameraToggleBtn, viewButton.nextSibling);
}

function setupTableSelector() {
  const tableSelector = document.createElement("select");
  tableSelector.innerHTML = `
        <option value="0">Symmetric Hull (Meters)</option>
        <option value="1">Asymmetric Hull (Feet)</option>
        <option value="2">Millimeters Hull</option>
    `;
  tableSelector.selectedIndex = currentTable;
  tableSelector.style.cssText = `
        margin-right: 10px;
        padding: 8px;
        border-radius: 4px;
        border: 1px solid #ccc;
    `;

  // Handle table selection change
  tableSelector.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    const newIndex = parseInt(target.value);
    setCurrentTable(newIndex);
    visualizer.loadHullFromQuoteTable(getCurrentTable());
    showTempMessage(`📊 Loaded ${target.options[newIndex].text}`, 'info');
  });

  // Insert table selector before view button
  const viewButton = document.getElementById("viewButton");
  viewButton?.parentElement?.insertBefore(tableSelector, viewButton);
}

function setupViewMenu() {
  const viewButton = document.getElementById("viewButton") as HTMLButtonElement;
  viewButton.addEventListener("click", handleViewButtonClick);
}

function handleViewButtonClick(e: MouseEvent) {
  const viewButton = document.getElementById("viewButton") as HTMLButtonElement;
  e.stopPropagation();
  const bbox = getBBox(viewButton);

  // Remove existing menu if present
  const existingMenu = document.getElementById("viewMenu");
  if (existingMenu) {
    existingMenu.remove();
  }

  // Create new view menu
  const viewMenu = document.createElement("div");
  viewMenu.id = "viewMenu";
  viewMenu.style.cssText = `
        position: absolute;
        top: ${bbox.bottom}px;
        left: ${bbox.left}px;
        background: white;
        border: 1px solid #ccc;
        padding: 15px;
        z-index: 1000;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        min-width: 200px;
    `;

  // Define view options with current state
  const options = {
    wireframe: visualizer.stateManagerRef.WireframeActive,
    stations: visualizer.stateManagerRef.ShowStations,
    waterlines: visualizer.stateManagerRef.ShowWaterlines,
    hull: visualizer.stateManagerRef.ShowHull,
    deck: visualizer.stateManagerRef.ShowDeck,
  };

  // Add menu title
  const title = document.createElement("div");
  title.textContent = "View Options";
  title.style.fontWeight = "bold";
  title.style.marginBottom = "10px";
  title.style.borderBottom = "1px solid #eee";
  title.style.paddingBottom = "5px";
  viewMenu.appendChild(title);

  // Create checkbox for each view option
  Object.entries(options).forEach(([key, value]) => {
    viewMenu.appendChild(createCheckboxElement(key, value));
  });

  document.body.appendChild(viewMenu);

  // Close menu when clicking outside
  setTimeout(() => {
    const handleClose = (e: MouseEvent) => {
      if (!viewMenu.contains(e.target as Node)) {
        viewMenu.remove();
        window.removeEventListener("click", handleClose);
      }
    };
    window.addEventListener("click", handleClose);
  }, 100);
}

function createCheckboxElement(title: string, defaultValue = false) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        padding: 4px;
        border-radius: 3px;
        transition: background 0.2s;
    `;

  // Add hover effects
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.background = '#f5f5f5';
  });

  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.background = 'transparent';
  });

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = defaultValue;
  checkbox.id = `checkbox-${title}`;
  checkbox.style.marginRight = "8px";

  const label = document.createElement("label");
  label.htmlFor = checkbox.id;
  label.textContent = title.charAt(0).toUpperCase() + title.slice(1);
  label.style.cursor = "pointer";
  label.style.flex = "1";

  // Handle checkbox change events
  checkbox.addEventListener("change", () => {
    // Update state manager based on checkbox type
    switch (title) {
      case 'wireframe':
        visualizer.stateManagerRef.WireframeActive = checkbox.checked;
        break;
      case 'stations':
        visualizer.stateManagerRef.ShowStations = checkbox.checked;
        break;
      case 'waterlines':
        visualizer.stateManagerRef.ShowWaterlines = checkbox.checked;
        break;
      case 'hull':
        visualizer.stateManagerRef.ShowHull = checkbox.checked;
        break;
      case 'deck':
        visualizer.stateManagerRef.ShowDeck = checkbox.checked;
        break;
    }

    // Refresh hull visualization with new settings
    visualizer.loadHullFromQuoteTable(getCurrentTable());
  });

  wrapper.appendChild(checkbox);
  wrapper.appendChild(label);
  return wrapper;
}

function setupAddWeightButton() {
  const addWeightBtn = document.getElementById("addWeightBtn") as HTMLButtonElement;

  addWeightBtn.addEventListener("click", (mouse: MouseEvent) => {
    const newState = !visualizer.stateManagerRef.AddWeightActive;
    visualizer.stateManagerRef.AddWeightActive = newState;

    // Update button appearance based on state
    if (newState) {
      addWeightBtn.style.background = '#00aa00';
      addWeightBtn.textContent = '✅ Weight Mode ON';
    } else {
      addWeightBtn.style.background = '';
      addWeightBtn.textContent = '🎨 Add Weight';
    }
  });
}

function setupSelectionInfoUpdater() {
  // Update selection info periodically
  setInterval(() => {
    if (!visualizer) return;

    const faceCountElement = document.getElementById('faceCount');
    const totalWeightElement = document.getElementById('totalWeight');
    const breakdownElement = document.getElementById('breakdown');

    if (faceCountElement && totalWeightElement && breakdownElement) {
      const selectionInfo = visualizer.getSelectionInfo();
      faceCountElement.textContent = selectionInfo.faceCount.toString();
      totalWeightElement.textContent = selectionInfo.totalWeight.toFixed(1);

      // Update breakdown display
      const breakdown = selectionInfo.breakdown;
      breakdownElement.textContent =
        `Hull: ${breakdown.hull}, Deck: ${breakdown.deck}, Stations: ${breakdown.station}`;

      // Update applied weights information
      const appliedWeight = visualizer.weightManager?.getAppliedWeight() || 0;
      const appliedCount = visualizer.weightManager?.getAppliedWeightCount() || 0;

      const appliedInfoElement = document.getElementById('appliedInfo') || createAppliedInfoElement();
      appliedInfoElement.textContent = `Applied: ${appliedCount} weights (${appliedWeight.toFixed(1)} kg)`;
    }
  }, 100);
}

function createAppliedInfoElement() {
  const appliedInfo = document.createElement('div');
  appliedInfo.id = 'appliedInfo';
  appliedInfo.style.cssText = `
        margin-top: 10px;
        padding: 8px;
        background: rgba(255,0,0,0.1);
        border-radius: 4px;
        font-size: 12px;
        border-left: 3px solid #ff0000;
    `;

  // Add to weight panel
  const weightPanel = document.getElementById('weightPanel');
  weightPanel?.appendChild(appliedInfo);

  return appliedInfo;
}

function showTempMessage(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  // Remove existing message if present
  const existingMsg = document.getElementById('tempMessage');
  if (existingMsg) {
    existingMsg.remove();
  }

  // Create new message element
  const msgDiv = document.createElement("div");
  msgDiv.id = "tempMessage";
  msgDiv.textContent = message;
  msgDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        transition: opacity 0.3s;
    `;

  // Set background color based on message type
  switch (type) {
    case 'success':
      msgDiv.style.background = '#00aa00';
      break;
    case 'error':
      msgDiv.style.background = '#ff4444';
      break;
    case 'warning':
      msgDiv.style.background = '#ffaa00';
      break;
    case 'info':
      msgDiv.style.background = '#0088cc';
      break;
  }

  document.body.appendChild(msgDiv);

  // Auto-remove message after 3 seconds with fade out
  setTimeout(() => {
    msgDiv.style.opacity = '0';
    setTimeout(() => {
      if (msgDiv.parentElement) {
        msgDiv.parentElement.removeChild(msgDiv);
      }
    }, 300);
  }, 3000);
}

function getBBox(of: HTMLElement) {
  const rect = of.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    right: rect.right + window.scrollX,
    bottom: rect.bottom + window.scrollY,
  };
}

window.addEventListener("load", () => {
  const canvas: HTMLCanvasElement = document.getElementById("hullCanvas") as HTMLCanvasElement;
  visualizer = new HullVisualizer(canvas);

  // Initialize all UI components
  setupTableSelector();
  setupViewMenu();
  setupCameraToggle();
  setupAddWeightButton();
  setupWeightUI();
  setupSelectionInfoUpdater();

  // Load initial hull data and enable debug mode
  visualizer.loadHullFromQuoteTable(getCurrentTable());
  visualizer.stateManagerRef.Debug = true;

  // Add button styling
  const style = document.createElement('style');
  style.textContent = `
        #viewButton, #addWeightBtn {
            
            background: #444;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 5px;
            transition: background 0.2s;
        }
        
        #viewButton:hover, #addWeightBtn:hover {
            background: #666;
        }
        
        #addWeightBtn.active {
            background: #00aa00 !important;
        }
    `;
  document.head.appendChild(style);
});