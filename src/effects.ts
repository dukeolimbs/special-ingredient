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
import type { EffectData } from "./data";

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

export interface EffectTypeDef {
  /** Registry key, `${category}.${name}`. */
  key: string;
  category: Category;
  params: ParamDef[];
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

const DEFINITIONS: [Category, string, ParamDef[]][] = [
  ["ability", "setScore", [p("ability", "select", abilities), p("value", "number")]],
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
  ["defence", "tempHp", [p("formula", "formula")]],
  ["defence", "maxHp", [p("formula", "formula")]],
  ["defence", "healing", [p("healMode", "select", fixed("healMode", ["instant", "overTime"])), p("formula", "formula")]],
  ["defence", "deathSaves", []],
  ["defence", "maxHealing", []],
  ["defence", "diseasePoison", [p("immunity", "select", fixed("immunity", ["disease", "poison", "both"]))]],

  ["movement", "speed", [p("movement", "select", withAll(movementTypes, "movement")), p("speedMode", "select", fixed("speedMode", ["add", "multiply", "set"])), p("value", "number")]],
  ["movement", "newType", [p("movement", "select", movementTypes), p("speed", "number")]],
  ["movement", "jump", [p("multiplier", "number")]],
  ["movement", "freedom", []],
  ["movement", "special", [p("specialMove", "select", fixed("specialMove", ["waterWalk", "wallWalk", "teleport"])), p("distance", "number")]],

  ["senses", "sense", [p("sense", "select", senses), p("range", "number")]],
  ["senses", "seeInvisible", []],
  ["senses", "language", [p("languageMode", "select", fixed("languageMode", ["understand", "speak", "telepathy"])), p("language", "text"), p("range", "number")]],

  ["actions", "extra", [p("actionKind", "select", fixed("actionKind", ["action", "bonus", "reaction"]))]],
  ["actions", "lose", [p("actionKind", "select", fixed("actionKind", ["action", "bonus", "reaction"]))]],
  ["actions", "initiative", [p("initiativeMode", "select", fixed("initiativeMode", ["bonus", "advantage"])), p("value", "number")]],

  ["conditions", "apply", [p("condition", "select", conditions)]],
  ["conditions", "immunity", [p("condition", "select", conditions)]],
  ["conditions", "remove", [p("condition", "select", removable)]],

  ["form", "size", [p("size", "select", sizes)]],
  ["form", "statBlock", [p("creature", "text")]],
  ["form", "cosmetic", []],
  ["form", "gaseous", []],

  ["spell", "cast", [p("spell", "spell"), p("level", "number"), p("dc", "number"), p("attack", "number")]],

  ["misc", "waterBreathing", []],
  ["misc", "spellStat", [p("spellStat", "select", fixed("spellStat", ["dc", "attack"])), p("value", "number")]],
  ["misc", "other", []],
];

export const EFFECT_TYPES: ReadonlyMap<string, EffectTypeDef> = new Map(
  DEFINITIONS.map(([category, name, params]) => {
    const key = `${category}.${name}`;
    return [key, { key, category, params }];
  }),
);

export const DEFAULT_EFFECT_TYPE = "misc.other";

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
