/* eslint-disable @typescript-eslint/no-explicit-any -- Foundry documents are untyped (see foundry-shim.d.ts). */
/**
 * Effect-type registry.
 *
 * Every effect a GM can add is one entry here: its category, label and the
 * parameters it takes. The MVP only uses the registry to render the creation
 * form and to summarise effects as text. Automation later means adding an
 * `apply` handler to entries (params -> Active Effect changes); stored effect
 * data does not need to change.
 */

import { I18N, t } from "./constants";
import { DURATION_UNITS, SCALAR_DURATION_UNITS, type DurationUnit, type EffectData } from "./data";

export const CATEGORIES = [
  "ability", "checks", "saves", "attacks", "defence", "movement",
  "senses", "actions", "conditions", "form", "spell", "misc",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type ParamKind = "number" | "text" | "formula" | "select" | "boolean" | "spell";

export interface ParamDef {
  key: string;
  kind: ParamKind;
  /** Choices for "select" params, resolved at render time (dnd5e config is only ready after init). */
  choices?: () => Record<string, string>;
}

/**
 * Which durations make sense for an effect:
 *   lasting  - an ongoing change (a buff, a sense, a condition); anything but Instantaneous
 *   instant  - happens once (removing a condition, a teleport); always Instantaneous
 *   either   - could be either (temporary HP, "Other")
 *   spell    - a cast spell; the spell's own duration applies
 */
export type DurationRule = "lasting" | "instant" | "either" | "spell";

export interface EffectTypeDef {
  /** Registry key, `${category}.${name}`. */
  key: string;
  category: Category;
  params: ParamDef[];
  /** Duration rule, which may depend on the effect's params (e.g. instant vs over-time healing). */
  duration: (params: Record<string, unknown>) => DurationRule;
}

/* -------------------------------------------- */
/*  Choice lists                                */
/* -------------------------------------------- */

/** Normalise a dnd5e config record (string | {label} | {name} values) into value -> localized label. */
function fromConfig(record: Record<string, any> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(record ?? {})) {
    const label = typeof value === "string" ? value : value?.label ?? value?.name ?? key;
    out[key] = game.i18n.localize(label);
  }
  return out;
}

/** A fixed list of options localized under SPECIAL_INGREDIENT.Choice.<group>.<value>. */
function fixed(group: string, values: string[]): () => Record<string, string> {
  return () => Object.fromEntries(values.map((v) => [v, t(`Choice.${group}.${v}`)]));
}

const withAll = (choices: () => Record<string, string>, group: string) => () => ({
  all: t(`Choice.${group}.all`),
  ...choices(),
});

const abilities = () => fromConfig(CONFIG.DND5E.abilities);
const skills = () => fromConfig(CONFIG.DND5E.skills);
const damageTypes = () => fromConfig(CONFIG.DND5E.damageTypes);
const conditions = () => fromConfig(CONFIG.DND5E.conditionTypes);
const movementTypes = () => fromConfig(CONFIG.DND5E.movementTypes);
const senses = () => fromConfig(CONFIG.DND5E.senses);
const sizes = () => fromConfig(CONFIG.DND5E.actorSizes);

const checkTargets = () => ({ all: t("Choice.check.all"), ...abilities(), ...skills() });
const removable = () => ({ ...conditions(), curse: t("Choice.remove.curse") });

const mode = fixed("mode", ["advantage", "disadvantage"]);

/* -------------------------------------------- */
/*  Registry                                    */
/* -------------------------------------------- */

const p = (key: string, kind: ParamKind, choices?: () => Record<string, string>): ParamDef => ({ key, kind, choices });

type RuleSpec = DurationRule | ((params: Record<string, unknown>) => DurationRule);

