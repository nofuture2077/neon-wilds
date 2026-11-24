import { Rng, deriveSeed } from '../core/rng';
import type { Effect } from '../missions/types';
import type { DistrictLayout } from './district';
import { Tile, type TileKind } from './tiles';

/**
 * Vignettes (WORLD_GEN.md L6): small authored scenes placed into the generated
 * city — a night market stall, a busker with a Fizzlet, a Wildling nest, a
 * Saints soup line. Each has set dressing, optional extras (stationary NPCs
 * who bark lines), a time window, and something to look at, sometimes with a
 * small one-time reward. Placement is seeded and validated like the rest of
 * world generation; no generative AI.
 */
export type VignetteProp =
  | 'stall'
  | 'crates'
  | 'fire-barrel'
  | 'speaker'
  | 'easel'
  | 'candles'
  | 'graffiti'
  | 'tent'
  | 'cart'
  | 'nest'
  | 'table'
  | 'cage'
  | 'flowers'
  | 'toolbox';

export type VignetteGround = 'sidewalk' | 'plaza' | 'alley' | 'grass';

export interface VignetteDef {
  id: string;
  title: string;
  /** Region ids where it may appear; empty means anywhere. */
  regions: string[];
  /** Active hours [from, to); wraps past midnight. [0, 24] = always. */
  hours: [number, number];
  ground: VignetteGround;
  props: Array<{ kind: VignetteProp; dx: number; dy: number }>;
  extras?: Array<{ archetype: string; name: string; dx: number; dy: number }>;
  /** Lines the extras call out while the player is near. */
  barks?: string[];
  /** What the player sees on a closer look. */
  look: string[];
  /** Given once per vignette, the first time the player looks. */
  reward?: Effect[];
  /** Relative placement weight (default 1). */
  weight?: number;
}

export interface VignettePlacement {
  /** Unique per placement, stable for a seed. */
  id: string;
  def: string;
  /** Anchor tile; the scene's props are offsets from it. */
  tx: number;
  ty: number;
  region: string;
}

const ALWAYS: [number, number] = [0, 24];
const NIGHT: [number, number] = [19, 4];
const DAY: [number, number] = [7, 19];
const EVENING: [number, number] = [17, 2];

