# NEON WILDS — Game Design Document

> Owner: Game Director · Status: living document · Last major revision: Milestone 1
>
> Companion documents: [World Design](WORLD.md) · [Game AI](AI.md) · [Architecture](ARCHITECTURE.md) · [Domain Model](DOMAIN_MODEL.md) · [Roadmap](ROADMAP.md)

## 1. Vision

**NEON WILDS** is a top-down open-world RPG set in **Vesper City**, a rain-slicked neon metropolis where people share the streets, rooftops and storm drains with wild creatures called **Wildlings**. It combines:

- the **freedom and chaos of a top-down urban sandbox**: steal a car, start a gang war, outrun the Wardens;
- the **collection, bonding and tactical battles of a classic creature RPG**: catch, raise, evolve and battle Wildlings;
- a **city that lives on its own**: every NPC has a routine, a mood and a memory, and factions run their own strategies.

**One-sentence pitch:** *You are a night-shift courier whose package hatches into a Wildling the whole city wants — and the city remembers everything you do with it.*

### Hard rule: no runtime AI

NEON WILDS uses **no generative AI, LLMs or external inference** at runtime. All behaviour comes from conventional game AI (FSMs, hierarchical state machines, behaviour trees, utility AI, GOAP, A*, steering) and handcrafted content. CI enforces this (`scripts/check-no-ai.mjs`).

## 2. Design pillars

1. **The city remembers.** Every meaningful action leaves a trace: in an NPC's memory, a faction's ledger, a district's mood or a Warden report. Consequences are visible and explainable.
2. **Many ways to be somebody.** Collector, pit fighter, smuggler, faction lieutenant, explorer or freelancer — every archetype has a full progression path. Nothing is mandatory except the spine of the main story.
3. **Wildlings are characters, not stat blocks.** Every species has a recognisable personality and behaviour in the world, before you ever battle it.
4. **Tactics over grinding.** Type matchups, status effects, team roles and terrain matter more than raw level.
5. **Chaos with rules.** The sandbox is anarchic, but every system obeys readable rules so players can plan, exploit and predict.

## 3. Player fantasy and archetypes

| Archetype | Fantasy | Primary systems | Progression currency |
|---|---|---|---|
| Creature collector | Fill the Wildling Index, find rare variants | Encounters, capture, habitats, evolution | Index completion, rare captures |
| Underground fighter | Climb the Iron Chain pit circuit | Battles, team building, training | Pit rank, prize money |
| Criminal entrepreneur | Run smuggling routes and black-market trades | Economy, vehicles, wanted system | Cash, contacts, routes |
| Faction leader | Rise through a faction and steer the city | Reputation, territory, faction missions | Faction rank, territory |
| Explorer | Uncover the city's secrets | Hidden locations, tunnels, lore | Secrets, Hush Fragments |
| Independent mercenary | Sell skills to whoever pays | Dynamic missions, bounties | Cash, reputation with all |

All archetypes converge on the main story's final act through different routes (see WORLD.md §5).

## 4. Core loops

**Moment-to-moment (seconds):** move through the city (on foot or by vehicle), read the street, interact, avoid or cause trouble, spot Wildlings.

**Session loop (10–40 min):** pick up a mission or chase an opportunity → travel → encounter (battle, chase, negotiation, heist) → reward → spend (gear, healing, upgrades, bribes) → new opportunities appear because the world reacted.

**Long-term loop (hours):** grow a team, raise faction standing, unlock districts, push the main story, shape the city's balance of power, reach one of the endings.

## 5. Controls

| Action | Keyboard | Controller |
|---|---|---|
| Move | WASD / arrows | Left stick / d-pad |
| Run | Shift | B / RT |
| Interact / talk / confirm | E / Space / Enter | A |
| Pause | Esc | Start |
| *(M2+)* Throw capture device | Q | X |
| *(M2+)* Party menu | Tab | Y |
| *(M3+)* Enter / exit vehicle | F | Y (hold) |
| *(M3+)* Accelerate / brake / steer | W / S / A D | RT / LT / left stick |

## 6. Wildlings

### 6.1 Elemental types

Eight types grounded in the city: **Spark** (electricity, neon), **Blaze** (fire, heat), **Tide** (water, drains, sea), **Bloom** (plants, growth), **Toxic** (pollution, rot), **Alloy** (metal, machines), **Shade** (shadow, the unseen), **Rubble** (concrete, stone, earth).

