// mouse_helper.ts
import * as THREE from 'three';
import type Hull from '../../../components/hull';
import { stateManager } from '../../state_manager';
import type CameraHelper from '../camera/camera_helper';
// import type { CameraModes } from 'src/types';

type InteractionType =
    | 'dragStart' | 'drag' | 'dragEnd'
    | 'mouseDown' | 'mouseUp' | 'mouseUpNoDrag'
    | 'mouseMove' | 'wheel' | 'click';

type DragType = 'left' | 'right';

interface DragEvent {
    originalEvent: MouseEvent;
    deltaX: number;
    deltaY: number;
    dragType: DragType;
}

interface MouseEventData {
    originalEvent: MouseEvent;
    dragType?: DragType;
}

interface WheelEventData {
    originalEvent: WheelEvent;
    delta: number;
}

type InteractionFunction = (event?: any) => void | boolean;

/**
 * Mouse input helper for handling complex interaction patterns
 * Manages left/right click, drag detection, and raycasting with proper event delegation
 */
export default class MouseHelper {
    private cameraHelperRef: CameraHelper;
    private position: THREE.Vector2;
    private isLeftDown: boolean;
    private isRightDown: boolean;
    private lastPositionBeforeLeftClick: THREE.Vector2 | undefined;
    private lastPositionBeforeRightClick: THREE.Vector2 | undefined;
    private rightInteractionFunctions: { [key in InteractionType]?: InteractionFunction[] } = {};
    private leftInteractionFunctions: { [key in InteractionType]?: InteractionFunction[] } = {};
    private generalInteractionFunctions: { [key in InteractionType]?: InteractionFunction[] } = {};
    private raycaster: THREE.Raycaster;
    private movedBeforeRightUp: boolean;
    private movedBeforeLeftUp: boolean;
    private moveThreshold: number;
    private clickThreshold: number;
    private dragStartTime?: number;

    constructor(cameraHelperRef: CameraHelper) {
        this.cameraHelperRef = cameraHelperRef;
        this.raycaster = new THREE.Raycaster();
        this.position = new THREE.Vector2();
        this.isLeftDown = false;
        this.isRightDown = false;
        this.movedBeforeRightUp = false;
        this.movedBeforeLeftUp = false;
        this.moveThreshold = 5; // pixels of movement to trigger drag
        this.clickThreshold = 200; // milliseconds for click vs drag timing

        this.setupEvents();
    }

    /** Resets left mouse button state */
    private resetLeft() {
        this.isLeftDown = false;
        this.movedBeforeLeftUp = false;
        this.lastPositionBeforeLeftClick = undefined;
    }

    /** Resets right mouse button state */
    private resetRight() {
        this.isRightDown = false;
        this.movedBeforeRightUp = false;
        this.lastPositionBeforeRightClick = undefined;
    }

    /** Sets up all mouse event listeners on the window */
    private setupEvents() {
        window.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
        window.addEventListener('click', this.handleClick.bind(this));
        window.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        window.addEventListener('contextmenu', this.handleContextMenu.bind(this), false);
    }

    /** Handles context menu (right-click) events with drag detection */
    private handleContextMenu(event: MouseEvent): void {
        // Only handle right clicks that weren't part of a drag
        if (!this.movedBeforeRightUp) {
            const dragTime = performance.now() - (this.dragStartTime || 0);

            if (dragTime < this.clickThreshold) {
                // This is a valid right click (quick press and release without movement)
                for (const func of this.rightInteractionFunctions['click'] || []) {
                    const result = func({ originalEvent: event, dragType: 'right' } as MouseEventData);
                    if (result === true) {
                        event.preventDefault();
                        break;
                    }
                }

                // Also call mouseUpNoDrag for backward compatibility
                for (const func of this.rightInteractionFunctions['mouseUpNoDrag'] || []) {
                    const result = func({ originalEvent: event, dragType: 'right' } as MouseEventData);
                    if (result === true) {
                        event.preventDefault();
                        break;
                    }
                }
            }
        }
        event.preventDefault(); // Always prevent default context menu
    }

