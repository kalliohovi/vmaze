import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Maze } from '../Maze';
import { AudioManager } from '../audio/AudioManager';

export interface MonsterData {
    mesh: THREE.Object3D;
    position: THREE.Vector3;
    speed: number;
    target: THREE.Vector3;
    lastSoundTime: number;
}

export class MonsterManager {
    private monsters: MonsterData[] = [];
    private monsterPositions: number[][] = [];
    private jensenModel: THREE.Object3D | null = null;
    private gltfLoader = new GLTFLoader();
    private scene: THREE.Scene;
    private maze: Maze;
    private audioManager: AudioManager;
    private monsterRadius: number = 0.5;
    private playerRadius: number = 0.4;
    private onPlayerCaught: (() => void) | null = null;
    private impossibleMode: boolean = false;
    
    constructor(
        scene: THREE.Scene, 
        maze: Maze, 
        audioManager: AudioManager, 
        onPlayerCaught: (() => void) | null = null,
        impossibleMode: boolean = false
    ) {
        this.scene = scene;
        this.maze = maze;
        this.audioManager = audioManager;
        this.onPlayerCaught = onPlayerCaught;
        this.impossibleMode = impossibleMode;
        
        this.setupMonsterPositions();
        this.loadMonsterModel().then(() => {
            this.initializeMonsters();
        });
    }
    
    private setupMonsterPositions(): void {
        // Monster starting positions (grid coordinates)
        this.monsterPositions = [
            [9, 1.5, 1], // Top right
            [1, 1.5, 9], // Bottom left  
            [9, 1.5, 9]  // Bottom right
        ];
    }
    
    private async loadMonsterModel(): Promise<void> {
        try {
            const jensenGltf = await this.loadGLTFModel('/static/models/jensen.glb');
            this.jensenModel = jensenGltf.scene.children[0];
            console.log('Jensen model loaded successfully');
        } catch (error) {
            console.error('Error loading Jensen model:', error);
            this.jensenModel = null;
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
    
    private initializeMonsters(): void {
        // If we have the loaded Jensen model, use it, otherwise fallback to simple geometry
        if (this.jensenModel) {
            this.monsterPositions.forEach(pos => {
                // Clone the model for each monster
                const monster = this.jensenModel!.clone();
                
                // Calculate world position from grid coordinates
                const worldPos = this.maze.getWorldPositionFromGridCoordinates(pos[0], pos[2], pos[1]);
                
                // Position and scale the Jensen model appropriately
                monster.position.copy(worldPos);
                monster.scale.set(1.5, 1.5, 1.5); // Adjust scale as needed
                
                // Store the monster in our array
                this.monsters.push({
                    mesh: monster,
                    position: worldPos.clone(),
                    speed: 1.5, // A bit faster but still slower than player
                    target: new THREE.Vector3(), // Will be set to player position in update
                    lastSoundTime: 0
                });
                
                this.scene.add(monster);
            });
        } else {
            // Fallback to simple geometry if model loading failed
            const monsterGeometry = new THREE.SphereGeometry(0.5, 8, 8);
            const monsterMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xff0000,
                emissive: 0x330000,
                roughness: 0.7,
                metalness: 0.3
            });
            
            this.monsterPositions.forEach(pos => {
                const monsterMesh = new THREE.Mesh(monsterGeometry, monsterMaterial);
                // Calculate world position from grid coordinates
                const worldPos = this.maze.getWorldPositionFromGridCoordinates(pos[0], pos[2], pos[1]);
                monsterMesh.position.copy(worldPos);
                
                this.monsters.push({
                    mesh: monsterMesh,
                    position: worldPos.clone(),
                    speed: 1.5, // A bit faster but still slower than player
                    target: new THREE.Vector3(), // Will be set to player position in update
                    lastSoundTime: 0
                });
                
                this.scene.add(monsterMesh);
            });
        }
    }
    
