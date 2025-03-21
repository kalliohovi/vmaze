import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Player } from './Player';
import { Maze } from './Maze';
import { TokenManager } from './Token';
import { MonsterManager } from './enemies/Monster';
import { ClipyManager } from './enemies/Clipy';
import { AudioManager } from './audio/AudioManager';
import { PhaseManager } from './phases/PhaseManager';
import { UIManager } from '../ui/UIManager';
import { TextureManager } from './textures/TextureManager';

// Add this interface near the top of your file, before the Game class
interface ExtendedAudioBufferSourceNode extends AudioBufferSourceNode {
    gainNode?: GainNode;
}

/**
 * REFACTORING SUGGESTION:
 * 
 * This file should be split into these modules:
 * 
 * 1. src/lib/game/Game.ts - Main class that orchestrates everything (keep slim)
 * 2. src/lib/game/Player.ts - Player movement, collision, input handling
 * 3. src/lib/game/Maze.ts - Maze generation and wall collision logic
 * 4. src/lib/game/enemies/Monster.ts - Jensen monster behavior
 * 5. src/lib/game/enemies/Clipy.ts - Clipy enemy behavior
 * 6. src/lib/game/Token.ts - Token placement and collection
 * 7. src/lib/game/audio/AudioManager.ts - Sound loading and playback
 * 8. src/lib/game/phases/PhaseManager.ts - Game stages and phase transitions
 * 9. src/lib/game/utils/CollisionDetection.ts - Shared collision utilities
 * 
 * Then import and use these modules in the main Game class.
 */

/**
 * Main Game class that orchestrates all game components
 */
