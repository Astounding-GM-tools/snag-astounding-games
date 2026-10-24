<script lang="ts">
  import { DEFAULT_CONFIG, newGame, nextMonth, submitAction, type Action, type GameState } from '../engine';
  import CardZoom from './CardZoom.svelte';
  import DrawTable from './DrawTable.svelte';
  import MonthEnd from './MonthEnd.svelte';
  import Showdown from './Showdown.svelte';
  import Table from './Table.svelte';
  import Title from './Title.svelte';
  import { loadBest, loadGame, recordResult, saveGame } from './storage';

  let best = $state(loadBest());
  /** Paused or saved voyage, shown as "Continue" on the title screen. */
  let saved = $state.raw<GameState | null>(loadGame());
  // Engine state is replaced wholesale on every move, so keep it out of deep reactivity.
  let game = $state.raw<GameState | null>(null);
  /** After a duel: 'reveal' plays the showdown, then 'result' shows the month's card. */
  let stage = $state<'play' | 'reveal' | 'result'>('play');
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  /** The showdown has shown its verdict: the pot may be paid out on the table. */
  let settled = $state(true);

  function setGame(g: GameState | null) {
    game = g;
    if (g) {
      saveGame(g);
      saved = loadGame();
    }
  }

  function start() {
    stage = 'play';
    setGame(newGame(Date.now() >>> 0, DEFAULT_CONFIG));
  }

  function resume() {
    if (!saved) return;
    stage = saved.phase === 'duel' ? 'play' : 'result';
    game = saved;
  }

  function act(action: Action) {
    if (!game) return;
    const g = submitAction(game, action);
    if (g.phase === 'gameOver' || g.phase === 'victory') best = recordResult(g.month, g.phase === 'victory');
    setGame(g);
    if (g.phase !== 'duel') {
      // A fold has nothing to reveal: straight to the result card.
      if (g.config.playStyle === 'draw') {
        const folded = g.round?.result?.folded != null;
        settled = folded;
        if (folded) {
          // Nothing to reveal: let the pot fly to the winner, then show the result card.
          clearTimeout(endTimer);
          endTimer = setTimeout(() => (stage = 'result'), 1200);
        } else stage = 'reveal';
      }
      else {
        // Slots style: let the showdown sit on the table for a beat.
        clearTimeout(endTimer);
        endTimer = setTimeout(() => (stage = 'result'), 1400);
      }
    }
  }

  function next() {
    if (!game) return;
    stage = 'play';
    setGame(nextMonth(game));
  }

  function pause() {
    clearTimeout(endTimer);
    stage = 'play';
    game = null;
  }

  // A brand-new player (no game saved) goes straight to the table: there's only
  // one thing to do. The title screen is for choosing between a game in
  // progress and a new one.
  if (!loadGame()) start();
</script>

<div class="film">
  {#if game}
    {#if game.round?.playStyle === 'draw'}
      <DrawTable {game} {settled} {stage} onaction={act} onmenu={pause} onverdict={() => (settled = true)} onrevealed={() => (stage = 'result')} onnext={next} />
    {:else}
      <Table {game} peek={false} onaction={act} onmenu={pause} />
    {/if}
    {#if stage === 'reveal' && game.round?.result && game.round.playStyle !== 'draw'}
      <Showdown {game} ondone={() => (stage = 'result')} onverdict={() => (settled = true)} />
    {:else if stage === 'result' && game.report && (game.round?.playStyle !== 'draw' || game.phase !== 'monthEnd')}
      <MonthEnd {game} onnext={next} onpause={pause} onagain={() => start()} />
    {/if}
  {:else}
    <Title savedMonth={saved?.month ?? null} onstart={() => start()} oncontinue={resume} />
  {/if}
</div>
<CardZoom />
