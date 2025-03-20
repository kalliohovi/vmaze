<script>
    import '../app.css';
</script>

<div class="layout-container">
    <slot />
</div>

<style>
    .layout-container {
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
    }
</style>
