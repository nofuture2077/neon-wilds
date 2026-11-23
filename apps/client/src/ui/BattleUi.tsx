import type { BattleAction } from '@neon-wilds/sim';
import { useEffect, useRef } from 'react';
import { type ShownCreature, useGameStore } from '../state/gameStore';
import { HpBar, StatusBadge, TypeBadge } from './widgets';
import { useGamepadNav } from './useGamepadNav';

/** Battle overlay: status panels, the narration box and command menus. */
export function BattleUi() {
  const battle = useGameStore((s) => s.battle);
  const menuRef = useRef<HTMLDivElement>(null);
  useGamepadNav(!!battle && !battle.message);

  const showMenu = !!battle && !battle.message && battle.queue.length === 0 && !battle.outcome;
  useEffect(() => {
    if (!showMenu) return;
    // Small delay so the key-up of the press that dismissed the last message can't click the first button.
    const t = setTimeout(() => menuRef.current?.querySelector<HTMLElement>('[data-nav]:not([disabled])')?.focus(), 180);
    return () => clearTimeout(t);
  }, [showMenu, battle?.menu]);

  useEffect(() => {
    if (!battle) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Escape' || e.key === 'Backspace') && battle.menu !== 'main' && battle.view.phase !== 'force-switch') {
        e.preventDefault();
        useGameStore.getState().battleMenu('main');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [battle]);

  if (!battle) return null;
  const { view } = battle;
  const act = (action: BattleAction) => useGameStore.getState().command({ type: 'battle.action', action });
  const forceSwitch = view.phase === 'force-switch';
  const menu = forceSwitch ? 'party' : battle.menu;
  const store = useGameStore.getState();

  return (
    <div className="absolute inset-0 select-none">
      <CreaturePanel c={battle.enemy} className="left-6 top-6" subtitle={view.kind === 'trainer' ? `${view.trainerName} · ${view.enemyRemaining}/${view.enemyPartySize} left` : 'Wild'} />
      <CreaturePanel c={battle.player} className="bottom-52 right-6" mine />

      <div className="absolute inset-x-0 bottom-0 flex h-48 gap-3 p-4">
        <button
          type="button"
          className="panel flex-1 cursor-pointer px-5 py-4 text-left font-term text-2xl leading-snug outline-none"
          onClick={() => store.battleAdvance()}
        >
          {battle.message ?? (battle.outcome ? '' : forceSwitch ? 'Choose a Wildling to send out.' : `What will ${battle.player.name} do?`)}
          {(battle.message || battle.outcome) && <span className="blink ml-2 font-pixel text-xs text-slate-400">▾</span>}
        </button>

        {showMenu && (
          <div ref={menuRef} className="panel w-[min(520px,50vw)] overflow-y-auto p-3">
            {menu === 'main' && (
              <div className="grid h-full grid-cols-2 gap-2">
                <MenuButton label="Fight" onClick={() => store.battleMenu('skills')} />
                <MenuButton label="Snare" disabled={view.kind !== 'wild' || view.snares.length === 0} onClick={() => store.battleMenu('snares')} />
                <MenuButton label="Bag" disabled={view.medicine.length === 0} onClick={() => store.battleMenu('items')} />
                <MenuButton label="Party" onClick={() => store.battleMenu('party')} />
                {view.kind === 'wild' && <MenuButton label="Run" onClick={() => act({ kind: 'flee' })} />}
              </div>
            )}
            {menu === 'skills' && (
              <div className="grid grid-cols-2 gap-2">
                {view.party[view.activeIndex]?.skills.map((s, i) => (
                  <button key={s.id} data-nav className="pixel-button !p-2 !text-[10px]" onClick={() => act({ kind: 'skill', index: i })} title={s.description}>
                    <div>{s.name}</div>
                    <div className="mt-1 flex items-center gap-2 font-term text-base normal-case text-slate-400">
                      <TypeBadge type={s.type} />
                      {s.category === 'status' ? 'status' : `pow ${s.power}`}
                    </div>
                  </button>
                ))}
                <BackButton />
              </div>
            )}
            {menu === 'snares' && (
              <div className="flex flex-col gap-2">
                {view.snares.map((s) => (
                  <button key={s.id} data-nav className="pixel-button flex justify-between" onClick={() => act({ kind: 'capture', itemId: s.id })}>
                    <span>{s.name}</span>
                    <span>×{s.qty}</span>
                  </button>
                ))}
                <BackButton />
              </div>
            )}
            {menu === 'items' && (
              <div className="flex flex-col gap-2">
                {view.medicine.map((m) => (
                  <button key={m.id} data-nav className="pixel-button flex justify-between" title={m.description} onClick={() => store.battleChooseItem(m.id)}>
                    <span>{m.name}</span>
                    <span>×{m.qty}</span>
                  </button>
                ))}
                <BackButton />
              </div>
            )}
            {menu === 'party' && (
              <div className="flex flex-col gap-2">
                {battle.pendingItem && <div className="font-term text-lg text-neon-yellow">Use on which Wildling?</div>}
                {view.party.map((w, i) => (
                  <button
                    key={w.uid}
                    data-nav
                    disabled={w.hp <= 0 || (!battle.pendingItem && i === view.activeIndex && !forceSwitch)}
                    className="pixel-button flex items-center justify-between gap-3 !py-2"
                    onClick={() =>
                      battle.pendingItem
                        ? act({ kind: 'item', itemId: battle.pendingItem, partyIndex: i })
                        : act({ kind: 'switch', partyIndex: i })
                    }
                  >
                    <span>
                      {w.name} <span className="text-slate-400">Lv{w.level}</span>
                    </span>
                    <span className="flex items-center gap-2 font-term text-lg">
                      <StatusBadge status={w.status} />
                      {w.hp}/{w.maxHp}
                    </span>
                  </button>
                ))}
                {!forceSwitch && <BackButton />}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button data-nav disabled={disabled} className="pixel-button text-center" onClick={onClick}>
      {label}
    </button>
  );
}

function BackButton() {
  return (
    <button data-nav data-nav-back className="pixel-button !text-[10px] text-slate-400" onClick={() => useGameStore.getState().battleMenu('main')}>
      Back
    </button>
  );
}

function CreaturePanel({ c, className, mine = false, subtitle }: { c: ShownCreature; className: string; mine?: boolean; subtitle?: string }) {
  return (
    <div className={`panel absolute w-72 px-4 py-3 ${className}`}>
      <div className="flex items-baseline justify-between">
        <span className={`font-pixel text-xs ${mine ? 'text-neon-cyan' : 'text-neon-pink'}`}>{c.name}</span>
        <span className="font-pixel text-[10px] text-slate-300">Lv{c.level}</span>
      </div>
      {subtitle && <div className="font-term text-base text-slate-400">{subtitle}</div>}
      <div className="mt-2 flex items-center gap-2">
        <span className="font-pixel text-[8px] text-neon-yellow">HP</span>
        <HpBar hp={c.hp} max={c.maxHp} wide />
        <StatusBadge status={c.status} />
      </div>
      {mine && (
        <div className="mt-1 text-right font-term text-lg text-slate-300">
          {c.hp}/{c.maxHp}
        </div>
      )}
    </div>
  );
}
