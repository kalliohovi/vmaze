import * as THREE from 'three';

export interface PlayerControls {
    position: THREE.Vector3;
    rotation: number;
    velocity: THREE.Vector3;
    speed: number;
    rotationSpeed: number;
}

export class Player {
    public position: THREE.Vector3;
    public rotation: number;
    public velocity: THREE.Vector3;
    public speed: number;
    public rotationSpeed: number;
    public radius: number = 0.4;
    
    // Sprint properties
    public sprintAvailable: boolean = false;
    public sprintEnergy: number = 100;
    public sprintRechargeRate: number = 10; // per second
    public sprintDepletionRate: number = 20; // per second
    public isSprinting: boolean = false;
    
    // Mobile control properties
    private mobileForward: number = 0;
    private mobileRotation: number = 0;
    private isUsingMobileControls: boolean = false;
    
    private keys: Set<string> = new Set();
    private onRotationUpdate: (rotation: number) => void;
    
    constructor(
        initialPosition: THREE.Vector3,
        initialRotation: number,
        speed: number,
        rotationSpeed: number,
        onRotationUpdate: (rotation: number) => void
    ) {
        this.position = initialPosition;
        this.rotation = initialRotation;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.speed = speed;
        this.rotationSpeed = rotationSpeed;
        this.onRotationUpdate = onRotationUpdate;
        
        // Add keyboard event listeners
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
    }
    
    private onKeyDown(event: KeyboardEvent) {
        this.keys.add(event.key.toLowerCase());
    }
    
    private onKeyUp(event: KeyboardEvent) {
        this.keys.delete(event.key.toLowerCase());
    }
    
    // Method for receiving input from mobile controls
    public setMobileControlsInput(forward: number, rotation: number): void {
        this.mobileForward = forward;
        this.mobileRotation = rotation;
        this.isUsingMobileControls = true;
    }
    
    public update(deltaTime: number, checkWallCollision: (position: THREE.Vector3, radius: number) => boolean): void {
        // Reset velocity
        this.velocity.set(0, 0, 0);
        
        // Handle keyboard rotation
        if (this.keys.has('a') || this.keys.has('arrowleft')) {
            this.rotation += this.rotationSpeed * deltaTime;
            this.onRotationUpdate(this.rotation);
        }
        if (this.keys.has('d') || this.keys.has('arrowright')) {
            this.rotation -= this.rotationSpeed * deltaTime;
            this.onRotationUpdate(this.rotation);
        }
        
        // Handle mobile rotation if mobile controls are being used
        if (this.isUsingMobileControls && Math.abs(this.mobileRotation) > 0.1) {
            // Apply rotation based on joystick input
            this.rotation -= this.mobileRotation * this.rotationSpeed * deltaTime;
            this.onRotationUpdate(this.rotation);
        }
        
        // Check for sprint key (Shift)
        if (this.sprintAvailable && 
            (this.keys.has('shift') || this.keys.has('shiftleft') || this.keys.has('shiftright'))) {
            // Only sprint if we have energy
            if (this.sprintEnergy > 0) {
                this.isSprinting = true;
                this.sprintEnergy = Math.max(0, this.sprintEnergy - this.sprintDepletionRate * deltaTime);
            } else {
                this.isSprinting = false;
            }
        } else {
            this.isSprinting = false;
            // Recharge sprint energy when not sprinting
            if (this.sprintAvailable) {
                this.sprintEnergy = Math.min(100, this.sprintEnergy + this.sprintRechargeRate * deltaTime);
            }
        }
        
        // Calculate actual speed based on sprint status
        const currentSpeed = this.isSprinting ? this.speed * 2.0 : this.speed;
        
        // Handle keyboard forward/backward movement
        if (this.keys.has('w') || this.keys.has('arrowup')) {
            this.velocity.z = -currentSpeed;
        }
        if (this.keys.has('s') || this.keys.has('arrowdown')) {
            this.velocity.z = currentSpeed;
        }
        
        // Handle mobile forward/backward movement
        if (this.isUsingMobileControls) {
            // Use the negative Y axis from the joystick for forward/backward
            // Forward is negative Z in our coordinate system
            this.velocity.z = -this.mobileForward * currentSpeed;
        }
        
        // Apply rotation to movement direction (for first-person effect)
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.rotation);
        this.velocity.applyMatrix4(rotationMatrix);
        
        // Store old position for collision detection
        const oldPosition = this.position.clone();
        
        // Update player position
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Check for collisions
        if (checkWallCollision(this.position, this.radius)) {
            this.position.copy(oldPosition);
        }
    }
    
    public enableSprint(): void {
        this.sprintAvailable = true;
        this.sprintEnergy = 100;
    }
    
    public getSprintInfo(): { available: boolean, energy: number } {
        return {
            available: this.sprintAvailable,
            energy: this.sprintEnergy
        };
    }
    
    public resetPosition(position: THREE.Vector3, rotation: number = Math.PI): void {
        this.position.copy(position);
        this.rotation = rotation;
        this.velocity.set(0, 0, 0);
        this.onRotationUpdate(this.rotation);
    }
    
    public dispose(): void {
        // Remove event listeners to prevent memory leaks
        window.removeEventListener('keydown', this.onKeyDown.bind(this));
        window.removeEventListener('keyup', this.onKeyUp.bind(this));
    }
} 