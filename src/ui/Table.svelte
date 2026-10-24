<script lang="ts">
  import { HUMAN_ID, STREETS, bestHand, isJoker, isLegal, legalActions, player, type Action, type Card, type GameState } from '../engine';
  import { t } from '../i18n';
  import CardView from './CardView.svelte';
  import SidePanel from './SidePanel.svelte';
  import { cardLabel, dollars, name } from './format';

  interface Props {
    game: GameState;
    peek: boolean;
    onaction: (a: Action) => void;
    onmenu: () => void;
  }
  let { game, peek, onaction, onmenu }: Props = $props();

  let selectedId = $state<string | null>(null);

  const round = $derived(game.round!);
  const config = $derived(game.config);
  const me = $derived(round.seats[0]);
  const them = $derived(round.seats[1]);
  const opponentId = $derived(game.opponentId!);
  const playing = $derived(game.phase === 'duel');
  const opponent = $derived(player(game, opponentId));

  const findCard = (id: string): Card | undefined => [...me.hand, ...me.jokers].find((c) => c.id === id);

  const myHand = $derived(bestHand(me.slots, round.community, config.ownCards));
  const usedIds = $derived(new Set(myHand.cards.map((c) => c.id)));
  const theirJokerCount = $derived(them.jokers.length + them.slots.filter(isJoker).length);
  const stakes = $derived([
    ...(round.communityJoker ? [round.communityJoker] : []),
    ...round.community.filter(isJoker),
    ...them.slots.filter(isJoker),
  ]);
  const lastMoves = $derived(round.history.at(-1));
  const streetName = $derived(round.street <= 2 ? STREETS[round.street] : 'showdown');
  /** Community cards from this index on were revealed on the latest street. */
  const freshFrom = $derived(round.community.length - config.communitySchedule[Math.min(round.street, 2)]);
  const mustPass = $derived(playing && legalActions(round, 0)[0].type === 'pass');
  /** Which street each community position is revealed on, for placeholders. */
  const boardStreets = $derived(config.communitySchedule.flatMap((n, street) => Array<string>(n).fill(STREETS[street])));
  const ruleText = $derived(
    config.ownCards.min === config.ownCards.max
      ? t('table.rule.exact', { n: config.ownCards.min })
      : t('table.rule.range', { min: config.ownCards.min, max: Math.min(config.ownCards.max, config.slotCount) }),
  );

  function select(card: Card) {
    if (!playing) return;
    selectedId = selectedId === card.id ? null : card.id;
  }

  /** A card laid is a card played: actions go straight to the table. */
  function play(action: Action) {
    if (!playing || !isLegal(round, 0, action)) return;
    selectedId = null;
    onaction(action);
  }

  function toSlot(slot: number, id = selectedId) {
    if (id) play({ type: 'place', cardId: id, slot });
  }

  function toDiscard(id = selectedId) {
    if (id && !isJoker(findCard(id))) play({ type: 'discard', cardId: id });
  }

  const dragStart = (card: Card) => (e: DragEvent) => {
    e.dataTransfer?.setData('text/plain', card.id);
    selectedId = card.id;
  };
  const dropId = (e: DragEvent) => {
    e.preventDefault();
    return e.dataTransfer?.getData('text/plain') || null;
  };
  const allowDrop = (e: DragEvent) => e.preventDefault();

  function describe(action: Action, who: string, slots: (Card | null)[]): string {
    if (action.type === 'pass') return t('log.pass', { name: who });
    if (action.type !== 'place') return t('log.discard', { name: who });
    const card = slots[action.slot];
    return t('log.place', { name: who, card: card ? cardLabel(card) : '?', n: action.slot + 1 });
  }

</script>

