interface ExtendedAudioBufferSourceNode extends AudioBufferSourceNode {
    gainNode?: GainNode;
}

export class AudioManager {
    private audioContext: AudioContext | null = null;
    private sounds: { [key: string]: AudioBuffer } = {};
    private musicSource: ExtendedAudioBufferSourceNode | null = null;
    private onMusicEndCallbacks: { [key: string]: () => void } = {};
    private setupAudioBound: () => void;
    
    constructor() {
        // Bind the setupAudio method so we can remove it later
        this.setupAudioBound = this.setupAudio.bind(this);
        this.initAudio();
    }
    
    public async initAudio(): Promise<void> {
        try {
            // Add event listeners to initialize audio on first user interaction
            window.addEventListener('click', this.setupAudioBound);
            window.addEventListener('keydown', this.setupAudioBound);
            
        } catch (error) {
            console.error('Audio initialization failed:', error);
        }
    }
    
    private setupAudio(): void {
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
            window.removeEventListener('click', this.setupAudioBound);
            window.removeEventListener('keydown', this.setupAudioBound);
        }
    }
    
    public async loadSound(name: string, url: string): Promise<void> {
        if (!this.audioContext) return;
        
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            this.sounds[name] = audioBuffer;
            
            // If it's background music, store it separately and start it
            if (name === 'background') {
                this.playBackgroundMusic('background');
            }
            
            console.log(`Loaded sound: ${name}`);
        } catch (error) {
            console.error(`Error loading sound ${name}:`, error);
        }
    }
    
    public playSound(name: string, volume: number = 1.0): void {
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
    
    public playBackgroundMusic(musicName: string, onEnd?: () => void): void {
        if (!this.audioContext || !this.sounds[musicName]) return;
        
        try {
            // Stop any existing music
            if (this.musicSource) {
                // Remove any existing onended callback
                this.musicSource.onended = null;
                this.musicSource.stop();
            }
            
            // Create a new source for the music
            this.musicSource = this.audioContext.createBufferSource();
            this.musicSource.buffer = this.sounds[musicName];
            this.musicSource.loop = musicName === 'background'; // Only loop main background
            
            // Create a gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.3; // Lower volume for background music
            
            // Connect and start
            this.musicSource.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            this.musicSource.gainNode = gainNode;
            this.musicSource.start(0);
            
            console.log(`Playing ${musicName} music`);
            
            // Set up the onended callback if provided
            if (onEnd && !this.musicSource.loop) {
                this.musicSource.onended = onEnd;
                // Store reference to the callback
                this.onMusicEndCallbacks[musicName] = onEnd;
            }
        } catch (error) {
            console.error(`Error playing background music ${musicName}:`, error);
        }
    }
    
    public stopMusic(): void {
        if (this.musicSource) {
            try {
                this.musicSource.stop();
                this.musicSource = null;
            } catch (error) {
                console.error('Error stopping music:', error);
            }
        }
    }
    
    public setMusicVolume(volume: number): void {
        if (this.musicSource && this.musicSource.gainNode) {
            this.musicSource.gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }
    
    public isReady(): boolean {
        return this.audioContext !== null;
    }
    
    public dispose(): void {
        // Stop any playing music
        this.stopMusic();
        
        // Close the audio context
        if (this.audioContext) {
            // Remove event listeners that might have been set up
            window.removeEventListener('click', this.setupAudioBound);
            window.removeEventListener('keydown', this.setupAudioBound);
            
            // Close the audio context
            this.audioContext.close().catch(console.error);
            this.audioContext = null;
        }
        
        // Clear sounds dictionary
        this.sounds = {};
        this.musicSource = null;
        this.onMusicEndCallbacks = {};
    }
} 