    public update(deltaTime: number, playerPosition: THREE.Vector3): void {
        const currentTime = performance.now();
        
        // Update each monster's position to move toward the player
        for (const monster of this.monsters) {
            // Update target to current player position
            monster.target.copy(playerPosition);
            
            // Calculate direction to player
            const direction = new THREE.Vector3()
                .subVectors(monster.target, monster.position)
                .normalize();
                
            // Make the model look toward the player
            if (this.jensenModel) {
                const targetAngle = Math.atan2(direction.x, direction.z);
                monster.mesh.rotation.y = targetAngle;
            }
            
            // Calculate distance to player
            const distanceToPlayer = monster.position.distanceTo(playerPosition);
            
            // Play Jensen close sound when monster is within range (not too frequently)
            if (distanceToPlayer < 5 && currentTime - monster.lastSoundTime > 3000) {
                this.audioManager.playSound('jensenClose', 0.4);
                monster.lastSoundTime = currentTime;
            }
            
            // Calculate movement this frame
            const movement = direction.multiplyScalar(monster.speed * deltaTime);
            
            // Store old position for collision detection
            const oldPosition = monster.position.clone();
            
            // Update monster position
            monster.position.add(movement);
            
            // In impossible mode, monsters ignore walls
            if (!this.impossibleMode) {
                // Check for wall collisions
                if (this.maze.checkWallCollision(monster.position, this.monsterRadius)) {
                    // If collision, try moving in just X or just Z direction
                    monster.position.copy(oldPosition);
                    
                    // Try X movement only
                    const xMovement = new THREE.Vector3(movement.x, 0, 0);
                    monster.position.add(xMovement);
                    
                    if (this.maze.checkWallCollision(monster.position, this.monsterRadius)) {
                        // X movement failed, restore position and try Z movement
                        monster.position.copy(oldPosition);
                        
                        const zMovement = new THREE.Vector3(0, 0, movement.z);
                        monster.position.add(zMovement);
                        
                        // If Z movement also fails, monster is stuck this frame
                        if (this.maze.checkWallCollision(monster.position, this.monsterRadius)) {
                            monster.position.copy(oldPosition);
                        }
                    }
                }
            }
            
            // Update mesh position
            monster.mesh.position.copy(monster.position);
            
            // Check for collision with player
            if (distanceToPlayer < (this.playerRadius + this.monsterRadius)) {
                // Monster caught player
                this.handleMonsterCatch();
            }
        }
    }
    
    private handleMonsterCatch(): void {
        // Play catch sound
        this.audioManager.playSound('jensenCatch', 0.7);
        
        // Notify the game if player was caught
        if (this.onPlayerCaught) {
            this.onPlayerCaught();
        }
    }
    
    public setMonsterSpeed(speed: number): void {
        this.monsters.forEach(monster => {
            monster.speed = speed;
        });
    }
    
    public setPlayerRadius(radius: number): void {
        this.playerRadius = radius;
    }
    
    public setImpossibleMode(enabled: boolean): void {
        this.impossibleMode = enabled;
        
        // In impossible mode, monsters are super fast
        if (enabled) {
            this.monsters.forEach(monster => {
                monster.speed = 10.0;
            });
        }
    }
    
    public resetMonsters(): void {
        // Reset monsters to their starting positions
        this.monsters.forEach((monster, index) => {
            const pos = this.monsterPositions[index % this.monsterPositions.length];
            const worldPos = this.maze.getWorldPositionFromGridCoordinates(pos[0], pos[2], pos[1]);
            
            // Reset position
            monster.position.copy(worldPos);
            monster.mesh.position.copy(worldPos);
        });
    }
    
    // Reset to initial state with only original monsters
    public resetToInitialState(): void {
        // Remove all additional monsters beyond the initial count
        const initialCount = this.monsterPositions.length;
        
        if (this.monsters.length > initialCount) {
            // Remove excess monsters from the scene
            for (let i = initialCount; i < this.monsters.length; i++) {
                this.scene.remove(this.monsters[i].mesh);
            }
            
            // Truncate the array to keep only initial monsters
            this.monsters = this.monsters.slice(0, initialCount);
            
            console.log(`Reset to initial ${initialCount} Jensen clones`);
        }
        
        // Then reset their positions
        this.resetMonsters();
    }
    
    public addAdditionalMonsters(positions: number[][]): void {
        // Skip if model not loaded or no positions
        if (!this.jensenModel || positions.length === 0) {
            console.warn('Cannot add additional monsters: model not loaded or no positions specified');
            return;
        }
        
        // Add monsters at specified positions
        positions.forEach(pos => {
            // Clone the model for each monster
            const monster = this.jensenModel!.clone();
            
            // Calculate world position from grid coordinates
            const worldPos = this.maze.getWorldPositionFromGridCoordinates(pos[0], pos[2], pos[1]);
            
            // Position and scale the Jensen model appropriately
            monster.position.copy(worldPos);
            monster.scale.set(1.5, 1.5, 1.5); // Adjust scale as needed
            
            // Store the monster in our array
            this.monsters.push({
                mesh: monster,
                position: worldPos.clone(),
                speed: 1.7, // Slightly faster than regular monsters
                target: new THREE.Vector3(), // Will be set to player position in update
                lastSoundTime: 0
            });
            
            this.scene.add(monster);
        });
        
        console.log(`Added ${positions.length} additional Jensen clones.`);
    }
    
    public dispose(): void {
        // Remove all monsters from the scene
        this.monsters.forEach(monster => {
            this.scene.remove(monster.mesh);
        });
        this.monsters = [];
    }
    
    // Add this method to teleport all monsters to the player's position
    public teleportToPlayer(playerPosition: THREE.Vector3): void {
        this.monsters.forEach(monster => {
            // Teleport the monster to the player
            monster.position.copy(playerPosition);
            monster.mesh.position.copy(playerPosition);
            
            // Play a sound effect for dramatic effect
            this.audioManager.playSound('jensenClose', 0.8);
        });
        
        console.log("All monsters teleported to player position!");
    }
} 