<div class="table">
  <!-- Opponent -->
  <section class="opponent">
    <div class="portrait">
      <div class="oval">{name(opponentId)[0]}</div>
      <div>
        <h2>{name(opponentId)}</h2>
        <p class="boat">{t(`character.${opponentId}.boat`)}</p>
        <p class="blurb">{t(`character.${opponentId}.blurb`)}</p>
        <p class="stats">
          {t('table.money')}: <b>{dollars(opponent.money)}</b> · {t(theirJokerCount === 1 ? 'table.jokerCount.one' : 'table.jokerCount', { n: theirJokerCount })}
        </p>
      </div>
    </div>
    <div class="row">
      <div class="hand-backs">
        {#each them.hand as card (card.id)}
          <CardView small faceDown={!peek} card={peek ? card : null} />
        {/each}
        {#each them.jokers as card (card.id)}
          <CardView small faceDown={!peek} card={peek ? card : null} />
        {/each}
        <span class="count">{t('table.cards', { n: them.hand.length + them.jokers.length })}</span>
      </div>
      <div class="slots">
        {#each them.slots as card, i}
          <CardView {card} fresh={lastMoves?.actions[1].type === 'place' && lastMoves.actions[1].slot === i} placeholder={t('table.slot', { n: i + 1 })} />
        {/each}
      </div>
    </div>
    {#if lastMoves}
      <p class="log">{describe(lastMoves.actions[1], name(opponentId), them.slots)}</p>
    {/if}
  </section>

  <!-- The river -->
  <section class="river">
    <div class="street">{t(`street.${streetName}`)}</div>
    <div class="river-row">
      <div class="community">
        {#each boardStreets as street, i}
          <CardView
            card={round.community[i] ?? null}
            fresh={!!round.community[i] && i >= freshFrom}
            used={!!round.community[i] && usedIds.has(round.community[i].id)}
            placeholder={t(`street.${street}`)}
          />
        {/each}
        {#if config.jokerMode === 'slot'}
          <div class="joker-slot">
            <CardView card={round.communityJoker} placeholder="🪵?" />
          </div>
        {/if}
      </div>
      <div
        class="target discard"
        class:armed={!!selectedId && !isJoker(findCard(selectedId))}
        role="button"
        tabindex="0"
        onclick={() => toDiscard()}
        onkeydown={(e) => e.key === 'Enter' && toDiscard()}
        ondragover={allowDrop}
        ondrop={(e) => toDiscard(dropId(e))}
      >
        <span class="discard-label">{t('table.discard')}</span>
        <CardView card={round.discards.at(-1) ?? null} placeholder="✕" />
      </div>
    </div>
    <p class="stakes">
      {#if stakes.length}{t('table.stakes')}: {stakes.map(cardLabel).join(', ')}{:else}{t('table.noStakes')}{/if}
    </p>
  </section>

  <!-- The Captain -->
  <section class="captain">
    <div class="row targets">
      {#each me.slots as card, i}
        <div
          class="target"
          class:armed={!!selectedId}
          role="button"
          tabindex="0"
          onclick={() => toSlot(i)}
          onkeydown={(e) => e.key === 'Enter' && toSlot(i)}
          ondragover={allowDrop}
          ondrop={(e) => toSlot(i, dropId(e))}
        >
          <CardView {card} used={!!card && usedIds.has(card.id)} faded={!!card && !isJoker(card) && !usedIds.has(card.id)} placeholder={t('table.slot', { n: i + 1 })} />
        </div>
      {/each}
      <div class="best">
        {t('table.yourBest', { hand: t(`hand.${myHand.category}`) })}
        <small>{ruleText}</small>
      </div>
    </div>

    <div class="row hand">
      {#each me.hand as card (card.id)}
        <CardView {card} selected={selectedId === card.id} onclick={() => select(card)} ondragstart={playing ? dragStart(card) : undefined} />
      {/each}
      {#if me.jokers.length}
        <div class="jokers">
          {#each me.jokers as card (card.id)}
            <CardView small {card} selected={selectedId === card.id} onclick={() => select(card)} ondragstart={playing ? dragStart(card) : undefined} />
          {/each}
        </div>
      {/if}
    </div>

    {#if playing}
      <div class="row controls">
        {#if mustPass}
          <span class="hint">{t('table.mustPass')}</span>
          <button onclick={() => play({ type: 'pass' })}>{t('table.pass')}</button>
        {:else}
          <span class="hint">{t('table.hint')}</span>
        {/if}
      </div>
    {/if}
  </section>

  <SidePanel {game} {opponentId} {onmenu} />
</div>