    /** Handles mouse down events for both left and right buttons */
    private handleMouseDown(event: MouseEvent): void {
        this.dragStartTime = performance.now();

        if (event.button === 2) { // Right click
            this.lastPositionBeforeRightClick = new THREE.Vector2(event.clientX, event.clientY);
            this.isRightDown = true;
            this.movedBeforeRightUp = false;
            document.getElementsByTagName('body')[0].style.cursor = 'grabbing';
            
            // Update mouse position for raycasting
            this.updateMousePosition(event);

            // Call mouseDown handlers with drag type
            for (const func of this.rightInteractionFunctions['mouseDown'] || []) {
                const result = func({ originalEvent: event, dragType: 'right' } as MouseEventData);
                if (result === true) {
                    event.preventDefault();
                    break;
                }
            }
            return;
        }

        if (event.button === 0) { // Left click
            this.isLeftDown = true;
            this.movedBeforeLeftUp = false;
            this.lastPositionBeforeLeftClick = new THREE.Vector2(event.clientX, event.clientY);

            // Update mouse position for raycasting
            this.updateMousePosition(event);

            // Call mouseDown handlers with drag type
            for (const func of this.leftInteractionFunctions['mouseDown'] || []) {
                const result = func({ originalEvent: event, dragType: 'left' } as MouseEventData);
                if (result === true) {
                    event.preventDefault();
                    break;
                }
            }
        }
    }

    /** Handles mouse move events with drag detection and interpolation */
    private handleMouseMove(event: MouseEvent): void {
        this.updateMousePosition(event);

        // Handle right-drag
        if (this.isRightDown && this.lastPositionBeforeRightClick) {
            const currentPos = new THREE.Vector2(event.clientX, event.clientY);
            const delta = currentPos.distanceTo(this.lastPositionBeforeRightClick);

            if (delta > this.moveThreshold) {
                this.movedBeforeRightUp = true;

                // Call dragStart on first movement beyond threshold
                if (this.rightInteractionFunctions['dragStart'] && !this.getIsRightDragging()) {
                    for (const func of this.rightInteractionFunctions['dragStart'] || []) {
                        const result = func({
                            originalEvent: event,
                            dragType: 'right'
                        } as MouseEventData);
                        if (result === true) {
                            event.preventDefault();
                            break;
                        }
                    }
                }

                // Call drag handlers with delta information
                for (const func of this.rightInteractionFunctions['drag'] || []) {
                    const result = func({
                        originalEvent: event,
                        deltaX: event.clientX - this.lastPositionBeforeRightClick.x,
                        deltaY: event.clientY - this.lastPositionBeforeRightClick.y,
                        dragType: 'right'
                    } as DragEvent);
                    if (result === true) {
                        event.preventDefault();
                        break;
                    }
                }

                this.lastPositionBeforeRightClick.copy(currentPos);
            }
        }

        // Handle left-drag detection
        if (this.isLeftDown && this.lastPositionBeforeLeftClick) {
            const currentPos = new THREE.Vector2(event.clientX, event.clientY);
            const delta = currentPos.distanceTo(this.lastPositionBeforeLeftClick);

            if (delta > this.moveThreshold) {
                this.movedBeforeLeftUp = true;

                // Call dragStart on first movement beyond threshold
                if (this.leftInteractionFunctions['dragStart'] && !this.getIsDragging()) {
                    for (const func of this.leftInteractionFunctions['dragStart'] || []) {
                        const result = func({
                            originalEvent: event,
                            dragType: 'left'
                        } as MouseEventData);
                        if (result === true) {
                            event.preventDefault();
                            break;
                        }
                    }
                }

                // Call drag handlers with delta information
                for (const func of this.leftInteractionFunctions['drag'] || []) {
                    const result = func({
                        originalEvent: event,
                        deltaX: event.clientX - this.lastPositionBeforeLeftClick.x,
                        deltaY: event.clientY - this.lastPositionBeforeLeftClick.y,
                        dragType: 'left'
                    } as DragEvent);
                    if (result === true) {
                        event.preventDefault();
                        break;
                    }
                }

                this.lastPositionBeforeLeftClick.copy(currentPos);
            }
        }

        // Always call mouseMove handlers (general handlers that don't care about button)
        for (const func of this.generalInteractionFunctions['mouseMove'] || []) {
            const result = func(event);
            if (result === true) {
                event.preventDefault();
                break;
            }
        }
    }

    /** Handles mouse up events and routes to appropriate button handlers */
    private handleMouseUp(event: MouseEvent): void {
        if (event.button === 2) { // Right click
            this.handleRightMouseUp(event);
            return;
        }

        if (event.button === 0) { // Left click
            this.handleLeftMouseUp(event);
            return;
        }
    }

