type KeyboardEvents = "keydown" | "keyup" | "keypress";

/**
 * Keyboard input helper for managing keyboard event listeners
 * Provides a simple pub/sub system for keyboard events with easy callback management
 */
export default class KeyboardHelper {
    /** Storage for registered callback functions organized by event type */
    callbackMethods: { [key in KeyboardEvents]: Array<(event: KeyboardEvent) => void> } = {
        keydown: [],
        keypress: [],
        keyup: []
    };

    constructor() {
        this.setupListeners();
    }

    /** Sets up global keyboard event listeners on the window */
    private setupListeners() {
        window.addEventListener("keydown", this.handleKey.bind(this));
        window.addEventListener("keypress", this.handleKey.bind(this));
        window.addEventListener("keyup", this.handleKey.bind(this));
    }

    /** 
     * Handles keyboard events and dispatches to registered callbacks
     * @param event - The native keyboard event from the browser
     */
    private handleKey(event: KeyboardEvent) {
        const callbacks = this.callbackMethods[event.type as KeyboardEvents];
        if (callbacks) {
            // Execute all registered callbacks for this event type
            callbacks.forEach(cb => cb(event));
        }
    }

    /**
     * Registers a callback function for a specific keyboard event type
     * @param event - The keyboard event type to listen for
     * @param callback - Function to call when the event occurs
     */
    addCallback(event: KeyboardEvents, callback: (event: KeyboardEvent) => void) {
        this.callbackMethods[event].push(callback);
    }

    /**
     * Removes a previously registered callback function
     * @param event - The keyboard event type the callback was registered for
     * @param callback - The exact callback function to remove
     */
    removeCallback(event: KeyboardEvents, callback: (event: KeyboardEvent) => void) {
        const index = this.callbackMethods[event].indexOf(callback);
        if (index !== -1) this.callbackMethods[event].splice(index, 1);
    }
}