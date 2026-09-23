/* eslint-disable @typescript-eslint/no-explicit-any -- Foundry documents are untyped (see foundry-shim.d.ts). */
/**
 * The item sheet used by every Special Ingredient item: definitions (GM
 * editor), specimens (reveal view), meals and Soup.
 *
 * Items select it through `flags.core.sheetClass`, so the class name must stay
 * equal to SHEET_CLASS_NAME.
 */

import { eat, prepare, toggleEffectReveal, toggleFieldReveal } from "./actions";
import { MODULE_ID, t, TEMPLATES } from "./constants";
import {
  defaultEffect, deletionUpdate, DURATION_UNITS, flagPath, getFlags, isSpoiled, QUALITY_LEVELS,
  REVEALABLE_FIELDS, SCALAR_DURATION_UNITS, sortedEffects, TARGET_KINDS, usesRemaining,
  type EffectData, type EffectMap, type Quality, type RevealableField,
} from "./data";
import { CATEGORIES, categoryLabel, DEFAULT_EFFECT_TYPE, EFFECT_TYPES, effectTypeLabel, paramLabel } from "./effects";
import { effectView, qualityLabel } from "./format";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

interface Option { value: string; label: string; selected: boolean }

function options(choices: Record<string, string>, selected: unknown): Option[] {
  return Object.entries(choices).map(([value, label]) => ({ value, label, selected: value === String(selected ?? "") }));
}

const effectsPath = (level: string) => flagPath(`ingredient.levels.${level}.effects`);