    /** Handles right mouse button release with drag/click detection */
    private handleRightMouseUp(event: MouseEvent): void {
        const dragTime = performance.now() - (this.dragStartTime || 0);
        const wasDrag = this.movedBeforeRightUp && dragTime < this.clickThreshold;

        if (wasDrag) {
            // This was a drag operation
            for (const func of this.rightInteractionFunctions['dragEnd'] || []) {
                func({ originalEvent: event, dragType: 'right' } as MouseEventData);
            }
        } else {
            // This was a potential right click (will be handled by contextmenu event)
            for (const func of this.rightInteractionFunctions['mouseUpNoDrag'] || []) {
                func({ originalEvent: event, dragType: 'right' } as MouseEventData);
            }
        }

        // Always call mouseUp handlers
        for (const func of this.rightInteractionFunctions['mouseUp'] || []) {
            func({ originalEvent: event, dragType: 'right' } as MouseEventData);
        }

        document.getElementsByTagName('body')[0].style.cursor = 'default';
        this.resetRight();
    }

    /** Handles left mouse button release with drag/click detection */
    private handleLeftMouseUp(event: MouseEvent): void {
        const dragTime = performance.now() - (this.dragStartTime || 0);
        const wasDrag = this.movedBeforeLeftUp && dragTime < this.clickThreshold;

        if (wasDrag) {
            // This was a drag operation
            for (const func of this.leftInteractionFunctions['dragEnd'] || []) {
                func({ originalEvent: event, dragType: 'left' } as MouseEventData);
            }
        } else {
            // This was a potential click (will be handled by click event)
            for (const func of this.leftInteractionFunctions['mouseUpNoDrag'] || []) {
                func({ originalEvent: event, dragType: 'left' } as MouseEventData);
            }
        }

        // Always call mouseUp handlers
        for (const func of this.leftInteractionFunctions['mouseUp'] || []) {
            func({ originalEvent: event, dragType: 'left' } as MouseEventData);
        }

        this.resetLeft();
    }

    /** Handles click events (left button only with no drag) */
    private handleClick(event: MouseEvent): void {
        // Only handle left clicks that weren't part of a drag
        if (event.button === 0 && !this.movedBeforeLeftUp) {
            const dragTime = performance.now() - (this.dragStartTime || 0);

            if (dragTime < this.clickThreshold) {
                // This is a valid click (quick press and release without movement)
                for (const func of this.leftInteractionFunctions['click'] || []) {
                    const result = func({ originalEvent: event, dragType: 'left' } as MouseEventData);
                    if (result === true) {
                        event.preventDefault();
                        break;
                    }
                }

                // Also call mouseUpNoDrag for backward compatibility
                for (const func of this.leftInteractionFunctions['mouseUpNoDrag'] || []) {
                    const result = func({ originalEvent: event, dragType: 'left' } as MouseEventData);
                    if (result === true) {
                        event.preventDefault();
                        break;
                    }
                }
            }
        }
    }

    /** Handles mouse wheel events for zooming and scrolling */
    private handleWheel(event: WheelEvent): void {
        // Call wheel handlers (wheel is not button-specific)
        for (const func of this.generalInteractionFunctions['wheel'] || []) {
            const result = func({
                originalEvent: event,
                delta: Math.sign(event.deltaY)
            } as WheelEventData);
            if (result === true) {
                event.preventDefault();
                break;
            }
        }

        // If no handler consumed the event, prevent default
        if (!this.generalInteractionFunctions['wheel'] || this.generalInteractionFunctions['wheel'].length === 0) {
            event.preventDefault();
        }
    }

