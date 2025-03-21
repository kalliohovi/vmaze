<script lang="ts">
    export let visible = false;
    
    // Detect if this is a mobile device
    let isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 800;
</script>

{#if visible}
<div class="pause-overlay">
    <div class="pause-modal">
        <h2>GAME PAUSED</h2>
        
        <div class="controls-reminder">
            {#if isMobileDevice}
                <h3>Controls:</h3>
                <ul>
                    <li>Left joystick - Move forward/backward</li>
                    <li>Right joystick - Turn left/right</li>
                </ul>
            {:else}
                <h3>Controls:</h3>
                <ul>
                    <li>W/Arrow Up - Move forward</li>
                    <li>S/Arrow Down - Move backward</li>
                    <li>A/Arrow Left - Turn left</li>
                    <li>D/Arrow Right - Turn right</li>
                </ul>
            {/if}
        </div>
        
        <div class="tips">
            <h3>Tips:</h3>
            <ul>
                <li>Collect all 42 tokens to unlock the exit portal</li>
                <li>Stay away from the Jensen clones - they'll catch you!</li>
                <li>The maze has wide corridors - use them to your advantage</li>
            </ul>
        </div>
        
        <div class="message" on:touchstart={() => document.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space'}))}>
            {#if isMobileDevice}
                Tap here to resume game
            {:else}
                Press SPACE to resume game
            {/if}
        </div>
    </div>
</div>
{/if}

<style>
    .pause-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    
    .pause-modal {
        background-color: #222;
        border: 4px solid #444;
        border-radius: 10px;
        padding: 30px;
        width: 80%;
        max-width: 500px;
        color: #ddd;
        font-family: 'Courier New', monospace;
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.8);
    }
    
    h2 {
        text-align: center;
        margin-top: 0;
        color: #ffd700;
        text-shadow: 0 0 10px #ffa500;
        font-size: 30px;
        margin-bottom: 20px;
    }
    
    h3 {
        color: #ffd700;
        margin: 0 0 10px;
    }
    
    .controls-reminder, .tips {
        background-color: #1a1a1a;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 5px;
        border: 1px solid #333;
    }
    
    ul {
        margin: 0;
        padding-left: 20px;
    }
    
    li {
        margin-bottom: 5px;
    }
    
    .message {
        text-align: center;
        color: #ffd700;
        font-size: 18px;
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0% { opacity: 0.6; }
        50% { opacity: 1; }
        100% { opacity: 0.6; }
    }
    
    /* Mobile responsiveness */
    @media (max-width: 800px) {
        .pause-modal {
            width: 90%;
            padding: 20px;
        }
        
        h2 {
            font-size: 24px;
            margin-bottom: 15px;
        }
        
        h3 {
            font-size: 16px;
        }
        
        .controls-reminder, .tips {
            padding: 10px;
            margin-bottom: 15px;
        }
        
        li {
            font-size: 14px;
        }
        
        .message {
            font-size: 16px;
        }
    }
</style> 