<script lang="ts">
    export let visible = false;
</script>

{#if visible}
<div class="pause-overlay">
    <div class="win95-window">
        <div class="title-bar">
            <div class="title-text">VMaze.exe - PAUSED</div>
        </div>
        <div class="pause-content">
            <div class="pause-icon">⏸️</div>
            <h2>GAME PAUSED</h2>
            <p>Press SPACE to continue</p>
        </div>
    </div>
</div>
{/if}

<style>
    .pause-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 900;
    }
    
    .win95-window {
        width: 300px;
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
    
    .pause-content {
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
    
    .pause-icon {
        font-size: 48px;
        margin-bottom: 15px;
    }
    
    h2 {
        margin: 0 0 10px 0;
        font-size: 20px;
    }
    
    p {
        margin: 5px 0;
        font-size: 16px;
    }
</style> 