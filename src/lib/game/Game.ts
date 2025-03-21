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
import { MobileControls } from '../ui/MobileControls';

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
    
    // Portal properties
    private portal: THREE.Mesh | null = null;
    private portalPosition: THREE.Vector3 | null = null;
    private allTokensCollected: boolean = false;
    private portalRadius: number = 2.0;
    
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
    
    // Add mobile controls property
    private mobileControls: MobileControls | null = null;
    
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
            this.handleAllTokensCollected.bind(this)
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
        
        // Initialize mobile controls
        this.initializeMobileControls(container);
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
        
        // First, explicitly reset score to zero
        this.phaseManager.resetScore();
        
        // Use the UI manager to show the error dialog
        this.uiManager.showErrorDialog(
            "You've been caught by a Jensen clone! Try again...",
            () => {
                // Reset the game with full reset to properly reset scores
                this.resetGame(true);
                
                // Make sure the UI is fully updated after reset
                this.updateUI();
                
                // Explicitly notify the score callback after reset to update Svelte component
                this.onScoreUpdate(0);
            }
        );
    }
    
    private applyDifficultySettings(): void {
        switch (this.difficulty) {
            case "Easy":
                // Slower monsters, faster player
                this.monsterManager.setMonsterSpeed(2.0);
                this.player.speed = 6.0;
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
        this.player.speed = 1.1;
        
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
    
    private handleAllTokensCollected(): void {
        // Set the flag that all tokens have been collected
        this.allTokensCollected = true;
        
        // Create the exit portal at a predetermined location
        this.createExitPortal();
        
        // Show message to guide the player
        this.uiManager.showTemporaryMessage("All tokens collected! Find the portal to escape!");
        
        // Play sound to indicate portal appearance
        this.audioManager.playSound('tokenAdded1', 1.0);
        setTimeout(() => this.audioManager.playSound('tokenAdded2', 1.0), 300);
        
        console.log("All tokens collected! Portal has appeared");
        
        // IMPORTANT: Do NOT trigger game completion here
        // The player must physically reach the portal to win
    }
    
    private createExitPortal(): void {
        // Create a glowing portal mesh
        const portalGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 32);
        const portalMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 3.0,
            side: THREE.DoubleSide
        });
        
        this.portal = new THREE.Mesh(portalGeometry, portalMaterial);
        
        // Find a suitable position for the portal
        const portalPosition = this.findPortalPosition();
        this.portalPosition = portalPosition;
        
        // Position the portal
        this.portal.position.copy(portalPosition);
        
        // Rotate portal to be horizontal (like a platform to step on)
        this.portal.rotation.x = Math.PI / 2;
        
        // Add to scene
        this.scene.add(this.portal);
        
        // Create a bright light at the portal for visibility
        const portalLight = new THREE.PointLight(0x00ffff, 4, 10);
        portalLight.position.copy(portalPosition);
        this.scene.add(portalLight);
        
        // Play a distinct sound to indicate portal has appeared
        this.audioManager.playSound('tokenAdded1', 1.0);
        setTimeout(() => this.audioManager.playSound('tokenAdded2', 1.0), 200);
        setTimeout(() => this.audioManager.playSound('tokenAdded1', 1.0), 400);
        
        // Show a help message
        this.uiManager.showTemporaryMessage("Portal has appeared! Find the GLOWING BLUE platform to escape!");
    }
    
    private findPortalPosition(): THREE.Vector3 {
        // Use one of the token positions for portal placement
        // This guarantees the portal will be in an accessible location
        const mazeSize = this.maze.getMazeSize();
        
        // Get a random token position from the tokenManager's positions
        const tokenPositions = [
            // Row 1 corridor
            [3, 0.7, 1],
            // Middle row
            [5, 0.7, 5],
            // Bottom row
            [7, 0.7, 9]
        ];
        
        // Pick a random position from our predefined positions
        const randomIndex = Math.floor(Math.random() * tokenPositions.length);
        const randomPos = tokenPositions[randomIndex];
        
        console.log(`Creating portal at position: [${randomPos[0]}, ${randomPos[1]}, ${randomPos[2]}]`);
        
        // Convert to world coordinates
        return this.maze.getWorldPositionFromGridCoordinates(randomPos[0], randomPos[2], randomPos[1] + 0.5);
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
        
        // Make sure score reflects all 42 tokens (should be 420 points)
        // This ensures consistency in case there was a counting issue
        const tokenCount = this.tokenManager.getTotalTokenCount();
        const expectedBaseScore = tokenCount * 10;
        const currentScore = this.phaseManager.getScore();
        
        // If score is less than expected for all tokens, adjust it
        if (currentScore < expectedBaseScore) {
            console.log(`Adjusting score from ${currentScore} to ${expectedBaseScore} to account for all tokens`);
            this.phaseManager.setScore(expectedBaseScore);
        }
        
        // Show game completion UI
        this.uiManager.showGameCompleteMessage(
            this.phaseManager.getScore(),
            this.difficulty
        );
        
        console.log("Game completed! Player escaped through the portal!");
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
        
        // If all tokens collected, check for portal collision
        if (this.allTokensCollected && this.portal && this.portalPosition) {
            // Animate the portal
            this.animatePortal(deltaTime);
            
            // Double-check token collection status to prevent false wins
            const remainingTokens = this.tokenManager.getRemainingTokenCount();
            
            // Only allow game completion if tokens are truly all collected and player reaches portal
            if (remainingTokens === 0 && this.player.position.distanceTo(this.portalPosition) < this.portalRadius) {
                console.log("Player entered portal - completing game");
                this.handleGameCompletion();
            }
            // If tokens exist but flag is set, fix the inconsistency
            else if (remainingTokens > 0) {
                console.log(`Portal active but ${remainingTokens} tokens still exist - correcting state`);
                this.allTokensCollected = false;
                
                // Remove portal
                if (this.portal) {
                    this.scene.remove(this.portal);
                    this.portal = null;
                }
            }
        }
        
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
        console.log("Reset game called - full reset:", fullReset);
        
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
        
        // Remove the portal if it exists
        if (this.portal) {
            this.scene.remove(this.portal);
            this.portal = null;
            this.portalPosition = null;
        }
        
        // Reset token collection flag
        this.allTokensCollected = false;
        
        // Reset the tokens - add missing tokens back to the scene
        console.log("Game reset: Resetting tokens");
        this.tokenManager.reset();
        
        // Always reset the score and stage for proper reset
        this.phaseManager.reset();
        
        // Double-check that score is actually zero
        if (this.phaseManager.getScore() !== 0) {
            console.log("Force resetting score to zero");
            this.phaseManager.resetScore();
        }
        
        if (fullReset) {
            // Full reset additional steps
            
            // Return to normal theme
            this.changeTheme('normal');
            
            // Restart normal background music
            this.audioManager.playBackgroundMusic('background');
        }
        
        // Update UI after reset
        this.updateUI();
        
        // Verify token state is correct after reset
        const tokenCount = this.tokenManager.getTokenCount();
        const expectedCount = this.tokenManager.getTotalTokenCount();
        console.log(`After reset: ${tokenCount} of ${expectedCount} tokens exist`);
        if (tokenCount !== expectedCount) {
            console.error("Token count mismatch after reset - forcing reinitialize");
            this.tokenManager.reset();
        }
        
        // Force a score callback with zero to ensure Svelte component updates
        this.onScoreUpdate(0);
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
        
        // Clean up mobile controls
        if (this.mobileControls) {
            this.mobileControls.dispose();
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
    
    private animatePortal(deltaTime: number): void {
        if (!this.portal) return;
        
        // Rotate the portal for a spinning effect
        this.portal.rotation.z += deltaTime * 3.0;
        
        // Make the portal pulse by scaling it
        const pulseFactor = 0.2;
        const pulseSpeed = 3.0;
        const scaleOffset = Math.sin(performance.now() * 0.001 * pulseSpeed) * pulseFactor;
        this.portal.scale.set(1 + scaleOffset, 1, 1 + scaleOffset);
        
        // Make the portal hover up and down slightly
        const hoverHeight = 0.3;
        const hoverSpeed = 1.5;
        const heightOffset = Math.sin(performance.now() * 0.001 * hoverSpeed) * hoverHeight;
        this.portal.position.y = this.portalPosition!.y + heightOffset;
        
        // Animate the portal material for a stronger glowing effect
        if (this.portal.material instanceof THREE.MeshStandardMaterial) {
            const emissiveIntensity = 2.5 + Math.sin(performance.now() * 0.003) * 1.5;
            this.portal.material.emissiveIntensity = emissiveIntensity;
            
            // Cycle the portal color for extra visibility
            const r = 0.3 + 0.7 * Math.sin(performance.now() * 0.001);
            const g = 0.7 + 0.3 * Math.sin(performance.now() * 0.002);
            const b = 0.7 + 0.3 * Math.cos(performance.now() * 0.001);
            this.portal.material.emissive.setRGB(r, g, b);
        }
    }
    
    private initializeMobileControls(container: HTMLElement): void {
        // Initialize mobile controls with callbacks for movement and rotation
        this.mobileControls = new MobileControls(
            container,
            // Forward/backward movement (y value is what we care about)
            (x: number, y: number) => {
                // We need to negate y because mobile joystick up means negative y
                if (this.player) {
                    this.player.setMobileControlsInput(-y, 0);
                }
            },
            // Left/right rotation (x value is what we care about)
            (x: number, y: number) => {
                if (this.player) {
                    this.player.setMobileControlsInput(0, x);
                }
            }
        );
        
        // Add mobile-friendly meta tag to prevent zoom and scroll issues
        this.addMobileMetaTags();
    }
    
    private addMobileMetaTags(): void {
        // Prevent pinch zoom and scrolling on mobile
        const metaViewport = document.querySelector('meta[name="viewport"]');
        
        if (metaViewport) {
            // Update existing viewport meta tag
            metaViewport.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
        } else {
            // Create new viewport meta tag
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
            document.head.appendChild(meta);
        }
        
        // Add additional meta to disable touchscreen text selection
        const metaUserSelect = document.createElement('meta');
        metaUserSelect.name = 'apple-mobile-web-app-capable';
        metaUserSelect.content = 'yes';
        document.head.appendChild(metaUserSelect);
        
        // Add CSS to prevent text selection and touch callouts
        const style = document.createElement('style');
        style.textContent = `
            * {
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
                touch-action: manipulation;
            }
            
            body {
                overscroll-behavior: none;
                overflow: hidden;
                position: fixed;
                width: 100%;
                height: 100%;
            }
        `;
        document.head.appendChild(style);
    }
} 