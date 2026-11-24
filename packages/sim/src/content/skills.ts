import type { Skill } from '../creatures/model';

const S = (s: Omit<Skill, 'priority' | 'target'> & Partial<Pick<Skill, 'priority' | 'target'>>): Skill => ({
  priority: 0,
  target: 'foe',
  ...s,
});

export const SKILLS: Record<string, Skill> = Object.fromEntries(
  [
    // Spark
    S({ id: 'static-nip', name: 'Static Nip', type: 'spark', category: 'physical', power: 40, accuracy: 100, status: { kind: 'shorted', chance: 10 }, description: 'A crackling bite. May short the target out.' }),
    S({ id: 'flicker-dash', name: 'Flicker Dash', type: 'spark', category: 'physical', power: 35, accuracy: 100, priority: 1, description: 'Strikes first, faster than a blown fuse.' }),
    S({ id: 'arc-bolt', name: 'Arc Bolt', type: 'spark', category: 'focus', power: 70, accuracy: 95, status: { kind: 'shorted', chance: 20 }, description: 'A bolt arcs between user and target.' }),
    S({ id: 'static-field', name: 'Static Field', type: 'spark', category: 'status', power: 0, accuracy: 90, stages: { stat: 'speed', delta: -1, chance: 100, target: 'foe' }, description: 'Charged air slows the target.' }),
    S({ id: 'overcharge', name: 'Overcharge', type: 'spark', category: 'status', power: 0, accuracy: 100, target: 'self', stages: { stat: 'focus', delta: 2, chance: 100, target: 'self' }, description: 'Draws power from the grid. Sharply raises Focus.' }),
    // Blaze
    S({ id: 'ember-swipe', name: 'Ember Swipe', type: 'blaze', category: 'physical', power: 40, accuracy: 100, status: { kind: 'scorched', chance: 10 }, description: 'Hot claws. May scorch.' }),
    S({ id: 'smoulder', name: 'Smoulder', type: 'blaze', category: 'status', power: 0, accuracy: 85, status: { kind: 'scorched', chance: 100 }, description: 'Slow-burning embers scorch the target.' }),
    S({ id: 'flare-burst', name: 'Flare Burst', type: 'blaze', category: 'focus', power: 70, accuracy: 95, status: { kind: 'scorched', chance: 15 }, description: 'A burst of flame.' }),
    // Tide
    S({ id: 'splash-jab', name: 'Splash Jab', type: 'tide', category: 'physical', power: 40, accuracy: 100, description: 'A quick wet strike.' }),
    S({ id: 'drain-surge', name: 'Drain Surge', type: 'tide', category: 'focus', power: 60, accuracy: 100, status: { kind: 'soaked', chance: 30 }, description: 'Storm-drain water floods the target. May soak.' }),
    S({ id: 'hydrant-blast', name: 'Hydrant Blast', type: 'tide', category: 'focus', power: 90, accuracy: 85, description: 'High-pressure water. Hard to aim.' }),
    // Bloom
    S({ id: 'vine-snap', name: 'Vine Snap', type: 'bloom', category: 'physical', power: 45, accuracy: 100, description: 'Whips the target with a weed stalk.' }),
    S({ id: 'root-bind', name: 'Root Bind', type: 'bloom', category: 'status', power: 0, accuracy: 90, status: { kind: 'rooted', chance: 100 }, description: 'Roots crack the pavement and hold the target in place.' }),
    S({ id: 'sap-mend', name: 'Sap Mend', type: 'bloom', category: 'status', power: 0, accuracy: 100, target: 'self', heal: 0.5, description: 'Restores half of max HP.' }),
    S({ id: 'spore-burst', name: 'Spore Burst', type: 'bloom', category: 'focus', power: 60, accuracy: 100, status: { kind: 'dazed', chance: 20 }, description: 'A cloud of spores. May daze.' }),
    S({ id: 'ivy-lash', name: 'Ivy Lash', type: 'bloom', category: 'physical', power: 65, accuracy: 95, status: { kind: 'rooted', chance: 15 }, description: 'Old ivy whips out of the wall. May root the target.' }),
    // Toxic
    S({ id: 'smog-puff', name: 'Smog Puff', type: 'toxic', category: 'focus', power: 40, accuracy: 100, status: { kind: 'poisoned', chance: 30 }, description: 'A lungful of exhaust. May poison.' }),
    S({ id: 'grime-peck', name: 'Grime Peck', type: 'toxic', category: 'physical', power: 50, accuracy: 100, status: { kind: 'poisoned', chance: 10 }, description: 'A filthy peck.' }),
    S({ id: 'exhaust', name: 'Exhaust', type: 'toxic', category: 'status', power: 0, accuracy: 85, status: { kind: 'dazed', chance: 100 }, description: 'Blinding fumes daze the target.' }),
    // Alloy
    S({ id: 'bolt-bite', name: 'Bolt Bite', type: 'alloy', category: 'physical', power: 50, accuracy: 100, description: 'Steel teeth clamp down.' }),
    S({ id: 'iron-hide', name: 'Iron Hide', type: 'alloy', category: 'status', power: 0, accuracy: 100, target: 'self', stages: { stat: 'defence', delta: 2, chance: 100, target: 'self' }, description: 'Plates harden. Sharply raises Defence.' }),
    S({ id: 'scrap-slam', name: 'Scrap Slam', type: 'alloy', category: 'physical', power: 85, accuracy: 90, recoil: 0.25, description: 'A reckless full-body slam. Hurts the user too.' }),
    S({ id: 'rust-spray', name: 'Rust Spray', type: 'alloy', category: 'status', power: 0, accuracy: 90, status: { kind: 'rusted', chance: 100 }, description: 'Corrodes the target, lowering its Defence.' }),
    // Shade
    S({ id: 'shadow-swipe', name: 'Shadow Swipe', type: 'shade', category: 'physical', power: 45, accuracy: 100, description: 'A strike from the target’s blind spot.' }),
    S({ id: 'pickpocket', name: 'Pickpocket', type: 'shade', category: 'physical', power: 35, accuracy: 100, priority: 1, description: 'A sneaky first strike.' }),
    S({ id: 'spook', name: 'Spook', type: 'shade', category: 'status', power: 0, accuracy: 85, status: { kind: 'spooked', chance: 100 }, description: 'Something moves in the corner of the eye.' }),
    S({ id: 'night-lurk', name: 'Night Lurk', type: 'shade', category: 'focus', power: 70, accuracy: 100, description: 'Darkness itself bites.' }),
    S({ id: 'glitch-pulse', name: 'Glitch Pulse', type: 'shade', category: 'focus', power: 55, accuracy: 100, status: { kind: 'spooked', chance: 20 }, description: 'A wave of corrupted static. May spook.' }),
    S({ id: 'nightfall-pounce', name: 'Nightfall Pounce', type: 'shade', category: 'physical', power: 80, accuracy: 90, description: 'Lands from nowhere, claws first.' }),
    S({ id: 'still-watch', name: 'Still Watch', type: 'shade', category: 'status', power: 0, accuracy: 100, target: 'self', stages: { stat: 'resolve', delta: 2, chance: 100, target: 'self' }, description: 'Goes perfectly still. Sharply raises Resolve.' }),
    // Rubble
    S({ id: 'pebble-toss', name: 'Pebble Toss', type: 'rubble', category: 'physical', power: 40, accuracy: 100, description: 'Flings gravel.' }),
    S({ id: 'curl-up', name: 'Curl Up', type: 'rubble', category: 'status', power: 0, accuracy: 100, target: 'self', stages: { stat: 'defence', delta: 1, chance: 100, target: 'self' }, description: 'Rolls into a ball. Raises Defence.' }),
    S({ id: 'gargoyle-drop', name: 'Gargoyle Drop', type: 'rubble', category: 'physical', power: 85, accuracy: 90, description: 'Drops off a ledge like a falling cornice.' }),
    S({ id: 'rubble-roll', name: 'Rubble Roll', type: 'rubble', category: 'physical', power: 70, accuracy: 90, description: 'Rolls into the target like a loose kerbstone.' }),
  ].map((s) => [s.id, s]),
);
