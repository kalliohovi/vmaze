<script lang="ts">
    import { onMount } from 'svelte';
    import { Game } from '../lib/game/Game';

    let gameContainer: HTMLDivElement;
    let game: Game;
    let score: number = 0;
    let direction: string = "N";
    let totalTokens: number = 42; // Updated token count
    
    // Update direction based on player rotation
    function updateDirection(rotation: number) {
        const normalizedRotation = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const angle = normalizedRotation * 180 / Math.PI;
        
        if (angle >= 315 || angle < 45) direction = "N";
        else if (angle >= 45 && angle < 135) direction = "E";
        else if (angle >= 135 && angle < 225) direction = "S";
        else direction = "W";
    }

    onMount(() => {
        if (gameContainer) {
            game = new Game(gameContainer, (newScore: number) => {
                score = newScore;
            }, (rotation: number) => {
                updateDirection(rotation);
            });
            game.start();
        }
    });
</script>

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
        </div>
        
        <div class="side-bar left">
            <div class="character-portrait">
                <div class="portrait-frame"></div>
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
        </div>
        
        <div class="side-bar right">
            <div class="weapon-display">
                <div class="weapon-icon"></div>
            </div>
            <div class="items">
                <div class="item">TOKENS: {score/10}/{totalTokens}</div>
                <div class="item danger">JENSEN CLONES: 3</div>
            </div>
        </div>
        
        <div class="bottom-bar">
            <div class="message-box">DANGER: Jensen clones are hunting you! Use the wide corridors to evade them and collect all tokens to escape!</div>
            <div class="controls-hint">
                <span>W/UP - Forward</span>
                <span>S/DOWN - Back</span>
                <span>A/LEFT - Turn Left</span>
                <span>D/RIGHT - Turn Right</span>
            </div>
        </div>
    </div>
</main>

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
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="90" height="100" viewBox="0 0 90 100"><rect x="5" y="5" width="80" height="90" fill="%23111" rx="5" ry="5"/><circle cx="45" cy="50" r="30" fill="%23333"/><circle cx="45" cy="40" r="10" fill="%23555"/><rect x="35" y="55" width="20" height="15" fill="%23555"/></svg>');
        border: 3px solid #534939;
        border-radius: 5px;
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
</style> 