Type chart (attacker → defender multiplier; unlisted = ×1):

| Attacker | ×2 against | ×½ against |
|---|---|---|
| Spark | Tide, Alloy | Spark, Bloom, Rubble |
| Blaze | Bloom, Alloy | Blaze, Tide, Rubble |
| Tide | Blaze, Rubble, Toxic | Tide, Bloom |
| Bloom | Tide, Rubble | Blaze, Bloom, Toxic, Alloy |
| Toxic | Bloom, Tide | Toxic, Rubble, Alloy |
| Alloy | Rubble, Shade | Blaze, Tide, Alloy |
| Shade | Spark, Shade | Alloy, Blaze |
| Rubble | Spark, Blaze, Toxic | Bloom, Alloy |

Design notes: Tide and Toxic hit each other super-effectively (pollution versus dilution). Rubble is the broad "grounding" counter and Alloy the defensive wall. Dual types multiply. There are no immunities, so every matchup stays playable. The chart lives in data (`content/types`) and is unit-tested for symmetry assumptions in M2.

### 6.2 Species model

Every species defines: name, types (1–2), personality archetype, base stats (HP, Attack, Defence, Focus, Resolve, Speed), learnset, evolution rules, rarity, habitats (district, tile kinds, time of day, weather), behaviour profile (see AI.md §6), capture difficulty, social relations (prey, predators, allies) and Index lore.

**Stats:** HP; **Attack** (physical); **Focus** (special); **Defence** (physical resist); **Resolve** (special resist and status resistance); **Speed** (turn order, flee chance).

**Personality archetypes** drive both overworld behaviour and battle tendencies: *Aggressive, Shy, Curious, Territorial, Social, Predatory, Sleepy, Loyal*.

### 6.3 Launch roster (32 species)

