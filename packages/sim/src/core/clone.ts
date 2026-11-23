/**
 * Deep copy for plain simulation data. Simulation state is JSON-safe by
 * design (no Maps, class instances or typed arrays), and JS number <-> JSON
 * round-trips are exact, so this preserves determinism.
 */
export function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
