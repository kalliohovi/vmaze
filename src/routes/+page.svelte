<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Game } from '../lib/game/Game';
    import MenuScene from '../lib/components/MenuScene.svelte';
    import PauseOverlay from '../lib/components/PauseOverlay.svelte';

    let gameContainer: HTMLDivElement;
    let game: Game;
    let score: number = 0;
    let direction: string = "N";
    let totalTokens: number = 42; // Updated token count
    let showMenu = true;
    let gameDifficulty = "Normal";
    let gamePaused = false;
    let currentStage: number = 1;
    let sprintAvailable: boolean = false;
    let sprintEnergy: number = 0;
    
    // Add mobile detection
    let isMobileDevice = false;
    
    // Add Survival phase state
    let survivalPhaseActive: boolean = false;
    let survivalPhaseTimeRemaining: number = 0;
    
    // Animation frame handle for cleanup
    let animationFrameHandle: number | null = null;
    
    // Format time as MM:SS
    function formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    // Update direction based on player rotation
    function updateDirection(rotation: number) {
        const normalizedRotation = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const angle = normalizedRotation * 180 / Math.PI;
        
        if (angle >= 315 || angle < 45) direction = "N";
        else if (angle >= 45 && angle < 135) direction = "E";
        else if (angle >= 135 && angle < 225) direction = "S";
        else direction = "W";
    }

    function handlePlayerCaught() {
        // Reset score immediately to ensure UI is consistent
        score = 0;
        
        // Game's handlePlayerCaught will handle showing the error dialog and game pause
        // The Game.ts implementation will handle everything else
    }
    
    function handleStartGame(event) {
        gameDifficulty = event.detail.difficulty;
        showMenu = false;
        
        // Small timeout to ensure the DOM is updated
        setTimeout(() => {
            initGame();
        }, 0);
    }
    
    function initGame() {
        if (gameContainer) {
            // Ensure any previous game instance is cleaned up
            cleanupGame();
            
            // Initialize game with selected difficulty
            game = new Game(
                gameContainer, 
                (newScore: number) => {
                    // Always update our local score to match the game's score
                    console.log(`Score callback triggered: ${newScore}`);
                    score = newScore;
                    
                    // Update token display
                    const tokenProgress = game.getTokenProgress();
                    totalTokens = tokenProgress.total;
                }, 
                (rotation: number) => {
                    updateDirection(rotation);
                },
                () => {
                    handlePlayerCaught();
                },
                gameDifficulty,
                (newStage: number) => {
                    currentStage = newStage;
                },
                (active: boolean, timeRemaining: number) => {
                    survivalPhaseActive = active;
                    survivalPhaseTimeRemaining = timeRemaining;
                }
            );
            game.start();
            
            // Update UI based on difficulty
            updateUIForDifficulty();
            
            // Add keyboard listener for spacebar pause
            window.addEventListener('keydown', handleKeyDown);
            
            // Start the sprint info update loop
            updateSprintInfo();
        }
    }
    
    function handleKeyDown(event: KeyboardEvent) {
        // Only process when game is running (not in menu)
        if (!showMenu) {
            if (event.code === 'Space') {
                // Toggle pause state
                if (game) {
                    gamePaused = game.togglePause();
                }
                
                // Prevent spacebar from scrolling the page
                event.preventDefault();
            }
            
            // Handle escape key to show menu
            if (event.code === 'Escape' && !gamePaused) {
                gamePaused = true;
                if (game) {
                    game.pauseGame();
                }
            }
        }
    }
    
    function updateUIForDifficulty() {
        // You could update UI elements based on difficulty here
        if (gameDifficulty === "Impossible") {
            // Show special message for impossible mode
            const messageBox = document.querySelector('.message-box');
            if (messageBox) {
                messageBox.textContent = "FATAL ERROR: You selected IMPOSSIBLE mode. The Jensen clones have been enhanced with wall-phasing technology. THERE IS NO ESCAPE. YOU WILL BE TERMINATED.";
            }
            
            // Update the difficulty display with a special class
            const difficultyDisplay = document.querySelector('.difficulty-display');
            if (difficultyDisplay) {
                difficultyDisplay.classList.add('impossible');
            }
        }
    }

    // Add a function to update sprint info
    function updateSprintInfo() {
        if (game) {
            const sprintInfo = game.getSprintInfo();
            sprintAvailable = sprintInfo.available;
            sprintEnergy = sprintInfo.energy;
        }
        
        // Schedule next update
        animationFrameHandle = requestAnimationFrame(updateSprintInfo);
    }
    
    
    // Function to clean up the game instance
    function cleanupGame() {
        if (game) {
            // Call game's dispose method
            game.dispose();
            game = null;
        }
        
        // Cancel animation frame
        if (animationFrameHandle !== null) {
            cancelAnimationFrame(animationFrameHandle);
            animationFrameHandle = null;
        }
    }

    onMount(() => {
        // Check if it's a mobile device
        isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;
        
        // Add meta viewport for mobile
        if (isMobileDevice) {
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
            document.head.appendChild(meta);
        }
    });
    
    onDestroy(() => {
        // Clean up resources when component is destroyed
        cleanupGame();
        
        // Remove key listener
        window.removeEventListener('keydown', handleKeyDown);
    });
