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
      <p className="mt-4 font-term text-lg text-slate-400">
        Walk (don't run) to sneak up on sleeping Wildlings for a free first strike. Sprinting into people knocks them aside — they will not forget it in a hurry.
      </p>
    </div>
  );
}
