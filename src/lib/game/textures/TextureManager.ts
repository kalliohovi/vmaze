import * as THREE from 'three';

export interface TextureCoords {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ThemeConfig {
    wall: TextureCoords;
    floor: TextureCoords;
    ceiling?: TextureCoords;
    // Add more elements as needed
}

export class TextureManager {
    private textureAtlas: THREE.Texture;
    private themes: Map<string, ThemeConfig> = new Map();
    private currentTheme: string = 'default';
    
    constructor() {
        // Load the texture atlas
        const loader = new THREE.TextureLoader();
        this.textureAtlas = loader.load('/static/textures/server_texture.png');
        this.textureAtlas.magFilter = THREE.NearestFilter; // For pixelated look
        
        // Define regions in your texture atlas
        this.setupThemes();
    }
    
    private setupThemes() {
        // Basic theme
        this.themes.set('default', {
            wall: { x: 0, y: 0, width: 16, height: 16 },
            floor: { x: 16, y: 0, width: 16, height: 16 }
        });
        
        // Cliby phase theme
        this.themes.set('cliby', {
            wall: { x: 32, y: 0, width: 16, height: 16 },
            floor: { x: 48, y: 0, width: 16, height: 16 }
        });
        
        // Add more themes as needed
    }
    
    public createMaterial(element: 'wall' | 'floor' | 'ceiling'): THREE.MeshStandardMaterial {
        const theme = this.themes.get(this.currentTheme) || this.themes.get('default');
        const coords = theme?.[element];
        
        if (!coords) {
            // Fallback if texture coords not defined
            return new THREE.MeshStandardMaterial({ 
                color: element === 'wall' ? 0x884400 : 0x333333,
                roughness: 1.0,
                metalness: 0.0
            });
        }
        
        // Create a cloned texture with specific UV mapping
        const texture = this.textureAtlas.clone();
        texture.repeat.set(coords.width / 64, coords.height / 64);
        texture.offset.set(coords.x / 64, coords.y / 64);
        
        return new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.9,
            metalness: 0.1
        });
    }
    
    public setTheme(themeName: string): boolean {
        if (this.themes.has(themeName)) {
            this.currentTheme = themeName;
            return true;
        }
        return false;
    }
    
    public getCurrentTheme(): string {
        return this.currentTheme;
    }
}
