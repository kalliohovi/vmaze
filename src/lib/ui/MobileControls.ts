import * as THREE from 'three';

interface JoystickState {
    active: boolean;
    position: { x: number, y: number };
    delta: { x: number, y: number };
    maxDistance: number;
    id: number | null;
}

export class MobileControls {
    private leftJoystick: JoystickState;
    private rightJoystick: JoystickState;
    private container: HTMLElement;
    private leftJoystickElement: HTMLElement;
    private rightJoystickElement: HTMLElement;
    private leftStickElement: HTMLElement;
    private rightStickElement: HTMLElement;
    private isTouchDevice: boolean;
    
    // Callbacks for movement
    private onMovementChange: (x: number, y: number) => void;
    private onRotationChange: (x: number, y: number) => void;
    
    constructor(
        container: HTMLElement,
        onMovementChange: (x: number, y: number) => void,
        onRotationChange: (x: number, y: number) => void
    ) {
        this.container = container;
        this.onMovementChange = onMovementChange;
        this.onRotationChange = onRotationChange;
        
        // Initialize joystick states
        this.leftJoystick = {
            active: false,
            position: { x: 0, y: 0 },
            delta: { x: 0, y: 0 },
            maxDistance: 40,
            id: null
        };
        
        this.rightJoystick = {
            active: false,
            position: { x: 0, y: 0 },
            delta: { x: 0, y: 0 },
            maxDistance: 40,
            id: null
        };
        
        // Check if it's a touch device
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        if (this.isTouchDevice) {
            this.createJoystickElements();
            this.setupEventListeners();
        }
    }
    
    private createJoystickElements(): void {
        // Create left joystick container
        this.leftJoystickElement = document.createElement('div');
        this.leftJoystickElement.className = 'joystick left-joystick';
        this.leftJoystickElement.innerHTML = '<div class="joystick-text">MOVE</div>';
        
        // Create left stick
        this.leftStickElement = document.createElement('div');
        this.leftStickElement.className = 'joystick-stick';
        this.leftJoystickElement.appendChild(this.leftStickElement);
        
        // Create right joystick container
        this.rightJoystickElement = document.createElement('div');
        this.rightJoystickElement.className = 'joystick right-joystick';
        this.rightJoystickElement.innerHTML = '<div class="joystick-text">TURN</div>';
        
        // Create right stick
        this.rightStickElement = document.createElement('div');
        this.rightStickElement.className = 'joystick-stick';
        this.rightJoystickElement.appendChild(this.rightStickElement);
        
        // Add joysticks to container
        this.container.appendChild(this.leftJoystickElement);
        this.container.appendChild(this.rightJoystickElement);
        
        // Add styles
        this.addJoystickStyles();
    }
    
