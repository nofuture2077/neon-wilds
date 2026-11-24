import { useGameStore } from '../state/gameStore';

/** Local statistics and achievements. */
export function RecordsTab() {
  useGameStore((s) => s.progress);
  const records = useGameStore.getState().queries?.records();
  if (!records) return null;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      <div>
        <h3 className="mb-2 font-pixel text-[10px] text-neon-yellow">Statistics</h3>
        <table className="w-full font-term text-xl">
          <tbody>
            {records.stats.map((s) => (
              <tr key={s.label} className="border-t border-night-700">
                <td className="py-1 pr-4 text-slate-300">{s.label}</td>
                <td className="py-1 text-right text-neon-cyan">{s.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="mb-2 font-pixel text-[10px] text-neon-yellow">
          Achievements {records.unlocked} / {records.total}
        </h3>
        <div className="flex flex-col gap-1">
          {records.achievements.map((a) => (
            <div key={a.id} className={`border-2 px-3 py-1 ${a.unlocked ? 'border-neon-green bg-night-800' : 'border-night-700 opacity-60'}`}>
              <div className={`font-pixel text-[9px] ${a.unlocked ? 'text-neon-green' : 'text-slate-400'}`}>{a.title}</div>
              <div className="font-term text-lg leading-tight text-slate-300">{a.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
