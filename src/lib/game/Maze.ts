import * as THREE from 'three';
import { TextureManager } from './textures/TextureManager';

export class Maze {
    private maze: THREE.Group = new THREE.Group();
    private walls: THREE.Mesh[] = [];
    private mazeSize: number = 35;
    private cellSize: number = 3.5;
    private wallThickness: number = 0.5;
    private textureManager: TextureManager;
    
    constructor(scene: THREE.Scene, textureManager?: TextureManager) {
        this.textureManager = textureManager || new TextureManager();
        this.initializeMaze();
        scene.add(this.maze);
    }
    
    private initializeMaze(): void {
        // Create ground with textured material
        const groundGeometry = new THREE.PlaneGeometry(this.mazeSize, this.mazeSize);
        const groundMaterial = this.textureManager.createMaterial('floor');
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.maze.add(ground);
        
        // Add ceiling with textured material
        const ceilingGeometry = new THREE.PlaneGeometry(this.mazeSize, this.mazeSize);
        const ceilingMaterial = this.textureManager.createMaterial('ceiling');
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 3; // Ceiling height
        this.maze.add(ceiling);
        
        // Define wall material from texture manager
        const wallMaterial = this.textureManager.createMaterial('wall');
        
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
    }
    
    public checkWallCollision(position: THREE.Vector3, radius: number): boolean {
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
    
    public getStartingPosition(): THREE.Vector3 {
        // Player starting position inside the maze in cell (1,1) - an open area
        const halfMazeSize = this.mazeSize / 2;
        const startCol = 1;
        const startRow = 1;
        
        return new THREE.Vector3(
            (startCol * this.cellSize) - halfMazeSize + (this.cellSize / 2), // X coordinate
            1.5, // Y coordinate (eye level)
            (startRow * this.cellSize) - halfMazeSize + (this.cellSize / 2)  // Z coordinate
        );
    }
    
    public getWorldPositionFromGridCoordinates(gridX: number, gridY: number, height: number = 1.5): THREE.Vector3 {
        const halfMazeSize = this.mazeSize / 2;
        return new THREE.Vector3(
            (gridX * this.cellSize) - halfMazeSize + (this.cellSize / 2),
            height,
            (gridY * this.cellSize) - halfMazeSize + (this.cellSize / 2)
        );
    }
    
    public getMazeSize(): number {
        return this.mazeSize;
    }
    
    public getCellSize(): number {
        return this.cellSize;
    }
    
    // Add method to update theme/textures
    public updateTheme(themeName: string): void {
        if (this.textureManager.setTheme(themeName)) {
            // Rebuild maze with new textures or update existing materials
            this.updateMaterials();
        }
    }
    
    private updateMaterials(): void {
        // Update all wall materials
        this.walls.forEach(wall => {
            wall.material = this.textureManager.createMaterial('wall');
        });
        
        // Update floor
        const floor = this.maze.children.find(child => child.name === 'floor');
        if (floor && floor instanceof THREE.Mesh) {
            floor.material = this.textureManager.createMaterial('floor');
        }
        
        // Update ceiling
        const ceiling = this.maze.children.find(child => child.name === 'ceiling');
        if (ceiling && ceiling instanceof THREE.Mesh) {
            ceiling.material = this.textureManager.createMaterial('ceiling');
        }
    }
} 