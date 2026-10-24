<script lang="ts">
  import { HUMAN_ID, type DuelSummary, type GameState } from '../engine';
  import { t } from '../i18n';
  import { dollars, jokerList, shortName } from './format';
  import { describeHand } from './handNames';

  interface Props {
    game: GameState;
    onnext: () => void;
    onpause: () => void;
    onagain: () => void;
  }
  let { game, onnext, onpause, onagain }: Props = $props();

  const report = $derived(game.report!);
  const res = $derived(report.duel.result);
  const foe = $derived(report.duel.players[1]);
  const won = $derived(res.winner === 0);
  const mine = $derived(report.money[HUMAN_ID]);
  const potMode = $derived(game.round?.potMode ?? false);
  const paidIn = $derived(potMode ? (game.round?.bets[0] ?? 0) : 0);
  const loss = $derived(!potMode && res.winner === 1 ? Math.round(res.gain * game.config.loserPays) : 0);
  const youFolded = $derived(res.folded === 0 && res.winner === 1);
  const theyFolded = $derived(res.folded === 1 && res.winner === 0);
  const over = $derived(game.phase === 'gameOver' || game.phase === 'victory');

  const headline = $derived(
    game.phase === 'gameOver' ? t('end.gameOver')
    : game.phase === 'victory' ? t('end.winGame')
    : youFolded ? t('end.folded')
    : res.winner === null ? t('end.draw')
    : won ? t('end.victory') : t('end.catastrophe'),
  );

  /** Rivals still afloat when you go broke: with only one, they take the river. */
  const rivalsLeft = $derived(game.players.filter((p) => p.id !== HUMAN_ID && p.status === 'active'));

  const statusOrder = { active: 0, waiting: 1, eliminated: 2 } as const;
  const standings = $derived(
    [...game.players].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || b.money - a.money),
  );

  function duelLine(d: DuelSummary): string {
    const r = d.result;
    if (r.folded !== null && r.folded !== undefined && r.winner !== null) {
      return t('end.duelFold', { folder: shortName(d.players[r.folded]), winner: shortName(d.players[r.winner]), n: r.pot });
    }
    if (r.winner === null) return t('end.duelDraw', { a: shortName(d.players[0]), b: shortName(d.players[1]) });
    const loser = shortName(d.players[1 - r.winner]);
    const moved = [...r.dumped, ...r.communityTaken];
    const jokers =
      moved.length === 0 ? ''
      : moved.length === 1 ? ' ' + t('end.newJoker', { name: loser, joker: jokerList(moved) })
      : ' ' + t('end.newJokers', { name: loser, jokers: jokerList(moved) });
    return t('end.duel', { winner: shortName(d.players[r.winner]), loser, hand: describeHand(r.hands[r.winner]) }) + jokers;
  }
</script>

