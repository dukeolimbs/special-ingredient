# Special Ingredient — Design

Status: draft, requirements gathering. Target: Foundry v13+ / dnd5e 5.x, **2024 rules only**.

## Overview

GMs define magical ingredients, give harvested specimens of them to players, and
progressively reveal their properties. Players prepare a specimen into a meal
during a rest; eating the meal applies (for MVP: describes) its effects.

## 1. Ingredient definition

- A dnd5e **Consumable** item, stored as a **world Item** (Items sidebar).
- Storage must not assume world Items — compendium-held definitions are a
  future feature.

### Per-ingredient fields

| Field | Notes |
|---|---|
| Appearance | Free text. Always visible. |
| Aroma | Free text. Always visible. |
| Flavour | Free text. Hidden until revealed. |
| Spoilage % per day | Hidden until revealed. |
| Total uses | Hidden until revealed. |

### Quality levels

Five levels: **Wretched, Subpar, Decent, Excellent, Exceptional**.

Quality and potency are effectively the same thing: quality determines potency,
which is the strength and duration of the effects. The spec uses **Quality**
throughout. The GM designs each level independently, with its own list of effects.
Effects may be beneficial or harmful, and one level may mix categories.

### Effects

Each effect has:

- **Category** and **effect type** (picked from the category's menu, see §5)
- **Parameters** specific to that effect type (see §5, "Data shape")
- **Target:** Self / Target / Emanation, plus a range in ft where relevant
- **Duration:** instantaneous, rounds, minutes, hours, days, until short rest,
  until long rest, until dispelled, etc. The GM can pick any of these.
- **Description:** free text shown to players
- **Spell link** (Spell effect category only): a spell item imported alongside
  the ingredient. Eating the meal **casts** it. The GM sets the cast level and
  DC per quality level during creation.

Eating always costs an **Action**. Some effects grant extra actions, bonus
actions or reactions (Action economy category).

## 2. Harvest (GM gives a specimen to a PC)

1. The GM drags the definition from the Items sidebar onto a character sheet.
2. A **Specimen Quality dialog** opens. The GM picks a level. Cancelling the
   dialog aborts the drop.
3. A **separate** item is created in the inventory (specimens never stack).
4. Current spoilage starts at **0%**. The GM can edit it afterwards to fudge or
   correct.

## 3. Identification

- This is a custom mechanism, **not** dnd5e's identified/unidentified system.
- The name is always shown. Hidden fields display **(unknown)**.
- Always visible: name, appearance, aroma, current spoilage %.
- The GM reveals these individually, on the specimen item in the PC's inventory:
  - each effect separately
  - quality
  - flavour
  - spoilage % per day
  - uses total/remaining
- Revealed information is visible to everyone. No chat message is posted.

## 4. Spoilage, preparation and eating

- **Spoilage:** at 100% the item is marked **Spoiled**. Consequences are
  roleplayed; nothing is automated.
- **Preparation:** activating the specimen spends one use and creates an item
  named `Meal {specimen name}` in the same inventory. It has no cost and no
  rest automation; meal prep is roleplayed during a short/long rest. A specimen
  is **deleted** when its uses reach 0.
- **Meal item:** a single-use consumable carrying the specimen's quality-level
  effects and spell link. Deleted once eaten.
- **Eating:** costs an Action. It reveals **all** effects for the specimen's
  quality, shown in the chat card, and casts any linked spell. Those effects
  are also marked revealed on the source specimen and on other specimens of the
  same ingredient **and same quality** in the **eater's inventory** only.
- **Meal freshness:** a meal stays good even if its source specimen later
  spoils.
- **Spoiled specimen:** preparing it spends a use and creates an item named
  exactly `Soup` instead of a meal. The Soup has an empty description. Eating
  it costs an Action and applies **Blinded for 1 hour**. Neither the item nor
  its chat card tells the player this. This is the one automated effect in the
  MVP.

## 5. Effect catalogue

Each category offers a menu of effect types. The GM's choice is stored as data
so it can be automated later.

| Category | Effect types |
|---|---|
| Ability scores | Set score to fixed value · Reduce score · Adv/disadv on one ability |
| Skills & ability checks | Flat/dice bonus · Adv/disadv on specific checks · Temp proficiency/expertise |
| Saving throws | Bonus · Adv/disadv · Automatic failure · Adv on concentration |
| Attacks & damage | Attack bonus · Extra damage dice · Adv/disadv (own / against) · Change damage type / magical · Expanded crit range |
| Defence & HP | AC bonus / new AC base · Resistance/immunity/vulnerability · Temp HP · Max HP ± · Healing (instant / over time) · Death-save adv / max healing · Disease/poison immunity |
| Movement | Speed ± · New movement type · Jump distance · Ignore difficult terrain/restraints · Water/wall walking, teleport |
| Senses & communication | Special senses · See invisible · Languages/telepathy |
| Action economy & initiative | Extra action · Lose action/bonus/reaction · Initiative bonus/adv |
| Conditions | Apply condition · Grant immunity · Remove exhaustion/curse/condition |
| Size & form | Size change · Stat-block replacement · Cosmetic change · Gaseous/incorporeal |
| Spell effect | Cast linked spell |
| Misc | Water breathing / no air · Spell DC / attack bonus |

### Data shape (decision: structured parameters + free text)

Each effect stores a typed `type` key (e.g. `defence.acBonus`) plus a `params`
object matching that type's schema (e.g. `{ mode: "bonus", value: 2 }`). It
also always stores a free-text `description` for display.

A central **effect-type registry** declares each type's category, parameter
schema and label. The MVP only uses the registry to render the creation form.
Automation later means adding an `apply` handler per registry entry, which maps
params to Active Effect changes. No data migration is needed.

## 6. Backlog

- **[High] Spoilage auto-advance with world time.** Current spoilage increases
  by the daily rate as `game.time` advances.
- **Meal spoilage.** Decide whether meals spoil, and how.
- **Effect automation.** Implement registry `apply` handlers as Active Effects.
- **Compendium-held definitions.**

## 7. Open questions

None outstanding.

## 8. Implementation choices awaiting confirmation

These are small UX choices made during the MVP build. None of them affect
stored data.

1. Definitions are created with a **Create Ingredient** button in the Items
   sidebar header (GM only).
2. Unrevealed effects appear to players as one "(unknown)" row each, so players
   can see how many effects exist.
3. Preparing a meal and eating both ask for confirmation first.
4. Preparation shows a notification but posts no chat card.
5. Eating Soup posts "{actor} eats Soup." and nothing else.
6. Only the GM can drop an ingredient definition onto a sheet. Players get a
   warning.
7. A meal copies the specimen's revealed effects when it is prepared. The GM
   can also toggle reveals on the meal itself.
8. A player opening a definition from the sidebar sees it as unidentified.
9. Hidden data is only hidden in the UI. It is readable in the item's flags via
   the browser console.
