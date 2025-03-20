<script lang="ts">
    import { onMount } from 'svelte';
    import { Game } from '../lib/game/Game';
    import ErrorDialog from '../lib/components/ErrorDialog.svelte';
    import MenuScene from '../lib/components/MenuScene.svelte';
    import PauseOverlay from '../lib/components/PauseOverlay.svelte';

    let gameContainer: HTMLDivElement;
    let game: Game;
    let score: number = 0;
    let direction: string = "N";
    let totalTokens: number = 42; // Updated token count
    let errorDialogVisible = false;
    let showMenu = true;
    let gameDifficulty = "Normal";
    let gamePaused = false;
    let currentStage: number = 1;
    let sprintAvailable: boolean = false;
    let sprintEnergy: number = 0;
    
    // Add Cliby phase state
    let clibyPhaseActive: boolean = false;
    let clibyPhaseTimeRemaining: number = 0;
    
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
        // Show error dialog
        errorDialogVisible = true;
        
        // Game is already paused in handleMonsterCatch()
    }
    
    function handleAbort() {
        // Go back to menu
        showMenu = true;
        
        // Full reset of the game would happen when starting a new game
    }
    
    function handleRetry() {
        // Reset player and monster positions, score, stages, and tokens
        game.resetGame(true);
    }
    
    function handleIgnore() {
        // Just close the dialog and resume at current position
        // Resume the game first to prevent any race conditions
        game.resumeGame();
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
            // Initialize game with selected difficulty
            game = new Game(
                gameContainer, 
                (newScore: number) => {
                    score = newScore;
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
                    updateStageUI();
                },
                (active: boolean, timeRemaining: number) => {
                    clibyPhaseActive = active;
                    clibyPhaseTimeRemaining = timeRemaining;
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
        if (!showMenu && !errorDialogVisible) {
            if (event.code === 'Space') {
                // Toggle pause state
                if (game) {
                    gamePaused = game.togglePause();
                }
                
                // Prevent spacebar from scrolling the page
                event.preventDefault();
            }
        }
    }
    
    function updateUIForDifficulty() {
        // You could update UI elements based on difficulty here
        if (gameDifficulty === "Impossible") {
            // Show special message for impossible mode
            const messageBox = document.querySelector('.message-box');
            if (messageBox) {
                messageBox.textContent = "FATAL ERROR: You selected IMPOSSIBLE mode. The Jensen clones have been enhanced with wall-phasing technology. You WILL be terminated.";
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
        requestAnimationFrame(updateSprintInfo);
    }
    
    // Add a function to update UI when stage changes
    function updateStageUI() {
        // Update the message box with stage-specific messages
        if (currentStage === 2) {
            const messageBox = document.querySelector('.message-box');
            if (messageBox) {
                messageBox.textContent = "WARNING: Anomaly detected! Cliby entities have entered the maze! Press SHIFT to sprint.";
            }
        }
    }

    onMount(() => {
        // Don't automatically start the game, wait for menu selection
        
        // Clean up the key listener when component is unmounted
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    });
</script>

{#if showMenu}
    <MenuScene visible={true} on:startGame={handleStartGame} />
{:else}
    <main>
        <div class="arena-frame">
            <div class="game-viewport">
                <div bind:this={gameContainer} class="game-container"></div>
            </div>
            
            <div class="top-bar">
                <div class="compass">
                    <div class="compass-directions">
                        <span class={direction === "N" ? "active" : ""}>N</span>
                        <span class={direction === "E" ? "active" : ""}>E</span>
                        <span class={direction === "S" ? "active" : ""}>S</span>
                        <span class={direction === "W" ? "active" : ""}>W</span>
                    </div>
                </div>
                <div class="score-display">SCORE: {score}</div>
                <div class="stage-display">STAGE: {currentStage}</div>
                {#if clibyPhaseActive}
                <div class="cliby-timer">SURVIVE: {formatTime(clibyPhaseTimeRemaining)}</div>
                {/if}
                <div class="difficulty-display">LEVEL: {gameDifficulty}</div>
            </div>
            
            <div class="side-bar left">
                <div class="character-portrait"> 
                    <div class="portrait-frame {clibyPhaseActive ? 'cliby-active' : ''}"></div>
                </div>
                <div class="stats">
                    <div class="stat-bar">
                        <span>HP</span>
                        <div class="bar health"></div>
                    </div>
                    <div class="stat-bar">
                        <span>MP</span>
                        <div class="bar mana"></div>
                    </div>
                    <div class="stat-bar">
                        <span>ST</span>
                        <div class="bar stamina"></div>
                    </div>
                </div>
                
                <!-- Add Sprint meter when available -->
                {#if sprintAvailable}
                <div class="sprint-container">
                    <div class="sprint-label">SPRINT</div>
                    <div class="sprint-bar">
                        <div class="sprint-fill" style="width: {sprintEnergy}%"></div>
                    </div>
                    <div class="sprint-key">SHIFT</div>
                </div>
                {/if}
            </div>
            
            <div class="side-bar right">
                <div class="weapon-display">
                    <div class="weapon-icon"></div>
                </div>
                <div class="items">
                    <div class="item">TOKENS: {score/10}/{totalTokens}</div>
                    <div class="item danger">JENSEN CLONES: 3</div>
                    {#if clibyPhaseActive}
                    <div class="item anomaly pulsing">CLIBY ANOMALIES: 3</div>
                    {/if}
                </div>
            </div>
            
            <div class="bottom-bar">
                <div class="message-box">
                    {#if gameDifficulty === "Impossible"}
                        FATAL ERROR: You selected IMPOSSIBLE mode. The Jensen clones have been enhanced with wall-phasing technology. You WILL be terminated.
                    {:else if clibyPhaseActive}
                        CRITICAL ALERT: Cliby anomalies detected! Survive for {formatTime(clibyPhaseTimeRemaining)} to stabilize the maze! Press SHIFT to sprint.
                    {:else}
                        DANGER: Jensen clones are hunting you! Use the wide corridors to evade them and collect all tokens to escape!
                    {/if}
                </div>
                <div class="controls-hint">
                    <span>W/UP - Forward</span>
                    <span>S/DOWN - Back</span>
                    <span>A/LEFT - Turn Left</span>
                    <span>D/RIGHT - Turn Right</span>
                    <span>SPACE - Pause</span>
                    {#if sprintAvailable}
                    <span>SHIFT - Sprint</span>
                    {/if}
                </div>
            </div>
        </div>
    </main>
    
    <PauseOverlay visible={gamePaused} />
{/if}

<ErrorDialog 
    bind:visible={errorDialogVisible}
    on:abort={handleAbort}
    on:retry={handleRetry}
    on:ignore={handleIgnore}
/>

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
        display: grid;
        grid-template-rows: 60px 1fr 80px;
        grid-template-columns: 120px 1fr 120px;
        grid-template-areas:
            "topleft top topright"
            "left center right"
            "bottomleft bottom bottomright";
        background-color: #423d38;
        box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.8);
        border: 12px solid #2a2520;
        box-sizing: border-box;
    }

    .game-viewport {
        grid-area: center;
        position: relative;
        overflow: hidden;
        border: 4px solid #2a2520;
        box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.7);
    }

    .game-container {
        width: 100%;
        height: 100%;
    }

    .top-bar {
        grid-area: top;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        background-color: #2a2520;
        border-bottom: 2px solid #000;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    .compass {
        width: 120px;
        height: 40px;
        background-color: #111;
        border: 3px solid #534939;
        border-radius: 5px;
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
    }

    .compass-directions .active {
        color: #ffd700;
        text-shadow: 0 0 8px #ffa500;
    }

    .score-display {
        font-family: 'Courier New', monospace;
        font-size: 24px;
        font-weight: bold;
        color: #ffd700;
        text-shadow: 0 0 5px #ffa500;
    }

    .stage-display {
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        color: #ffd700;
        text-shadow: 0 0 5px #ffa500;
        background-color: #111;
        padding: 5px 10px;
        border-radius: 3px;
        border: 2px solid #534939;
        margin-right: 10px;
    }

    .difficulty-display {
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        color: #ffd700;
        text-shadow: 0 0 5px #ffa500;
        background-color: #111;
        padding: 5px 10px;
        border-radius: 3px;
        border: 2px solid #534939;
    }

    .side-bar {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px;
        background-color: #2a2520;
        box-shadow: inset 0 0 15px rgba(0, 0, 0, 0.5);
    }

    .side-bar.left {
        grid-area: left;
        border-right: 2px solid #000;
    }

    .side-bar.right {
        grid-area: right;
        border-left: 2px solid #000;
    }

    .character-portrait {
        width: 90px;
        height: 100px;
        margin-bottom: 20px;
    }

    .portrait-frame {
        width: 100%;
        height: 100%;
        background-image: url('/static/images/player-profile-64x64.png');
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        border: 3px solid #534939;
        border-radius: 5px;
        transition: all 0.3s ease;
    }

    .portrait-frame.cliby-active {
        background-image: url('/static/images/cliby-profile-64.png');
        border-color: #800080;
        box-shadow: 0 0 10px #ff00ff;
        animation: portrait-pulse 2s infinite;
    }

    @keyframes portrait-pulse {
        0% { border-color: #800080; }
        50% { border-color: #ff00ff; }
        100% { border-color: #800080; }
    }

    .stats {
        width: 100%;
    }

    .stat-bar {
        margin: 10px 0;
        display: flex;
        align-items: center;
    }

    .stat-bar span {
        width: 25px;
        color: #ccc;
        font-weight: bold;
        font-family: 'Courier New', monospace;
    }

    .bar {
        height: 15px;
        flex-grow: 1;
        border: 2px solid #534939;
        border-radius: 3px;
        position: relative;
    }

    .bar::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        height: 100%;
        border-radius: 1px;
    }

    .health::after {
        width: 85%;
        background-color: #a02c2c;
    }

    .mana::after {
        width: 65%;
        background-color: #2c57a0;
    }

    .stamina::after {
        width: 75%;
        background-color: #2ca042;
    }

    .weapon-display {
        width: 90px;
        height: 120px;
        background-color: #111;
        border: 3px solid #534939;
        border-radius: 5px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .weapon-icon {
        width: 70px;
        height: 70px;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70"><path d="M35,10 L40,25 L45,25 L45,60 L25,60 L25,25 L30,25 Z" fill="%23ccc"/><path d="M35,20 L37,25 L33,25 Z" fill="%23f5f5f5"/></svg>');
    }

    .items {
        width: 100%;
    }

    .item {
        font-family: 'Courier New', monospace;
        color: #ffd700;
        text-align: center;
        font-size: 14px;
        background-color: #111;
        border: 2px solid #534939;
        border-radius: 3px;
        padding: 5px;
        margin: 5px 0;
    }

    .item.danger {
        color: #ff4040;
        border-color: #800000;
        text-shadow: 0 0 5px #ff0000;
    }

    .item.anomaly {
        color: #ff80ff;
        border-color: #800080;
        text-shadow: 0 0 5px #ff00ff;
    }

    .bottom-bar {
        grid-area: bottom;
        display: flex;
        flex-direction: column;
        background-color: #2a2520;
        border-top: 2px solid #000;
        box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.4);
    }

    .message-box {
        flex-grow: 1;
        padding: 10px;
        font-family: 'Courier New', monospace;
        color: #ccc;
        border-bottom: 1px solid #534939;
        background-color: #111;
        overflow: hidden;
        margin: 5px;
        border-radius: 3px;
    }

    .controls-hint {
        display: flex;
        justify-content: space-around;
        padding: 5px;
        font-family: 'Courier New', monospace;
        color: #aaa;
        font-size: 12px;
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

    .sprint-container {
        width: 100%;
        margin-top: 15px;
        padding: 5px;
        background-color: #111;
        border: 2px solid #534939;
        border-radius: 3px;
    }
    
    .sprint-label {
        font-family: 'Courier New', monospace;
        color: #ccc;
        font-size: 12px;
        text-align: center;
        margin-bottom: 3px;
    }
    
    .sprint-bar {
        height: 10px;
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
        font-size: 10px;
        text-align: center;
        margin-top: 3px;
    }

    .cliby-timer {
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        color: #ff80ff;
        text-shadow: 0 0 5px #ff00ff;
        background-color: #111;
        padding: 5px 10px;
        border-radius: 3px;
        border: 2px solid #800080;
        margin-right: 10px;
        animation: pulse 1s infinite;
    }
    
    .pulsing {
        animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
</style> 