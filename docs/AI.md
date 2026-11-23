# NEON WILDS — Traditional Game AI Architecture

> Owner: Game AI Engineer · **No generative AI, LLMs or external inference — ever.** Everything here is deterministic, conventional game AI running inside `@neon-wilds/sim`.

## 1. Principles

1. **Deterministic:** seeded RNG streams, fixed ticks, ordered iteration. Every decision can be replayed and debugged.
2. **Layered:** cheap reflexes every tick; deliberate choices at lower rates; strategy hourly.
3. **Data-driven:** personalities, schedules, utility curves, behaviour trees, dialogue and mission templates are content, not code.
4. **Explainable:** every decision records its top-scoring reasons for the debug overlay ("why is Dez angry?").
5. **Budgeted:** per-tick caps on pathfinding and decisions, with simulation LOD (ARCHITECTURE.md §4.5).

## 2. Agent stack (per NPC)

```
 Perception ──► Memory & Knowledge ──► Emotion/Needs ──► Decision ──► Action/Motion
 (events,       (episodic memories,    (fear, anger,     (HSM top    (behaviour trees,
  sight cone,    relationships,         joy; hunger,      level +      steering, A*,
  hearing)       rumours)               rest, social,     utility      animation
                                        money, safety)    activity     intents)
                                                          selection)
```

### 2.1 Perception

- **Stimuli** are simulation events with a position, radius, kind and severity: `crime.assault`, `crime.theft`, `gunshot`, `wildling.attack`, `player.sprint`, `vehicle.crash`, `shove`.
- **Sight:** a facing cone (120°, 10 tiles by day, 6 at night unless lit) plus tile line-of-sight (Bresenham on the `blocked` layer). **Hearing:** radius by loudness, with no line of sight needed.
- Queries go through the spatial hash. Perception runs at 10 Hz for L1 NPCs, staggered by id. L2 NPCs perceive only district-level events.
- **Implemented in M1 (simplified):** shove events alert bystanders within 7 tiles (radius-based), and ambient barks trigger when the player is within 6 tiles.

### 2.2 Memory

Each NPC holds a bounded list of `MemoryRecord`s (DOMAIN_MODEL.md):

| Field | Meaning |
|---|---|
| `kind` | `helped`, `harmed`, `threatened`, `robbed`, `witnessed_crime`, `battle_won/lost`, `gift`, `faction_event`, `personal` … |
| `subject` | Entity reference: player, NPC, faction or Wildling |
| `salience` | 0–1; decays over time with a half-life by kind (shove ≈ 1 game day, theft ≈ 1 week, attack on family ≈ never) |
| `important` | Never decays (story or severe events) |
| `emotion` | Valence and arousal at encoding time |
| `tick`, `location` | When and where |

- **Short-term buffer** (last ~10 perceptions) is promoted to long-term if salience exceeds 0.3. The cap is 32 long-term memories per NPC; the least salient non-important memory is evicted.
- **Retrieval** for dialogue and decisions is `max salience × recency weight`, filtered by subject.
- **Gossip:** when two NPCs socialise, each shares its most salient memory about a third party with probability `trust × talkativeness`, as a *rumour* (salience × 0.6, `secondhand: true`). Reputation therefore spreads through social graphs rather than globally.
- **M1:** `grudgeUntilTick` is the first memory primitive: a shoved NPC remembers for 3 real minutes and switches to grudge dialogue. It is replaced by `MemoryRecord(kind: 'harmed')` in M4.

### 2.3 Relationships graph

Directed edges `(from, to)` over nodes {NPC, Player, Faction, Wildling}, with four axes in [−100, 100]: **trust, affection, fear, respect**. Edges are updated by memory encoding (deltas per memory kind × personality multipliers) and by scripted story events. Faction-to-faction edges carry `stance` (alliance, business, wary, hostile, war) used by the faction AI. Edges decay toward personality baselines when no memories reinforce them.

### 2.4 Emotion and needs

- **Needs** (0–1, rising over time): hunger, rest, social, money, safety, plus role needs such as `duty` for officers and `territory` for gang members. These feed utility scores.
- **Emotion:** a PAD-lite model (valence, arousal, dominance) pushed by memories and perceptions and decaying to the personality baseline. Discrete moods are derived for dialogue and animation: *calm, happy, nervous, afraid, angry, grieving*.
- **Personality** (data): Big-Five-lite traits (`bravery`, `aggression`, `sociability`, `greed`, `curiosity`, `lawfulness`, each 0–1). M1's `temperament` (timid/steady/tough) becomes a preset over these traits.

### 2.5 Decision: hierarchical state machine with utility selection

Top-level HSM, in priority order:

```
┌ Incapacitated (knocked out, arrested)
├ Combat      (fight / flee / surrender)        ← threat perceived and the choice is to fight
├ Threat      (flee / hide / call Wardens / confront / film it)
├ Duty        (faction or job orders: patrol, guard, escort, raid)
├ Social      (conversation, gossip, greeting, following a friend)
└ Routine     (utility-selected activity from the current schedule block)
```