| # | Name | Type | Stage → | Rarity | Habitat | Personality | Concept |
|---|---|---|---|---|---|---|---|
| 1 | Fizzlet | Spark | → Neonyx (Lv 18) | Common | Slums alleys, substations | Curious | Cable-chewing rodent whose whiskers spark when it is excited |
| 2 | Neonyx | Spark/Shade | final | Uncommon | Slums, Downtown at night | Curious | Sleek rat that drinks light; leaves a trail of dead bulbs |
| 3 | Wattbug | Spark | → Arcmoth (Lv 16) | Common | Downtown signs | Social | Beetle swarms that cluster on neon tubes |
| 4 | Arcmoth | Spark/Bloom | final | Uncommon | Downtown rooftops | Social | Moth whose wing dust glows in whatever colour it last touched |
| 5 | Cindertail | Blaze | → Pyrolynx (Lv 20) | Common | Slums, Industrial | Territorial | Stray cat with a smouldering tail; guards warm vents |
| 6 | Pyrolynx | Blaze | final | Rare | Industrial rooftops | Territorial | Lean fire-cat; its territory is marked with scorched pawprints |
| 7 | Puddlefin | Tide | → Gutterjaw (Lv 18) | Common | Storm drains, puddles after rain | Shy | Minnow that hops between puddles |
| 8 | Gutterjaw | Tide/Toxic | final | Uncommon | Drains, Harbor | Aggressive | Eel that has adapted to the city's runoff |
| 9 | Brinekin | Tide/Alloy | → Dockhulk (Lv 24) | Common | Harbor docks | Territorial | Hermit crab that wears tin cans as shells |
| 10 | Dockhulk | Tide/Alloy | final | Rare | Harbor | Territorial | Crab the size of a car, shelled in a shipping-container fragment |
| 11 | Cracksprout | Bloom | → Asphalm (Lv 15) | Common | Pavement cracks everywhere | Shy | Weed sprite that ducks back into the crack when watched |
| 12 | Asphalm | Bloom/Rubble | final | Uncommon | Outskirts, vacant lots | Territorial | Palm-like creature that lifts slabs of asphalt with its roots |
| 13 | Mossling | Bloom | → Ivyclad (Lv 22) | Uncommon | Old Town walls | Sleepy | Fuzzy moss ball; sleeps for days on north-facing walls |
| 14 | Ivyclad | Bloom/Shade | final | Rare | Old Town ruins | Sleepy | Ivy-cloaked creature that hides inside abandoned buildings |
| 15 | Smogling | Toxic | → Smogmaw (Lv 25) | Common | Industrial chimneys | Predatory | Living soot cloud that hunts small Bloom Wildlings |
| 16 | Smogmaw | Toxic/Blaze | final | Rare | Industrial | Predatory | Smog beast with an ember throat |
| 17 | Binbandit | Shade | → Heistcoon (Lv 20) | Common | Slums, Downtown dumpsters | Curious | Masked scavenger that steals shiny items from the player |
| 18 | Heistcoon | Shade/Alloy | final | Uncommon | Downtown | Curious | Raccoon with a stolen lockpick kit grafted into its fur |
| 19 | Scrapup | Alloy | → Gearhound (Lv 16) | Common | Industrial scrapyards | Loyal | Puppy made of springs and bolts |
| 20 | Gearhound | Alloy | → Scrapjaw (Lv 34) | Uncommon | Industrial | Loyal / Social | Pack hound; packs of three patrol the yards |
| 21 | Scrapjaw | Alloy/Rubble | final | Rare | Industrial | Loyal | Massive junk-dog; the Iron Chain's favourite pit champion |
| 22 | Gloomkit | Shade | → Nightprowl (Lv 22) | Uncommon | Old Town alleys (night) | Shy | Kitten that only exists in peripheral vision |
| 23 | Nightprowl | Shade | final | Rare | Old Town (night) | Predatory | Silent hunter; preys on Puddlefin and Fizzlet |
| 24 | Pebblet | Rubble | → Slabbard (Lv 20) | Common | Construction sites | Sleepy | Pebble armadillo; rolls into a ball when startled |
| 25 | Slabbard | Rubble/Alloy | final | Uncommon | Industrial, Outskirts | Territorial | Concrete-plated armadillo with rebar spines |
| 26 | Gargrin | Rubble/Shade | single stage | Rare | Old Town rooftops | Territorial | Living gargoyle that only moves when nobody looks |
| 27 | Ventwing | Toxic | → Spirewing (Lv 21) | Common | Downtown rooftops | Social | Pigeon-sized bird that nests in exhaust vents; travels in flocks |
| 28 | Spirewing | Toxic/Spark | final | Uncommon | Downtown spires | Social | Long-tailed bird that rides the updrafts between towers |
| 29 | Kilnback | Blaze/Rubble | single stage | Rare | Industrial furnaces | Sleepy | Tortoise with a working kiln for a shell |
| 30 | Fernfox | Bloom | → Grovevix (Lv 24) | Uncommon | Outskirts woods | Shy | Fox with fern-frond ears |
| 31 | Grovevix | Bloom/Spark | final | Rare | Outskirts | Curious | Bioluminescent fox; its tails map the old forest paths |
| 32 | Hydrantoad | Tide | single stage | Uncommon | Downtown fountains, hydrants | Aggressive | Toad that sprays like a burst hydrant |

