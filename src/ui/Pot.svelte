<script lang="ts">
  /**
   * The pot as coins, one a dollar, in stacks of ten filling in from the left:
   * the opponent's chips just above the middle, yours just below. No figure;
   * the stacks say it. Each coin is tagged (seat and number) so the table can
   * fly coins in from the purses onto the right spot.
   */
  let { bets, paid = false }: { bets: [number, number]; paid?: boolean } = $props();

  const STACK = 10;
  const W = 18;
  const STEP = 2.6;
  const GAP = 20;
  /** A row would hold about 15 stacks on a phone; pots that big wrap onto another row. */
  let width = $state(320);
  const perRow = $derived(Math.max(1, Math.floor((width - W) / GAP) + 1) * STACK);

  function coins(n: number) {
    return Array.from({ length: Math.max(0, n) }, (_, k) => {
      const stack = Math.floor(k / STACK);
      const row = Math.floor(k / perRow);
      return { k, x: (stack - row * (perRow / STACK)) * GAP + W / 2, y: (k % STACK) * STEP, row };
    });
  }
  const theirs = $derived(coins(bets[1]));
  const mine = $derived(coins(bets[0]));
</script>

<div class="pot" class:paid bind:clientWidth={width} aria-hidden="true">
  <div class="half theirs">
    {#each theirs as c (c.k)}
      <span class="coin" data-seat="1" data-k={c.k} style="left: {c.x}px; bottom: {c.y + c.row * 32}px"></span>
    {/each}
  </div>
  <div class="half mine">
    {#each mine as c (c.k)}
      <span class="coin" data-seat="0" data-k={c.k} style="left: {c.x}px; bottom: {c.y - c.row * 32}px"></span>
    {/each}
  </div>
</div>

<style>
  .pot {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }
  /* Each half is one stack tall; theirs sits on the middle line, yours hangs just below it. */
  .half {
    position: relative;
    height: 32px;
  }
  .coin {
    position: absolute;
    width: 18px;
    height: 6px;
    border-radius: 50%;
    background: linear-gradient(#fff, #a9a69e);
    border: 1px solid #111;
    transform: translateX(-50%);
  }
  .paid .coin {
    visibility: hidden;
  }
  /* Short screens (decided once at load, so hiding browser bars never changes it). */
  :global(.short) .half {
    height: 28px;
  }
</style>
