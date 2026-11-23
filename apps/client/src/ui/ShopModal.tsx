import { ITEMS, SHOPS } from '@neon-wilds/sim';
import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { useGamepadNav } from './useGamepadNav';

export function ShopModal() {
  const shopId = useGameStore((s) => s.shopId);
  const progress = useGameStore((s) => s.progress);
  const first = useRef<HTMLButtonElement>(null);
  useGamepadNav(!!shopId);
  useEffect(() => {
    if (shopId) first.current?.focus();
  }, [shopId]);
  if (!shopId) return null;
  const shop = SHOPS[shopId];
  if (!shop) return null;
  const money = progress?.money ?? 0;
  const owned = (id: string) => progress?.inventory.find((i) => i.id === id)?.qty ?? 0;
  const store = useGameStore.getState();

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
      <div className="panel flex w-[min(620px,94vw)] flex-col gap-4 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="neon-title font-pixel text-sm text-neon-yellow">{shop.name}</h2>
          <span className="font-pixel text-xs text-neon-yellow">{money}₵</span>
        </div>
        <div className="flex flex-col gap-2">
          {shop.items.map((id, i) => {
            const item = ITEMS[id];
            if (!item) return null;
            return (
              <button
                key={id}
                ref={i === 0 ? first : undefined}
                data-nav
                disabled={money < item.price}
                className="pixel-button flex items-center justify-between gap-4 !py-2"
                onClick={() => store.command({ type: 'shop.buy', shopId, itemId: id, qty: 1 })}
              >
                <span className="flex flex-col">
                  <span>{item.name}</span>
                  <span className="font-term text-base normal-case text-slate-400">{item.description}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end font-term text-lg normal-case">
                  <span className="text-neon-yellow">{item.price}₵</span>
                  <span className="text-slate-400">own {owned(id)}</span>
                </span>
              </button>
            );
          })}
        </div>
        <button data-nav data-nav-back className="pixel-button text-center" onClick={() => store.setShop(null)}>
          Leave (Esc)
        </button>
      </div>
    </div>
  );
}
