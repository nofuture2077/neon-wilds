const ROWS: Array<[string, string, string]> = [
  ['Move', 'WASD / Arrows', 'Left stick / D-pad'],
  ['Run', 'Shift', 'B / RT'],
  ['Talk / Interact', 'E / Space / Enter', 'A'],
  ['Enter / exit vehicle', 'F', 'Y'],
  ['Drive: accelerate / brake / steer', 'W / S / A D', 'Stick'],
  ['Handbrake (drift)', 'Shift', 'B / RT'],
  ['Advance dialogue', 'E / Space / Enter', 'A'],
  ['Pause / menu (party, bag, index, save)', 'Esc', 'Start'],
  ['Menus', 'Arrows + Enter, Esc = back', 'D-pad + A, B = back'],
];

export function ControlsPanel() {
  return (
    <div>
      <h2 className="mb-4 font-pixel text-sm text-neon-yellow">Controls</h2>
      <table className="w-full font-term text-xl">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="pb-2 font-normal">Action</th>
            <th className="pb-2 font-normal">Keyboard</th>
            <th className="pb-2 font-normal">Controller</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([action, kb, pad]) => (
            <tr key={action} className="border-t border-night-700">
              <td className="py-1 pr-4">{action}</td>
              <td className="py-1 pr-4 text-neon-cyan">{kb}</td>
              <td className="py-1 text-neon-pink">{pad}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mb-2 mt-6 font-pixel text-sm text-neon-yellow">How to play</h2>
      <ul className="list-disc space-y-1 pl-5 font-term text-lg text-slate-300">
        <li>
          <span className="text-neon-cyan">Catch Wildlings:</span> walk into a wild one to battle, weaken it with Fight, then use Snare. Each species lives in its own district, ground and time of day.
        </li>
        <li>
          <span className="text-neon-cyan">Earn money:</span> the job board at the Vesper Courier Co-op, missions from people around the city, Index bounties for new species, and the Scrapyard Exchange for stolen cars.
        </li>
        <li>
          <span className="text-neon-cyan">Spend it:</span> Snares and medicine at shops (Paper Moon Pawn, Gaslight Antiques, the Night Market). Healing at Saint Ottilie Free Clinic is free.
        </li>
        <li>
          <span className="text-neon-cyan">Get around:</span> cars are twice as fast as running, and Express jobs need one. The Co-op shuttle (at the job board) takes you to any district you have visited. Stealing makes the Wardens look for you; a respray at Rustbucket Garage loses them.
        </li>
        <li>
          <span className="text-neon-cyan">Push the story:</span> your active mission and its marker are always on screen. Factions that trust you offer their own jobs.
        </li>
      </ul>
      <p className="mt-4 font-term text-lg text-slate-400">
        Walk (don't run) to sneak up on sleeping Wildlings for a free first strike. Sprinting into people knocks them aside — they will not forget it in a hurry.
      </p>
    </div>
  );
}