export const VIGNETTES: VignetteDef[] = [
  // ---- The Slums
  {
    id: 'soup-line',
    title: 'Saints’ soup line',
    regions: ['slums'],
    hours: [11, 15],
    ground: 'sidewalk',
    props: [{ kind: 'table', dx: 0, dy: 0 }, { kind: 'fire-barrel', dx: 2, dy: 0 }],
    extras: [{ archetype: 'gutter-saint', name: 'Saint with a ladle', dx: 0, dy: -1 }, { archetype: 'night-worker', name: 'Hungry regular', dx: 1, dy: 1 }],
    barks: ['Bowls back when you’re done!', 'There’s always enough. Somehow.', 'Next!'],
    look: ['A folding table, a dented pot the size of a bathtub, and a queue that never quite ends. Nobody asks for your name.'],
    reward: [{ type: 'give-item', item: 'patch-kit', qty: 1 }, { type: 'reputation', faction: 'saints', delta: 2 }],
  },
  {
    id: 'busker-fizzlet',
    title: 'Busker with a Fizzlet',
    regions: ['slums', 'downtown'],
    hours: EVENING,
    ground: 'sidewalk',
    props: [{ kind: 'speaker', dx: 1, dy: 0 }],
    extras: [{ archetype: 'busker', name: 'Busker', dx: 0, dy: 0 }],
    barks: ['♪ Neon on the water, rain on the line... ♪', 'Coins for the Fizzlet, it does the light show!', 'Request? I know four songs.'],
    look: ['A Fizzlet sits on the busker’s amp, sparking in time with the chords. The coins in the hat are mostly buttons.'],
    reward: [{ type: 'give-money', amount: 15 }],
  },
  {
    id: 'graffiti-crew',
    title: 'Graffiti crew',
    regions: ['slums', 'industrial', 'harbor'],
    hours: NIGHT,
    ground: 'alley',
    props: [{ kind: 'graffiti', dx: 0, dy: 0 }, { kind: 'crates', dx: 2, dy: 0 }],
    extras: [{ archetype: 'street-kid', name: 'Tagger', dx: 1, dy: 0 }],
    barks: ['Lookout! ...False alarm.', 'Pink or more pink?', 'This wall’s ours now.'],
    look: ['A half-finished mural of a giant Glitchling crushing a Halcyon logo. The paint is still wet. It has your courier jacket.'],
  },
  {
    id: 'stray-feeding',
    title: 'Strays at the back door',
    regions: ['slums', 'harbor', 'oldtown'],
    hours: [18, 23],
    ground: 'alley',
    props: [{ kind: 'crates', dx: 0, dy: 0 }, { kind: 'nest', dx: 1, dy: 0 }],
    extras: [{ archetype: 'street-vendor', name: 'Noodle cook', dx: 0, dy: 1 }],
    barks: ['Easy, easy, there’s plenty.', 'Don’t tell the health inspector.'],
    look: ['A cook tips yesterday’s noodles into a hubcap. Three Binbandits and a very confident Puddlefin share it without fighting. Mostly.'],
    reward: [{ type: 'give-item', item: 'tin-snare', qty: 1 }],
  },
  {
    id: 'street-repair',
    title: 'Backstreet mechanic',
    regions: ['slums', 'industrial'],
    hours: DAY,
    ground: 'sidewalk',
    props: [{ kind: 'toolbox', dx: 0, dy: 0 }, { kind: 'crates', dx: 2, dy: 0 }],
    extras: [{ archetype: 'tinkerer', name: 'Grease monkey', dx: 1, dy: 0 }],
    barks: ['Pass the seven! No, the other seven.', 'She’ll run. She’ll run angry, but she’ll run.'],
    look: ['A gutted scooter, a Scrapup holding the torch, and a mechanic who has clearly given up on gloves.'],
  },
  {
    id: 'kids-battle',
    title: 'Kids’ Wildling match',
    regions: ['slums', 'harbor'],
    hours: [14, 20],
    ground: 'plaza',
    props: [{ kind: 'graffiti', dx: 0, dy: 1 }],
    extras: [{ archetype: 'street-kid', name: 'Kid with a Pebblet', dx: -1, dy: 0 }, { archetype: 'street-kid', name: 'Kid with a Cracksprout', dx: 1, dy: 0 }],
    barks: ['Use Curl Up! No, attack! No, Curl Up!', 'Best of three hundred!', 'That doesn’t count, it sneezed!'],
    look: ['A chalk ring on the paving. A Pebblet and a Cracksprout circle each other with enormous seriousness.'],
    reward: [{ type: 'give-money', amount: 10 }],
  },
  {
    id: 'pawn-sale',
    title: 'Sidewalk sale',
    regions: ['slums'],
    hours: DAY,
    ground: 'sidewalk',
    props: [{ kind: 'table', dx: 0, dy: 0 }, { kind: 'crates', dx: 1, dy: 0 }],
    extras: [{ archetype: 'street-vendor', name: 'Seller', dx: 0, dy: -1 }],
    barks: ['Everything must go! Including me, eventually.', 'That toaster? Haunted. Half price.'],
    look: ['Cassette tapes, a single roller skate, and a Snare with a dent in it. The seller shrugs: "Take it, it’s bad luck."'],
    reward: [{ type: 'give-item', item: 'tin-snare', qty: 1 }],
  },
  // ---- Downtown
  {
    id: 'influencer-shoot',
    title: 'Influencer photoshoot',
    regions: ['downtown'],
    hours: [10, 20],
    ground: 'plaza',
    props: [{ kind: 'flowers', dx: 0, dy: 0 }, { kind: 'speaker', dx: 2, dy: 0 }],
    extras: [{ archetype: 'socialite', name: 'Influencer', dx: 1, dy: 0 }],
    barks: ['Can everyone just NOT walk through my shot?', 'Wattbug, look at the lens. LOOK at it.', '#HalcyonHalo #blessed'],
    look: ['A Wattbug in a tiny diamond collar refuses to face the camera. Its owner is having a very bad day in a very expensive coat.'],
  },
  {
    id: 'protest',
    title: 'Anti-Halcyon protest',
    regions: ['downtown'],
    hours: [12, 18],
    ground: 'plaza',
    props: [{ kind: 'graffiti', dx: 0, dy: 1 }, { kind: 'speaker', dx: -1, dy: 0 }],
    extras: [{ archetype: 'gutter-saint', name: 'Protester', dx: 0, dy: 0 }, { archetype: 'street-kid', name: 'Protester', dx: 1, dy: 0 }],
    barks: ['Chips out of Wildlings!', 'What do we want? NO TETHERS!', 'Halcyon lies!'],
    look: ['Hand-painted signs: "MY FIZZLET IS NOT YOUR PRODUCT". An Aegis guard across the plaza is pretending not to film them.'],
    reward: [{ type: 'reputation', faction: 'saints', delta: 2 }],
  },
  {
    id: 'food-cart',
    title: 'Late-night food cart',
    regions: ['downtown', 'harbor'],
    hours: [20, 3],
    ground: 'sidewalk',
    props: [{ kind: 'cart', dx: 0, dy: 0 }],
    extras: [{ archetype: 'street-vendor', name: 'Cart vendor', dx: 0, dy: 1 }],
    barks: ['Dumplings! Hot dumplings!', 'Spicy is the only option. Trust me.'],
    look: ['Steam, neon and the smell of chilli oil. A Hydrantoad sits under the cart catching drips with obvious satisfaction.'],
    reward: [{ type: 'give-item', item: 'patch-kit', qty: 1 }],
  },
  {
    id: 'halo-billboard',
    title: 'Halo promo stand',
    regions: ['downtown'],
    hours: DAY,
    ground: 'plaza',
    props: [{ kind: 'stall', dx: 0, dy: 0 }],
    extras: [{ archetype: 'office-worker', name: 'Promoter', dx: 0, dy: 1 }],
    barks: ['Try a Halo earpiece! Feel the calm!', 'Free trial! No obligation! Mostly!'],
    look: ['Rows of white Halo earpieces glow softly on a stand. When you lean close, one of them hums the same note as every street lamp.'],
  },
  {
    id: 'rooftop-garden',
    title: 'Pocket garden',
    regions: ['downtown', 'oldtown'],
    hours: ALWAYS,
    ground: 'plaza',
    props: [{ kind: 'flowers', dx: 0, dy: 0 }, { kind: 'flowers', dx: 1, dy: 0 }],
    look: ['Someone has turned a dead planter into a tiny garden. A Cracksprout is asleep in the tomatoes.'],
    reward: [{ type: 'give-item', item: 'cleanse-tab', qty: 1 }],
  },
  // ---- Harbor
  {
    id: 'fish-auction',
    title: 'Dawn fish auction',
    regions: ['harbor'],
    hours: [4, 9],
    ground: 'plaza',
    props: [{ kind: 'crates', dx: 0, dy: 0 }, { kind: 'crates', dx: 1, dy: 0 }, { kind: 'table', dx: -1, dy: 0 }],
    extras: [{ archetype: 'fishmonger', name: 'Auctioneer', dx: 0, dy: -1 }, { archetype: 'docker', name: 'Buyer', dx: 1, dy: 1 }],
    barks: ['Forty! Do I hear forty-five?', 'Sold to the man with the Puddlefin hat!'],
    look: ['Ice, scales and shouting. A Brinekin keeps trying to get back into the crate it came in.'],
  },
  {
    id: 'dockers-dice',
    title: 'Dockers’ dice game',
    regions: ['harbor', 'industrial'],
    hours: NIGHT,
    ground: 'plaza',
    props: [{ kind: 'fire-barrel', dx: 0, dy: 0 }, { kind: 'crates', dx: 1, dy: 1 }],
    extras: [{ archetype: 'docker', name: 'Docker', dx: -1, dy: 0 }, { archetype: 'smuggler', name: 'Card sharp', dx: 1, dy: 0 }],
    barks: ['Snake eyes again?! These dice are rigged.', 'Shift starts in ten. One more round.'],
    look: ['Dice on an upturned crate, coins on the dice, a Gutterjaw asleep on the coins.'],
    reward: [{ type: 'give-money', amount: 20 }],
  },
  {
    id: 'net-mending',
    title: 'Net menders',
    regions: ['harbor'],
    hours: DAY,
    ground: 'sidewalk',
    props: [{ kind: 'crates', dx: 0, dy: 0 }, { kind: 'toolbox', dx: 1, dy: 0 }],
    extras: [{ archetype: 'fishmonger', name: 'Net mender', dx: 0, dy: 1 }],
    barks: ['Something big tore this. From the inside.', 'Berth nine again. Always berth nine.'],
    look: ['Nets laid out to dry, with a hole the size of a door in the middle of one. The menders don’t want to talk about it.'],
  },
  {
    id: 'smuggler-cache',
    title: 'Smugglers’ drop',
    regions: ['harbor', 'oldtown'],
    hours: NIGHT,
    ground: 'alley',
    props: [{ kind: 'crates', dx: 0, dy: 0 }, { kind: 'cage', dx: 1, dy: 0 }],
    extras: [{ archetype: 'smuggler', name: 'Lookout', dx: 0, dy: 1 }],
    barks: ['Nothing to see. Move along.', 'You didn’t see me. I didn’t see you.'],
    look: ['A Compact anchor chalked on the crate. Inside: coils, medicine, and one empty cage with the door left open, on purpose.'],
    reward: [{ type: 'give-item', item: 'coil-snare', qty: 1 }, { type: 'reputation', faction: 'compact', delta: 2 }],
  },
  // ---- Industrial
  {
    id: 'shift-break',
    title: 'Shift break',
    regions: ['industrial'],
    hours: [12, 14],
    ground: 'sidewalk',
    props: [{ kind: 'fire-barrel', dx: 0, dy: 0 }, { kind: 'table', dx: 1, dy: 0 }],
    extras: [{ archetype: 'factory-worker', name: 'Worker', dx: 0, dy: 1 }, { archetype: 'factory-worker', name: 'Worker', dx: 2, dy: 0 }],
    barks: ['Twenty minutes. Make them count.', 'Who took my sandwich? WHO?', 'Union strong.'],
    look: ['Lunch tins on a cable drum. A Kilnback warms everyone’s coffee just by existing.'],
  },
  {
    id: 'scrap-nest',
    title: 'Scrapup nest',
    regions: ['industrial', 'slums'],
    hours: ALWAYS,
    ground: 'alley',
    props: [{ kind: 'nest', dx: 0, dy: 0 }, { kind: 'crates', dx: 1, dy: 0 }],
    look: ['A nest woven from copper wire, bottle caps and one Halcyon ID badge. Something inside beeps sleepily.'],
    reward: [{ type: 'give-item', item: 'lull-snare', qty: 1 }],
  },
  {
    id: 'pit-poster',
    title: 'Pit card poster',
    regions: ['industrial'],
    hours: ALWAYS,
    ground: 'sidewalk',
    props: [{ kind: 'graffiti', dx: 0, dy: 0 }],
    look: ['FURNACE PITS — FIGHT NIGHT. Under the headline someone has scratched "GRIT IS A FRAUD" and someone else "GRIT IS LOVE".'],
  },
  {
    id: 'scrap-cart',
    title: 'Scrap collector',
    regions: ['industrial', 'outskirts'],
    hours: DAY,
    ground: 'sidewalk',
    props: [{ kind: 'cart', dx: 0, dy: 0 }],
    extras: [{ archetype: 'scrapper', name: 'Scrap collector', dx: 1, dy: 0 }],
    barks: ['Any old iron! Any old coils!', 'That’s not rubbish, that’s inventory.'],
    look: ['A shopping trolley piled impossibly high with pipes, cable and three hubcaps. It has a name painted on it: BETSY.'],
    reward: [{ type: 'give-money', amount: 15 }],
  },
  {
    id: 'brazier-workers',
    title: 'Night-shift brazier',
    regions: ['industrial'],
    hours: NIGHT,
    ground: 'plaza',
    props: [{ kind: 'fire-barrel', dx: 0, dy: 0 }],
    extras: [{ archetype: 'factory-worker', name: 'Night-shift worker', dx: 1, dy: 0 }],
    barks: ['Cold one tonight.', 'Hear that hum? Only at night.'],
    look: ['A brazier made from an oil drum. A Smogling drifts lazily in its heat, purring.'],
  },
  // ---- Old Town
  {
    id: 'chalk-artist',
    title: 'Chalk artist',
    regions: ['oldtown', 'downtown'],
    hours: DAY,
    ground: 'plaza',
    props: [{ kind: 'easel', dx: 0, dy: 0 }],
    extras: [{ archetype: 'antiquarian', name: 'Chalk artist', dx: 1, dy: 0 }],
    barks: ['Mind the stag! Mind the — thank you.', 'Copied it off a wall older than the city.'],
    look: ['A pavement drawing of a stag with branches for antlers, standing in a marsh. Beneath it, in careful letters: "IT SANG FIRST."'],
  },
  {
    id: 'candle-shrine',
    title: 'Street shrine',
    regions: ['oldtown', 'outskirts'],
    hours: ALWAYS,
    ground: 'sidewalk',
    props: [{ kind: 'candles', dx: 0, dy: 0 }, { kind: 'flowers', dx: 1, dy: 0 }],
    look: ['Candles, moss and little clay Wildlings left by passers-by. The Glitchling hums softly at it.'],
    reward: [{ type: 'give-item', item: 'cleanse-tab', qty: 1 }, { type: 'reputation', faction: 'choir', delta: 2 }],
  },
  {
    id: 'choir-singing',
    title: 'Street choir',
    regions: ['oldtown'],
    hours: [18, 22],
    ground: 'plaza',
    props: [{ kind: 'candles', dx: 0, dy: 0 }],
    extras: [{ archetype: 'choir-acolyte', name: 'Singer', dx: -1, dy: 0 }, { archetype: 'choir-acolyte', name: 'Singer', dx: 1, dy: 0 }],
    barks: ['♪ Before the lamps, before the stone... ♪', '♪ ...the marsh was singing all alone ♪'],
    look: ['Three voices and no instruments. A Gloomkit sits at the edge of the light, listening with its whole body.'],
  },
  {
    id: 'antique-cart',
    title: 'Antiques barrow',
    regions: ['oldtown'],
    hours: DAY,
    ground: 'sidewalk',
    props: [{ kind: 'cart', dx: 0, dy: 0 }, { kind: 'crates', dx: 1, dy: 0 }],
    extras: [{ archetype: 'antiquarian', name: 'Barrow seller', dx: 0, dy: 1 }],
    barks: ['Pre-charter! Guaranteed! Mostly!', 'That compass points to something. Not north.'],
    look: ['Old maps of a Vesper that had a marsh where the Outskirts are. One shows a lighthouse that should be miles from any sea.'],
  },
  {
    id: 'tunnel-mouth',
    title: 'Tunnel guide’s hatch',
    regions: ['oldtown'],
    hours: NIGHT,
    ground: 'alley',
    props: [{ kind: 'crates', dx: 0, dy: 0 }, { kind: 'candles', dx: 1, dy: 0 }],
    extras: [{ archetype: 'tunnel-guide', name: 'Tunnel guide', dx: 0, dy: 1 }],
    barks: ['Tours at noon. This isn’t a tour.', 'Mind your head. And your wallet.'],
    look: ['An iron hatch, propped open with a brick. Cold air and the faint sound of water rise from below.'],
    reward: [{ type: 'give-item', item: 'lull-snare', qty: 1 }],
  },
  {
    id: 'gargoyle-watch',
    title: 'Gargoyle spotters',
    regions: ['oldtown'],
    hours: [20, 2],
    ground: 'plaza',
    props: [{ kind: 'table', dx: 0, dy: 0 }],
    extras: [{ archetype: 'antiquarian', name: 'Spotter', dx: 1, dy: 0 }],
    barks: ['It moved! I swear it moved!', 'Don’t look directly at it. That’s the rule.'],
    look: ['A thermos, binoculars and a notebook full of tally marks. "Gargrins on the cathedral: 11. Built with: 10."'],
  },
  // ---- Outskirts
  {
    id: 'pilgrim-camp',
    title: 'Pilgrims’ campfire',
    regions: ['outskirts'],
    hours: [18, 6],
    ground: 'grass',
    props: [{ kind: 'tent', dx: 0, dy: 0 }, { kind: 'fire-barrel', dx: 2, dy: 0 }],
    extras: [{ archetype: 'pilgrim', name: 'Pilgrim', dx: 1, dy: 1 }],
    barks: ['Sit, sit. The marsh will wait.', 'Did you hear that? ...No? Me neither.'],
    look: ['A patched tent, a kettle on the fire, and a hand-drawn map of the Outskirts with a big question mark in the middle.'],
    reward: [{ type: 'give-item', item: 'med-spray', qty: 1 }],
  },
  {
    id: 'fernfox-den',
    title: 'Fernfox den',
    regions: ['outskirts'],
    hours: ALWAYS,
    ground: 'grass',
    props: [{ kind: 'nest', dx: 0, dy: 0 }],
    look: ['A den dug under a road sign. Inside, among stolen boots and a bicycle bell, three Fernfox cubs are fast asleep.'],
    reward: [{ type: 'give-item', item: 'lull-snare', qty: 1 }],
  },
  {
    id: 'hermit-garden',
    title: 'Hermit’s vegetable patch',
    regions: ['outskirts'],
    hours: DAY,
    ground: 'grass',
    props: [{ kind: 'flowers', dx: 0, dy: 0 }, { kind: 'toolbox', dx: 1, dy: 0 }],
    extras: [{ archetype: 'hermit', name: 'Gardener', dx: 0, dy: 1 }],
    barks: ['Slugs. Everywhere. Slugs.', 'Asphalm pulled up the fence again.'],
    look: ['Cabbages in rows, a scarecrow wearing a Halcyon hard hat, and a very guilty-looking Asphalm.'],
  },
  {
    id: 'field-survey',
    title: 'Halcyon survey post',
    regions: ['outskirts'],
    hours: DAY,
    ground: 'grass',
    props: [{ kind: 'stall', dx: 0, dy: 0 }, { kind: 'cage', dx: 1, dy: 0 }],
    extras: [{ archetype: 'field-tech', name: 'Surveyor', dx: 0, dy: 1 }],
    barks: ['Reading’s off the scale again.', 'Did the scanner just play whale noises?'],
    look: ['A tripod scanner pointed at nothing in particular. The screen shows a perfect ring, pulsing slowly.'],
  },
  {
    id: 'abandoned-car',
    title: 'Abandoned car',
    regions: ['outskirts', 'industrial'],
    hours: ALWAYS,
    ground: 'grass',
    props: [{ kind: 'crates', dx: 0, dy: 0 }, { kind: 'nest', dx: 1, dy: 0 }],
    look: ['What’s left of a hatchback, slowly becoming a hill. Moss on the seats, a Cracksprout through the steering wheel.'],
    reward: [{ type: 'give-money', amount: 25 }],
  },
  // ---- Anywhere
  {
    id: 'lost-wildling',
    title: 'Lost Wildling poster',
    regions: [],
    hours: ALWAYS,
    ground: 'sidewalk',
    props: [{ kind: 'graffiti', dx: 0, dy: 0 }],
    look: ['LOST: one Fizzlet, answers to "Sparky", probably on fire. REWARD: our eternal gratitude and a pie.'],
  },
  {
    id: 'birthday',
    title: 'Street birthday party',
    regions: ['slums', 'harbor', 'oldtown'],
    hours: [16, 22],
    ground: 'plaza',
    props: [{ kind: 'table', dx: 0, dy: 0 }, { kind: 'speaker', dx: 2, dy: 0 }, { kind: 'flowers', dx: -1, dy: 0 }],
    extras: [{ archetype: 'night-worker', name: 'Party host', dx: 1, dy: 1 }, { archetype: 'street-kid', name: 'Birthday kid', dx: 0, dy: 1 }],
    barks: ['Happy birthday to youuu...', 'Who brought the cake? Who ATE the cake?'],
    look: ['A folding table, a lopsided cake, and a Puddlefin in a party hat that it seems very proud of.'],
    reward: [{ type: 'give-item', item: 'patch-kit', qty: 1 }],
  },
  {
    id: 'flower-seller',
    title: 'Flower seller',
    regions: ['downtown', 'oldtown', 'slums'],
    hours: [8, 20],
    ground: 'sidewalk',
    props: [{ kind: 'flowers', dx: 0, dy: 0 }, { kind: 'cart', dx: 1, dy: 0 }],
    extras: [{ archetype: 'street-vendor', name: 'Flower seller', dx: 0, dy: 1 }],
    barks: ['Flowers! Real ones! Smell them!', 'For someone special? Or for you?'],
    look: ['Buckets of real flowers, rare in a city this bright. The seller says they grow in the Outskirts, where the light is wrong.'],
  },
  {
    id: 'warden-checkpoint',
    title: 'Warden spot check',
    regions: ['downtown', 'slums', 'harbor'],
    hours: [9, 17],
    ground: 'sidewalk',
    props: [{ kind: 'table', dx: 0, dy: 0 }, { kind: 'cage', dx: 1, dy: 0 }],
    extras: [{ archetype: 'aegis-guard', name: 'Licence checker', dx: 0, dy: 1 }],
    barks: ['Wildling licences, please.', 'Unlicensed creatures will be confiscated.', 'Move along.'],
    look: ['"WILDLING LICENCE SPOT CHECK". The cage behind the table is empty, for now.'],
  },
  {
    id: 'puddle-party',
    title: 'Puddle after the rain',
    regions: ['slums', 'harbor', 'downtown'],
    hours: ALWAYS,
    ground: 'alley',
    props: [{ kind: 'nest', dx: 0, dy: 0 }],
    look: ['A deep puddle that never quite dries out. Two Puddlefin are having what can only be described as a pool party.'],
  },
  {
    id: 'domino-elders',
    title: 'Dominoes on the corner',
    regions: ['slums', 'oldtown', 'harbor'],
    hours: [10, 21],
    ground: 'sidewalk',
    props: [{ kind: 'table', dx: 0, dy: 0 }],
    extras: [{ archetype: 'old-timer', name: 'Domino player', dx: -1, dy: 0 }, { archetype: 'old-timer', name: 'Domino player', dx: 1, dy: 0 }],
    barks: ['Domino! Ha!', 'Back in my day the lights didn’t hum.', 'You cheated. You always cheat.'],
    look: ['Two old friends, one table, forty years of arguments. One of them claims to have seen Saltmaw, twice.'],
  },
  {
    id: 'rain-shelter',
    title: 'Tarp shelter',
    regions: ['slums', 'industrial', 'outskirts'],
    hours: ALWAYS,
    ground: 'alley',
    props: [{ kind: 'tent', dx: 0, dy: 0 }, { kind: 'fire-barrel', dx: 1, dy: 0 }],
    look: ['A tarp roof strung between drainpipes, a mattress, a kettle. A note: "Back soon. Feed the Binbandit."'],
  },
  {
    id: 'vending-wildling',
    title: 'Vending machine resident',
    regions: ['downtown', 'slums'],
    hours: ALWAYS,
    ground: 'sidewalk',
    props: [{ kind: 'crates', dx: 0, dy: 0 }],
    look: ['A dead vending machine with a Wattbug colony living in the coin slot. Pressing B4 makes the whole thing glow.'],
    reward: [{ type: 'give-money', amount: 5 }],
  },
];

