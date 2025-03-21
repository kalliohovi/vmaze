export class UIManager {
    private scoreElement: HTMLElement | null;
    private tokenCountElement: HTMLElement | null;
    private stageElement: HTMLElement | null;
    private survivalPhaseTimerElement: HTMLElement | null;
    private sprintBarElement: HTMLElement | null;
    
    constructor(options: { 
        createScoreElement?: boolean,
        createTokenElement?: boolean,
        createStageElement?: boolean,
        createTimerElement?: boolean,
        createSprintElement?: boolean
    } = {}) {
        // Remove any existing UI elements that might have been created elsewhere
        this.cleanupExistingElements();
        
        // Find or create UI elements based on options
        this.initializeUIElements(options);
    }
    
    private cleanupExistingElements(): void {
        // Remove any previous score displays or overlays
        const existingElements = [
            document.getElementById('score'),
            document.getElementById('token-count'),
            document.getElementById('stage'),
            document.getElementById('survival-phase-timer'),
            document.getElementById('sprint-bar'),
            document.getElementById('game-overlay'),
            document.getElementById('error-overlay')
        ];
        
        existingElements.forEach(element => {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // Also look for any other overlay elements that might be present
        const overlays = document.querySelectorAll('.game-overlay');
        overlays.forEach(overlay => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });
    }
    
    private initializeUIElements(options: {
        createScoreElement?: boolean,
        createTokenElement?: boolean,
        createStageElement?: boolean,
        createTimerElement?: boolean,
        createSprintElement?: boolean
    }): void {
        // Use defaults if options not specified
        const opts = {
            createScoreElement: false,
            createTokenElement: false,
            createStageElement: false,
            createTimerElement: true,
            createSprintElement: true,
            ...options
        };
        
        // Only create elements if requested
        if (opts.createScoreElement) {
            this.scoreElement = this.createUIElement('score', 'Score: 0');
        }
        
        if (opts.createTokenElement) {
            this.tokenCountElement = this.createUIElement('token-count', 'Tokens: 0/42');
        }
        
        if (opts.createStageElement) {
            this.stageElement = this.createUIElement('stage', 'Stage: 1');
        }
        
        if (opts.createTimerElement) {
            this.survivalPhaseTimerElement = this.createUIElement('survival-phase-timer', '', 'none');
        }
        
        if (opts.createSprintElement) {
            this.sprintBarElement = this.createUIElement('sprint-bar', '', 'none');
            this.styleSprintBar();
        }
    }
    
    private createUIElement(id: string, text: string, display: string = 'block'): HTMLElement {
        const element = document.createElement('div');
        element.id = id;
        element.textContent = text;
        element.style.position = 'absolute';
        element.style.color = 'white';
        element.style.fontFamily = 'monospace';
        element.style.fontSize = '16px';
        element.style.padding = '10px';
        element.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        element.style.borderRadius = '5px';
        element.style.display = display;
        
        // Position based on element type
        switch (id) {
            case 'score':
                element.style.top = '10px';
                element.style.left = '10px';
                break;
            case 'token-count':
                element.style.top = '40px';
                element.style.left = '10px';
                break;
            case 'stage':
                element.style.top = '10px';
                element.style.right = '10px';
                break;
            case 'survival-phase-timer':
                element.style.top = '70px';
                element.style.left = '10px';
                break;
            case 'sprint-bar':
                element.style.bottom = '20px';
                element.style.left = '50%';
                element.style.transform = 'translateX(-50%)';
                break;
        }
        
        document.body.appendChild(element);
        return element;
    }
    
    private styleSprintBar(): void {
        if (!this.sprintBarElement) return;
        
        this.sprintBarElement.style.width = '200px';
        this.sprintBarElement.style.height = '20px';
        this.sprintBarElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        this.sprintBarElement.style.border = '2px solid white';
        
        // Create inner bar
        const innerBar = document.createElement('div');
        innerBar.id = 'sprint-inner-bar';
        innerBar.style.width = '100%';
        innerBar.style.height = '100%';
        innerBar.style.backgroundColor = '#00ff00';
        
        this.sprintBarElement.appendChild(innerBar);
        
        // Add label
        const label = document.createElement('div');
        label.textContent = 'SPRINT';
        label.style.position = 'absolute';
        label.style.top = '50%';
        label.style.left = '50%';
        label.style.transform = 'translate(-50%, -50%)';
        label.style.fontSize = '12px';
        label.style.fontWeight = 'bold';
        
        this.sprintBarElement.appendChild(label);
    }
    
    public updateScore(score: number, maxScore: number = 420): void {
        if (this.scoreElement) {
            this.scoreElement.textContent = `Score: ${score}/${maxScore}`;
        }
    }
    
    public updateTokenCount(collected: number, total: number = 42): void {
        if (this.tokenCountElement) {
            this.tokenCountElement.textContent = `Tokens: ${collected}/${total}`;
        }
    }
    
    public updateStage(stage: number): void {
        if (this.stageElement) {
            this.stageElement.textContent = `Stage: ${stage}`;
        }
    }
    
    public updateSurvivalPhaseTimer(active: boolean, timeRemaining: number): void {
        if (!this.survivalPhaseTimerElement) return;
        
        if (active) {
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = Math.floor(timeRemaining % 60);
            this.survivalPhaseTimerElement.textContent = `SURVIVAL PHASE: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            this.survivalPhaseTimerElement.style.display = 'block';
            this.survivalPhaseTimerElement.style.color = timeRemaining < 10 ? '#ff0000' : '#ffff00';
        } else {
            this.survivalPhaseTimerElement.style.display = 'none';
        }
    }
    
    public updateSprintBar(available: boolean, energy: number): void {
        if (!this.sprintBarElement) return;
        
        const innerBar = document.getElementById('sprint-inner-bar');
        if (!innerBar) return;
        
        if (available) {
            this.sprintBarElement.style.display = 'block';
            innerBar.style.width = `${energy}%`;
            
            // Change color based on energy level
            if (energy > 70) {
                innerBar.style.backgroundColor = '#00ff00'; // Green
            } else if (energy > 30) {
                innerBar.style.backgroundColor = '#ffff00'; // Yellow
            } else {
                innerBar.style.backgroundColor = '#ff0000'; // Red
            }
        } else {
            this.sprintBarElement.style.display = 'none';
        }
    }
    
    public showGameCompleteMessage(score: number, difficulty: string): void {
        // Remove any existing overlays first
        const existingOverlay = document.getElementById('game-overlay');
        if (existingOverlay && existingOverlay.parentNode) {
            existingOverlay.parentNode.removeChild(existingOverlay);
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'game-overlay';
        overlay.className = 'game-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.color = 'white';
        overlay.style.fontFamily = 'monospace';
        overlay.style.zIndex = '1000';
        
        const title = document.createElement('h1');
        title.textContent = '🎮 GAME COMPLETE! 🎮';
        title.style.fontSize = '36px';
        title.style.marginBottom = '20px';
        overlay.appendChild(title);
        
        const message = document.createElement('p');
        message.textContent = `Congratulations! You've collected all 42 tokens and escaped the Jensen clones!`;
        message.style.fontSize = '18px';
        message.style.marginBottom = '10px';
        overlay.appendChild(message);
        
        const scoreText = document.createElement('p');
        scoreText.textContent = `Final Score: ${score}`;
        scoreText.style.fontSize = '24px';
        scoreText.style.marginBottom = '10px';
        overlay.appendChild(scoreText);
        
        const difficultyText = document.createElement('p');
        difficultyText.textContent = `Difficulty: ${difficulty}`;
        difficultyText.style.fontSize = '18px';
        difficultyText.style.marginBottom = '20px';
        overlay.appendChild(difficultyText);
        
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Play Again';
        restartButton.style.padding = '10px 20px';
        restartButton.style.fontSize = '16px';
        restartButton.style.backgroundColor = '#4CAF50';
        restartButton.style.border = 'none';
        restartButton.style.borderRadius = '5px';
        restartButton.style.cursor = 'pointer';
        restartButton.onclick = () => {
            document.body.removeChild(overlay);
            window.location.reload();
        };
        overlay.appendChild(restartButton);
        
        document.body.appendChild(overlay);
    }
    
    public showErrorDialog(message: string, onClose: () => void): void {
        // Remove any existing error overlays first
        const existingOverlay = document.getElementById('error-overlay');
        if (existingOverlay && existingOverlay.parentNode) {
            existingOverlay.parentNode.removeChild(existingOverlay);
        }
        
        const overlay = document.createElement('div');
        overlay.id = 'error-overlay';
        overlay.className = 'game-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.color = 'white';
        overlay.style.fontFamily = 'monospace';
        overlay.style.zIndex = '1000';
        
        const title = document.createElement('h1');
        title.textContent = '⚠️ CAUGHT! ⚠️';
        title.style.fontSize = '36px';
        title.style.marginBottom = '20px';
        title.style.color = '#ff0000';
        overlay.appendChild(title);
        
        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        messageElement.style.fontSize = '18px';
        messageElement.style.marginBottom = '20px';
        overlay.appendChild(messageElement);
        
        const continueButton = document.createElement('button');
        continueButton.textContent = 'Continue';
        continueButton.style.padding = '10px 20px';
        continueButton.style.fontSize = '16px';
        continueButton.style.backgroundColor = '#4CAF50';
        continueButton.style.border = 'none';
        continueButton.style.borderRadius = '5px';
        continueButton.style.cursor = 'pointer';
        continueButton.onclick = () => {
            document.body.removeChild(overlay);
            onClose();
        };
        overlay.appendChild(continueButton);
        
        document.body.appendChild(overlay);
    }
    
    // Add a cleanup method for when the game is destroyed/reset
    public cleanup(): void {
        this.cleanupExistingElements();
    }
} 