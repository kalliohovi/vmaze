import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Maze } from './Maze';
import { AudioManager } from './audio/AudioManager';

export class TokenManager {
    private tokens: THREE.Object3D[] = [];
    private tokenPositions: number[][] = [];
    private tokenModel: THREE.Object3D | null = null;
    private gltfLoader = new GLTFLoader();
    private scene: THREE.Scene;
    private maze: Maze;
    private audioManager: AudioManager;
    private lastTokenSound: number = 1; // Toggle between token sounds
    private onScoreUpdate: (points: number) => void;
    private onAllTokensCollected: (() => void) | null = null;
    private totalTokenCount: number = 42; // Fixed token count
    
    constructor(
        scene: THREE.Scene, 
        maze: Maze, 
        audioManager: AudioManager, 
        onScoreUpdate: (points: number) => void,
        onAllTokensCollected: (() => void) | null = null
    ) {
        this.scene = scene;
        this.maze = maze;
        this.audioManager = audioManager;
        this.onScoreUpdate = onScoreUpdate;
        this.onAllTokensCollected = onAllTokensCollected;
        
        this.setupTokenPositions();
        this.loadTokenModel().then(() => {
            this.initializeTokens();
        });
    }
    
    private setupTokenPositions(): void {
        // Define token positions throughout the maze (grid coordinates)
        // Total tokens should be exactly 42
        this.tokenPositions = [
            // Row 1 - First open corridor (reduced from 9 to 8)
            [1, 0.7, 1], [2, 0.7, 1], [3, 0.7, 1], [4, 0.7, 1], 
            [5, 0.7, 1], [7, 0.7, 1], [8, 0.7, 1], [9, 0.7, 1],
            
            // Row 3 - Corridor with gaps
            [3, 0.7, 3], [4, 0.7, 3], [5, 0.7, 3], [6, 0.7, 3], [7, 0.7, 3],
            
            // Row 4 - Middle area
            [1, 0.7, 4], [2, 0.7, 4], [3, 0.7, 4], [7, 0.7, 4], [8, 0.7, 4], [9, 0.7, 4],
            
            // Row 5-6 - Central corridors
            [1, 0.7, 5], [3, 0.7, 5], [7, 0.7, 5], [9, 0.7, 5],
            [1, 0.7, 6], [3, 0.7, 6], [7, 0.7, 6], [9, 0.7, 6],
            
            // Row 7 - Lower corridor (reduced from 7 to 6)
            [1, 0.7, 7], [3, 0.7, 7], [4, 0.7, 7], 
            [6, 0.7, 7], [7, 0.7, 7], [9, 0.7, 7],
            
            // Row 9 - Bottom corridor
            [1, 0.7, 9], [2, 0.7, 9], [3, 0.7, 9], [4, 0.7, 9], 
            [5, 0.7, 9], [6, 0.7, 9], [7, 0.7, 9], [8, 0.7, 9], [9, 0.7, 9],
        ];
        
        // Verify token count
        console.log(`Token count: ${this.tokenPositions.length} of ${this.totalTokenCount}`);
        if (this.tokenPositions.length !== this.totalTokenCount) {
            console.warn(`Token count mismatch! Expected ${this.totalTokenCount}, found ${this.tokenPositions.length}`);
        }
    }
    
    private async loadTokenModel(): Promise<void> {
        try {
            const tokenGltf = await this.loadGLTFModel('/static/models/token.glb');
            this.tokenModel = tokenGltf.scene.children[0];
            console.log('Token model loaded successfully');
        } catch (error) {
            console.error('Error loading token model:', error);
            this.tokenModel = null;
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
    
    private initializeTokens(): void {
        // If we have the loaded model, use it, otherwise fallback to simple geometry
        if (this.tokenModel) {
            this.tokenPositions.forEach(pos => {
                // Clone the model for each token
                const token = this.tokenModel!.clone();
                
                // Calculate world position from grid coordinates
                const worldPos = this.maze.getWorldPositionFromGridCoordinates(pos[0], pos[2], pos[1]);
                
                // Position and scale the token model appropriately
                token.position.copy(worldPos);
                token.scale.set(0.3, 0.3, 0.3); // Adjust scale as needed
                token.rotation.y = Math.random() * Math.PI * 2; // Random rotation for variety
                
                this.tokens.push(token);
                this.scene.add(token);
            });
        } else {
            // Fallback to simple geometry if model loading failed
            const tokenGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8);
            const tokenMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xffff00,
                emissive: 0x777700,
                roughness: 0.3,
                metalness: 0.7
            });
            
            this.tokenPositions.forEach(pos => {
                const token = new THREE.Mesh(tokenGeometry, tokenMaterial);
                // Calculate world position from grid coordinates
                const worldPos = this.maze.getWorldPositionFromGridCoordinates(pos[0], pos[2], pos[1]);
                token.position.copy(worldPos);
                token.rotation.x = Math.PI / 2;
                this.tokens.push(token);
                this.scene.add(token);
            });
        }
        
        // Double-check that we've created the correct number of tokens
        console.log(`Created ${this.tokens.length} tokens of ${this.totalTokenCount}`);
    }
    
    public updateTokenRotations(deltaTime: number): void {
        // Rotate the tokens for a cool effect (if using 3D models)
        if (this.tokenModel) {
            this.tokens.forEach(token => {
                token.rotation.y += deltaTime * 2; // Rotate around Y axis
            });
        }
    }
    
    public checkTokenCollection(playerPosition: THREE.Vector3): void {
        for (let i = this.tokens.length - 1; i >= 0; i--) {
            const token = this.tokens[i];
            const tokenPosition = new THREE.Vector3();
            token.getWorldPosition(tokenPosition);
            const distance = playerPosition.distanceTo(tokenPosition);
            
            if (distance < 1.2) { // Slightly larger collection radius for 3D models
                // Remove the token from the scene
                this.scene.remove(token);
                this.tokens.splice(i, 1);
                
                // Play token collection sound (alternating between the two sounds)
                const soundName = this.lastTokenSound === 1 ? 'tokenAdded1' : 'tokenAdded2';
                this.audioManager.playSound(soundName, 0.5);
                this.lastTokenSound = this.lastTokenSound === 1 ? 2 : 1;
                
                // Update score by 10 points per token
                this.onScoreUpdate(10);
                
                // Check if all tokens are collected
                if (this.tokens.length === 0) {
                    this.handleAllTokensCollected();
                }
            }
        }
    }
    
    private handleAllTokensCollected(): void {
        // Play victory sounds
        this.audioManager.playSound('tokenAdded1', 1.0);
        setTimeout(() => this.audioManager.playSound('tokenAdded2', 1.0), 300);
        
        console.log(`All ${this.totalTokenCount} tokens collected! Game complete!`);
        
        // Notify game that all tokens are collected
        if (this.onAllTokensCollected) {
            this.onAllTokensCollected();
        } else {
            // Fallback if no callback is provided
            alert(`Congratulations! You've collected all ${this.totalTokenCount} tokens and escaped the Jensen clones!`);
        }
    }
    
    public getTokenCount(): number {
        return this.tokens.length;
    }
    
    public getTotalTokenCount(): number {
        return this.totalTokenCount;
    }
    
    public getRemainingTokenCount(): number {
        return this.tokens.length;
    }
    
    public getCollectedTokenCount(): number {
        return this.totalTokenCount - this.tokens.length;
    }
    
    public reset(): void {
        // Remove existing tokens
        this.tokens.forEach(token => this.scene.remove(token));
        this.tokens = [];
        
        // Reinitialize tokens
        this.initializeTokens();
    }
} 