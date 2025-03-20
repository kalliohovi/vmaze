import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Add this interface near the top of your file, before the Game class
interface ExtendedAudioBufferSourceNode extends AudioBufferSourceNode {
    gainNode?: GainNode;
}

export class Game {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private maze: THREE.Group = new THREE.Group();
    private player: { 
        position: THREE.Vector3;
        rotation: number;
        velocity: THREE.Vector3;
        speed: number;
        rotationSpeed: number;
    };
    private tokens: THREE.Object3D[] = [];
    private monsters: {
        mesh: THREE.Object3D;
        position: THREE.Vector3;
        speed: number;
        target: THREE.Vector3;
        lastSoundTime: number;
    }[] = [];
    private keys: Set<string> = new Set();
    private score: number = 0;
    private onScoreUpdate: (score: number) => void;
    private onRotationUpdate: (rotation: number) => void;
    private raycaster: THREE.Raycaster;
    private clock: THREE.Clock;
    private walls: THREE.Mesh[] = [];
    private playerRadius: number = 0.4;
    private monsterRadius: number = 0.5;
    private mazeSize: number = 35; // Even larger maze
    private cellSize: number = 3.5; // Wider cells
    private wallThickness: number = 0.5; // For thinner walls
    private gltfLoader = new GLTFLoader();
    private tokenModel: THREE.Object3D | null = null;
    private jensenModel: THREE.Object3D | null = null;
    private modelsLoaded: boolean = false;
    private tokenPositions: number[][] = [];
    private monsterPositions: number[][] = [];
    
    // Audio system
    private audioContext: AudioContext | null = null;
    private sounds: { [key: string]: AudioBuffer } = {};
    private musicSource: ExtendedAudioBufferSourceNode | null = null;
    private backgroundMusic: AudioBuffer | null = null;
    private lastTokenSound: number = 1; // Toggle between token sounds

    // New property for onPlayerCaught callback
    private onPlayerCaught: (() => void) | null = null;

    // Add this property to the Game class (near the top with other properties)
    private isPaused: boolean = false;

    // Add these properties to the Game class
    private difficulty: string = "Normal";
    private impossibleMode: boolean = false;
    private stage: number = 1;
    private clibies: {
        mesh: THREE.Object3D;
        position: THREE.Vector3;
        speed: number;
        target: THREE.Vector3;
        lastSoundTime: number;
        mixer: THREE.AnimationMixer | null;
        animations: THREE.AnimationClip[];
        isGlitching: boolean;
    }[] = [];
    private clipyModel: THREE.Object3D | null = null;
    private clipyAnimations: THREE.AnimationClip[] = [];
    private onStageUpdate: ((stage: number) => void) | null = null;
    private sprintAvailable: boolean = false;
    private sprintEnergy: number = 100;
    private sprintRechargeRate: number = 10; // per second
    private sprintDepletionRate: number = 20; // per second
    private isSprinting: boolean = false;
    private clibyPhaseActive: boolean = false;
    private clibyPhaseTimer: number = 84; // 1:24 in seconds
    private clibyPhaseStartTime: number = 0;
    private onClibyPhaseUpdate: ((active: boolean, timeRemaining: number) => void) | null = null;

    constructor(
        container: HTMLElement, 
        onScoreUpdate: (score: number) => void,
        onRotationUpdate: (rotation: number) => void,
        onPlayerCaught: (() => void) | null = null,
        difficulty: string = "Normal",
        onStageUpdate: ((stage: number) => void) | null = null,
        onClibyPhaseUpdate: ((active: boolean, timeRemaining: number) => void) | null = null
    ) {
        this.onScoreUpdate = onScoreUpdate;
        this.onRotationUpdate = onRotationUpdate;
        this.onPlayerCaught = onPlayerCaught;
        this.onStageUpdate = onStageUpdate;
        this.onClibyPhaseUpdate = onClibyPhaseUpdate;
        this.difficulty = difficulty;
        this.impossibleMode = difficulty === "Impossible";
        this.clock = new THREE.Clock();
        
        // Initialize audio system
        this.initAudio();
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000); // Dark background for 90s feel
        this.scene.fog = new THREE.Fog(0x000000, 10, 25); // Adjust fog for wider maze