Transitions fire on perception and memory events (interrupts), with hysteresis to avoid flapping.

Inside **Routine**, the schedule (daily template per role, e.g. *vendor: 07–09 set up stall, 09–20 sell, 20–22 eat/socialise, 22–07 home*) offers candidate **activities**. A **utility AI** scores each one:

```
score(a) = weight(a, scheduleBlock) × Π curve_i(consideration_i) × personalityBias(a) × (1 + momentum if current)
```

Considerations include need levels, distance, time left in the block, weather, danger near the location, and relationships with people there. Selection takes the highest score, or a seeded weighted-random pick among the top 3 for variety. Each activity executes as a **behaviour tree** (for example `OpenShop`: GoTo(shop door) → Enter → SetShopState(open) → Loop(ServeCustomers | Idle) until block end).

**Implemented in M1:** a flat FSM (`idle → walking → idle`, `talking`, `fleeing`, `confronting`). It uses A* wandering on the pedestrian network with a per-tick path budget and temperament-driven reactions to shoves. This is the Routine/Threat skeleton the HSM grows from.

### 2.6 Behaviour tree runtime

Small, allocation-free BT interpreter: Sequence, Selector, Parallel, Inverter, Cooldown, UtilitySelector, and leaf actions and conditions registered by name. Trees are **data** (JSON-like TS objects), compiled once into flat node arrays. Each agent holds a per-node status array. Running nodes resume next decision tick. BTs never touch state directly: actions emit *intents* (`moveTo`, `say`, `attack`, `pickUp`) that systems validate and apply.

## 3. Police AI (M3)

- **Witness pipeline:** crime → perceiving NPCs encode a `witnessed_crime` memory. Based on lawfulness, fear and their relationship to the perpetrator, they flee, call the Wardens (walk to a phone or officer, takes time), confront, or ignore. Saints sympathisers do not call.
- **Wanted state:** `heat` per district plus the last known position. Units investigate the last known position (search pattern: expanding spiral of waypoints), pursue on sight, and use roadblocks at chokepoints on the route graph.
- **Escalation:** a director picks unit types by star level and budget per district. Specialist WCU units bring trained Wildlings.
- **Evasion:** heat decays out of sight. Hiding spots, resprays, disguises and bribes reduce it.

## 4. Wildling behaviour (M2 overworld, M4 full)

Behaviour tree per species *profile* (data), parameterised by personality and stats:

```
Selector
├─ Sequence: Threatened? → (courage < threat ? Flee : Fight)        // Aggressive/Territorial lower threshold
├─ Sequence: Hurt & low HP? → Retreat to den → Rest
├─ Sequence: Companion in danger? → Protect (social/loyal species)
├─ Sequence: Intruder in territory? → Display → Escalate → Attack    // Territorial
├─ Sequence: Hungry? → Selector(Hunt prey [Predatory] | Forage food source | Scavenge bins)
├─ Sequence: Sleepy & time matches activity cycle? → GoTo den → Sleep
├─ Sequence: Curious & novel object nearby? → Approach carefully → Investigate → (steal if Binbandit)
├─ Sequence: Social & group nearby? → Flock (boids: separation/alignment/cohesion)
└─ Explore / Idle within habitat bounds
```

- **Inputs:** hunger, energy, HP%, time of day (diurnal, nocturnal, crepuscular), weather, nearby entities from the spatial hash, threat level (the player running or holding a Snare raises it), and territory anchor.
- **Species relations** from data: predator/prey pairs (Nightprowl hunts Puddlefin and Fizzlet), symbiosis (Mossling and Gargrin), rivalries (Cindertail and Hydrantoad).
- **Following a trainer:** the party leader follows the player with steering (arrive plus obstacle avoidance) and reacts to world events (growls at hostile NPCs).
- **Population:** each habitat zone keeps a target population per species. L3 regrowth is logistic, depending on food, Hush strength and capture pressure. Overcapture lowers populations and raises prices.

## 5. Battle AI (M2)

Deterministic tactical evaluator for trainers and wild Wildlings:

1. Enumerate actions: each skill, switch to each healthy party member, item use, flee (wild only).
2. Score each action:
   - Expected damage = average roll × type × STAB × accuracy, as a fraction of the target's remaining HP.
   - Kill bonus if it KOs; heavy penalty if the user would be KO'd first (speed check and opponent's best expected damage).
   - Status value (by remaining turns and target role); stat-change value (decays with stacks).
   - Switch value = matchup improvement − switch-in damage taken.
   - Heal value when HP% < threshold(personality), and only if the item budget allows ("avoid unnecessary resource consumption").