</script>

{#if showMenu}
    <MenuScene visible={true} on:startGame={handleStartGame} />
{:else}
    <main>
        <div class="arena-frame">
            <div class="top-bar">
                <div class="main-info">
                    <div class="compass">
                        <div class="compass-directions">
                            <span class={direction === "N" ? "active" : ""}>N</span>
                            <span class={direction === "E" ? "active" : ""}>E</span>
                            <span class={direction === "S" ? "active" : ""}>S</span>
                            <span class={direction === "W" ? "active" : ""}>W</span>
                        </div>
                    </div>
                    
                    <div class="portrait-container">
                        <div class="character-portrait">
                            <div class="portrait-frame"></div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-display">
                    <div class="score-display">S: {score}</div>
                    <div class="stage-display">ST: {currentStage}</div>
                    <div class="tokens-display">T: {score/10}/{totalTokens}</div>
                </div>
                
                <div class="right-info">
                    <div class="difficulty-display">LEVEL: {gameDifficulty}</div>
                    <div class="clones-display danger">CLONES: {survivalPhaseActive ? 6 : 3}</div>
                </div>
            </div>
            
            {#if survivalPhaseActive}
            <div class="survival-timer">SURVIVE: {formatTime(survivalPhaseTimeRemaining)}</div>
            {/if}
            
            <div class="game-viewport">
                <div bind:this={gameContainer} class="game-container"></div>
                
                <!-- Sprint meter for mobile -->
                {#if sprintAvailable && isMobileDevice}
                <div class="mobile-sprint-container">
                    <div class="sprint-bar">
                        <div class="sprint-fill" style="width: {sprintEnergy}%"></div>
                    </div>
                </div>
                {/if}
            </div>
            
            <!-- Sprint container for desktop, positioned on side -->
            {#if sprintAvailable && !isMobileDevice}
            <div class="side-sprint-container">
                <div class="sprint-label">SPRINT</div>
                <div class="sprint-bar">
                    <div class="sprint-fill" style="width: {sprintEnergy}%"></div>
                </div>
                <div class="sprint-key">SHIFT</div>
            </div>
            {/if}
        </div>
    </main>
    
    <PauseOverlay visible={gamePaused} />
{/if}

<style>
    main {
        width: 100%;
        height: 100%;
        background-color: #000;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
    }

    .arena-frame {
        width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
        background-color: #423d38;
        box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.8);
        border: 8px solid #2a2520;
        box-sizing: border-box;
    }

    .top-bar {
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        background-color: #2a2520;
        border-bottom: 2px solid #000;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    .main-info, .right-info {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .stats-display {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }

    .compass {
        width: 60px;
        height: 30px;
        background-color: #111;
        border: 2px solid #534939;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .compass-directions {
        display: flex;
        justify-content: space-around;
        width: 100%;
        color: #777;
        font-weight: bold;
        font-family: 'Courier New', monospace;
        font-size: 14px;
    }

    .compass-directions .active {
        color: #ffd700;
        text-shadow: 0 0 8px #ffa500;
    }

    .portrait-container {
        display: flex;
        align-items: center;
    }

    .character-portrait {
        width: 36px;
        height: 36px;
        border: 2px solid #534939;
        border-radius: 4px;
        overflow: hidden;
    }

    .portrait-frame {
        width: 100%;
        height: 100%;
        background-image: url('/static/images/player-profile-64x64.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
    }

    .score-display {
        font-family: 'Courier New', monospace;
        font-size: 10px;
        font-weight: bold;
        color: #ffd700;
        text-shadow: 0 0 5px #ffa500;
    }

    .stage-display, .tokens-display {
        font-family: 'Courier New', monospace;
        font-size: 10px;
        font-weight: bold;
        color: #ffd700;
        text-shadow: 0 0 5px #ffa500;
    }

    .difficulty-display, .clones-display {
        font-family: 'Courier New', monospace;
        font-size: 12px;
        font-weight: bold;
        background-color: #111;
        padding: 3px 6px;
        border-radius: 3px;
        border: 2px solid #534939;
    }
    
    .difficulty-display {
        color: #ffd700;
        text-shadow: 0 0 5px #ffa500;
    }
    
    .danger {
        color: #ff4040;
        border-color: #800000;
        text-shadow: 0 0 5px #ff0000;
    }

    .game-viewport {
        flex: 1;
        position: relative;
        overflow: hidden;
        border: 4px solid #2a2520;
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.7);
    }

    .game-container {
        width: 100%;
        height: 100%;
    }

    /* Make the difficulty display red for Impossible mode */
    :global(.difficulty-display.impossible) {
        color: #ff4040;
        border-color: #800000;
        text-shadow: 0 0 5px #ff0000;
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }

    .side-sprint-container {
        position: absolute;
        left: 10px;
        top: 60px;
        width: 60px;
        padding: 5px;
        background-color: #111;
        border: 2px solid #534939;
        border-radius: 3px;
    }
    
    .mobile-sprint-container {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        width: 120px;
        height: 10px;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 5px;
        overflow: hidden;
    }
    
    .sprint-label {
        font-family: 'Courier New', monospace;
        color: #ccc;
        font-size: 10px;
        text-align: center;
        margin-bottom: 3px;
    }
    
    .sprint-bar {
        height: 8px;
        width: 100%;
        background-color: #333;
        border: 1px solid #666;
        border-radius: 2px;
        overflow: hidden;
    }
    
    .sprint-fill {
        height: 100%;
        background-color: #2ca042;
        transition: width 0.2s ease;
    }
    
    .sprint-key {
        font-family: 'Courier New', monospace;
        color: #ccc;
        font-size: 9px;
        text-align: center;
        margin-top: 3px;
    }

    .survival-timer {
        position: absolute;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        padding: 3px 8px;
        background-color: rgba(255, 0, 0, 0.7);
        color: white;
        font-family: "VT323", monospace;
        font-size: 1.2rem;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(255, 0, 0, 0.7);
        text-shadow: 0 0 5px #fff;
        animation: blink 1s infinite;
        z-index: 10;
    }
    
    @keyframes blink {
        0% { opacity: 1; }
        50% { opacity: 0.6; }
        100% { opacity: 1; }
    }

    /* Hide scrollbars and prevent overscroll on mobile */
    main {
        overscroll-behavior: none;
        overflow: hidden;
        position: fixed;
        touch-action: none;
        width: 100%;
        height: 100%;
    }
</style> 