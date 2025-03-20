<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let visible = true;
    
    const dispatch = createEventDispatcher();
    const difficulties = ["Easy", "Normal", "Hard", "Impossible"];
    let selectedDifficulty = "Normal";
    
    function startGame() {
        dispatch('startGame', { difficulty: selectedDifficulty });
    }
    
    function changeDifficulty(difficulty: string) {
        selectedDifficulty = difficulty;
    }
</script>

{#if visible}
<div class="menu-overlay">
    <div class="win95-menu">
        <div class="title-bar">
            <div class="title-text">VMaze.exe</div>
        </div>
        
        <div class="menu-content">
            <div class="game-title">
                <h1>VMaze</h1>
                <p>Escape the Jensen Clones!</p>
            </div>
            
            <div class="difficulty-selection">
                <h2>Select Difficulty:</h2>
                <div class="difficulty-buttons">
                    {#each difficulties as difficulty}
                        <button 
                            class="win95-button {selectedDifficulty === difficulty ? 'selected' : ''}" 
                            on:click={() => changeDifficulty(difficulty)}
                        >
                            {difficulty}
                            {#if difficulty === "Impossible"}
                                <span class="warning">⚠️</span>
                            {/if}
                        </button>
                    {/each}
                </div>
                
                {#if selectedDifficulty === "Impossible"}
                    <div class="warning-text">WARNING: This mode is ACTUALLY impossible!</div>
                {/if}
            </div>
            
            <div class="start-button-container">
                <button class="win95-button start-button" on:click={startGame}>
                    Start Game
                </button>
            </div>
            
            <div class="game-info">
                <h3>Controls:</h3>
                <p>W/UP - Move Forward</p>
                <p>S/DOWN - Move Backward</p>
                <p>A/LEFT - Turn Left</p>
                <p>D/RIGHT - Turn Right</p>
            </div>
        </div>
    </div>
</div>
{/if}

<style>
    .menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #008080; /* Classic Windows 95 teal background */
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .win95-menu {
        width: 500px;
        background: #c0c0c0;
        border: 3px solid #dfdfdf;
        border-right-color: #808080;
        border-bottom-color: #808080;
        box-shadow: 0 0 0 1px #000000;
        font-family: 'MS Sans Serif', Tahoma, sans-serif;
    }
    
    .title-bar {
        background: #000080;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 5px;
        font-weight: bold;
    }
    
    .menu-content {
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    
    .game-title {
        text-align: center;
        margin-bottom: 20px;
    }
    
    .game-title h1 {
        margin: 0;
        font-size: 32px;
        color: #000080;
    }
    
    .game-title p {
        margin: 5px 0 0;
        font-size: 16px;
    }
    
    .difficulty-selection {
        width: 100%;
        margin-bottom: 20px;
        text-align: center;
    }
    
    .difficulty-selection h2 {
        margin: 0 0 10px;
        font-size: 18px;
    }
    
    .difficulty-buttons {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-bottom: 10px;
    }
    
    .win95-button {
        min-width: 80px;
        padding: 6px 12px;
        background: #c0c0c0;
        border: 2px solid #dfdfdf;
        border-right-color: #808080;
        border-bottom-color: #808080;
        box-shadow: 0 0 0 1px #000000;
        font-family: 'MS Sans Serif', Tahoma, sans-serif;
        font-size: 14px;
        cursor: pointer;
        position: relative;
    }
    
    .win95-button:active, .win95-button.selected {
        border-color: #808080;
        border-right-color: #dfdfdf;
        border-bottom-color: #dfdfdf;
        background-color: #b0b0b0;
    }
    
    .warning {
        color: red;
        margin-left: 5px;
    }
    
    .warning-text {
        color: red;
        font-weight: bold;
        margin-top: 10px;
        font-size: 14px;
    }
    
    .start-button-container {
        margin-bottom: 20px;
    }
    
    .start-button {
        font-size: 18px;
        font-weight: bold;
        padding: 8px 20px;
    }
    
    .game-info {
        background: #ffffff;
        border: 1px solid #808080;
        padding: 10px;
        width: 80%;
        font-size: 12px;
    }
    
    .game-info h3 {
        margin: 0 0 5px;
        font-size: 16px;
    }
    
    .game-info p {
        margin: 3px 0;
    }
</style> 