export class IngredientSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID],
    position: { width: 620, height: 720 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      addEffect: IngredientSheet.#onAddEffect,
      deleteEffect: IngredientSheet.#onDeleteEffect,
      clearSpell: IngredientSheet.#onClearSpell,
      openSpell: IngredientSheet.#onOpenSpell,
      toggleReveal: IngredientSheet.#onToggleReveal,
      prepare: IngredientSheet.#onPrepare,
      eat: IngredientSheet.#onEat,
    },
  };

  static PARTS = {
    body: { template: `${TEMPLATES}/sheet.hbs`, scrollable: [".si-body"] },
  };

  tabGroups: Record<string, string> = { level: "wretched" };

  /* -------------------------------------------- */
  /*  Context                                     */
  /* -------------------------------------------- */

  async _prepareContext(options: any): Promise<Record<string, unknown>> {
    const context = await this.#buildContext(await super._prepareContext(options));
    // Handlebars has no equality helper we can rely on across versions; expose one flag per mode.
    context[`mode_${context.mode}`] = true;
    return context;
  }

  async #buildContext(context: Record<string, unknown>): Promise<Record<string, unknown>> {
    const item = this.document;
    const flags = getFlags(item);
    const isGM = game.user.isGM;
    const base = { ...context, item, isGM, name: item.name, img: item.img };

    if (flags?.kind === "soup") return { ...base, mode: "soup", canEat: item.isEmbedded && item.isOwner };

    if (flags?.kind === "meal" && flags.meal) {
      return {
        ...base,
        mode: "meal",
        canEat: item.isEmbedded && item.isOwner,
        activation: t("Sheet.ActionCost"),
        effects: this.#revealableEffects(flags.meal.effects, flags.meal.revealed ?? {}, isGM),
      };
    }

    const ingredient = flags?.ingredient;
    if (!ingredient) return { ...base, mode: "invalid" };

    if (!flags.specimen) {
      if (isGM && this.isEditable) return { ...base, mode: "editor", ...this.#editorContext(ingredient) };
      // A player looking at a definition sees it as an unidentified ingredient.
      return {
        ...base,
        mode: "specimen",
        rows: [
          this.#row("Appearance", ingredient.appearance),
          this.#row("Aroma", ingredient.aroma),
          ...REVEALABLE_FIELDS.map((f) => ({ label: t(`Field.${f}`), value: t("Sheet.Unknown"), known: false })),
        ],
        effects: [],
      };
    }

    const specimen = flags.specimen;
    const remaining = usesRemaining(ingredient, specimen);
    const values: Record<RevealableField, string> = {
      quality: qualityLabel(specimen.quality),
      flavour: ingredient.flavour,
      spoilageRate: `${ingredient.spoilageRate}%`,
      uses: `${remaining} / ${ingredient.uses}`,
    };
    return {
      ...base,
      mode: "specimen",
      rows: [
        this.#row("Appearance", ingredient.appearance),
        this.#row("Aroma", ingredient.aroma),
        ...REVEALABLE_FIELDS.map((field) => {
          const revealed = specimen.revealed[field];
          return {
            label: t(`Field.${field}`),
            value: isGM || revealed ? values[field] : t("Sheet.Unknown"),
            known: isGM || revealed,
            field,
            revealed,
          };
        }),
      ],
      spoilage: specimen.spoilage,
      spoiled: isSpoiled(specimen),
      usesRemaining: remaining,
      usesTotal: ingredient.uses,
      effects: this.#revealableEffects(
        ingredient.levels[specimen.quality]?.effects,
        specimen.revealed.effects ?? {},
        isGM,
      ),
      canPrepare: item.isEmbedded && item.isOwner,
    };
  }

  #row(labelKey: string, value: string) {
    return { label: t(`Field.${labelKey}`), value, known: true };
  }

  /** Effects as players see them: revealed ones in full, the rest as (unknown). The GM sees all. */
  #revealableEffects(effects: EffectMap | undefined, revealed: Record<string, boolean>, isGM: boolean) {
    return sortedEffects(effects).map(([id, effect]) => {
      const isRevealed = !!revealed[id];
      return { ...effectView(id, effect), known: isGM || isRevealed, revealed: isRevealed };
    });
  }

  #editorContext(ingredient: NonNullable<ReturnType<typeof getFlags>>["ingredient"] & object) {
    const typeGroups = (selected: string) =>
      CATEGORIES.map((category) => ({
        label: categoryLabel(category),
        types: [...EFFECT_TYPES.values()]
          .filter((d) => d.category === category)
          .map((d) => ({ value: d.key, label: effectTypeLabel(d.key), selected: d.key === selected })),
      }));

    const targetChoices = Object.fromEntries(TARGET_KINDS.map((k) => [k, t(`Target.${k}`)]));
    const durationChoices = Object.fromEntries(DURATION_UNITS.map((u) => [u, t(`Duration.${u}`)]));

    const effectRow = (level: Quality, id: string, effect: EffectData) => {
      const path = `${effectsPath(level)}.${id}`;
      const def = EFFECT_TYPES.get(effect.type);
      const params = (def?.params ?? []).map((param) => {
        const value = effect.params?.[param.key];
        return {
          label: paramLabel(param.key),
          name: `${path}.params.${param.key}`,
          value: value ?? "",
          checked: !!value,
          [`is_${param.kind}`]: true,
          options: param.choices ? options(param.choices(), value) : [],
          spellName: param.kind === "spell" && value
            ? fromUuidSync(String(value), { strict: false })?.name ?? t("Sheet.MissingSpell")
            : null,
        };
      });
      return {
        id,
        level,
        path,
        typeGroups: typeGroups(effect.type),
        params,
        targetOptions: options(targetChoices, effect.target?.kind),
        showRange: effect.target?.kind !== "self",
        range: effect.target?.range ?? "",
        durationOptions: options(durationChoices, effect.duration?.units),
        showDurationValue: SCALAR_DURATION_UNITS.has(effect.duration?.units),
        durationValue: effect.duration?.value ?? "",
        description: effect.description ?? "",
      };
    };

    return {
      ingredient,
      levels: QUALITY_LEVELS.map((level) => ({
        key: level,
        label: qualityLabel(level),
        active: this.tabGroups.level === level,
        effects: sortedEffects(ingredient.levels[level]?.effects).map(([id, e]) => effectRow(level, id, e)),
      })),
    };
  }

  /* -------------------------------------------- */
  /*  Form handling                               */
  /* -------------------------------------------- */

  _processFormData(event: any, form: any, formData: any): Record<string, unknown> {
    const data = super._processFormData(event, form, formData);
    const flags = getFlags(this.document);
    const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

    // The GM edits uses as "remaining"; store them as uses spent.
    if ("usesRemaining" in data) {
      const remaining = Number(data.usesRemaining);
      delete data.usesRemaining;
      if (flags?.ingredient && flags.specimen && Number.isFinite(remaining)) {
        const total = flags.ingredient.uses;
        foundry.utils.setProperty(data, flagPath("specimen.usesSpent"), clamp(total - remaining, 0, total));
      }
    }

    // Definitions: at least one use, no negative spoilage rate.
    const usesPath = flagPath("ingredient.uses");
    const uses = foundry.utils.getProperty(data, usesPath);
    if (uses !== undefined) foundry.utils.setProperty(data, usesPath, Math.max(1, Math.round(Number(uses) || 1)));
    const ratePath = flagPath("ingredient.spoilageRate");
    const rate = foundry.utils.getProperty(data, ratePath);
    if (rate !== undefined) foundry.utils.setProperty(data, ratePath, Math.max(0, Number(rate) || 0));

    const spoilagePath = flagPath("specimen.spoilage");
    const spoilage = foundry.utils.getProperty(data, spoilagePath);
    if (typeof spoilage === "number") foundry.utils.setProperty(data, spoilagePath, clamp(spoilage, 0, 100));

    return data;
  }

  async _onRender(context: any, options: any): Promise<void> {
    await super._onRender(context, options);
    for (const zone of this.element.querySelectorAll(".si-spell-drop")) {
      zone.addEventListener("dragover", (event: DragEvent) => event.preventDefault());
      zone.addEventListener("drop", (event: DragEvent) => this.#onDropSpell(event, zone as HTMLElement));
    }
  }

  async #onDropSpell(event: DragEvent, zone: HTMLElement): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type !== "Item") return;
    const spell = await fromUuid(data.uuid);
    if (spell?.type !== "spell") {
      ui.notifications.warn(t("Sheet.NotASpell"));
      return;
    }
    await this.document.update({ [`${zone.dataset.path}.params.spell`]: spell.uuid });
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #onAddEffect(this: IngredientSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const level = target.dataset.level as Quality;
    const effects = getFlags(this.document)?.ingredient?.levels[level]?.effects ?? {};
    const sort = Math.max(0, ...Object.values(effects).map((e) => e.sort ?? 0)) + 1;
    const id = foundry.utils.randomID();
    await this.document.update({ [`${effectsPath(level)}.${id}`]: defaultEffect(DEFAULT_EFFECT_TYPE, sort) });
  }

  static async #onDeleteEffect(this: IngredientSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const { level, effectId } = target.dataset;
    if (!level || !effectId) return;
    await this.document.update(deletionUpdate(effectsPath(level), effectId));
  }

  static async #onClearSpell(this: IngredientSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    await this.document.update({ [`${target.dataset.path}.params.spell`]: "" });
  }

  static async #onOpenSpell(this: IngredientSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    const spell = target.dataset.uuid ? await fromUuid(target.dataset.uuid) : null;
    spell?.sheet?.render(true);
  }

  static async #onToggleReveal(this: IngredientSheet, _event: PointerEvent, target: HTMLElement): Promise<void> {
    if (!game.user.isGM) return;
    const { field, effectId } = target.dataset;
    if (effectId) await toggleEffectReveal(this.document, effectId);
    else if (field) await toggleFieldReveal(this.document, field as RevealableField);
  }

  static async #onPrepare(this: IngredientSheet): Promise<void> {
    await prepare(this.document);
  }

  static async #onEat(this: IngredientSheet): Promise<void> {
    await eat(this.document);
  }
}