const GROUND_TILES: Record<VignetteGround, TileKind[]> = {
  sidewalk: [Tile.Sidewalk],
  plaza: [Tile.Plaza],
  alley: [Tile.Alley],
  grass: [Tile.Grass],
};

/** Vignettes per region, and the minimum spacing between any two. */
const PER_REGION = 9;
const MIN_SPACING = 14;

export function vignetteDef(id: string): VignetteDef | undefined {
  return VIGNETTES.find((v) => v.id === id);
}

export function vignetteActive(def: VignetteDef, hour: number): boolean {
  const [from, to] = def.hours;
  if (to - from >= 24) return true;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/**
 * Seeded placement: per region, a weighted pick of eligible scenes (no repeats within a region),
 * each on a fitting ground tile with room for its props and extras, away from doors and other scenes.
 */
export function placeVignettes(layout: DistrictLayout, seed: number): VignettePlacement[] {
  const rng = new Rng(deriveSeed(seed, 'vignettes'));
  const { map } = layout;
  const W = map.width;
  const doors = new Set(layout.buildings.map((b) => b.entrance.ty * W + b.entrance.tx));
  const out: VignettePlacement[] = [];
  const free = (x: number, y: number, kinds: TileKind[] | null) => {
    if (!map.inBounds(x, y) || map.isSolid(x, y) || doors.has(y * W + x)) return false;
    return kinds ? kinds.includes(map.get(x, y)) : map.isPedestrianWalkable(x, y);
  };
  // Candidate anchor tiles per region and ground.
  const tiles = new Map<string, number[]>();
  for (let i = 0; i < map.tiles.length; i++) {
    const kind = map.tiles[i] as TileKind;
    const ground = (Object.keys(GROUND_TILES) as VignetteGround[]).find((g) => GROUND_TILES[g].includes(kind));
    if (!ground) continue;
    const region = layout.regions[layout.regionMap[i]!]!.id;
    const key = `${region}:${ground}`;
    (tiles.get(key) ?? tiles.set(key, []).get(key)!).push(i);
  }
  for (const region of layout.regions) {
    const pool = VIGNETTES.filter((v) => v.regions.length === 0 || v.regions.includes(region.id));
    const order: VignetteDef[] = [];
    const bag = pool.slice();
    while (bag.length) {
      const total = bag.reduce((n, v) => n + (v.weight ?? 1), 0);
      let r = rng.next() * total;
      let k = 0;
      for (; k < bag.length - 1; k++) {
        r -= bag[k]!.weight ?? 1;
        if (r <= 0) break;
      }
      order.push(bag.splice(k, 1)[0]!);
    }
    let placed = 0;
    for (const def of order) {
      if (placed >= PER_REGION) break;
      const candidates = tiles.get(`${region.id}:${def.ground}`) ?? [];
      for (let attempt = 0; attempt < 40 && candidates.length; attempt++) {
        const i = rng.pick(candidates);
        const tx = i % W;
        const ty = (i - tx) / W;
        if (out.some((p) => Math.hypot(p.tx - tx, p.ty - ty) < MIN_SPACING)) continue;
        const kinds = GROUND_TILES[def.ground];
        const ok = free(tx, ty, kinds) && def.props.every((p) => free(tx + p.dx, ty + p.dy, null)) && (def.extras ?? []).every((e) => free(tx + e.dx, ty + e.dy, null));
        if (!ok) continue;
        out.push({ id: `vig-${region.id}-${placed}`, def: def.id, tx, ty, region: region.id });
        placed++;
        break;
      }
    }
  }
  return out;
}