**Story and legendary Wildlings** (not counted above): **Glitchling** (Spark/Shade, the player's companion, evolves by story into **Resonant**), **Saltmaw** (Tide/Rubble, Harbor legend), **Hollowstag** (Shade/Bloom, Outskirts secret; secret ending).

**Milestone 2 subset (10):** Fizzlet, Neonyx, Cindertail, Puddlefin, Cracksprout, Binbandit, Scrapup, Pebblet, Ventwing and Glitchling. Together they cover all eight types and include two evolution lines.

### 6.4 Capture

- **Capture devices** ("Snares"): *Tin Snare* (×1.0), *Coil Snare* (×1.5; better versus Spark/Alloy), *Lull Snare* (×1.5 on sleeping targets), *Black-Market Snare* (×2.5; illegal, raises Warden suspicion if seen), *Courier Capsule* (story item).
- **Formula (deterministic, seeded):** `p = clamp(base × device × (1 − hp%)^0.75 × statusBonus × bondBonus × nightBonus, 0.02, 0.98)`. `base` comes from species capture difficulty. Shakes are rolled from the simulation RNG, so outcomes are reproducible from a save.
- Wildlings can **break free and flee**. Shy species may flee before a throw if the player approaches running.
- Capturing in faction territory may have consequences, for example poaching the Iron Chain's fighters.

### 6.5 Progression and care

- **XP and levels** (1–60) with a medium-fast curve; XP is split across participants and boosted for type disadvantage wins ("underdog bonus").
- **Evolution:** by level, item (e.g. *Copper Coil*), friendship threshold, time of day or district. Can be cancelled.
- **Skills:** up to four active skills; learnset by level plus *Technique Discs* bought or found.
- **Equipment:** one held item (e.g. *Insulated Collar* halves Spark damage taken).
- **Friendship** (0–255) rises with battles, walks (party follower), feeding and healing, and falls with fainting and neglect. It affects evolution, crit chance and obedience. **Loyalty** is a separate axis: Wildlings acquired from the black market or by theft start low and may disobey.
- **Injuries:** fainting causes an *injury* that lowers max HP by 10% until treated at a clinic (Saint Ottilie's is free but faction-aligned; Halcyon clinics are fast and expensive). This adds stakes without permadeath.
- **Party:** six active; the rest go to *storage* (a pigeon-coop network run by the Gutter Saints, or a Halcyon cloud locker).

## 7. Combat

### 7.1 Turn-based battles

- 1v1 Wildlings with switching, in trainer battles or wild encounters. Doubles are planned after launch.
- **Turn order:** Speed plus skill priority; ties broken by a seeded coin flip.
- **Damage:** `((2L/5+2) × Power × A/D)/50 + 2`, then × STAB 1.25 × type multiplier × crit (1.5, 1/16 base) × environment × random(0.9–1.0) from the seeded RNG.
- **Status effects:** *Shorted* (Spark: 25% lose turn), *Scorched* (DoT and −Attack), *Soaked* (−Speed, +Spark damage taken), *Rooted* (cannot switch), *Poisoned* (escalating DoT), *Rusted* (−Defence), *Spooked* (may hit self), *Dazed* (−accuracy). Each has a cure and a duration.
- **Environment modifiers** come from the overworld location and weather: rain boosts Tide and weakens Blaze; neon-lit streets boost Spark; parks boost Bloom; night boosts Shade.
- **Trainer AI** is deterministic and tactical (see AI.md §5): it scores moves by expected damage, type effectiveness, kill thresholds and status value; it switches out of bad matchups, uses healing items under thresholds, and its difficulty tier limits lookahead and knowledge.

### 7.2 Real-time overworld encounters

- Wildlings exist in the world. Approach them, sneak up on them (walking, not running), throw bait or startle them.
- Hostile Wildlings and faction creatures **attack in the overworld**: a contact or lunge starts a battle. Escape is possible by outrunning them or using a vehicle.
- **Rival trainers** challenge you on sight (line-of-sight cone) and can be avoided.
- **Environmental interactions**: break a hydrant (Tide encounters and a Soaked field), short a substation (Spark), knock over bins (lure Binbandits).

## 8. Urban sandbox

### 8.1 Vehicles (M3)

| Class | Examples | Handling |
|---|---|---|
| Compact | "Kettle" hatchback | Agile, fragile |
| Sedan | "Vesper Civic" | Balanced |
| Van | Courier van | Slow, carries Wildling crates (smuggling) |
| Bike | Delivery scooter | Fast, exposes rider |
| Heavy | Garbage truck, Halcyon armoured car | Rams anything |
| Emergency | Warden cruiser | Fast, faction-locked |

Kinematic bicycle-model physics with acceleration, braking, handbrake slides, collision impulses and component damage (engine smoke, then fire, then explosion). Vehicles are acquired by purchase, theft (alarm, witnesses), mission reward or faction perk.

### 8.2 Traffic and pedestrians

Cars follow a lane graph generated from the road grid, obey signals at intersections, and brake for obstacles and pedestrians. Pedestrians use sidewalks and crosswalks (already in M1), react to danger, gossip and witness crimes.

### 8.3 Wanted system: the Wardens

| Level | Trigger examples | Response |
|---|---|---|
| ★ Noticed | Witnessed theft, shoving an officer | One patrol investigates the last known position |
| ★★ Pursuit | Assault, car theft seen by an officer | Cruisers pursue; roadblocks at district exits |
| ★★★ Manhunt | Repeated violence, Wildling attacks on civilians | Wildling Control Unit with trained Wildlings |
| ★★★★ Lockdown | Killing Wardens, major property destruction | Armoured units; district checkpoints |
| ★★★★★ Blackout | Story escalation or extreme chaos | Halcyon Aegis plus Wardens; neon grid surveillance |

Crime → **witness** (NPC perception) → **report** (witness must reach a phone or officer, or the act is seen directly) → heat. Heat decays out of sight. Hiding spots (alleys, Saint safehouses, garages that repaint cars) and bribes (Compact contacts) reduce it. Reports can be **prevented** by intimidating or bribing witnesses, or by working with the Gutter Saints, who do not talk to Wardens.

### 8.4 Factions (details in WORLD.md §3)

Five competing factions: **Gutter Saints, Halcyon Biotech, Tidewater Compact, Verdant Choir and Iron Chain**. The **Vesper City Wardens** are the institutional law and work as the police system with their own standing.

Reputation per faction ranges from −100 to +100, across five tiers: *Hunted, Distrusted, Unknown, Trusted, Family*. Ranks within a faction unlock missions, gear, safehouses and territory perks.

### 8.5 Economy

- Currency: **Vesper credits (₵)**. Cash on hand can be stolen and lost; bank accounts appear later.
- **District price indices** respond to supply and demand, faction control (taxes or protection), world events (a lab spill raises medicine prices) and player actions (selling ten Neonyx crashes their black-market price for days).
- **Shops:** general store, clinic, Snare shop, Technique Disc vendor, mechanic, black market (Compact), pit merchant (Iron Chain), Halcyon store (licensed Wildlings and legal gear).
- **Creature trading:** legal (licensed, Halcyon-taxed) versus black market (higher margins, wanted risk, faction consequences).

## 9. Missions

- **Handcrafted:** the main story, faction questlines and character arcs (WORLD.md §5–6).
- **Procedural (deterministic templates):** delivery, investigation, rescue, capture, battle, vehicle theft, escort, faction conflict, territory defence, smuggling, bounty, exploration and recovery. Templates declare preconditions, role constraints, objectives, failure conditions, rewards and consequences. The generator binds them to real NPCs and locations and validates completability before offering them (see AI.md §8).
- **Mission sources:** phone board (courier jobs), faction contacts, NPCs with needs (from their state), notice boards and world events.

## 10. Progression summary

| Track | Range | Unlocks |
|---|---|---|
| Player level (Street Cred) | 1–50 | Skill points |
| Player skills | 4 trees: *Handler* (capture/bond), *Runner* (movement/stealth/driving), *Hustler* (prices/bribes/persuasion), *Brawler* (overworld combat/intimidation) | Perks |
| Faction rank | 0–5 per faction | Missions, gear, territory |
| Wildling Index | 0–35 | Index rewards, rare Snares |
| Districts | Slums → Downtown / Industrial → Old Town / Harbor → Outskirts | Through story beats, faction access, or illegal routes (tunnels, smuggling boats) |

## 11. User interface

React (DOM) overlays over the Phaser canvas: main menu, character creation, HUD, dialogue, pause (M1). Later: party and Wildling management, storage, Index, inventory, map, quest journal, faction standings, shops, battle UI, settings, save/load and account. Retro pixel typography (Press Start 2P for headings, VT323 for body), neon accent colours, full keyboard and controller navigation, readable at 1280×720.

## 12. Audio direction (M7)

Synth-wave and lo-fi beats per district. Each district has a different instrumentation palette: Slums are dusty lo-fi; Downtown is glossy synth-pop; Industrial is percussive. Rain ambience, neon hum, and creature calls built from processed field recordings. Battle themes escalate with wanted level.

## 13. Milestone 1 as built

- The Slums district: 4×3 city blocks, roads with lane markings, crosswalks, sidewalks with curbs, alleys, a park with a pond, 40+ buildings with 10 named landmarks, parked cars, dumpsters, benches and street lamps.
- Walking and running with acceleration, wall sliding and integer-zoom camera follow.
- 14 named NPCs across 6 archetypes. They wander the pedestrian network (A*, crosswalks only), bark ambient lines, hold handcrafted conversations (greeting, night and grudge variants), and react to being shoved by temperament: timid NPCs flee, steady ones protest, tough ones confront. Bystanders react too. Shoved NPCs hold a **grudge** that changes their dialogue (an early memory system).
- Day and night cycle (24-minute day) with neon signs, warm street lamps and flickering signs.
- Building entrances you can inspect for environmental storytelling.

## 14. Milestone 2 as built

- 11 species in play (Glitchling plus 10 catchable), 30 skills, 8 statuses, environment modifiers, two evolution lines.
- Wildlings roam by habitat and time of day with personality behaviours: flee, approach, charge, nap, flock and hunt.
- Turn-based battles with tactical AI tiers, capture with three Snare types, party and storage, Index, bag, shops, clinic, injuries, blackout.
- Three missions: *Last Run*, *Binbandit Chase*, *Vik's Challenge*.
- Local saves (3 slots plus autosave) with corruption recovery.
