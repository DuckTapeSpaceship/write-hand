<script lang="ts">
  // First impression while nothing is drawn yet. The headline is set in
  // AshFont, a handwriting font made with Write-Hand v1.
  let { onstart }: { onstart: () => void } = $props()
</script>

<section class="landing panel" aria-labelledby="landing-title">
  <h2 id="landing-title" class="ash">Your handwriting, as a font.</h2>
  <p>
    Draw each letter once and Write-Hand turns your strokes into a real OpenType font: spaced, kerned, with alternate letter forms so
    repeated letters don't look stamped. It all happens in your browser, and nothing is uploaded.
  </p>
  <div class="row">
    <button class="btn primary" onclick={onstart}>Start with “a”</button>
    <span class="credit">Headline set in <span class="ash">AshFont</span>, made with Write-Hand v1.</span>
  </div>
</section>

<style>
  @font-face {
    font-family: 'AshFont';
    src: url('/AshFont.ttf') format('truetype');
    font-display: swap;
  }
  .landing {
    margin: 16px 0 8px;
    padding: 18px 20px;
    display: grid;
    gap: 10px;
  }
  .ash {
    font-family: 'AshFont', var(--font-ui);
    font-weight: 400;
  }
  h2 {
    margin: 0;
    font-size: clamp(34px, 6vw, 60px);
    line-height: 1.1;
  }
  p {
    margin: 0;
    max-width: 62ch;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
  }
  .credit {
    font-size: 0.85rem;
    opacity: 0.8;
  }
  .credit .ash {
    font-size: 1.3em;
  }
</style>
