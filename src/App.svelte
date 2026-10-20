<script lang="ts">
  const version = __APP_VERSION__
</script>

<main>
  <h1>Write-Hand</h1>
  <p>v2 is being rebuilt. {#if import.meta.env.DEV}<a href="/lab/">Engine lab →</a>{/if}</p>
  <footer>{version}</footer>
</main>

<style>
  main {
    max-width: 640px;
    margin: 10vh auto;
    padding: 0 16px;
  }
  a {
    color: inherit;
  }
  footer {
    opacity: 0.6;
    font-size: 0.8rem;
  }
</style>