<div class="overlay">
  <div class="intertitle">
    <div class="flourish">❦ ❦ ❦</div>
    <h1>{headline}</h1>

    {#if game.phase === 'gameOver'}
      <p>{t('end.gameOverBody')}</p>
      <p>{rivalsLeft.length === 1 ? t('end.gameOverKing', { name: shortName(rivalsLeft[0].id) }) : t('end.gameOverMany')}</p>
    {:else if game.phase === 'victory'}
      <p>{t('end.lastStanding', { month: game.month })}</p>
    {/if}

    <!-- The end of the tournament says only what matters; the round's details were on the table. -->
    {#if !over}
    <div class="ledger">
      {#if res.winner === null}
        <p>{t('end.draw.body')}</p>
      {:else if won}
        {#if theyFolded}<p>{t('end.theyFolded', { name: shortName(foe) })}</p>{/if}
        <p class="big">{potMode ? t('end.potWon', { n: res.pot }) : t('end.gain', { n: res.gain })}</p>
        {#if res.dumped.length}<p>{t('end.dumped', { jokers: jokerList(res.dumped) })}</p>{/if}
        {#if res.forfeit}<p>{t('end.forfeitWon', { name: shortName(foe), n: res.forfeit })}</p>{/if}
        {#if res.communityTaken.length}<p>{t('end.dodged', { name: shortName(foe), jokers: jokerList(res.communityTaken) })}</p>{/if}
      {:else}
        {#if youFolded}<p>{t('end.youFolded')}</p>{/if}
        {#if potMode}<p class="big">{t('end.potLost', { name: shortName(foe), n: res.pot })}</p>{/if}
        {#if loss}<p class="big">{t('end.loss', { n: loss })}</p>{/if}
        {#if res.forfeit}<p class="big">{t('end.forfeitLost', { n: res.forfeit })}</p>{/if}
        {#if res.dumped.length}<p class="big">{t('end.gotDumped', { name: shortName(foe), jokers: jokerList(res.dumped) })}</p>{/if}
        {#if res.communityTaken.length}<p class="big">{t('end.tookCommunity', { jokers: jokerList(res.communityTaken) })}</p>{/if}
        {#if !potMode && !loss && !res.forfeit && !res.dumped.length && !res.communityTaken.length}<p>{t('end.noHarm')}</p>{/if}
      {/if}
      {#if paidIn}<p>{t('end.paidIn', { n: paidIn })}</p>{/if}
      {#if mine?.drained}<p>{t('end.drain', { n: mine.drained })}</p>{/if}
      {#if mine}<p class="pop">{t('table.money')}: {dollars(mine.before)} → <b>{dollars(mine.after)}</b></p>{/if}
    </div>

    <table class="standings">
      <tbody>
        {#each standings as p (p.id)}
          <tr class:out={p.status !== 'active'} class:me={p.id === HUMAN_ID}>
            <td>{p.id === HUMAN_ID ? t('character.captain.you') : shortName(p.id)}</td>
            <td>
              {#if p.status === 'eliminated'}{t('table.out')}
              {:else if p.status === 'waiting'}{t('table.waiting')}
              {:else}{dollars(p.money)}{/if}
            </td>
            <td>{p.status === 'active' ? '🪵'.repeat(p.jokers.length) || '·' : ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if report.offscreen.length || report.eliminated.length || report.joined.length || report.sittingOut}
      <div class="news">
        <h2>{t('end.meanwhile')}</h2>
        {#each report.offscreen as d}<p>{duelLine(d)}</p>{/each}
        {#if report.sittingOut}<p>{t('end.satOut', { name: shortName(report.sittingOut) })}</p>{/if}
        {#each report.eliminated.filter((id) => id !== HUMAN_ID) as id}<p><b>{t('end.eliminated', { name: shortName(id) })}</b></p>{/each}
        {#each report.joined as id}<p><b>{t('end.joined', { name: shortName(id) })}</b></p>{/each}
      </div>
    {/if}

    {/if}

    <div class="buttons">
      {#if over}
        <button onclick={onagain}>{t('end.again')}</button>
        <button class="ghost" onclick={onpause}>{t('end.toTitle')}</button>
      {:else}
        <button onclick={onnext}>{t('end.next')}</button>
        <button class="ghost" onclick={onpause}>{t('end.pause')}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 20;
    animation: iris 0.5s ease-out;
  }
  @keyframes iris {
    from { clip-path: circle(0% at 50% 50%); }
    to { clip-path: circle(150% at 50% 50%); }
  }
  .intertitle {
    width: 100%;
    max-height: 94vh;
    overflow: auto;
  }
  /* A phone: less padding, so the summary fits the screen. */
  @media (max-width: 480px) {
    .intertitle {
      padding: 1.25rem 1rem;
    }
  }
  .ledger p {
    margin: 0.35rem 0;
  }
  .big {
    font-family: var(--title-font);
    font-size: 1.4rem;
  }
  .pop {
    color: var(--grey);
  }
  .pop b {
    color: var(--paper);
  }
  .standings {
    margin: 1rem auto 0;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .standings td {
    padding: 2px 0.75rem;
    border-bottom: 1px dotted var(--dim);
    text-align: left;
  }
  .standings .me {
    font-weight: bold;
  }
  .standings .out {
    color: var(--dim);
    text-decoration: line-through;
  }
  .news {
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px dashed var(--grey);
    font-size: 0.9rem;
    color: var(--grey);
  }
  .news h2 {
    font-size: 1.2rem;
    color: var(--paper);
  }
  .news p {
    margin: 0.25rem 0;
  }
  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 1.5rem;
  }
</style>