/** Entries are [category, name, params, duration rule (default "lasting")]. */
const DEFINITIONS: [Category, string, ParamDef[], RuleSpec?][] = [
  ["ability", "setScore", [p("ability", "select", abilities), p("value", "number")]],
  ["ability", "improveScore", [p("ability", "select", abilities), p("amount", "formula"), p("maximum", "number")]],
  ["ability", "reduceScore", [p("ability", "select", abilities), p("amount", "formula")]],
  ["ability", "checkMode", [p("ability", "select", abilities), p("mode", "select", mode)]],

  ["checks", "bonus", [p("check", "select", checkTargets), p("bonus", "formula")]],
  ["checks", "mode", [p("check", "select", checkTargets), p("mode", "select", mode)]],
  ["checks", "proficiency", [p("skill", "select", skills), p("level", "select", fixed("proficiency", ["proficient", "expertise"]))]],

  ["saves", "bonus", [p("save", "select", withAll(abilities, "save")), p("bonus", "formula")]],
  ["saves", "mode", [p("save", "select", withAll(abilities, "save")), p("mode", "select", mode)]],
  ["saves", "autoFail", [p("save", "select", abilities)]],
  ["saves", "concentration", []],

  ["attacks", "bonus", [p("attackKind", "select", fixed("attackKind", ["all", "melee", "ranged", "weapon", "spell"])), p("bonus", "formula")]],
  ["attacks", "extraDamage", [p("formula", "formula"), p("damageType", "select", damageTypes)]],
  ["attacks", "mode", [p("direction", "select", fixed("direction", ["made", "against"])), p("mode", "select", mode)]],
  ["attacks", "damageType", [p("damageType", "select", damageTypes), p("magical", "boolean")]],
  ["attacks", "critRange", [p("threshold", "number")]],

  ["defence", "ac", [p("acMode", "select", fixed("acMode", ["bonus", "base", "minimum"])), p("value", "formula")]],
  ["defence", "damageTrait", [p("trait", "select", fixed("trait", ["resistance", "immunity", "vulnerability"])), p("damageType", "select", damageTypes)]],
  ["defence", "tempHp", [p("formula", "formula")], "either"],
  ["defence", "maxHp", [p("formula", "formula")]],
  ["defence", "healing", [p("healMode", "select", fixed("healMode", ["instant", "overTime"])), p("formula", "formula")],
    (params) => (params.healMode === "overTime" ? "lasting" : params.healMode === "instant" ? "instant" : "either")],
  ["defence", "deathSaves", []],
  ["defence", "maxHealing", []],
  ["defence", "diseasePoison", [p("immunity", "select", fixed("immunity", ["disease", "poison", "both"]))]],

  ["movement", "speed", [p("movement", "select", withAll(movementTypes, "movement")), p("speedMode", "select", fixed("speedMode", ["add", "multiply", "set"])), p("value", "number")]],
  ["movement", "newType", [p("movement", "select", movementTypes), p("speed", "number")]],
  ["movement", "jump", [p("multiplier", "number")]],
  ["movement", "freedom", []],
  ["movement", "special", [p("specialMove", "select", fixed("specialMove", ["waterWalk", "wallWalk", "teleport"])), p("distance", "number")],
    (params) => (params.specialMove === "teleport" ? "instant" : "lasting")],

  ["senses", "sense", [p("sense", "select", senses), p("range", "number")]],
  ["senses", "seeInvisible", []],
  ["senses", "language", [p("languageMode", "select", fixed("languageMode", ["understand", "speak", "telepathy"])), p("language", "text"), p("range", "number")]],

  ["actions", "extra", [p("actionKind", "select", fixed("actionKind", ["action", "bonus", "reaction"]))]],
  ["actions", "lose", [p("actionKind", "select", fixed("actionKind", ["action", "bonus", "reaction"]))]],
  ["actions", "initiative", [p("initiativeMode", "select", fixed("initiativeMode", ["bonus", "advantage"])), p("value", "number")]],

  ["conditions", "apply", [p("condition", "select", conditions)]],
  ["conditions", "immunity", [p("condition", "select", conditions)]],
  ["conditions", "remove", [p("condition", "select", removable)], "instant"],

  ["form", "size", [p("size", "select", sizes)]],
  ["form", "statBlock", [p("creature", "text")]],
  ["form", "cosmetic", []],
  ["form", "gaseous", []],

  ["spell", "cast", [p("spell", "spell"), p("level", "number"), p("dc", "number"), p("attack", "number")], "spell"],

  ["misc", "waterBreathing", []],
  ["misc", "spellStat", [p("spellStat", "select", fixed("spellStat", ["dc", "attack"])), p("value", "number")]],
  ["misc", "other", [], "either"],
];

export const EFFECT_TYPES: ReadonlyMap<string, EffectTypeDef> = new Map(
  DEFINITIONS.map(([category, name, params, rule = "lasting"]) => {
    const key = `${category}.${name}`;
    const duration = typeof rule === "function" ? rule : () => rule;
    return [key, { key, category, params, duration }];
  }),
);