export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private clock: THREE.Clock;
    private raycaster: THREE.Raycaster;
    
    // Game components
    private maze: Maze;
    private player: Player;
    private tokenManager: TokenManager;
    private monsterManager: MonsterManager;
    private clipyManager: ClipyManager;
    private audioManager: AudioManager;
    private phaseManager: PhaseManager;
    
    // Game state
    private isPaused: boolean = false;
    private difficulty: string = "Normal";
    private impossibleMode: boolean = false;
    
    // Callbacks
    private onScoreUpdate: (score: number) => void;
    private onRotationUpdate: (rotation: number) => void;
    private onPlayerCaught: (() => void) | null = null;
    private onStageUpdate: ((stage: number) => void) | null = null;
    private onSurvivalPhaseUpdate: ((active: boolean, timeRemaining: number) => void) | null = null;
    
    // Add this property to track game completion
    private gameCompleted: boolean = false;
    
    // Add UI Manager
    private uiManager: UIManager;
    
    // Add TextureManager
    private textureManager: TextureManager;
    
    // Add timeout property
    private impossibleModeTimeout: number | null = null;
    
    constructor(
        container: HTMLElement, 
        onScoreUpdate: (score: number) => void,
        onRotationUpdate: (rotation: number) => void,
        onPlayerCaught: (() => void) | null = null,
        difficulty: string = "Normal",
        onStageUpdate: ((stage: number) => void) | null = null,
        onSurvivalPhaseUpdate: ((active: boolean, timeRemaining: number) => void) | null = null
    ) {
        // Store original callbacks - we'll wrap these with our UI updates
        this.onScoreUpdate = (score: number) => {
            // Call original callback first
            onScoreUpdate(score);
            
            // Then update UI if it exists
            if (this.uiManager) {
                this.updateUI();
            }
        };
        
        this.onRotationUpdate = onRotationUpdate;
        
        this.onPlayerCaught = (onPlayerCaught) ? 
            () => {
                // Use our internal handler which uses the UI manager
                this.handlePlayerCaught();
                
                // Also call the original callback if provided
                onPlayerCaught();
            } : 
            () => this.handlePlayerCaught();
            
        this.onStageUpdate = onStageUpdate;
        this.onSurvivalPhaseUpdate = onSurvivalPhaseUpdate;
        this.difficulty = difficulty;
        this.impossibleMode = difficulty === "Impossible";
        this.clock = new THREE.Clock();
        
        // Initialize UI manager with options to not create elements that are already in the Svelte component
        this.uiManager = new UIManager({
            createScoreElement: false,
            createTokenElement: false,
            createStageElement: false,
            createTimerElement: false, // The Svelte component has survival timer
            createSprintElement: false // The Svelte component has sprint bar
        });
        
        // Initialize scene and renderer
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000); // Dark background for 90s feel
        this.scene.fog = new THREE.Fog(0x000000, 10, 25); // Adjust fog for wider maze
        
        // Camera setup - first person perspective
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: false }); // Turn off antialiasing for retro feel
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1); // Lower pixel ratio for more pixelated look
        container.appendChild(this.renderer.domElement);
        
        // Add lighting
        this.setupLighting();
        
        // Raycaster for collision detection
        this.raycaster = new THREE.Raycaster();
        
        // Initialize audio manager
        this.audioManager = new AudioManager();
        
        // Initialize texture manager
        this.textureManager = new TextureManager();
        
        // Initialize maze first as other components depend on it
        this.maze = new Maze(this.scene, this.textureManager);
        
        // Initialize player with starting position from the maze
        this.player = new Player(
            this.maze.getStartingPosition(),
            Math.PI, // Initial rotation (facing down the corridor)
            3.0,     // Initial speed
            Math.PI * 1.2, // Rotation speed
            this.onRotationUpdate
        );
        
        // Initialize phase manager
        this.phaseManager = new PhaseManager(
            {
                onScoreUpdate: this.onScoreUpdate,
                onStageUpdate: this.onStageUpdate || undefined,
                onSurvivalPhaseUpdate: this.onSurvivalPhaseUpdate || undefined
            },
            this.audioManager
        );
        
        // Initialize token manager with completion callback
        this.tokenManager = new TokenManager(
            this.scene, 
            this.maze, 
            this.audioManager, 
            (points) => {
                this.phaseManager.addPoints(points);
                this.updateUI();
            },
            this.handleGameCompletion.bind(this)
        );
        
        // Initialize monster manager
        this.monsterManager = new MonsterManager(
            this.scene,
            this.maze,
            this.audioManager,
            this.handlePlayerCaught.bind(this),
            this.impossibleMode
        );
        
        // Initialize Clipy manager
        this.clipyManager = new ClipyManager(
            this.scene,
            this.maze,
            this.audioManager,
            this.handlePlayerCaught.bind(this)
        );
        
        // Apply difficulty settings
        this.applyDifficultySettings();
        
        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Set camera initial position
        this.updateCameraFromPlayer();
        
        // Initial UI update
        this.updateUI();
    }
    
    private setupLighting(): void {
        // Lighting - simpler lighting for 90s feel
        const ambientLight = new THREE.AmbientLight(0x666666);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
    }
    
    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    private updateCameraFromPlayer(): void {
        this.camera.position.copy(this.player.position);
        this.camera.rotation.set(0, this.player.rotation, 0);
    }
    
    private handlePlayerCaught(): void {
        // Pause the game to prevent sound loop
        this.isPaused = true;
        
        // Play catch sound once
        this.audioManager.playSound('jensenCatch', 0.7);
        
        // Use the UI manager to show the error dialog
        this.uiManager.showErrorDialog(
            "You've been caught by a Jensen clone! Try again...",
            () => {
                // Reset the game with full reset to properly reset scores
                this.resetGame(true);
                
                // Make sure the UI is fully updated after reset
                this.updateUI();
                
                // Explicitly notify the score callback after reset
                this.onScoreUpdate(this.phaseManager.getScore());
            }
        );
    }
    
    private applyDifficultySettings(): void {
        switch (this.difficulty) {
            case "Easy":
                // Slower monsters, faster player
                this.monsterManager.setMonsterSpeed(1.0);
                this.player.speed = 4.0;
                break;
                
            case "Normal":
                // Default settings
                this.monsterManager.setMonsterSpeed(1.5);
                this.player.speed = 3.0;
                break;
                
            case "Hard":
                // Faster monsters
                this.monsterManager.setMonsterSpeed(2.5);
                this.player.speed = 3.0;
                break;
                
            case "Impossible":
                // Truly impossible mode
                this.setupImpossibleMode();
                break;
        }
    }
    
    private setupImpossibleMode(): void {
        // Set impossible mode flag for monsters
        this.monsterManager.setImpossibleMode(true);
        
        // Regular player speed
        this.player.speed = 3.0;
        
        // Clear any existing timeout
        if (this.impossibleModeTimeout) {
            clearTimeout(this.impossibleModeTimeout);
        }
        
        // Set a timeout to trigger game over - this ensures the player will always lose
        this.impossibleModeTimeout = setTimeout(() => {
            if (this.impossibleMode && !this.gameCompleted && !this.isPaused) {
                console.log("Impossible mode time's up!");
                // Force all monsters to teleport to player for dramatic effect
                this.monsterManager.teleportToPlayer(this.player.position);
                // Call the catch handler
                if (this.onPlayerCaught) {
                    this.onPlayerCaught();
                }
            }
        }, 3000 + Math.random() * 5000); // Random between 3-8 seconds
    }
    
    private handleGameCompletion(): void {
        // Set game as completed
        this.gameCompleted = true;
        
        // Pause the game
        this.pauseGame();
        
        // End any active Survival phase
        if (this.phaseManager.isSurvivalPhaseActive()) {
            this.phaseManager.endSurvivalPhase();
            this.clipyManager.removeAllClipies();
        }
        
        // Show game completion UI
        this.uiManager.showGameCompleteMessage(
            this.phaseManager.getScore(),
            this.difficulty
        );
        
        console.log("Game completed! All tokens collected!");
    }
    
    private updateUI(): void {
        // Update score
        this.uiManager.updateScore(
            this.phaseManager.getScore(),
            this.phaseManager.getMaxScore()
        );
        
        // Update token count
        const tokenProgress = this.getTokenProgress();
        this.uiManager.updateTokenCount(
            tokenProgress.collected,
            tokenProgress.total
        );
        
        // Update stage
        this.uiManager.updateStage(this.phaseManager.getStage());
        
        // Update sprint bar if available
        const sprintInfo = this.player.getSprintInfo();
        this.uiManager.updateSprintBar(
            sprintInfo.available,
            sprintInfo.energy
        );
        
        // Update Survival phase timer if active
        const survivalInfo = this.phaseManager.getSurvivalPhaseInfo();
        this.uiManager.updateSurvivalPhaseTimer(
            survivalInfo.active,
            survivalInfo.timeRemaining
        );
    }
    
    public update(): void {
        // Skip updates if game is paused or completed
        if (this.isPaused || this.gameCompleted) {
            this.animationFrameId = requestAnimationFrame(this.update.bind(this));
            return;
        }
        
        const deltaTime = this.clock.getDelta();
        
        // Update player movement and handle collisions
        this.player.update(deltaTime, (position, radius) => this.maze.checkWallCollision(position, radius));
        
        // Update camera to follow player
        this.updateCameraFromPlayer();
        
        // Update monsters to chase player
        this.monsterManager.update(deltaTime, this.player.position);
        
        // Check token collection
        this.tokenManager.checkTokenCollection(this.player.position);
        this.tokenManager.updateTokenRotations(deltaTime);
        
        // Update Survival phase if active
        if (this.phaseManager.isSurvivalPhaseActive()) {
            this.phaseManager.updateSurvivalPhase();
            
            // Update Survival phase UI
            const survivalInfo = this.phaseManager.getSurvivalPhaseInfo();
            this.uiManager.updateSurvivalPhaseTimer(
                survivalInfo.active,
                survivalInfo.timeRemaining
            );
        }
        
        // Update sprint UI if available
        const sprintInfo = this.player.getSprintInfo();
        if (sprintInfo.available) {
            this.uiManager.updateSprintBar(true, sprintInfo.energy);
        }
        
        // Render the scene
        this.renderer.render(this.scene, this.camera);
        
        // Request next frame
        this.animationFrameId = requestAnimationFrame(this.update.bind(this));
    }
    
    public start(): void {
        this.clock.start();
        this.update();
    }
    
    public resetGame(fullReset: boolean = false): void {
        // Unpause in case we were paused
        this.isPaused = false;
        
        // Reset completed state
        this.gameCompleted = false;
        
        // Reset player position to maze starting point
        this.player.position.copy(this.maze.getStartingPosition());
        this.player.rotation = Math.PI; // Face down the corridor
        
        // Reset monsters to initial state (removes additional monsters)
        this.monsterManager.resetToInitialState();
        
        // Remove any Clipy enemies
        this.clipyManager.removeAllClipies();
        
        // Always reset the score and stage for proper reset
        this.phaseManager.reset();
        
        if (fullReset) {
            // Full reset additional steps
            
            // Return to normal theme
            this.changeTheme('normal');
            
            // Restart normal background music
            this.audioManager.playBackgroundMusic('background');
        }
        
        // Update UI after reset
        this.updateUI();
    }
    
    public pauseGame(): void {
        this.isPaused = true;
    }
    
    public resumeGame(): void {
        this.isPaused = false;
    }
    
    public togglePause(): boolean {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }
    
    public isPauseActive(): boolean {
        return this.isPaused;
    }
    
    public getSurvivalPhaseInfo(): { active: boolean, timeRemaining: number } {
        return this.phaseManager.getSurvivalPhaseInfo();
    }
    
    public getSprintInfo(): { available: boolean, energy: number } {
        return this.player.getSprintInfo();
    }
    
    public getCurrentStage(): number {
        return this.phaseManager.getStage();
    }
    
    public getScore(): number {
        return this.phaseManager.getScore();
    }
    
    public isGameCompleted(): boolean {
        return this.gameCompleted;
    }
    
    public getTokenProgress(): { collected: number, total: number } {
        return {
            collected: this.tokenManager.getCollectedTokenCount(),
            total: this.tokenManager.getTotalTokenCount()
        };
    }
    
    private animationFrameId: number | null = null;
    
    public dispose(): void {
        // Clean up UI elements
        if (this.uiManager) {
            this.uiManager.cleanup();
        }
        
        // Clear impossible mode timeout
        if (this.impossibleModeTimeout) {
            clearTimeout(this.impossibleModeTimeout);
            this.impossibleModeTimeout = null;
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize.bind(this));
        
        // Stop any sounds
        if (this.audioManager) {
            // Assuming AudioManager has a dispose or cleanup method
            this.audioManager.dispose();
        }
        
        // Clear any running animation frames
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
    
    // Add method to change theme during phase changes
    public changeTheme(themeName: string): void {
        if (this.textureManager.setTheme(themeName)) {
            this.maze.updateTheme(themeName);
        }
    }
    
    // Update phase-related code to change visuals
    private handleStageChange(): void {
        console.log(`Advancing to stage ${this.phaseManager.getStage()}`);
        
        // Check for stage 2 - start Cliby phase
        if (this.phaseManager.getStage() === 2) {
            this.changeTheme('cliby');
            // Add more Jensen clones instead of Clipy enemies
            this.addMoreJensenClones();
        }
    }
    
    // Add more Jensen clones instead of using Clipy enemies
    private addMoreJensenClones(): void {
        // Add 3 more Jensen clones at different positions
        const additionalPositions = [
            [2, 1.5, 2], // Top left corridor
            [8, 1.5, 2], // Top right corridor
            [5, 1.5, 5]  // Center of the maze
        ];
        
        // Tell the monster manager to add these additional clones
        this.monsterManager.addAdditionalMonsters(additionalPositions);
    }
} 