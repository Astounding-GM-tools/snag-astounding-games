<script lang="ts">
  import { t } from '../i18n';
  import HowTo from './HowTo.svelte';

  interface Props {
    /** Month of the voyage in progress, if any. */
    savedMonth: number | null;
    onstart: () => void;
    oncontinue: () => void;
  }
  let { savedMonth, onstart, oncontinue }: Props = $props();
  let showHowTo = $state(false);
  /** How many taglines the language file has (title.tagline.0 … n-1); one is picked per visit. */
  const TAGLINES = 12;
  const tagline = Math.floor(Math.random() * TAGLINES);

  /** Suit-shaped clouds of very different sizes; each gets a random tilt per visit. */
  const clouds = [
    { s: '♥', y: -6, size: 56, dur: 70, delay: 0 },
    { s: '♦', y: 22, size: 20, dur: 52, delay: -12 },
    { s: '♦', y: -20, size: 34, dur: 60, delay: -30 },
    { s: '♥', y: 6, size: 74, dur: 88, delay: -45 },
    { s: '♥', y: 30, size: 16, dur: 44, delay: -26 },
    { s: '♦', y: -10, size: 44, dur: 76, delay: -60 },
  ].map((c) => ({ ...c, tilt: Math.round(Math.random() * 70 - 35) }));
  let confirmAbandon = $state(false);

  function newVoyage() {
    if (savedMonth) confirmAbandon = true;
    else onstart();
  }
</script>