/** dnd5e's own SVG icons, one per category. Rendered with <dnd5e-icon> so they pick up theme colours. */
const ICON_ROOT = "systems/dnd5e/icons/svg";
const CATEGORY_ICONS: Record<Category, string> = {
  ability: `${ICON_ROOT}/ability-score-improvement.svg`,
  checks: `${ICON_ROOT}/activity/check.svg`,
  saves: `${ICON_ROOT}/activity/save.svg`,
  attacks: `${ICON_ROOT}/activity/attack.svg`,
  defence: `${ICON_ROOT}/rosa-shield.svg`,
  movement: `${ICON_ROOT}/statuses/flying.svg`,
  senses: `${ICON_ROOT}/trait-languages.svg`,
  actions: `${ICON_ROOT}/activity/order.svg`,
  conditions: `${ICON_ROOT}/trait-condition-immunities.svg`,
  form: `${ICON_ROOT}/activity/transform.svg`,
  spell: `${ICON_ROOT}/activity/cast.svg`,
  misc: `${ICON_ROOT}/activity/utility.svg`,
};

export function durationRule(effect: Pick<EffectData, "type" | "params">): DurationRule {
  return EFFECT_TYPES.get(effect.type)?.duration(effect.params ?? {}) ?? "either";
}

/** Duration units the GM may pick for a rule. Instant and spell effects have no choice. */
export function allowedDurationUnits(rule: DurationRule): DurationUnit[] {
  if (rule === "lasting") return DURATION_UNITS.filter((u) => u !== "inst");
  if (rule === "either") return [...DURATION_UNITS];
  return [];
}

/** Default for a lasting effect with no valid duration: 1 hour, like most potions. */
const LASTING_DEFAULT = { value: 1, units: "hour" } as const;

/**
 * The effect's duration corrected for its type: Instantaneous is replaced on lasting effects,
 * instant effects are always Instantaneous, and scalar units always have a value.
 */
export function normalizedDuration(effect: EffectData): EffectData["duration"] {
  const rule = durationRule(effect);
  const current = effect.duration ?? { value: null, units: "inst" };
  if (rule === "spell") return current;
  if (rule === "instant") return { value: null, units: "inst" };
  if (!allowedDurationUnits(rule).includes(current.units)) return { ...LASTING_DEFAULT };
  if (SCALAR_DURATION_UNITS.has(current.units)) {
    const value = Number(current.value);
    return { value: Number.isFinite(value) && value > 0 ? value : 1, units: current.units };
  }
  return { value: null, units: current.units };
}

export function effectIcon(type: string): string {
  const category = EFFECT_TYPES.get(type)?.category ?? "misc";
  return CATEGORY_ICONS[category];
}

export function effectTypeLabel(key: string): string {
  return game.i18n.localize(`${I18N}.Effect.Type.${key}`);
}

export function categoryLabel(category: string): string {
  return game.i18n.localize(`${I18N}.Effect.Category.${category}`);
}

export function paramLabel(key: string): string {
  return game.i18n.localize(`${I18N}.Effect.Param.${key}`);
}

/** Human-readable value of one param, or null if unset. */
function formatParam(def: ParamDef, value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  switch (def.kind) {
    case "boolean":
      return value ? paramLabel(def.key) : null;
    case "select":
      return def.choices?.()[String(value)] ?? String(value);
    case "spell":
      return fromUuidSync(String(value), { strict: false })?.name ?? t("Sheet.MissingSpell");
    default:
      return String(value);
  }
}

/** "Label: value" summary of an effect's params, e.g. "Ability: Strength · Value: 21". */
export function summarizeParams(effect: EffectData): string {
  const def = EFFECT_TYPES.get(effect.type);
  if (!def) return "";
  return def.params
    .map((param) => {
      const value = formatParam(param, effect.params?.[param.key]);
      if (value === null) return null;
      return param.kind === "boolean" ? value : `${paramLabel(param.key)}: ${value}`;
    })
    .filter((s): s is string => s !== null)
    .join(" · ");
}

/** The UUID of the spell linked by a Spell effect, if any. */
export function linkedSpellUuid(effect: EffectData): string | null {
  if (effect.type !== "spell.cast") return null;
  const uuid = effect.params?.spell;
  return typeof uuid === "string" && uuid ? uuid : null;
}