3. Difficulty tiers limit **knowledge** (does the AI know the player's hidden skills?), **lookahead** (0, 1 or 2 ply expectimax) and **noise** (seeded softmax temperature).
4. Trainer *styles* (data) bias weights: *Aggressor, Staller, Switcher, Status-spammer, Gambler*.

## 6. Faction intelligence (M4)

Every in-game hour, each faction leader evaluates **strategic goals** with utility and plans them with **GOAP**.

**World model (facts):** territory control per block (0–100 influence per faction), resources (cash, members, Wildlings, weapons), relationships (stances), threats (recent attacks), player reputation and story flags.

**Goals (utility):** `ExpandTerritory`, `DefendTerritory`, `Recruit`, `AccumulateResources`, `Retaliate(faction)`, `FormAlliance(faction)`, `UndermineRival`, `PursueAgenda` (faction-specific, e.g. Halcyon `CompleteLantern`, Choir `SabotageGrid`).

**GOAP actions** (preconditions → effects, cost):

| Action | Preconditions | Effects | Notes |
|---|---|---|---|
| ScoutBlock(b) | adjacent(b) | intel(b) | — |
| RecruitMembers | cash ≥ c | members += k | Visible: recruiters in their own district |
| RaidBlock(b) | intel(b), members ≥ n | influence(b) +Δ, rival influence −Δ, heat +h | Spawns a squad at L1, or is resolved abstractly at L2/L3 |
| FortifyBlock(b) | owns(b), cash ≥ c | defence(b) +Δ | Guards appear |
| ProposeTruce(f) | stance(f) ≠ war, respect ≥ r | stance improves | May create a player mission ("deliver the offer") |
| TradeDeal(f) | stance ≥ business | cash +, f.cash + | Delivery missions |
| HireMercenary | cash ≥ c | members + | Offers the player a contract |
| Retaliate(f) | grievance(f) | f.influence −, grievance cleared | Raid or ambush |

Plans run as **operations** with physical presence in the world (squads, couriers, graffiti, guards) and resolve deterministically: an abstract combat formula based on members, Wildling power, defence, player involvement and seeded variance. Consequences are visible: territory colour on the map, guard composition, prices, NPC dialogue, rumours, world events and new missions.

**Acceptance (vertical slice):** at least two factions (Saints and Halcyon first) run independently and change block influence. At least one faction changes behaviour based on world events; for example, a Halcyon raid on the Slums causes the Saints to switch to `DefendTerritory` and fortify.

## 7. World simulation director (M4)

An hourly tick updates weather (Markov chain per season), the economy (price indices from supply, demand and faction tax), district activity (crime rate, footfall, Warden presence) and creature populations, and rolls **world events** from a weighted table filtered by preconditions (blackout, flood, procession, auction, raid, recall drive). Each event has a duration, effects and hooks into missions and dialogue.

## 8. Dynamic missions (M5; generator prototype in M4)

**Template** (data): `id`, `category`, `preconditions` (predicate DSL over world state), `roles` (constraints for binding NPCs, locations, Wildlings and vehicles), `objectives` (a small state graph: GoTo, Talk, Deliver, Capture(species), Defeat(trainer), Escort, Steal(vehicle), Survive(time), Find(item)), `failure` (timers, role death, wanted ≥ n, item lost), `rewards` (formula from difficulty and faction), `consequences` (relationship and influence deltas, memories for involved NPCs, world flags), and `textVariants` (handcrafted strings with slots).

**Generation (deterministic, seeded per day and per source):**

1. Collect eligible templates (preconditions true for player progress, district, reputation, faction state, world events and collection progress).
2. Score by relevance: current district, faction needs (a faction's GOAP plan creates demand for "deliver the truce", for example), NPC needs (a vendor robbed yesterday wants a recovery job), novelty (avoid recent repeats) and variety.
3. **Bind roles** with constraint solving (backtracking over candidates sorted by score), for example "a Saints member who trusts the player ≥ 20 and is currently in the Slums".
4. **Validate completability:** every location is reachable (route graph); the target species exists in the bound habitat at a feasible time; the required level is ≤ player power + slack; items exist; timers ≥ travel time × 1.5; no role conflicts with active story missions.
5. Instantiate the text from handcrafted variants, then offer it through the source (job board, NPC dialogue option, faction contact).

Story missions use the same objective runtime but handcrafted definitions and flags.

## 9. Dialogue

Handcrafted **branching dialogue trees** (data): nodes with speaker, text variants and choices. Each choice has conditions (memory, relationship thresholds, faction rank, story flags, items, time) and effects (relationship deltas, flags, missions offered, items, start a battle). Line selection inside a node picks the first variant whose conditions hold, else the default. M1 uses the flat precursor: `greeting / night / grudge` conversation pools selected by state.

## 10. Debugging and observability

- **AI debug overlay** (dev builds, M4): selected NPC's HSM state, top 3 utility scores with considerations, BT node path, current path, memories and relationships.
- **Event log** with filters; **time controls** (pause, step, ×10) via dev commands.
- **Replays:** seed + input log; any bug report can include a replay.
- Headless **soak tests** (simulate one game week at L2/L3 in CI) check invariants: no NaN positions, populations within bounds, faction influences sum correctly, no stuck agents for more than 60 s.
