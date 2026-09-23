/* eslint-disable @typescript-eslint/no-explicit-any -- Foundry documents are untyped (see foundry-shim.d.ts). */
/**
 * Data model for ingredients, specimens, meals and soup.
 *
 * Everything lives in the item's module flags (`flags["special-ingredient"]`)
 * on a dnd5e Consumable. Nothing is stored in `system`, so dnd5e's inventory
 * rows, tooltips and cards never leak hidden information.
 *
 *   definition  kind "ingredient", no `specimen`   (world Item, GM-authored)
 *   specimen    kind "ingredient", has `specimen`  (on an actor, after harvest)
 *   meal        kind "meal"                        (prepared from a specimen)
 *   soup        kind "soup"                        (prepared from a spoiled specimen)
 */

import { MODULE_ID } from "./constants";

export const QUALITY_LEVELS = ["wretched", "subpar", "decent", "excellent", "exceptional"] as const;
export type Quality = (typeof QUALITY_LEVELS)[number];

export const TARGET_KINDS = ["self", "target", "emanation"] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export const DURATION_UNITS = [
  "inst", "turn", "round", "minute", "hour", "day",
  "shortRest", "longRest", "disp", "perm", "spec",
] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];

/** Units that take a numeric value (e.g. "10 minutes"). */
export const SCALAR_DURATION_UNITS: ReadonlySet<DurationUnit> = new Set(["turn", "round", "minute", "hour", "day"]);

/** Hidden specimen properties the GM can reveal individually (besides effects). */
export const REVEALABLE_FIELDS = ["quality", "flavour", "spoilageRate", "uses"] as const;
export type RevealableField = (typeof REVEALABLE_FIELDS)[number];

export interface EffectData {
  /** Effect-type registry key, e.g. "defence.ac". The category is its prefix. */
  type: string;
  /** Parameters defined by the effect type's registry entry. */
  params: Record<string, unknown>;
  target: { kind: TargetKind; range: number | null };
  duration: { value: number | null; units: DurationUnit };
  /** Free text shown to players once the effect is revealed. */
  description: string;
  sort: number;
}

export type EffectMap = Record<string, EffectData>;

export interface IngredientData {
  appearance: string;
  aroma: string;
  flavour: string;
  /** Percentage points of spoilage gained per day. */
  spoilageRate: number;
  /** Total uses of one specimen. */
  uses: number;
  levels: Record<Quality, { effects: EffectMap }>;
}

export interface SpecimenData {
  /** UUID of the ingredient definition this specimen was harvested from. */
  sourceUuid: string;
  quality: Quality;
  /** Current spoilage, 0–100. */
  spoilage: number;
  usesSpent: number;
  revealed: Record<RevealableField, boolean> & { effects: Record<string, boolean> };
}

export interface MealData {
  sourceUuid: string;
  quality: Quality;
  effects: EffectMap;
  revealed: Record<string, boolean>;
}

export type ItemKind = "ingredient" | "meal" | "soup";

export interface ModuleFlags {
  kind: ItemKind;
  ingredient?: IngredientData;
  specimen?: SpecimenData;
  meal?: MealData;
}

/* -------------------------------------------- */
/*  Accessors                                   */
/* -------------------------------------------- */

export function getFlags(item: any): ModuleFlags | undefined {
  return item?.flags?.[MODULE_ID];
}

export function kindOf(item: any): ItemKind | undefined {
  return getFlags(item)?.kind;
}

export function isDefinition(item: any): boolean {
  const flags = getFlags(item);
  return flags?.kind === "ingredient" && !flags.specimen;
}

export function isSpecimen(item: any): boolean {
  const flags = getFlags(item);
  return flags?.kind === "ingredient" && !!flags.specimen;
}

export function isSpoiled(specimen: SpecimenData): boolean {
  return specimen.spoilage >= 100;
}

export function usesRemaining(ingredient: IngredientData, specimen: SpecimenData): number {
  return Math.max(0, ingredient.uses - specimen.usesSpent);
}

/** Effects of a map as [id, effect] pairs in display order. */
export function sortedEffects(effects: EffectMap | undefined): [string, EffectData][] {
  return Object.entries(effects ?? {}).sort(([, a], [, b]) => (a.sort ?? 0) - (b.sort ?? 0));
}

/** Path to a flag key, for use in `Document#update`. */
export function flagPath(key: string): string {
  return `flags.${MODULE_ID}.${key}`;
}

/** An update entry that deletes `key` from the object at `path`. */
export function deletionUpdate(path: string, key: string): Record<string, unknown> {
  const ForcedDeletion = foundry.data.operators?.ForcedDeletion;
  if (ForcedDeletion) return { [`${path}.${key}`]: ForcedDeletion.create() };
  return { [`${path}.-=${key}`]: null };
}

/* -------------------------------------------- */
/*  Factories                                   */
/* -------------------------------------------- */

export function defaultIngredient(): IngredientData {
  const levels = Object.fromEntries(QUALITY_LEVELS.map((q) => [q, { effects: {} }])) as IngredientData["levels"];
  return { appearance: "", aroma: "", flavour: "", spoilageRate: 0, uses: 1, levels };
}

export function defaultEffect(type: string, sort: number): EffectData {
  return {
    type,
    params: {},
    target: { kind: "self", range: null },
    duration: { value: null, units: "inst" },
    description: "",
    sort,
  };
}

export function newSpecimen(sourceUuid: string, quality: Quality): SpecimenData {
  return {
    sourceUuid,
    quality,
    spoilage: 0,
    usesSpent: 0,
    revealed: { quality: false, flavour: false, spoilageRate: false, uses: false, effects: {} },
  };
}