        // Camera setup - first person perspective
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // Player setup - will be positioned properly after maze creation
        this.player = {
            position: new THREE.Vector3(0, 1.5, 0), // Initial position, will be set properly after maze creation
            rotation: Math.PI, // Start facing down the corridor
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 3.0, // Slightly faster for better gameplay
            rotationSpeed: Math.PI * 1.2 // Radians per second - slightly faster rotation
        };
        this.camera.position.copy(this.player.position);
        this.camera.rotation.set(0, this.player.rotation, 0);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: false }); // Turn off antialiasing for retro feel
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1); // Lower pixel ratio for more pixelated look
        container.appendChild(this.renderer.domElement);

        // Lighting - simpler lighting for 90s feel
        const ambientLight = new THREE.AmbientLight(0x666666);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);

        // Raycaster for collision detection
        this.raycaster = new THREE.Raycaster();

        // Initialize maze
        this.initializeMaze();
        
        // Set up token positions
        this.setupTokenPositions();
        
        // Set up monster positions
        this.setupMonsterPositions();
        
        // Load models then initialize game objects
        this.loadModels().then(() => {
            this.initializeTokens();
            this.initializeMonsters();
            this.modelsLoaded = true;
        });

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Add keyboard event listeners
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Initial rotation update
        this.onRotationUpdate(this.player.rotation);

        // Apply difficulty settings
        this.applyDifficultySettings();
    }
    
    private async initAudio() {
        try {
            // Create audio context with a user interaction to comply with autoplay policies
            const setupAudio = () => {
                if (!this.audioContext) {
                    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                    
                    // Load all sound files
                    this.loadSound('background', '/static/sounds/background_loop.mp3');
                    this.loadSound('clibyBackground', '/static/sounds/cliby_background.mp3');
                    this.loadSound('jensenClose', '/static/sounds/jensen-close_sound.mp3');
                    this.loadSound('tokenAdded1', '/static/sounds/tokens-added_1.mp3');
                    this.loadSound('tokenAdded2', '/static/sounds/token_added_2.mp3');
                    this.loadSound('jensenCatch', '/static/sounds/jensen_catch_sound.mp3');
                    
                    // Remove event listeners once audio is initialized
                    window.removeEventListener('click', setupAudio);
                    window.removeEventListener('keydown', setupAudio);
                }
            };
            
            // Add event listeners to initialize audio on first user interaction
            window.addEventListener('click', setupAudio);
            window.addEventListener('keydown', setupAudio);
            
        } catch (error) {
            console.error('Audio initialization failed:', error);
        }
    }
    
    private async loadSound(name: string, url: string) {
        if (!this.audioContext) return;
        
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.sounds[name] = audioBuffer;
            
            // If it's background music, store it separately and start it
            if (name === 'background') {
                this.backgroundMusic = audioBuffer;
                this.playBackgroundMusic();
            }
            
            console.log(`Loaded sound: ${name}`);
        } catch (error) {
            console.error(`Error loading sound ${name}:`, error);
        }
    }
    
    private playSound(name: string, volume: number = 1.0) {
        if (!this.audioContext || !this.sounds[name]) return;
        
        try {
            const source = this.audioContext.createBufferSource();
            source.buffer = this.sounds[name];
            
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = volume;
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            source.start(0);
        } catch (error) {
            console.error(`Error playing sound ${name}:`, error);
        }
    }
    
    private playBackgroundMusic() {
        if (!this.audioContext || !this.backgroundMusic) return;
        
        try {
            // Stop any existing music
            if (this.musicSource) {
                this.musicSource.stop();
            }
            
            // Create a new source for the music
            this.musicSource = this.audioContext.createBufferSource();
            this.musicSource.buffer = this.backgroundMusic;
            this.musicSource.loop = true;
            
            // Create a gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.3; // Lower volume for background music
            
            // Connect and start
            this.musicSource.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            this.musicSource.start(0);
        } catch (error) {
            console.error('Error playing background music:', error);
        }
    }
    
    private async loadModels() {
        try {
            // Load token model
            const tokenGltf = await this.loadGLTFModel('/static/models/token.glb');
            this.tokenModel = tokenGltf.scene.children[0];
            
            // Load Jensen model
            const jensenGltf = await this.loadGLTFModel('/static/models/jensen.glb');
            this.jensenModel = jensenGltf.scene.children[0];
            
            // Load Cliby model with animations
            const clipyGltf = await this.loadGLTFModel('/static/models/cliby.glb');
            this.clipyModel = clipyGltf.scene;
            if (clipyGltf.animations && clipyGltf.animations.length > 0) {
                this.clipyAnimations = clipyGltf.animations;
                console.log('Loaded Cliby animations:', this.clipyAnimations.map(a => a.name).join(', '));
            }
            
            console.log('Models loaded successfully');
        } catch (error) {
            console.error('Error loading models:', error);
            // Use fallback geometries if models fail to load
            this.tokenModel = null;
            this.jensenModel = null;
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

    private initializeMaze() {
        // Create ground
        const groundGeometry = new THREE.PlaneGeometry(this.mazeSize, this.mazeSize);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 1.0,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.maze.add(ground);

        // Add ceiling
        const ceilingGeometry = new THREE.PlaneGeometry(this.mazeSize, this.mazeSize);
        const ceilingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 1.0,
            metalness: 0.0
        });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 3; // Ceiling height
        this.maze.add(ceiling);

        // Define wall material
        const wallMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x884400,
            roughness: 1.0,
            metalness: 0.0
        });
        
        // Define maze layout using a grid where 1 = wall, 0 = path
        // This creates a more interesting maze with multiple paths and wider corridors
        const mazeLayout = [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1],
            [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
            [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ];
        
        // Calculate wall positions based on maze layout
        const halfMazeSize = this.mazeSize / 2;
        
        // Create walls
        for (let row = 0; row < mazeLayout.length; row++) {
            for (let col = 0; col < mazeLayout[row].length; col++) {
                if (mazeLayout[row][col] === 1) {
                    // Create a wall cube with proper dimensions
                    const wallGeometry = new THREE.BoxGeometry(this.cellSize, 3, this.cellSize);
                    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                    
                    // Position relative to center of maze
                    const x = (col * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                    const z = (row * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                    wall.position.set(x, 1.5, z);
                    
                    this.walls.push(wall);
                    this.maze.add(wall);
                }
            }
        }

        this.scene.add(this.maze);
        
        // Set player starting position inside the maze in cell (1,1) - an open area
        // Calculate the correct world position based on cellSize and maze center offset
        const startCol = 1;
        const startRow = 1;
        this.player.position.set(
            (startCol * this.cellSize) - halfMazeSize + (this.cellSize / 2), // X coordinate
            1.5, // Y coordinate (eye level)
            (startRow * this.cellSize) - halfMazeSize + (this.cellSize / 2)  // Z coordinate
        );
        
        // Debug output
        console.log(`Player starting position: ${this.player.position.x}, ${this.player.position.y}, ${this.player.position.z}`);
        console.log(`Cell size: ${this.cellSize}, Half maze size: ${halfMazeSize}`);
        
        // Update camera to match player position
        this.camera.position.copy(this.player.position);
    }
    
    private setupTokenPositions() {
        // Define token positions throughout the maze (grid coordinates)
        this.tokenPositions = [
            // Row 1 - First open corridor
            [1, 0.7, 1], [2, 0.7, 1], [3, 0.7, 1], [4, 0.7, 1], 
            [5, 0.7, 1], [6, 0.7, 1], [7, 0.7, 1], [8, 0.7, 1], [9, 0.7, 1],
            
            // Row 3 - Corridor with gaps
            [3, 0.7, 3], [4, 0.7, 3], [5, 0.7, 3], [6, 0.7, 3], [7, 0.7, 3],
            
            // Row 4 - Middle area
            [1, 0.7, 4], [2, 0.7, 4], [3, 0.7, 4], [7, 0.7, 4], [8, 0.7, 4], [9, 0.7, 4],
            
            // Row 5-6 - Central corridors
            [1, 0.7, 5], [3, 0.7, 5], [7, 0.7, 5], [9, 0.7, 5],
            [1, 0.7, 6], [3, 0.7, 6], [7, 0.7, 6], [9, 0.7, 6],
            
            // Row 7 - Lower corridor
            [1, 0.7, 7], [3, 0.7, 7], [4, 0.7, 7], [5, 0.7, 7], 
            [6, 0.7, 7], [7, 0.7, 7], [9, 0.7, 7],
            
            // Row 9 - Bottom corridor
            [1, 0.7, 9], [2, 0.7, 9], [3, 0.7, 9], [4, 0.7, 9], 
            [5, 0.7, 9], [6, 0.7, 9], [7, 0.7, 9], [8, 0.7, 9], [9, 0.7, 9],
        ];
    }
    
    private setupMonsterPositions() {
        // Monster starting positions (grid coordinates)
        this.monsterPositions = [
            [9, 1.5, 1], // Top right
            [1, 1.5, 9], // Bottom left  
            [9, 1.5, 9]  // Bottom right
        ];
    }

    private initializeTokens() {
        const halfMazeSize = this.mazeSize / 2;
        
        // If we have the loaded model, use it, otherwise fallback to simple geometry
        if (this.tokenModel) {
            this.tokenPositions.forEach(pos => {
                // Clone the model for each token
                const token = this.tokenModel!.clone();
                
                // Calculate world position from grid coordinates
                const x = (pos[0] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                const y = pos[1]; // Height above floor
                const z = (pos[2] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                
                // Position and scale the token model appropriately
                token.position.set(x, y, z);
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
                const x = (pos[0] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                const y = pos[1]; // Height above floor
                const z = (pos[2] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                token.position.set(x, y, z);
                token.rotation.x = Math.PI / 2;
                this.tokens.push(token);
                this.scene.add(token);
            });
        }
    }

    private initializeMonsters() {
        const halfMazeSize = this.mazeSize / 2;
        
        // If we have the loaded Jensen model, use it, otherwise fallback to simple geometry
        if (this.jensenModel) {
            this.monsterPositions.forEach(pos => {
                // Clone the model for each monster
                const monster = this.jensenModel!.clone();
                
                // Calculate world position from grid coordinates
                const x = (pos[0] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                const y = pos[1]; // Height (eye level)
                const z = (pos[2] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                
                // Position and scale the Jensen model appropriately
                monster.position.set(x, y, z);
                monster.scale.set(1.5, 1.5, 1.5); // Adjust scale as needed
                
                // Store the monster in our array
                this.monsters.push({
                    mesh: monster,
                    position: new THREE.Vector3(x, y, z),
                    speed: 1.5, // A bit faster but still slower than player
                    target: this.player.position.clone(),
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
                const x = (pos[0] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                const y = pos[1]; // Height (eye level)
                const z = (pos[2] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
                monsterMesh.position.set(x, y, z);
                
                this.monsters.push({
                    mesh: monsterMesh,
                    position: new THREE.Vector3(x, y, z),
                    speed: 1.5, // A bit faster but still slower than player
                    target: this.player.position.clone(),
                    lastSoundTime: 0
                });
                
                this.scene.add(monsterMesh);
            });
        }
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private onKeyDown(event: KeyboardEvent) {
        this.keys.add(event.key.toLowerCase());
    }

    private onKeyUp(event: KeyboardEvent) {
        this.keys.delete(event.key.toLowerCase());
    }

    private updatePlayerMovement(deltaTime: number) {
        // Reset velocity
        this.player.velocity.set(0, 0, 0);
        
        // Handle rotation with A/D or left/right keys
        if (this.keys.has('a') || this.keys.has('arrowleft')) {
            this.player.rotation += this.player.rotationSpeed * deltaTime;
            this.onRotationUpdate(this.player.rotation);
        }
        if (this.keys.has('d') || this.keys.has('arrowright')) {
            this.player.rotation -= this.player.rotationSpeed * deltaTime;
            this.onRotationUpdate(this.player.rotation);
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
        const currentSpeed = this.isSprinting ? this.player.speed * 2.0 : this.player.speed;

        if (this.isSprinting) {
            console.log("Speed:", currentSpeed);
        }

        // Handle forward/backward movement with W/S or up/down keys
        if (this.keys.has('w') || this.keys.has('arrowup')) {
            this.player.velocity.z = -currentSpeed;
        }
        if (this.keys.has('s') || this.keys.has('arrowdown')) {
            this.player.velocity.z = currentSpeed;
        }

        // Apply rotation to movement direction (for first-person effect)
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.player.rotation);
        this.player.velocity.applyMatrix4(rotationMatrix);

        // Store old position for collision detection
        const oldPosition = this.player.position.clone();
        
        // Update player position
        this.player.position.add(this.player.velocity.clone().multiplyScalar(deltaTime));
        
        // Check for collisions
        if (this.checkWallCollision(this.player.position, this.playerRadius)) {
            this.player.position.copy(oldPosition);
        }

        // Update camera position and rotation to match player
        this.camera.position.copy(this.player.position);
        this.camera.rotation.set(0, this.player.rotation, 0);
    }

    private updateMonsters(deltaTime: number) {
        // Don't update if models aren't loaded yet
        if (!this.modelsLoaded) return;
        
        const currentTime = performance.now();
        
        // Update each monster's position to move toward the player
        for (const monster of this.monsters) {
            // Update target to current player position
            monster.target.copy(this.player.position);
            
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
            const distanceToPlayer = monster.position.distanceTo(this.player.position);
            
            // Play Jensen close sound when monster is within range (not too frequently)
            if (distanceToPlayer < 5 && currentTime - monster.lastSoundTime > 3000) {
                this.playSound('jensenClose', 0.4);
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
                if (this.checkWallCollision(monster.position, this.monsterRadius)) {
                    // If collision, try moving in just X or just Z direction
                    monster.position.copy(oldPosition);
                    
                    // Try X movement only
                    const xMovement = new THREE.Vector3(movement.x, 0, 0);
                    monster.position.add(xMovement);
                    
                    if (this.checkWallCollision(monster.position, this.monsterRadius)) {
                        // X movement failed, restore position and try Z movement
                        monster.position.copy(oldPosition);
                        
                        const zMovement = new THREE.Vector3(0, 0, movement.z);
                        monster.position.add(zMovement);
                        
                        // If Z movement also fails, monster is stuck this frame
                        if (this.checkWallCollision(monster.position, this.monsterRadius)) {
                            monster.position.copy(oldPosition);
                        }
                    }
                }
            }
            
            // Update mesh position
            monster.mesh.position.copy(monster.position);
            
            // Check for collision with player
            if (distanceToPlayer < (this.playerRadius + this.monsterRadius)) {
                // Monster caught player - reset player position to start
                this.handleMonsterCatch();
            }
        }
    }

    private handleMonsterCatch() {
        // Pause the game to prevent sound loop
        this.isPaused = true;
        
        // Play catch sound once
        this.playSound('jensenCatch', 0.7);
        
        // Notify the UI to show error dialog
        if (this.onPlayerCaught) {
            this.onPlayerCaught();
        }
        
        // Subtract points as penalty
        if (this.score >= 10) {
            this.score -= 10;
        } else {
            this.score = 0;
        }
        this.onScoreUpdate(this.score);
    }

    private checkWallCollision(position: THREE.Vector3, radius: number): boolean {
        // Check if a position + radius collides with any wall
        for (const wall of this.walls) {
            // Get wall dimensions and position
            const wallSize = new THREE.Vector3(this.cellSize, 3, this.cellSize); // BoxGeometry dimensions
            const wallMin = new THREE.Vector3(
                wall.position.x - wallSize.x/2,
                wall.position.y - wallSize.y/2,
                wall.position.z - wallSize.z/2
            );
            const wallMax = new THREE.Vector3(
                wall.position.x + wallSize.x/2,
                wall.position.y + wallSize.y/2,
                wall.position.z + wallSize.z/2
            );
            
            // Check if position + radius is colliding with this wall
            // Only check X and Z coordinates (horizontal plane)
            if (
                position.x + radius > wallMin.x &&
                position.x - radius < wallMax.x &&
                position.z + radius > wallMin.z &&
                position.z - radius < wallMax.z
            ) {
                return true;
            }
        }
        
        return false;
    }

    private checkTokenCollection() {
        // Don't check if models aren't loaded yet
        if (!this.modelsLoaded) return;
        
        for (let i = this.tokens.length - 1; i >= 0; i--) {
            const token = this.tokens[i];
            const tokenPosition = new THREE.Vector3();
            token.getWorldPosition(tokenPosition);
            const distance = this.player.position.distanceTo(tokenPosition);
            
            if (distance < 1.2) { // Slightly larger collection radius for 3D models
                // Remove the token from the scene
                this.scene.remove(token);
                this.tokens.splice(i, 1);
                
                // Play token collection sound (alternating between the two sounds)
                const soundName = this.lastTokenSound === 1 ? 'tokenAdded1' : 'tokenAdded2';
                this.playSound(soundName, 0.5);
                this.lastTokenSound = this.lastTokenSound === 1 ? 2 : 1;
                
                // Update score
                this.score += 10;
                this.onScoreUpdate(this.score);
                
                // Display message when all tokens are collected
                if (this.tokens.length === 0) {
                    // Play a victory sound
                    this.playSound('tokenAdded1', 1.0);
                    setTimeout(() => this.playSound('tokenAdded2', 1.0), 300);
                    
                    alert("Congratulations! You've collected all the tokens and escaped the Jensen clones!");
                }
            }
        }
    }
    
    private updateTokenRotations(deltaTime: number) {
        // Rotate the tokens for a cool effect (if using 3D models)
        if (this.tokenModel) {
            this.tokens.forEach(token => {
                token.rotation.y += deltaTime * 2; // Rotate around Y axis
            });
        }
    }

    public update() {
        // Skip updates if game is paused
        if (this.isPaused) {
            requestAnimationFrame(this.update.bind(this));
            return;
        }
        
        const deltaTime = this.clock.getDelta();
        
        this.updatePlayerMovement(deltaTime);
        this.updateMonsters(deltaTime);
        this.updateClipyEnemies(deltaTime);
        this.checkTokenCollection();
        this.updateTokenRotations(deltaTime);
        this.checkStageProgression();
        this.updateClibyPhase();
        
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.update.bind(this));
    }

    public start() {
        this.clock.start();
        this.update();
    }

    // Add a resetGame method to Game class
    public resetGame(fullReset: boolean = false) {
        // Immediately end Cliby phase if active (do this first regardless of fullReset)
        if (this.clibyPhaseActive) {
            this.clibyPhaseActive = false;
            this.clibyPhaseTimer = 84;
            
            // Switch back to normal music if we're in Cliby phase
            this.switchBackgroundMusic('background');
            
            // Notify UI that phase has ended
            if (this.onClibyPhaseUpdate) {
                this.onClibyPhaseUpdate(false, 0);
            }
        }
        
        // Reset player position to start
        const halfMazeSize = this.mazeSize / 2;
        const startCol = 1;
        const startRow = 1;
        this.player.position.set(
            (startCol * this.cellSize) - halfMazeSize + (this.cellSize / 2),
            1.5,
            (startRow * this.cellSize) - halfMazeSize + (this.cellSize / 2)
        );
        
        // Reset player rotation to original direction
        this.player.rotation = Math.PI;
        this.onRotationUpdate(this.player.rotation);
        
        // Reset monsters to their starting positions
        this.monsters.forEach((monster, index) => {
            const pos = this.monsterPositions[index % this.monsterPositions.length];
            const x = (pos[0] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
            const y = pos[1];
            const z = (pos[2] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
            
            // Reset position
            monster.position.set(x, y, z);
            monster.mesh.position.set(x, y, z);
            
            // Reset target
            monster.target.copy(this.player.position);
        });
        
        // For full reset, also reset score and other game state
        if (fullReset) {
            // Reset score
            this.score = 0;
            this.onScoreUpdate(this.score);
            
            // Reset stage
            this.stage = 1;
            if (this.onStageUpdate) {
                this.onStageUpdate(this.stage);
            }
            
            // Reset sprint capability
            this.sprintAvailable = false;
            this.sprintEnergy = 100;
            
            // Remove Cliby enemies if they exist
            if (this.clibies.length > 0) {
                this.clibies.forEach(clipy => {
                    if (clipy.mesh) {
                        this.scene.remove(clipy.mesh);
                    }
                });
                this.clibies = [];
            }
            
            // If all tokens were collected, we would need to recreate them
            if (this.tokens.length === 0) {
                // Remove existing tokens just in case
                this.tokens.forEach(token => this.scene.remove(token));
                this.tokens = [];
                
                // Reinitialize tokens
                this.initializeTokens();
            }
            
            // End Cliby phase if active
            if (this.clibyPhaseActive) {
                this.endClibyPhase();
            }
        }
        
        // Update camera
        this.camera.position.copy(this.player.position);
        this.camera.rotation.set(0, this.player.rotation, 0);
        
        // Resume the game
        this.isPaused = false;
    }

    // Add methods to pause and resume the game
    public pauseGame() {
        this.isPaused = true;
    }

    public resumeGame() {
        this.isPaused = false;
    }

    // Add a method to apply difficulty settings
    private applyDifficultySettings() {
        switch (this.difficulty) {
            case "Easy":
                // Slower monsters, faster player
                this.monsters.forEach(monster => {
                    monster.speed = 1.0;
                });
                this.player.speed = 4.0;
                break;
                
            case "Normal":
                // Default settings
                this.monsters.forEach(monster => {
                    monster.speed = 1.5;
                });
                this.player.speed = 3.0;
                break;
                
            case "Hard":
                // Faster monsters
                this.monsters.forEach(monster => {
                    monster.speed = 2.5;
                });
                this.player.speed = 3.0;
                break;
                
            case "Impossible":
                // Truly impossible mode
                this.setupImpossibleMode();
                break;
        }
    }

    // Add a method for the impossible mode setup
    private setupImpossibleMode() {
        // Super fast monsters that can pass through walls
        this.monsters.forEach(monster => {
            monster.speed = 10.0;
        });
        
        // Regular player speed
        this.player.speed = 3.0;
        
        // Set a timeout to trigger game over
        setTimeout(() => {
            if (this.impossibleMode && this.onPlayerCaught) {
                this.onPlayerCaught();
                
                // Ensure all monsters are right on top of player
                this.monsters.forEach(monster => {
                    monster.position.copy(this.player.position);
                    monster.mesh.position.copy(this.player.position);
                });
            }
        }, 3000 + Math.random() * 5000); // Random between 3-8 seconds
    }

    // Add a method to toggle game pause state
    public togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }

    // Add getter for pause state
    public isPauseActive(): boolean {
        return this.isPaused;
    }

    // Add a method to check and update game stage
    private checkStageProgression() {
        // Progress to the next stage based on score
        const newStage = Math.floor(this.score / 50) + 1;
        
        if (newStage > this.stage) {
            this.stage = newStage;
            
            // Handle stage-specific events
            this.handleStageChange();
            
            // Notify UI of stage change
            if (this.onStageUpdate) {
                this.onStageUpdate(this.stage);
            }
        }
    }

    // Add a method to handle stage-specific changes
    private handleStageChange() {
        console.log(`Advancing to stage ${this.stage}`);
        
        // Check for stage 2 - spawn Clippy enemies and enable sprint
        if (this.stage === 2) {
            this.startClibyPhase();
        }
    }

    // Add methods for the Clippy enemies
    private initializeClipyEnemies() {
        if (!this.clipyModel) return;
        
        const halfMazeSize = this.mazeSize / 2;
        
        // Define Clippy spawn positions - use known empty locations in the maze
        const clipyPositions = [
            [2, 1.5, 2], // Top left corridor
            [8, 1.5, 2], // Top right corridor
            [5, 1.5, 5]  // Center of the maze
        ];
        
        clipyPositions.forEach(pos => {
            // Clone the model
            const clipyMesh = this.clipyModel!.clone();
            
            // Calculate world position
            const x = (pos[0] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
            const y = pos[1]; // Height
            const z = (pos[2] * this.cellSize) - halfMazeSize + (this.cellSize / 2);
            
            clipyMesh.position.set(x, y, z);
            clipyMesh.scale.set(1.0, 1.0, 1.0); // Make them smaller so they fit in corridors
            
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
                position: new THREE.Vector3(x, y, z),
                speed: 2.5, // Faster than normal monsters
                target: this.player.position.clone(),
                lastSoundTime: 0,
                mixer: mixer,
                animations: animations,
                isGlitching: true
            });
            
            this.scene.add(clipyMesh);
        });
        
        console.log(`Added ${this.clibies.length} Clipy enemies at positions:`, clipyPositions);
    }

    // Add a method to update Clippy enemies
    private updateClipyEnemies(deltaTime: number) {
        // Skip if not at the right stage or models not loaded
        if (this.stage < 2 || !this.modelsLoaded || this.clibies.length === 0) return;
        
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
            clipy.target.copy(this.player.position);
            
            // Calculate direction to player
            const direction = new THREE.Vector3()
                .subVectors(clipy.target, clipy.position)
                .normalize();
                
            // Make the model look toward the player
            const targetAngle = Math.atan2(direction.x, direction.z);
            clipy.mesh.rotation.y = targetAngle;
            
            // Calculate distance to player
            const distanceToPlayer = clipy.position.distanceTo(this.player.position);
            
            // Play close sound when clipy is within range (not too frequently)
            if (distanceToPlayer < 8 && currentTime - clipy.lastSoundTime > 2000) {
                this.playSound('jensenClose', 0.6);
                clipy.lastSoundTime = currentTime;
            }
            
            // Calculate movement this frame
            const movement = direction.multiplyScalar(clipy.speed * deltaTime);
            
            // Store old position for collision detection
            const oldPosition = clipy.position.clone();
            
            // Update clipy position
            clipy.position.add(movement);
            
            // Check for wall collisions (Clippy moves through walls occasionally)
            if (Math.random() > 0.2 && this.checkWallCollision(clipy.position, this.monsterRadius)) {
                // 80% chance to collide with walls
                clipy.position.copy(oldPosition);
            }
            
            // Update mesh position
            clipy.mesh.position.copy(clipy.position);
            
            // Check for collision with player
            if (distanceToPlayer < (this.playerRadius + this.monsterRadius)) {
                // Clipy caught player - handle catch event
                this.handleMonsterCatch();
            }
        }
    }

    // Add sprint capabilities
    private enablePlayerSprint() {
        this.sprintAvailable = true;
        this.sprintEnergy = 100;
        console.log("Sprint capability enabled!");
    }

    // Add a getter for sprint information
    public getSprintInfo(): { available: boolean, energy: number } {
        return {
            available: this.sprintAvailable,
            energy: this.sprintEnergy
        };
    }

    // Add a getter for current stage
    public getCurrentStage(): number {
        return this.stage;
    }

    // Add a method to start the Cliby challenge phase
    private startClibyPhase() {
        // Initialize Cliby enemies
        this.initializeClipyEnemies();
        
        // Enable sprint capability
        this.enablePlayerSprint();
        
        // Set the phase active
        this.clibyPhaseActive = true;
        this.clibyPhaseTimer = 84; // 1:24 in seconds
        this.clibyPhaseStartTime = performance.now();
        
        // Switch to Cliby background music
        this.switchBackgroundMusic('clibyBackground');
        
        // Play a special sound for the phase start
        this.playSound('jensenClose', 1.0);
        
        // Notify UI of phase start
        if (this.onClibyPhaseUpdate) {
            this.onClibyPhaseUpdate(true, this.clibyPhaseTimer);
        }
        
        console.log("Cliby phase started! Survive for 1:24!");
    }

    // Add a method to end the Cliby challenge phase
    private endClibyPhase() {
        // Only proceed if we're currently in Cliby phase
        if (!this.clibyPhaseActive) return;
        
        // Set the phase inactive
        this.clibyPhaseActive = false;
        
        // Remove Cliby enemies
        this.clibies.forEach(clipy => {
            if (clipy.mesh) {
                this.scene.remove(clipy.mesh);
            }
        });
        this.clibies = [];
        
        // Switch back to normal background music
        this.switchBackgroundMusic('background');
        
        // Bonus reward for surviving
        this.score += 50;
        this.onScoreUpdate(this.score);
        
        // Play a victory sound
        this.playSound('tokenAdded1', 1.0);
        setTimeout(() => this.playSound('tokenAdded2', 1.0), 300);
        
        // Notify UI of phase end
        if (this.onClibyPhaseUpdate) {
            this.onClibyPhaseUpdate(false, 0);
        }
        
        console.log("Cliby phase complete! You survived!");
    }

    // Add a method to switch background music
    private switchBackgroundMusic(musicName: string) {
        if (!this.audioContext || !this.sounds[musicName]) return;
        
        try {
            // Stop any existing music
            if (this.musicSource) {
                this.musicSource.stop();
            }
            
            // Create a new source for the music
            this.musicSource = this.audioContext.createBufferSource();
            this.musicSource.buffer = this.sounds[musicName];
            
            // Only loop the main background, not the Cliby music (which has a natural end)
            this.musicSource.loop = musicName === 'background';
            
            // Create a gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.3; // Lower volume for background music
            
            // Store gain node for later volume adjustments
            this.musicSource.gainNode = gainNode;
            
            // Connect and start
            this.musicSource.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            this.musicSource.start(0);
            
            console.log(`Switched to ${musicName} music`);
            
            // If this is the Cliby music and not looping, set up a callback for when it ends
            if (musicName === 'clibyBackground' && !this.musicSource.loop) {
                this.musicSource.onended = () => {
                    // When Cliby music naturally ends, end the phase if not already ended
                    if (this.clibyPhaseActive) {
                        this.endClibyPhase();
                    }
                };
            }
        } catch (error) {
            console.error(`Error switching to ${musicName} music:`, error);
        }
    }

    // Add a method to update the Cliby phase timer
    private updateClibyPhase() {
        // Skip if phase is not active
        if (!this.clibyPhaseActive) return;
        
        // Calculate remaining time
        const elapsedTime = (performance.now() - this.clibyPhaseStartTime) / 1000;
        const remainingTime = Math.max(0, this.clibyPhaseTimer - elapsedTime);
        
        // Update UI with remaining time
        if (this.onClibyPhaseUpdate) {
            this.onClibyPhaseUpdate(true, remainingTime);
        }
        
        // Check if time is up
        if (remainingTime <= 0) {
            this.endClibyPhase();
        }
    }

    // Add a getter for Cliby phase information
    public getClibyPhaseInfo(): { active: boolean, timeRemaining: number } {
        if (!this.clibyPhaseActive) {
            return { active: false, timeRemaining: 0 };
        }
        
        const elapsedTime = (performance.now() - this.clibyPhaseStartTime) / 1000;
        const remainingTime = Math.max(0, this.clibyPhaseTimer - elapsedTime);
        
        return {
            active: this.clibyPhaseActive,
            timeRemaining: remainingTime
        };
    }
} 