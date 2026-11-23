import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { CreatureIcon } from './widgets';
import { useGamepadNav } from './useGamepadNav';

export function ShopModal() {
  const shopId = useGameStore((s) => s.shopId);
  // Re-render whenever progression changes (money, inventory, party).
  useGameStore((s) => s.progress);
  const first = useRef<HTMLButtonElement>(null);
  useGamepadNav(!!shopId);
  useEffect(() => {
    if (shopId) first.current?.focus();
  }, [shopId]);
  if (!shopId) return null;
  const store = useGameStore.getState();
  const shop = store.queries?.shop(shopId);
  if (!shop) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
      <div className="panel flex max-h-[92vh] w-[min(680px,94vw)] flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="neon-title font-pixel text-sm text-neon-yellow">{shop.name}</h2>
          <span className="font-pixel text-xs text-neon-yellow">{shop.money}₵</span>
        </div>
        <div className="flex flex-col gap-2">
          {shop.items.map((item, i) => (
            <button
              key={item.id}
              ref={i === 0 ? first : undefined}
              data-nav
              disabled={shop.money < item.price}
              className="pixel-button flex items-center justify-between gap-4 !py-2"
              onClick={() => store.command({ type: 'shop.buy', shopId, itemId: item.id, qty: 1 })}
            >
              <span className="flex flex-col">
                <span>{item.name}</span>
                <span className="font-term text-base normal-case text-slate-400">{item.description}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end font-term text-lg normal-case">
                <span className="text-neon-yellow">{item.price}₵</span>
                <span className="text-slate-400">own {item.owned}</span>
              </span>
            </button>
          ))}
        </div>
        {shop.blackMarket && (
          <div className="flex flex-col gap-2 border-t-2 border-night-700 pt-3">
            <h3 className="font-pixel text-[10px] text-neon-pink">Back room — no questions asked</h3>
            <p className="font-term text-lg text-slate-400">
              The pawnbroker buys Wildlings. Prices drop as the market floods. The Gutter Saints will hear about it.
            </p>
            {shop.sellables.length === 0 && <p className="font-term text-lg text-slate-500">Nothing you can sell.</p>}
            {shop.sellables.map((w) => (
              <button
                key={`${w.from}-${w.index}`}
                data-nav
                className="pixel-button flex items-center justify-between gap-3 !py-1"
                onClick={() => store.command({ type: 'market.sellWildling', from: w.from, index: w.index })}
              >
                <span className="flex items-center gap-2">
                  <CreatureIcon speciesId={w.speciesId} size={32} />
                  {w.name} Lv{w.level} <span className="text-slate-500">({w.from})</span>
                </span>
                <span className="font-term text-lg normal-case text-neon-yellow">sell {w.price}₵</span>
              </button>
            ))}
          </div>
        )}
        <button data-nav data-nav-back className="pixel-button text-center" onClick={() => store.setShop(null)}>
          Leave (Esc)
        </button>
      </div>
    </div>
  );
}
