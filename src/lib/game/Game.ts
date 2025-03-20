import * as THREE from 'three';

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
    private tokens: THREE.Mesh[] = [];
    private monsters: {
        mesh: THREE.Mesh;
        position: THREE.Vector3;
        speed: number;
        target: THREE.Vector3;
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

    constructor(
        container: HTMLElement, 
        onScoreUpdate: (score: number) => void,
        onRotationUpdate: (rotation: number) => void
    ) {
        this.onScoreUpdate = onScoreUpdate;
        this.onRotationUpdate = onRotationUpdate;
        this.clock = new THREE.Clock();
        
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

        // Initialize game objects
        this.initializeMaze();
        this.initializeTokens();
        this.initializeMonsters();

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Add keyboard event listeners
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Initial rotation update
        this.onRotationUpdate(this.player.rotation);
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

    private initializeTokens() {
        const tokenGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 8); // Less segments for retro look
        const tokenMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            emissive: 0x777700, // Glow effect
            roughness: 0.3,
            metalness: 0.7
        });

        // Define token positions throughout the maze (grid coordinates)
        const tokenPositions = [
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

        const halfMazeSize = this.mazeSize / 2;
        tokenPositions.forEach(pos => {
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

    private initializeMonsters() {
        // Create monsters that will chase the player
        const monsterGeometry = new THREE.SphereGeometry(0.5, 8, 8); // Low poly for retro look
        const monsterMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            emissive: 0x330000, // Slight glow
            roughness: 0.7,
            metalness: 0.3
        });
        
        // Monster starting positions (grid coordinates)
        const monsterPositions = [
            [9, 1.5, 1], // Top right
            [1, 1.5, 9], // Bottom left  
            [9, 1.5, 9]  // Bottom right
        ];
        
        const halfMazeSize = this.mazeSize / 2;
        monsterPositions.forEach(pos => {
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
                target: this.player.position.clone()
            });
            
            this.scene.add(monsterMesh);
        });
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

        // Handle forward/backward movement with W/S or up/down keys
        if (this.keys.has('w') || this.keys.has('arrowup')) {
            this.player.velocity.z = -this.player.speed;
        }
        if (this.keys.has('s') || this.keys.has('arrowdown')) {
            this.player.velocity.z = this.player.speed;
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
        // Update each monster's position to move toward the player
        for (const monster of this.monsters) {
            // Update target to current player position
            monster.target.copy(this.player.position);
            
            // Calculate direction to player
            const direction = new THREE.Vector3()
                .subVectors(monster.target, monster.position)
                .normalize();
            
            // Calculate movement this frame
            const movement = direction.multiplyScalar(monster.speed * deltaTime);
            
            // Store old position for collision detection
            const oldPosition = monster.position.clone();
            
            // Update monster position
            monster.position.add(movement);
            
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
            
            // Update mesh position
            monster.mesh.position.copy(monster.position);
            
            // Check for collision with player
            const distanceToPlayer = monster.position.distanceTo(this.player.position);
            if (distanceToPlayer < (this.playerRadius + this.monsterRadius)) {
                // Monster caught player - reset player position to start
                this.handleMonsterCatch();
            }
        }
    }

    private handleMonsterCatch() {
        // Reset player position to starting point when caught
        const halfMazeSize = this.mazeSize / 2;
        const startCol = 1;
        const startRow = 1;
        this.player.position.set(
            (startCol * this.cellSize) - halfMazeSize + (this.cellSize / 2),
            1.5,
            (startRow * this.cellSize) - halfMazeSize + (this.cellSize / 2)
        );
        
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
        for (let i = this.tokens.length - 1; i >= 0; i--) {
            const token = this.tokens[i];
            const distance = this.player.position.distanceTo(token.position);
            
            if (distance < 0.8) {
                this.scene.remove(token);
                this.tokens.splice(i, 1);
                this.score += 10;
                this.onScoreUpdate(this.score);
                
                // Display message when all tokens are collected
                if (this.tokens.length === 0) {
                    alert("Congratulations! You've collected all the tokens!");
                }
            }
        }
    }

    public update() {
        const deltaTime = this.clock.getDelta();
        
        this.updatePlayerMovement(deltaTime);
        this.updateMonsters(deltaTime);
        this.checkTokenCollection();
        
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.update.bind(this));
    }

    public start() {
        this.clock.start();
        this.update();
    }
} 