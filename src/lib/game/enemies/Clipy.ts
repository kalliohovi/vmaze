import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Maze } from '../Maze';
import { AudioManager } from '../audio/AudioManager';

export interface ClipyData {
    mesh: THREE.Object3D;
    position: THREE.Vector3;
    speed: number;
    target: THREE.Vector3;
    lastSoundTime: number;
    mixer: THREE.AnimationMixer | null;
    animations: THREE.AnimationClip[];
    isGlitching: boolean;
}

export class ClipyManager {
    private clibies: ClipyData[] = [];
    private clipyModel: THREE.Object3D | null = null;
    private clipyAnimations: THREE.AnimationClip[] = [];
    private gltfLoader = new GLTFLoader();
    private scene: THREE.Scene;
    private maze: Maze;
    private audioManager: AudioManager;
    private clipyRadius: number = 0.5;
    private playerRadius: number = 0.4;
    private onPlayerCaught: (() => void) | null = null;
    
    constructor(
        scene: THREE.Scene, 
        maze: Maze, 
        audioManager: AudioManager, 
        onPlayerCaught: (() => void) | null = null
    ) {
        this.scene = scene;
        this.maze = maze;
        this.audioManager = audioManager;
        this.onPlayerCaught = onPlayerCaught;
        
        this.loadClipyModel();
    }
    
    private async loadClipyModel(): Promise<void> {
        try {
            const clipyGltf = await this.loadGLTFModel('/static/models/cliby.glb');
            this.clipyModel = clipyGltf.scene;
            if (clipyGltf.animations && clipyGltf.animations.length > 0) {
                this.clipyAnimations = clipyGltf.animations;
                console.log('Loaded Cliby animations:', this.clipyAnimations.map(a => a.name).join(', '));
            }
            console.log('Clipy model loaded successfully');
        } catch (error) {
            console.error('Error loading Clipy model:', error);
            this.clipyModel = null;
        }
    }
    
    private loadGLTFModel(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => resolve(gltf),
                (xhr) => console.log(`${url} ${(xhr.loaded / xhr.total * 100)}% loaded`),
                (error) => reject(error)
            );
        });
    }
    
    public initializeClipyEnemies(): void {
        if (!this.clipyModel) {
            console.error('Cannot initialize Clipy enemies: model not loaded');
            return;
        }
        
        // Define Clipy spawn positions - use known empty locations in the maze
        const clipyPositions = [
            [2, 1.5, 2], // Top left corridor
            [8, 1.5, 2], // Top right corridor
            [5, 1.5, 5]  // Center of the maze
        ];
        
        clipyPositions.forEach(pos => {
            // Clone the model
            const clipyMesh = this.clipyModel!.clone();
            
            // Calculate world position from grid coordinates
            const worldPos = this.maze.getWorldPositionFromGridCoordinates(pos[0], pos[2], pos[1]);
            
            clipyMesh.position.copy(worldPos);
            clipyMesh.scale.set(1.5, 1.5, 1.5); // Make them smaller so they fit in corridors
            
            // Create animation mixer for this instance
            const mixer = new THREE.AnimationMixer(clipyMesh);
            let animations: THREE.AnimationClip[] = [];
            
            // Clone the animations for this instance
            if (this.clipyAnimations && this.clipyAnimations.length > 0) {
                animations = this.clipyAnimations.map(a => a.clone());
                
                // Find and play the "Glitch" animation
                const glitchAnim = animations.find(a => a.name === "Glitch" || a.name.toLowerCase().includes("glitch"));
                if (glitchAnim) {
                    const action = mixer.clipAction(glitchAnim);
                    action.play();
                } else {
                    console.warn("Glitch animation not found in:", this.clipyAnimations.map(a => a.name));
                }
            }
            
            // Add to the clibies array
            this.clibies.push({
                mesh: clipyMesh,
                position: worldPos.clone(),
                speed: 2.5, // Faster than normal monsters
                target: new THREE.Vector3(), // Will be set to player position during update
                lastSoundTime: 0,
                mixer: mixer,
                animations: animations,
                isGlitching: true
            });
            
            this.scene.add(clipyMesh);
        });
        
        console.log(`Added ${this.clibies.length} Clipy enemies at positions:`, clipyPositions);
    }
    
    public update(deltaTime: number, playerPosition: THREE.Vector3): void {
        const currentTime = performance.now();
        
        // Update animation mixers
        this.clibies.forEach(clipy => {
            if (clipy.mixer) {
                clipy.mixer.update(deltaTime);
            }
        });
        
        // Update each Clippy's position to move toward the player
        for (const clipy of this.clibies) {
            // Update target to current player position
            clipy.target.copy(playerPosition);
            
            // Calculate direction to player
            const direction = new THREE.Vector3()
                .subVectors(clipy.target, clipy.position)
                .normalize();
                
            // Make the model look toward the player
            const targetAngle = Math.atan2(direction.x, direction.z);
            clipy.mesh.rotation.y = targetAngle;
            
            // Calculate distance to player
            const distanceToPlayer = clipy.position.distanceTo(playerPosition);
            
            // Play close sound when clipy is within range (not too frequently)
            if (distanceToPlayer < 8 && currentTime - clipy.lastSoundTime > 2000) {
                this.audioManager.playSound('jensenClose', 0.6);
                clipy.lastSoundTime = currentTime;
            }
            
            // Calculate movement this frame
            const movement = direction.multiplyScalar(clipy.speed * deltaTime);
            
            // Store old position for collision detection
            const oldPosition = clipy.position.clone();
            
            // Update clipy position
            clipy.position.add(movement);
            
            // Check for wall collisions (Clippy moves through walls occasionally)
            if (Math.random() > 0.2 && this.maze.checkWallCollision(clipy.position, this.clipyRadius)) {
                // 80% chance to collide with walls
                clipy.position.copy(oldPosition);
            }
            
            // Update mesh position
            clipy.mesh.position.copy(clipy.position);
            
            // Check for collision with player
            if (distanceToPlayer < (this.playerRadius + this.clipyRadius)) {
                // Clipy caught player - handle catch event
                this.handleClipyCatch();
            }
        }
    }
    
    private handleClipyCatch(): void {
        // Play catch sound
        this.audioManager.playSound('jensenCatch', 0.7);
        
        // Notify the game if player was caught
        if (this.onPlayerCaught) {
            this.onPlayerCaught();
        }
    }
    
    public setPlayerRadius(radius: number): void {
        this.playerRadius = radius;
    }
    
    public getClipyCount(): number {
        return this.clibies.length;
    }
    
    public removeAllClipies(): void {
        // Remove all clipies from the scene
        this.clibies.forEach(clipy => {
            if (clipy.mesh) {
                this.scene.remove(clipy.mesh);
            }
        });
        this.clibies = [];
    }
    
    public dispose(): void {
        this.removeAllClipies();
        this.clipyModel = null;
        this.clipyAnimations = [];
    }
} 