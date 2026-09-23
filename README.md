# Special Ingredient

Magical ingredients for [FoundryVTT](https://foundryvtt.com/) **dnd5e (2024 rules)**. Targets Foundry v13+ (verified on v14) and dnd5e 5.x.

GMs define ingredients, drop harvested specimens onto characters, and reveal
their properties over time. Players cook specimens into meals and eat them.
Full design: [docs/design.md](docs/design.md).

## How it plays

1. **Define** — GM clicks **Create Ingredient** in the Items sidebar. Fill in
   appearance, aroma, flavour, spoilage per day and total uses, then add effects
   for each quality level (Wretched → Exceptional). Spell effects take a dropped
   spell plus cast level / DC / attack bonus.
2. **Harvest** — GM drags the ingredient onto a character sheet and picks the
   Specimen Quality. Cancelling aborts. Every drop is a separate item.
3. **Reveal** — on the specimen in the PC's inventory, the GM clicks the eye
   icons to reveal quality, flavour, spoilage rate, uses and individual effects.
   Players see *(unknown)* until then. The GM edits current spoilage and uses there too.
4. **Prepare** — the player uses the specimen (sheet button or inventory). One use
   becomes `Meal {name}`; at 100% spoilage it becomes `Soup` instead.
5. **Eat** — takes an Action. A meal posts all its effects to chat, reveals them on
   matching specimens in the eater's inventory, and casts any linked spells. Soup
   quietly applies Blinded for 1 hour.

Effects are descriptive only in this version (no automation beyond Soup).

## Commands

| Command           | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `npm install`     | Install dev dependencies (Vite, TypeScript, ESLint).                |
| `npm run build`   | Bundle `src/module.ts` → `dist/module.js`, copy `public/` → `dist/`.|
| `npm run watch`   | Rebuild automatically on every save.                                |
| `npm run link`    | Junction `dist/` into Foundry's modules folder.                     |
| `npm run unlink`  | Remove that junction.                                               |
| `npm run typecheck` | Type-check without emitting.                                      |
| `npm run lint`    | Lint `src/`.                                                        |
| `npm run package` | Build, then zip `dist/` → `module.zip` for manual distribution.     |

## What the template demonstrates

`src/module.ts` shows the patterns you reach for most often:

- **A world setting** registered in the `init` hook (visible under Configure Settings).
- **A settings-menu button** (`registerMenu`) that opens the window below.
- **An `ApplicationV2` + Handlebars window** (`ExampleApp`), the modern v13+ app framework.
- **A rebindable keybinding** (unbound by default) that opens the window.

## Releasing

`.github/workflows/release.yml` publishes a GitHub Release when you push a
version tag:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

It builds, rewrites `module.json` with the tag version and release URLs, zips
the module, and attaches `module.json` + `module.zip`. Users then install from
the **latest manifest URL**:
`https://github.com/<owner>/<repo>/releases/latest/download/module.json`

## Layout

```
special-ingredient/
├── src/
│   ├── module.ts     Hooks: sheet registration, drop → harvest, item use routing, sidebar button
│   ├── data.ts       Flag data model and accessors
│   ├── effects.ts    Effect-type registry (categories, types, params)
│   ├── actions.ts    Harvest, reveal, prepare, eat
│   ├── sheet.ts      IngredientSheet (editor / specimen / meal / soup)
│   ├── format.ts     Display helpers
│   └── constants.ts
├── public/           Copied verbatim into dist/ (manifest, lang, styles, templates)
└── docs/design.md    Requirements and backlog
```

## Real type support

The shim types everything as `any`. For full IntelliSense install the
community types:

```powershell
npm i -D github:League-of-Foundry-Developers/foundry-vtt-types#main
```

then add `"fvtt-types"` to `compilerOptions.types` in `tsconfig.json` and
delete `src/foundry-shim.d.ts`.

## Dev loop

1. `npm run watch` (rebuilds on save)
2. In Foundry: enable the module in a world.
3. Edit code → reload the Foundry browser tab to pick up changes.

Foundry can auto-reload CSS/templates if you enable **Hot Reload** in its
config, but JavaScript changes always need a page reload.
