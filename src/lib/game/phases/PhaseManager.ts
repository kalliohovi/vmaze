import { AudioManager } from '../audio/AudioManager';

export interface PhaseCallbacks {
    onScoreUpdate: (score: number) => void;
    onStageUpdate?: (stage: number) => void;
    onSurvivalPhaseUpdate?: (active: boolean, timeRemaining: number) => void;
}

export class PhaseManager {
    private score: number = 0;
    private stage: number = 1;
    private callbacks: PhaseCallbacks;
    private audioManager: AudioManager;
    private maxScore: number = 420; // 42 tokens * 10 points
    
    // Survival phase properties
    private survivalPhaseActive: boolean = false;
    private survivalPhaseTimer: number = 84; // 1:24 in seconds
    private survivalPhaseStartTime: number = 0;
    private endingSurvivalPhase: boolean = false;
    
    constructor(callbacks: PhaseCallbacks, audioManager: AudioManager) {
        this.callbacks = callbacks;
        this.audioManager = audioManager;
    }
    
    public addPoints(points: number): void {
        // Update score ensuring it doesn't exceed maximum (42 tokens * 10 points)
        this.score = Math.min(this.maxScore, this.score + points);
        this.callbacks.onScoreUpdate(this.score);
        this.checkStageProgression();
    }
    
    public subtractPoints(points: number): void {
        this.score = Math.max(0, this.score - points);
        this.callbacks.onScoreUpdate(this.score);
    }
    
    public getScore(): number {
        return this.score;
    }
    
    public setScore(newScore: number): void {
        this.score = Math.min(this.maxScore, newScore);
        this.callbacks.onScoreUpdate(this.score);
    }
    
    public getMaxScore(): number {
        return this.maxScore;
    }
    
    public getStage(): number {
        return this.stage;
    }
    
    private checkStageProgression(): void {
        // Progress to the next stage based on score
        const newStage = Math.floor(this.score / 50) + 1;
        
        if (newStage > this.stage) {
            this.stage = newStage;
            
            // Handle stage-specific events
            this.handleStageChange();
            
            // Notify UI of stage change
            if (this.callbacks.onStageUpdate) {
                this.callbacks.onStageUpdate(this.stage);
            }
        }
    }
    
    private handleStageChange(): void {
        console.log(`Advancing to stage ${this.stage}`);
        
        // Check for stage 2 - start Survival phase
        if (this.stage === 2) {
            this.startSurvivalPhase();
        }
    }
    
    // Survival phase methods
    public startSurvivalPhase(): void {
        // Prevent starting if already active
        if (this.survivalPhaseActive) return;
        
        // Set the phase active
        this.survivalPhaseActive = true;
        this.survivalPhaseTimer = 84; // 1:24 in seconds
        this.survivalPhaseStartTime = performance.now();
        
        // Switch to Survival background music with end callback
        this.audioManager.playBackgroundMusic('clibyBackground', () => {
            // When music naturally ends, end the phase if not already ended
            if (this.survivalPhaseActive && !this.endingSurvivalPhase) {
                console.log("DEBUG: Music ended naturally, ending Survival phase");
                this.endSurvivalPhase();
            }
        });
        
        // Play a special sound for the phase start
        this.audioManager.playSound('jensenClose', 1.0);
        
        // Notify UI of phase start
        if (this.callbacks.onSurvivalPhaseUpdate) {
            this.callbacks.onSurvivalPhaseUpdate(true, this.survivalPhaseTimer);
        }
        
        console.log("Survival phase started! Survive for 1:24!");
    }
    
    public endSurvivalPhase(): void {
        // Only proceed if we're currently in Survival phase and not already ending it
        if (!this.survivalPhaseActive || this.endingSurvivalPhase) return;
        
        // Set flag to prevent multiple calls
        this.endingSurvivalPhase = true;
        
        console.log("DEBUG: endSurvivalPhase called, score before bonus:", this.score);
        
        // Set the phase inactive
        this.survivalPhaseActive = false;
        
        // Switch back to normal background music
        this.audioManager.playBackgroundMusic('background');
        
        // Bonus reward for surviving - ensure it's only applied once and doesn't exceed max
        const newScore = Math.min(this.maxScore, this.score + 50);
        const actualBonus = newScore - this.score;
        this.score = newScore;
        
        console.log(`DEBUG: Added ${actualBonus} point bonus, new score: ${this.score}`);
        this.callbacks.onScoreUpdate(this.score);
        
        // Play a victory sound
        this.audioManager.playSound('tokenAdded1', 1.0);
        setTimeout(() => this.audioManager.playSound('tokenAdded2', 1.0), 300);
        
        // Notify UI of phase end
        if (this.callbacks.onSurvivalPhaseUpdate) {
            this.callbacks.onSurvivalPhaseUpdate(false, 0);
        }
        
        console.log("Survival phase complete! You survived!");
        
        // Reset the flag after a short delay to ensure we don't have race conditions
        setTimeout(() => {
            this.endingSurvivalPhase = false;
        }, 500);
    }
    
    public updateSurvivalPhase(): void {
        // Skip if phase is not active
        if (!this.survivalPhaseActive) return;
        
        // Calculate remaining time
        const elapsedTime = (performance.now() - this.survivalPhaseStartTime) / 1000;
        const remainingTime = Math.max(0, this.survivalPhaseTimer - elapsedTime);
        
        // Add debug logging for last few seconds
        if (remainingTime < 5) {
            console.log(`DEBUG: Survival phase ending in ${remainingTime.toFixed(1)} seconds`);
        }
        
        // Update UI with remaining time
        if (this.callbacks.onSurvivalPhaseUpdate) {
            this.callbacks.onSurvivalPhaseUpdate(true, remainingTime);
        }
        
        // Check if time is up
        if (remainingTime <= 0) {
            console.log("DEBUG: Survival phase timer reached zero, ending phase");
            this.endSurvivalPhase();
        }
    }
    
    public isSurvivalPhaseActive(): boolean {
        return this.survivalPhaseActive;
    }
    
    public getSurvivalPhaseInfo(): { active: boolean, timeRemaining: number } {
        if (!this.survivalPhaseActive) {
            return { active: false, timeRemaining: 0 };
        }
        
        const elapsedTime = (performance.now() - this.survivalPhaseStartTime) / 1000;
        const remainingTime = Math.max(0, this.survivalPhaseTimer - elapsedTime);
        
        return {
            active: this.survivalPhaseActive,
            timeRemaining: remainingTime
        };
    }
    
    public resetScore(): void {
        // Set score to 0
        this.score = 0;
        
        // Make sure to notify listeners about the score change
        this.callbacks.onScoreUpdate(this.score);
        
        console.log("Score reset to 0");
    }
    
    public resetStage(): void {
        this.stage = 1;
        if (this.callbacks.onStageUpdate) {
            this.callbacks.onStageUpdate(this.stage);
        }
    }
    
    public reset(): void {
        console.log("PhaseManager reset called - forcing score to 0");
        this.resetScore();
        this.resetStage();
        
        // End Survival phase if active
        if (this.survivalPhaseActive) {
            this.endSurvivalPhase();
        }
    }
} 