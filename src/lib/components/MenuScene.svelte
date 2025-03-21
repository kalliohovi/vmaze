<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let visible = false;
    
    const dispatch = createEventDispatcher();
    let selectedDifficulty = "Normal";
    
    // Detect if this is a mobile device
    let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;
    
    function startGame() {
        dispatch('startGame', { difficulty: selectedDifficulty });
    }
</script>

{#if visible}
<div class="menu-overlay">
    <div class="menu-container">
        <div class="menu-logo">
            <h1>VMaze</h1>
            <div class="menu-subtitle">Jensen Survival Simulator</div>
        </div>
        
        <div class="menu-content">
            <p class="menu-description">
                Collect all the tokens and escape the maze while avoiding the Jensen clones!
            </p>
            
            <div class="controls-info">
                {#if isMobileDevice}
                    <h3>Mobile Controls</h3>
                    <ul>
                        <li>Left joystick - Move forward/backward</li>
                        <li>Right joystick - Turn left/right</li>
                    </ul>
                {:else}
                    <h3>Keyboard Controls</h3>
                    <ul>
                        <li>W/Arrow Up - Move forward</li>
                        <li>S/Arrow Down - Move backward</li>
                        <li>A/Arrow Left - Turn left</li>
                        <li>D/Arrow Right - Turn right</li>
                        <li>Space - Pause game</li>
                        <li>Escape - Pause menu</li>
                    </ul>
                {/if}
            </div>
            
            <div class="difficulty-selector">
                <h3>Select Difficulty</h3>
                <div class="difficulty-options">
                    <button 
                        class={selectedDifficulty === "Easy" ? "selected" : ""}
                        on:click={() => selectedDifficulty = "Easy"}>
                        Easy
                    </button>
                    <button 
                        class={selectedDifficulty === "Normal" ? "selected" : ""}
                        on:click={() => selectedDifficulty = "Normal"}>
                        Normal
                    </button>
                    <button 
                        class={selectedDifficulty === "Hard" ? "selected" : ""}
                        on:click={() => selectedDifficulty = "Hard"}>
                        Hard
                    </button>
                    <button 
                        class={selectedDifficulty === "Impossible" ? "selected impossible" : "impossible"}
                        on:click={() => selectedDifficulty = "Impossible"}>
                        Impossible
                    </button>
                </div>
            </div>
            
            <button class="start-button" on:click={startGame}>START GAME</button>
        </div>
    </div>
</div>
{/if}

<style>
    .menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .menu-container {
        width: 80%;
        max-width: 700px;
        background-color: #222;
        border: 6px solid #444;
        border-radius: 10px;
        padding: 30px;
        color: #ddd;
        font-family: 'Courier New', monospace;
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);
    }
    
    .menu-logo {
        text-align: center;
        margin-bottom: 20px;
    }
    
    .menu-logo h1 {
        font-size: 48px;
        margin: 0;
        color: #ffd700;
        text-shadow: 0 0 10px #ffa500, 0 0 20px #ff0000;
        letter-spacing: 2px;
    }
    
    .menu-subtitle {
        font-size: 18px;
        color: #aaa;
        margin-top: 5px;
    }
    
    .menu-description {
        text-align: center;
        margin-bottom: 20px;
        line-height: 1.5;
        font-size: 18px;
    }
    
    .controls-info {
        margin-bottom: 30px;
        background-color: #1a1a1a;
        padding: 15px;
        border-radius: 5px;
        border: 1px solid #333;
    }
    
    .controls-info h3 {
        margin-top: 0;
        color: #ffd700;
        margin-bottom: 10px;
    }
    
    .controls-info ul {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }
    
    .controls-info li {
        margin-bottom: 5px;
        font-size: 16px;
    }
    
    .difficulty-selector {
        margin-bottom: 30px;
        text-align: center;
    }
    
    .difficulty-selector h3 {
        color: #ffd700;
        margin-bottom: 15px;
    }
    
    .difficulty-options {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
    }
    
    .difficulty-options button {
        padding: 10px 20px;
        background-color: #333;
        border: 1px solid #555;
        color: #ddd;
        font-family: 'Courier New', monospace;
        cursor: pointer;
        border-radius: 5px;
        transition: all 0.2s;
        font-size: 16px;
    }
    
    .difficulty-options button:hover {
        background-color: #444;
    }
    
    .difficulty-options button.selected {
        background-color: #ffd700;
        color: #000;
        border-color: #ffa500;
        box-shadow: 0 0 10px #ffa500;
    }
    
    .impossible {
        color: #ff0000 !important;
        border-color: #800000 !important;
    }
    
    .impossible.selected {
        background-color: #ff0000 !important;
        color: #fff !important;
        border-color: #800000 !important;
        box-shadow: 0 0 10px #ff0000 !important;
    }
    
    .start-button {
        display: block;
        width: 200px;
        margin: 0 auto;
        padding: 15px 20px;
        background-color: #ffd700;
        color: #000;
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 0 10px #ffa500;
    }
    
    .start-button:hover {
        background-color: #ffa500;
        transform: scale(1.05);
        box-shadow: 0 0 15px #ff8c00;
    }
    
    /* Mobile responsiveness */
    @media (max-width: 800px) {
        .menu-container {
            width: 90%;
            padding: 20px;
        }
        
        .menu-logo h1 {
            font-size: 36px;
        }
        
        .menu-subtitle {
            font-size: 16px;
        }
        
        .menu-description {
            font-size: 16px;
        }
        
        .controls-info {
            padding: 10px;
        }
        
        .controls-info li {
            font-size: 14px;
        }
        
        .difficulty-options button {
            padding: 8px 16px;
            font-size: 14px;
        }
        
        .start-button {
            width: 180px;
            padding: 12px 16px;
            font-size: 16px;
        }
    }
</style> 