    /** Updates internal mouse position with normalized coordinates for Three.js */
    private updateMousePosition(event: MouseEvent): void {
        const rect = document.getElementsByTagName('body')[0].getBoundingClientRect();
        this.position.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.position.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    // Public API Methods

    /** Adds an interaction handler function for specific event types and button */
    public addInteractionFunction(interactionType: InteractionType, func: InteractionFunction, dragType?: DragType) {
        if (dragType === 'left') {
            if (!this.leftInteractionFunctions[interactionType]) {
                this.leftInteractionFunctions[interactionType] = [];
            }
            this.leftInteractionFunctions[interactionType]!.push(func);
        } else if (dragType === 'right') {
            if (!this.rightInteractionFunctions[interactionType]) {
                this.rightInteractionFunctions[interactionType] = [];
            }
            this.rightInteractionFunctions[interactionType]!.push(func);
        } else {
            // For events that aren't button-specific (like mouseMove, wheel)
            if (!this.generalInteractionFunctions[interactionType]) {
                this.generalInteractionFunctions[interactionType] = [];
            }
            this.generalInteractionFunctions[interactionType]!.push(func);
        }
    }

    /** Removes an interaction handler function */
    public removeInteractionFunction(type: InteractionType, func: InteractionFunction, dragType?: DragType): void {
        if (dragType === 'left') {
            if (!this.leftInteractionFunctions[type]) return;
            const index = this.leftInteractionFunctions[type]!.indexOf(func);
            if (index > -1) {
                this.leftInteractionFunctions[type]!.splice(index, 1);
            }
        } else if (dragType === 'right') {
            if (!this.rightInteractionFunctions[type]) return;
            const index = this.rightInteractionFunctions[type]!.indexOf(func);
            if (index > -1) {
                this.rightInteractionFunctions[type]!.splice(index, 1);
            }
        } else {
            if (!this.generalInteractionFunctions[type]) return;
            const index = this.generalInteractionFunctions[type]!.indexOf(func);
            if (index > -1) {
                this.generalInteractionFunctions[type]!.splice(index, 1);
            }
        }
    }

    /** Checks if left button is currently dragging */
    public getIsDragging(): boolean {
        return this.isLeftDown && this.movedBeforeLeftUp;
    }

    /** Checks if right button is currently dragging */
    public getIsRightDragging(): boolean {
        return this.isRightDown && this.movedBeforeRightUp;
    }

    /** Gets the current drag type (left or right) */
    public getDragType(): DragType | null {
        if (this.getIsDragging()) return 'left';
        if (this.getIsRightDragging()) return 'right';
        return null;
    }

    /** Manually sets drag state (for external control) */
    public setDragState(dragging: boolean, dragType: DragType = 'left') {
        if (dragType === 'left') {
            this.movedBeforeLeftUp = dragging;
        } else {
            this.movedBeforeRightUp = dragging;
        }
    }

    // Raycasting methods

    /** Gets world position from raycast intersection with a specific mesh */
    public getWorldPosition(mesh: THREE.Object3D): THREE.Vector3 | null {
        this.raycaster.setFromCamera(this.position, this.cameraHelperRef.getCamera());
        const intersects = this.raycaster.intersectObject(mesh);

        if (intersects.length > 0) {
            return intersects[0].point;
        }

        return null;
    }

    /** Gets world position from raycast intersection with hull geometry */
    public getWorldPositionFromHull(hull: Hull): THREE.Vector3 | null {
        this.raycaster.setFromCamera(this.position, this.cameraHelperRef.getCamera());

        const { bowMesh, deckMesh, hullMesh, transomMesh, waterlines } = hull.getSeparatedHullMesh();
        const intersectMeshes = [];

        // Only include meshes that are currently visible according to state manager
        stateManager.ShowHull && intersectMeshes.push(hullMesh);
        stateManager.ShowHull && intersectMeshes.push(transomMesh);
        stateManager.ShowHull && intersectMeshes.push(bowMesh);
        stateManager.ShowDeck && intersectMeshes.push(deckMesh);
        stateManager.ShowWaterlines && intersectMeshes.push(waterlines);

        const intersects = this.raycaster.intersectObjects(intersectMeshes);

        if (intersects.length > 0) {
            return intersects[0].point;
        }

        return null;
    }

    /** Gets normalized mouse position for Three.js (-1 to 1 range) */
    public getMousePosition(): THREE.Vector2 {
        return this.position.clone();
    }

    /** Gets normalized mouse position in screen coordinates (0 to 1 range) */
    public getNormalizedMousePosition(): THREE.Vector2 {
        const rect = document.getElementsByTagName('body')[0].getBoundingClientRect();
        return new THREE.Vector2(
            (this.position.x + 1) / 2 * rect.width,
            (-this.position.y + 1) / 2 * rect.height
        );
    }

    /** Gets mouse position in screen pixel coordinates */
    public getScreenMousePosition(event: MouseEvent): THREE.Vector2 {
        const rect = document.getElementsByTagName('body')[0].getBoundingClientRect();
        return new THREE.Vector2(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
    }

    /** Cleans up event listeners and resources */
    public dispose(): void {
        // Clean up all event listeners
        window.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        window.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        window.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        window.removeEventListener('click', this.handleClick.bind(this));
        window.removeEventListener('wheel', this.handleWheel.bind(this));
        window.removeEventListener('contextmenu', this.handleContextMenu.bind(this));
    }
}