    private addJoystickStyles(): void {
        const style = document.createElement('style');
        style.textContent = `
            .joystick {
                position: fixed;
                width: 120px;
                height: 120px;
                background-color: rgba(0, 0, 0, 0.5);
                border-radius: 60px;
                bottom: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                user-select: none;
                touch-action: none;
                z-index: 1000;
            }
            
            .left-joystick {
                left: 30px;
            }
            
            .right-joystick {
                right: 30px;
            }
            
            .joystick-stick {
                width: 50px;
                height: 50px;
                background-color: rgba(255, 255, 255, 0.8);
                border-radius: 25px;
                position: absolute;
                transform: translate(-50%, -50%);
                left: 50%;
                top: 50%;
            }
            
            .joystick-text {
                position: absolute;
                color: white;
                font-size: 12px;
                top: 10px;
                opacity: 0.8;
                font-family: Arial, sans-serif;
            }
            
            @media (orientation: landscape) {
                .joystick {
                    width: 100px;
                    height: 100px;
                }
                
                .left-joystick {
                    left: 20px;
                    bottom: 20px;
                }
                
                .right-joystick {
                    right: 20px;
                    bottom: 20px;
                }
                
                .joystick-stick {
                    width: 40px;
                    height: 40px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    private setupEventListeners(): void {
        // Touch start event
        window.addEventListener('touchstart', (e: TouchEvent) => {
            e.preventDefault();
            this.handleTouchStart(e);
        }, { passive: false });
        
        // Touch move event
        window.addEventListener('touchmove', (e: TouchEvent) => {
            e.preventDefault();
            this.handleTouchMove(e);
        }, { passive: false });
        
        // Touch end event
        window.addEventListener('touchend', (e: TouchEvent) => {
            e.preventDefault();
            this.handleTouchEnd(e);
        }, { passive: false });
        
        // Touch cancel event
        window.addEventListener('touchcancel', (e: TouchEvent) => {
            e.preventDefault();
            this.handleTouchEnd(e);
        }, { passive: false });
    }
    
    private handleTouchStart(e: TouchEvent): void {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const touchX = touch.clientX;
            const touchY = touch.clientY;
            
            // Check if touch is in left half of screen
            if (touchX < window.innerWidth / 2) {
                if (!this.leftJoystick.active) {
                    this.leftJoystick.active = true;
                    this.leftJoystick.id = touch.identifier;
                    this.leftJoystick.position.x = touchX;
                    this.leftJoystick.position.y = touchY;
                    this.leftJoystick.delta.x = 0;
                    this.leftJoystick.delta.y = 0;
                    this.updateJoystickPosition(this.leftStickElement, 0, 0);
                }
            } 
            // Check if touch is in right half of screen
            else {
                if (!this.rightJoystick.active) {
                    this.rightJoystick.active = true;
                    this.rightJoystick.id = touch.identifier;
                    this.rightJoystick.position.x = touchX;
                    this.rightJoystick.position.y = touchY;
                    this.rightJoystick.delta.x = 0;
                    this.rightJoystick.delta.y = 0;
                    this.updateJoystickPosition(this.rightStickElement, 0, 0);
                }
            }
        }
    }
    
    private handleTouchMove(e: TouchEvent): void {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            
            // Handle left joystick movement
            if (this.leftJoystick.active && touch.identifier === this.leftJoystick.id) {
                this.processJoystickMovement(
                    touch, 
                    this.leftJoystick, 
                    this.leftStickElement, 
                    (dx, dy) => this.onMovementChange(dx, dy)
                );
            }
            
            // Handle right joystick movement
            if (this.rightJoystick.active && touch.identifier === this.rightJoystick.id) {
                this.processJoystickMovement(
                    touch, 
                    this.rightJoystick, 
                    this.rightStickElement, 
                    (dx, dy) => this.onRotationChange(dx, dy)
                );
            }
        }
    }
    
    private processJoystickMovement(
        touch: Touch, 
        joystick: JoystickState, 
        stickElement: HTMLElement, 
        callback: (dx: number, dy: number) => void
    ): void {
        const touchX = touch.clientX;
        const touchY = touch.clientY;
        
        let dx = touchX - joystick.position.x;
        let dy = touchY - joystick.position.y;
        
        // Calculate distance from center
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Normalize if distance exceeds maxDistance
        if (distance > joystick.maxDistance) {
            dx = (dx / distance) * joystick.maxDistance;
            dy = (dy / distance) * joystick.maxDistance;
        }
        
        // Update joystick delta
        joystick.delta.x = dx;
        joystick.delta.y = dy;
        
        // Update visual joystick position
        this.updateJoystickPosition(stickElement, dx, dy);
        
        // Calculate normalized values (-1 to 1) for movement
        const normalizedX = dx / joystick.maxDistance;
        const normalizedY = dy / joystick.maxDistance;
        
        // Call the callback with normalized values
        callback(normalizedX, normalizedY);
    }
    
    private handleTouchEnd(e: TouchEvent): void {
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            
            // Reset left joystick if its touch ended
            if (this.leftJoystick.active && touch.identifier === this.leftJoystick.id) {
                this.leftJoystick.active = false;
                this.leftJoystick.id = null;
                this.leftJoystick.delta.x = 0;
                this.leftJoystick.delta.y = 0;
                this.updateJoystickPosition(this.leftStickElement, 0, 0);
                this.onMovementChange(0, 0);
            }
            
            // Reset right joystick if its touch ended
            if (this.rightJoystick.active && touch.identifier === this.rightJoystick.id) {
                this.rightJoystick.active = false;
                this.rightJoystick.id = null;
                this.rightJoystick.delta.x = 0;
                this.rightJoystick.delta.y = 0;
                this.updateJoystickPosition(this.rightStickElement, 0, 0);
                this.onRotationChange(0, 0);
            }
        }
    }
    
    private updateJoystickPosition(element: HTMLElement, x: number, y: number): void {
        element.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    }
    
    // Check if this is a touch device
    public isMobileDevice(): boolean {
        return this.isTouchDevice;
    }
    
    // Clean up method
    public dispose(): void {
        if (this.isTouchDevice) {
            this.container.removeChild(this.leftJoystickElement);
            this.container.removeChild(this.rightJoystickElement);
        }
    }
} 