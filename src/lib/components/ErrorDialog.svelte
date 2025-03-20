<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let visible = false;
  
  const dispatch = createEventDispatcher();
  
  function handleAbort() {
    dispatch('abort');
    visible = false;
  }
  
  function handleRetry() {
    dispatch('retry');
    visible = false;
  }
  
  function handleIgnore() {
    dispatch('ignore');
    visible = false;
  }
</script>

{#if visible}
<div class="modal-overlay">
  <div class="win95-dialog">
    <div class="title-bar">
      <div class="title-text">VMaze.exe - Application Error</div>
      <div class="title-x">×</div>
    </div>
    <div class="dialog-content">
      <div class="error-icon">🛑</div>
      <div class="error-message">
        <p>Fatal Exception 0E at 0028:C000BF01</p>
        <p>JENSEN.DLL caused a General Protection Fault</p>
        <p>in module USER.EXE at 0001:00005A32.</p>
        <p>Player might be terminated in an unusual way.</p>
      </div>
    </div>
    <div class="button-row">
      <button on:click={handleAbort} class="win95-button">Abort</button>
      <button on:click={handleRetry} class="win95-button">Retry</button>
      <button on:click={handleIgnore} class="win95-button">Ignore</button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .win95-dialog {
    width: 400px;
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
  
  .title-x {
    cursor: pointer;
  }
  
  .dialog-content {
    padding: 15px;
    display: flex;
    align-items: center;
  }
  
  .error-icon {
    font-size: 32px;
    margin-right: 15px;
  }
  
  .error-message {
    font-size: 12px;
  }
  
  .error-message p {
    margin: 5px 0;
  }
  
  .button-row {
    display: flex;
    justify-content: center;
    padding: 10px 15px 15px;
    gap: 8px;
  }
  
  .win95-button {
    min-width: 80px;
    padding: 4px 8px;
    background: #c0c0c0;
    border: 2px solid #dfdfdf;
    border-right-color: #808080;
    border-bottom-color: #808080;
    box-shadow: 0 0 0 1px #000000;
    font-family: 'MS Sans Serif', Tahoma, sans-serif;
    font-size: 12px;
    cursor: pointer;
  }
  
  .win95-button:active {
    border-color: #808080;
    border-right-color: #dfdfdf;
    border-bottom-color: #dfdfdf;
  }
</style>
