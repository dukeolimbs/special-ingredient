/** Display helpers shared by the sheet and chat cards. */

import { t, tf } from "./constants";
import { SCALAR_DURATION_UNITS, type EffectData } from "./data";
import {
  categoryLabel, durationRule, effectIcon, effectTypeLabel, EFFECT_TYPES, normalizedDuration, summarizeParams,
} from "./effects";

export function qualityLabel(quality: string): string {
  return t(`Quality.${quality}`);
}

export function targetLabel(effect: EffectData): string {
  const { kind, range } = effect.target ?? { kind: "self", range: null };
  const label = t(`Target.${kind}`);
  if (kind === "self" || range === null || range === undefined) return label;
  return tf("Target.WithRange", { target: label, range });
}

export function durationLabel(effect: EffectData): string {
  if (durationRule(effect) === "spell") return t("Duration.AsSpell");
  const { value, units } = normalizedDuration(effect);
  if (!SCALAR_DURATION_UNITS.has(units) || !value) return t(`Duration.${units}`);
  return tf(`Duration.Count.${units}.${value === 1 ? "one" : "other"}`, { n: value });
}

export interface EffectView {
  id: string;
  icon: string;
  category: string;
  type: string;
  params: string;
  target: string;
  duration: string;
  description: string;
}

export function effectView(id: string, effect: EffectData): EffectView {
  const def = EFFECT_TYPES.get(effect.type);
  return {
    id,
    icon: effectIcon(effect.type),
    category: def ? categoryLabel(def.category) : "",
    type: effectTypeLabel(effect.type),
    params: summarizeParams(effect),
    target: targetLabel(effect),
    duration: durationLabel(effect),
    description: effect.description ?? "",
  };
}
