# Special Ingredient — Backlog

Work still to do. [design.md](design.md) is the original design: useful as
reference, but the module has moved on from it and this file is the working list.

## Features

- **[High] Spoilage auto-advance with world time.** Current spoilage increases
  by the daily rate as `game.time` advances.
- **Meal spoilage.** Decide whether meals spoil, and how.
- **Effect automation.** Implement registry `apply` handlers as Active Effects.
- **Compendium-held definitions.**

## Bugs

- **"Display in chat" triggers prepare/eat.** Item use is intercepted through
  the `dnd5e.preDisplayCard` hook, which also fires when dnd5e is asked to show
  an item's card in chat without using it. On a specimen, meal or Soup, that
  opens the Prepare or Eat confirmation instead of posting a card. Cancelling
  it is harmless. A fix needs a way to tell a "use" from a "display" before the
  card is built. dnd5e 5.x fires no hook before `Item#use`, so this needs
  investigating, e.g. whether the message config passed to the hook differs
  between the two paths.