<div class="title">
  <div class="stage">
  {#if showHowTo}<HowTo />{/if}
  <!-- A stern-wheeler steaming to the right: the wheel at the back turns so its
       lower paddles push the water astern; smoke trails back from three stacks
       that puff as they breathe; the river laps up over the hull. -->
  <svg class="boat" viewBox="0 -34 240 184" aria-hidden="true">
    <!-- The whole scene fades softly into the dark at its edges -->
    <defs>
      <radialGradient id="scene-fade-gradient" cx="50%" cy="45%" r="62%">
        <stop offset="70%" stop-color="#fff" />
        <stop offset="100%" stop-color="#000" />
      </radialGradient>
      <mask id="scene-fade" maskUnits="userSpaceOnUse" x="0" y="-34" width="240" height="184">
        <rect x="0" y="-34" width="240" height="184" fill="url(#scene-fade-gradient)" />
      </mask>
    </defs>
    <g mask="url(#scene-fade)">
    <!-- Background, slowest first: soft heart and diamond clouds, then copses of club and spade trees -->
    <defs>
      <filter id="soft-cloud" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
      <clipPath id="sky-clip"><rect x="0" y="-34" width="240" height="184" /></clipPath>
    </defs>
    <g clip-path="url(#sky-clip)">
      <!-- Night: twinkling stars and a moon on a very slow arc -->
      {#each [{ x: 60.3, y: 8.1, r: 0.9, d: 3.2, dl: 2.5 }, { x: 20.9, y: -29.1, r: 1.3, d: 2.4, dl: 0.9 }, { x: 233.0, y: 2.9, r: 1.3, d: 2.9, dl: 2.6 }, { x: 40.3, y: 14.4, r: 1.3, d: 3.1, dl: 3.0 }, { x: 159.1, y: -25.5, r: 1.2, d: 3.2, dl: 1.2 }, { x: 13.1, y: 30.6, r: 1.0, d: 3.5, dl: 3.5 }, { x: 168.8, y: 34.5, r: 0.9, d: 3.7, dl: 1.8 }, { x: 219.3, y: 31.5, r: 0.7, d: 2.1, dl: 0.9 }, { x: 226.1, y: 0.5, r: 1.1, d: 2.5, dl: 2.0 }, { x: 94.0, y: -5.4, r: 1.1, d: 3.2, dl: 3.6 }, { x: 161.5, y: 35.0, r: 1.3, d: 4.2, dl: 2.7 }, { x: 43.2, y: 30.2, r: 1.4, d: 4.0, dl: 2.3 }, { x: 168.8, y: -15.2, r: 1.3, d: 3.2, dl: 1.1 }, { x: 20.5, y: 29.8, r: 1.4, d: 2.0, dl: 3.2 }] as star, i (i)}
        <circle class="star" cx={star.x} cy={star.y} r={star.r} fill="#f2efe6" style="--d: {star.d}s; --dl: {star.dl}s" />
      {/each}
      <g class="moon">
        <circle cx="190" cy="-6" r="13" fill="#f2efe6" opacity="0.18" filter="url(#soft-cloud)" />
        <circle cx="190" cy="-6" r="9" fill="#e9e5da" />
        <circle cx="187" cy="-8" r="2" fill="#cfcbc1" />
        <circle cx="193" cy="-3" r="1.4" fill="#cfcbc1" />
        <circle cx="192" cy="-10" r="1" fill="#cfcbc1" />
      </g>
      {#each clouds as cloud, i (i)}
        <g class="cloud" style="--dur: {cloud.dur}s; --delay: {cloud.delay}s">
          <text
            x="260"
            y={cloud.y}
            font-size={cloud.size}
            fill="#8f8c84"
            fill-opacity="0.5"
            filter="url(#soft-cloud)"
            transform="rotate({cloud.tilt} {260 + cloud.size * 0.35} {cloud.y - cloud.size * 0.35})"
          >{cloud.s}</text>
        </g>
      {/each}
      <g class="bank">
        <rect x="-400" y="104" width="1100" height="8" fill="#5a5852" />
        {#each [{ x: -360.0, s: '♠', size: 29 }, { x: -345.1, s: '♣', size: 21 }, { x: -334.3, s: '♠', size: 21 }, { x: -310.8, s: '♣', size: 19 }, { x: -300.9, s: '♣', size: 27 }, { x: -286.9, s: '♠', size: 21 }, { x: -258.6, s: '♣', size: 18 }, { x: -249.4, s: '♣', size: 22 }, { x: -237.9, s: '♣', size: 18 }, { x: -228.9, s: '♠', size: 26 }, { x: -180.0, s: '♠', size: 29 }, { x: -165.1, s: '♣', size: 21 }, { x: -154.3, s: '♠', size: 21 }, { x: -130.8, s: '♣', size: 19 }, { x: -120.9, s: '♣', size: 27 }, { x: -106.9, s: '♠', size: 21 }, { x: -78.6, s: '♣', size: 18 }, { x: -69.4, s: '♣', size: 22 }, { x: -57.9, s: '♣', size: 18 }, { x: -48.9, s: '♠', size: 26 }, { x: 0.0, s: '♠', size: 29 }, { x: 14.9, s: '♣', size: 21 }, { x: 25.7, s: '♠', size: 21 }, { x: 49.2, s: '♣', size: 19 }, { x: 59.1, s: '♣', size: 27 }, { x: 73.1, s: '♠', size: 21 }, { x: 101.4, s: '♣', size: 18 }, { x: 110.6, s: '♣', size: 22 }, { x: 122.1, s: '♣', size: 18 }, { x: 131.1, s: '♠', size: 26 }, { x: 180.0, s: '♠', size: 29 }, { x: 194.9, s: '♣', size: 21 }, { x: 205.7, s: '♠', size: 21 }, { x: 229.2, s: '♣', size: 19 }, { x: 239.1, s: '♣', size: 27 }, { x: 253.1, s: '♠', size: 21 }, { x: 281.4, s: '♣', size: 18 }, { x: 290.6, s: '♣', size: 22 }, { x: 302.1, s: '♣', size: 18 }, { x: 311.1, s: '♠', size: 26 }, { x: 360.0, s: '♠', size: 29 }, { x: 374.9, s: '♣', size: 21 }, { x: 385.7, s: '♠', size: 21 }, { x: 409.2, s: '♣', size: 19 }, { x: 419.1, s: '♣', size: 27 }, { x: 433.1, s: '♠', size: 21 }, { x: 461.4, s: '♣', size: 18 }, { x: 470.6, s: '♣', size: 22 }, { x: 482.1, s: '♣', size: 18 }, { x: 491.1, s: '♠', size: 26 }, { x: 540.0, s: '♠', size: 29 }, { x: 554.9, s: '♣', size: 21 }, { x: 565.7, s: '♠', size: 21 }, { x: 589.2, s: '♣', size: 19 }, { x: 599.1, s: '♣', size: 27 }, { x: 613.1, s: '♠', size: 21 }, { x: 641.4, s: '♣', size: 18 }, { x: 650.6, s: '♣', size: 22 }, { x: 662.1, s: '♣', size: 18 }, { x: 671.1, s: '♠', size: 26 }] as tree, i (i)}
          <text x={tree.x} y="108" font-size={tree.size} fill="#5a5852">{tree.s}</text>
        {/each}
      </g>
    </g>

    <g class="bob">
      <!-- Smoke: particles rising from each stack, drifting astern -->
      {#each [{ x: 88, y: 50, n: 4 }, { x: 106, y: 28, n: 6 }, { x: 124, y: 40, n: 5 }] as stack, s (s)}
        {#each Array.from({ length: stack.n }) as _, i (i)}
          <circle
            class="puff"
            cx={stack.x}
            cy={stack.y}
            r={2.6 + (i % 3) * 0.8}
            fill={['#d9d6cd', '#b9b6ad', '#9a978f'][i % 3]}
            style="--d: {((i * 0.47 + s * 0.31) % 2.4).toFixed(2)}s; --dx: {-18 - i * 4}px; --dy: {-26 - (i % 3) * 6}px"
          />
        {/each}
      {/each}

      <!-- Stacks: short, tall, medium; each breathes on its own beat -->
      <g class="stack" style="--b: 0s"><rect x="83" y="52" width="10" height="24" fill="#f2efe6" stroke="#111" stroke-width="2.5" /><rect x="81" y="49" width="14" height="5" fill="#111" /></g>
      <g class="stack" style="--b: 0.5s"><rect x="101" y="30" width="10" height="46" fill="#f2efe6" stroke="#111" stroke-width="2.5" /><rect x="99" y="27" width="14" height="5" fill="#111" /></g>
      <g class="stack" style="--b: 1s"><rect x="119" y="42" width="10" height="34" fill="#f2efe6" stroke="#111" stroke-width="2.5" /><rect x="117" y="39" width="14" height="5" fill="#111" /></g>

      <!-- Pilot house -->
      <rect x="150" y="62" width="30" height="14" fill="#f2efe6" stroke="#111" stroke-width="2.5" />
      <rect x="160" y="65" width="10" height="6" fill="#111" />

      <!-- Main cabin with suit windows -->
      <rect x="66" y="76" width="124" height="20" fill="#f2efe6" stroke="#111" stroke-width="2.5" />
      {#each ['♠', '♡', '♢', '♣'] as suit, i (suit)}
        <text x={86 + i * 28} y="91" text-anchor="middle" font-size="13" fill="#111">{suit}</text>
      {/each}

      <!-- Stern wheel, partly hidden behind the hull -->
      <g class="wheel">
        <circle cx="52" cy="97" r="20" fill="none" stroke="#f2efe6" stroke-width="2.5" />
        <circle cx="52" cy="97" r="4" fill="#f2efe6" />
        {#each Array.from({ length: 8 }) as _, i (i)}
          <line x1="52" y1="97" x2={52 + 20 * Math.cos((i * Math.PI) / 4)} y2={97 + 20 * Math.sin((i * Math.PI) / 4)} stroke="#f2efe6" stroke-width="2" />
          <rect
            x={52 + 20 * Math.cos((i * Math.PI) / 4) - 3}
            y={97 + 20 * Math.sin((i * Math.PI) / 4) - 3}
            width="6"
            height="6"
            fill="#f2efe6"
            transform="rotate({i * 45} {52 + 20 * Math.cos((i * Math.PI) / 4)} {97 + 20 * Math.sin((i * Math.PI) / 4)})"
          />
        {/each}
      </g>
      <!-- Hull, bow to the right -->
      <path d="M52 96 H206 L224 86 L208 116 H58 Z" fill="#111" stroke="#f2efe6" stroke-width="2.5" />

    </g>

    <!-- The river, over the hull and the bottom of the wheel (clipped to the picture) -->
    <defs>
      <clipPath id="river-clip"><rect x="0" y="-34" width="240" height="184" /></clipPath>
    </defs>
    <g clip-path="url(#river-clip)">
      <g class="waves back">
        <path d="M-60 110 Q-45 104 -30 110 T0 110 T30 110 T60 110 T90 110 T120 110 T150 110 T180 110 T210 110 T240 110 T270 110 T300 110 T330 110 T360 110 T390 110 T420 110 V150 H-60 Z" fill="#3a3935" />
        <path d="M-60 110 Q-45 104 -30 110 T0 110 T30 110 T60 110 T90 110 T120 110 T150 110 T180 110 T210 110 T240 110 T270 110 T300 110 T330 110 T360 110 T390 110 T420 110" fill="none" stroke="#9a978f" stroke-width="2" />
      </g>
      <g class="waves front">
        <path d="M-60 117 Q-45 110 -30 117 T0 117 T30 117 T60 117 T90 117 T120 117 T150 117 T180 117 T210 117 T240 117 T270 117 T300 117 T330 117 T360 117 T390 117 T420 117 V150 H-60 Z" fill="#2a2926" />
        <path d="M-60 117 Q-45 110 -30 117 T0 117 T30 117 T60 117 T90 117 T120 117 T150 117 T180 117 T210 117 T240 117 T270 117 T300 117 T330 117 T360 117 T390 117 T420 117" fill="none" stroke="#f2efe6" stroke-width="2.5" />
      </g>
    </g>
    </g>
  </svg>

  <div class="intertitle menu">
    <button class="ghost icon help" onclick={() => (showHowTo = true)} aria-label={t('title.howTo')}>?</button>
    <h1 class="game-title">
      <span class="line-1">{t('title.line1')}</span>
      <span class="line-2">{t('title.line2')}</span>
    </h1>
    <p class="tagline">{t(`title.tagline.${tagline}`)}</p>
  </div>
  </div>

  <!-- The same two buttons, in the same places, as at the table: black left, white right. -->
  <div class="dock">
    <div class="actions" class:single={!savedMonth}>
      {#if showHowTo}
        <span></span>
        <button onclick={() => (showHowTo = false)}>{t('draw.close')}</button>
      {:else if savedMonth}
        <button class="ghost" onclick={newVoyage}>{t('title.new')}</button>
        <button onclick={oncontinue}>{t('title.next')}</button>
      {:else}
        <span></span>
        <button onclick={onstart}>{t('title.new')}</button>
      {/if}
    </div>
  </div>

  {#if confirmAbandon}
    <div class="overlay">
      <div class="intertitle">
        <h2>{t('title.abandon')}</h2>
        <p>{t('title.abandonBody', { month: savedMonth ?? 0 })}</p>
        <div class="buttons">
          <button onclick={() => ((confirmAbandon = false), onstart())}>{t('title.abandonYes')}</button>
          <button class="ghost" onclick={() => (confirmAbandon = false)}>{t('title.abandonNo')}</button>
        </div>
      </div>
    </div>
  {/if}


</div>

<style>
  .title {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
  }
  /* The picture and the title card share the room evenly; the buttons keep to the bottom. */
  .stage {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 1rem;
    padding: 1rem 1rem 0;
  }
  /*
   * Lined up with the table's buttons (DrawTable .actions): same insets, the
   * black one as wide as three cards and their gaps, the white one the rest.
   */
  .dock {
    /* Above the title card's spotlight shadow, which dims everything around it. */
    position: relative;
    z-index: 1;
    --cw: 76px;
    --hgap: 0.75rem;
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    /* The table's own padding + its section padding + the section's 2px border. */
    padding: 1rem calc(1rem + 1rem + 2px) calc(0.75rem + 0.75rem + 2px);
  }
  .actions {
    display: grid;
    grid-template-columns: calc(3 * var(--cw) + 2 * var(--hgap)) 1fr;
    gap: var(--hgap);
  }
  .actions button {
    padding-top: 0.6em;
    padding-bottom: 0.6em;
    white-space: nowrap;
  }
  .actions button:not(.ghost) {
    outline-offset: -2px;
  }
  @media (max-width: 600px) {
    .dock {
      --cw: 54px;
      --hgap: 0.5rem;
      padding: 0.75rem calc(0.5rem + 0.5rem + 2px) calc(0.4rem + 0.5rem + 2px);
    }
    .actions button {
      font-size: 1.15rem;
    }
  }
  @media (max-width: 600px) {
    :global(.short) .dock {
      padding-bottom: calc(0.25rem + 0.35rem + 2px);
    }
  }
  .boat {
    width: min(380px, 84vw);
    margin: 0 auto;
    display: block;
    overflow: visible;
    /* Its own stacking order keeps the animated picture in step with the film overlay. */
    position: relative;
    z-index: 0;
  }
  .bob {
    transform-box: fill-box;
    transform-origin: center;
    animation: bob 1.6s ease-in-out infinite;
  }
  .wheel {
    transform-box: fill-box;
    transform-origin: center;
    animation: spin 6s linear infinite;
  }
  .stack {
    transform-box: fill-box;
    transform-origin: bottom center;
    animation: breathe 1.5s ease-in-out var(--b) infinite;
  }
  .puff {
    transform-box: fill-box;
    transform-origin: center;
    opacity: 0;
    animation: puff 2.4s ease-out var(--d) infinite;
  }
  .waves.front {
    animation: waves 2.8s linear infinite;
  }
  .waves.back {
    animation: waves 4.3s linear infinite;
  }
  .star {
    animation: twinkle var(--d) ease-in-out var(--dl) infinite;
  }
  .moon {
    /* Pivot far below the picture: the moon crosses the sky on a gentle arc. */
    transform-origin: 120px 420px;
    animation: moon 240s ease-in-out infinite alternate;
  }
  @keyframes twinkle {
    0%, 100% { opacity: 0.9; }
    50% { opacity: 0.15; }
  }
  @keyframes moon {
    from { transform: rotate(3deg); }
    to { transform: rotate(-14deg); }
  }
  .cloud {
    animation: cloud var(--dur) linear var(--delay) infinite;
  }
  .bank {
    animation: bank 40s linear infinite;
  }
  /* Clouds cross the whole sky; the copses repeat every 180 units, so the bank loops seamlessly. */
  @keyframes cloud { to { transform: translateX(-300px); } }
  @keyframes bank { to { transform: translateX(-180px); } }
  @keyframes bob { 50% { transform: translateY(3px) rotate(-1deg); } }
  /* Clockwise: the lower paddles sweep left, pushing the water astern as the boat goes right. */
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes breathe {
    0%, 100% { transform: scale(1, 1); }
    40% { transform: scale(1.12, 0.92); }
    60% { transform: scale(0.94, 1.06); }
  }
  @keyframes puff {
    0% { transform: translate(0, 0) scale(0.4); opacity: 0.95; }
    70% { opacity: 0.5; }
    100% { transform: translate(var(--dx), var(--dy)) scale(2.4); opacity: 0; }
  }
  /* One full wavelength per loop, so the last frame matches the first. */
  @keyframes waves { to { transform: translateX(-60px); } }
  .tagline {
    font-style: italic;
    color: var(--grey);
  }
  .menu {
    position: relative;
  }
  /* How it works, tucked into the corner of the menu card. */
  .help {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    padding: 0 0.55em;
    font-size: 1rem;
    border-radius: 50%;
  }
  .buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
    margin: 1.5rem 0 1rem;
  }
  .menu {
    padding-bottom: 1.5rem;
  }
  .game-title {
    line-height: 1;
    margin-bottom: 0.4em;
  }
  .game-title span {
    display: block;
  }
  /* "Steamboat" is a word shorter, so it runs a size larger to line up with "Snag Poker". */
  .line-1 {
    font-size: 1.06em;
    letter-spacing: 0.02em;
  }
  .line-2 {
    margin-top: 0.08em;
  }
  .overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 20;
  }
</style>
