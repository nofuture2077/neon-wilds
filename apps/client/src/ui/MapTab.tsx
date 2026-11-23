import { Tile } from '@neon-wilds/sim';
import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';

const COLORS: Record<number, string> = {
  [Tile.Road]: '#25212f',
  [Tile.RoadLineH]: '#25212f',
  [Tile.RoadLineV]: '#25212f',
  [Tile.CrosswalkH]: '#4a4460',
  [Tile.CrosswalkV]: '#4a4460',
  [Tile.Sidewalk]: '#3b3548',
  [Tile.Alley]: '#2a2433',
  [Tile.Grass]: '#1f4a2c',
  [Tile.Plaza]: '#4a3f4f',
  [Tile.Water]: '#1b3f7a',
  [Tile.Building]: '#15121c',
  [Tile.Tree]: '#1a3a24',
  [Tile.Lot]: '#2a2228',
};
const FACTION_COLOR: Record<string, string> = { saints: '#d7dde8', halcyon: '#00e5ff', compact: '#4fffb0', 'iron-chain': '#ff9a30' };

/** City map with district names, territory overlay, landmarks and mission markers. */
export function MapTab() {
  const ref = useRef<HTMLCanvasElement>(null);
  const map = useGameStore.getState().queries?.map();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !map) return;
    const s = Math.max(3, Math.floor(Math.min(860 / map.width, 520 / map.height)));
    canvas.width = map.width * s;
    canvas.height = map.height * s;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        ctx.fillStyle = COLORS[map.tiles[y * map.width + x]!] ?? '#000';
        ctx.fillRect(x * s, y * s, s, s);
      }
    }
    // Territory: tint each block's tiles in its controller's colour; outline the block edge.
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const id = map.blockMap[y * map.width + x]!;
        if (id < 0) continue;
        const controller = map.blocks[id]?.controller;
        const c = controller ? FACTION_COLOR[controller] : null;
        if (!c) continue;
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = c;
        ctx.fillRect(x * s, y * s, s, s);
        const edge = map.blockMap[y * map.width + x - 1] !== id || map.blockMap[y * map.width + x + 1] !== id || map.blockMap[(y - 1) * map.width + x] !== id || map.blockMap[(y + 1) * map.width + x] !== id;
        if (edge) {
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x * s, y * s, s, s);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    for (const p of map.places) {
      ctx.fillStyle = p.kind === 'clinic' ? '#4fffb0' : p.kind === 'shop' ? '#fff275' : '#b37dff';
      ctx.fillRect(p.x * s - 3, p.y * s - 3, 6, 6);
    }
    for (const m of map.markers) {
      ctx.fillStyle = '#fff275';
      ctx.beginPath();
      ctx.moveTo(m.x * s, m.y * s + 6);
      ctx.lineTo(m.x * s - 6, m.y * s - 6);
      ctx.lineTo(m.x * s + 6, m.y * s - 6);
      ctx.fill();
    }
    ctx.font = `${Math.max(10, s * 3)}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    for (const d of map.districts) {
      ctx.fillStyle = 'rgba(7,7,15,0.7)';
      const w = ctx.measureText(d.name.toUpperCase()).width;
      ctx.fillRect(d.x * s - w / 2 - 4, d.y * s - s * 3 - 4, w + 8, s * 3 + 8);
      ctx.fillStyle = '#7ff6ff';
      ctx.fillText(d.name.toUpperCase(), d.x * s, d.y * s);
    }
    ctx.fillStyle = '#ff3fa4';
    ctx.beginPath();
    ctx.arc(map.player.x * s, map.player.y * s, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }, [map]);

  if (!map) return null;
  return (
    <div className="flex flex-col gap-3">
      <canvas ref={ref} className="max-w-full self-center border-2 border-night-700" style={{ imageRendering: 'pixelated' }} />
      <div className="flex flex-wrap gap-4 font-term text-lg text-slate-300">
        <Legend color="#ff3fa4" label="You" round />
        <Legend color="#fff275" label="Objective / shop" />
        <Legend color="#4fffb0" label="Clinic" />
        <Legend color="#b37dff" label="Landmark" />
        <Legend color="#d7dde8" label="Saints turf" />
        <Legend color="#00e5ff" label="Halcyon zone" />
        <Legend color="#4fffb0" label="Tidewater Compact" />
        <Legend color="#ff9a30" label="Iron Chain" />
      </div>
      {map.markers.map((m, i) => (
        <div key={i} className="font-term text-xl text-neon-yellow">
          ▼ {m.label}
        </div>
      ))}
    </div>
  );
}

function Legend({ color, label, round = false }: { color: string; label: string; round?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block h-3 w-3 ${round ? 'rounded-full' : ''}`} style={{ background: color }} />
      {label}
    </span>
  );
}
