/* eslint-disable @typescript-eslint/no-explicit-any -- Foundry documents are untyped (see foundry-shim.d.ts). */
/**
 * Gameplay flows: creating a definition, harvesting a specimen onto an actor,
 * revealing properties, preparing meals and eating them.
 */

import { ICONS, MODULE_ID, SHEET_ID, t, tf, TEMPLATES } from "./constants";
import {
  defaultIngredient, flagPath, getFlags, isSpecimen, isSpoiled, newSpecimen, QUALITY_LEVELS, sortedEffects,
  type EffectMap, type MealData, type ModuleFlags, type Quality, type RevealableField,
} from "./data";
import { linkedSpellUuid } from "./effects";
import { effectView, qualityLabel } from "./format";

const { DialogV2 } = foundry.applications.api;

/* -------------------------------------------- */
/*  Definitions                                 */
/* -------------------------------------------- */

/** Create a new ingredient definition in the Items sidebar and open its sheet. */
export async function createDefinition(): Promise<void> {
  const flags: ModuleFlags = { kind: "ingredient", ingredient: defaultIngredient() };
  const item = await Item.implementation.create({
    name: t("Ingredient.NewName"),
    type: "consumable",
    img: ICONS.ingredient,
    system: { type: { value: "food" } },
    flags: { core: { sheetClass: SHEET_ID }, [MODULE_ID]: flags },
  });
  item?.sheet?.render(true);
}

/* -------------------------------------------- */
/*  Harvest                                     */
/* -------------------------------------------- */

async function promptQuality(name: string): Promise<Quality | null> {
  const options = QUALITY_LEVELS.map(
    (q) => `<option value="${q}"${q === "decent" ? " selected" : ""}>${qualityLabel(q)}</option>`,
  ).join("");
  const result = await DialogV2.input({
    window: { title: tf("Harvest.Title", { name }) },
    content: `<div class="form-group">
        <label>${t("Harvest.Quality")}</label>
        <div class="form-fields"><select name="quality">${options}</select></div>
      </div>`,
    ok: { label: t("Harvest.Confirm"), icon: "fas fa-basket-shopping" },
  });
  const quality = result?.quality;
  return QUALITY_LEVELS.includes(quality) ? quality : null;
}

/**
 * Add a specimen of `definition` to `actor`, asking the GM for its quality.
 * Cancelling the dialog aborts the drop.
 */
export async function harvest(actor: any, definition: any): Promise<void> {
  const quality = await promptQuality(definition.name);
  if (!quality) return;

  const data = definition.toObject();
  for (const key of ["_id", "folder", "sort", "ownership"]) delete data[key];
  // No source id: dnd5e stacks dropped consumables that share one, but specimens never stack.
  foundry.utils.setProperty(data, "_stats.compendiumSource", null);
  delete data.flags?.core?.sourceId;
  data.system.quantity = 1;
  data.flags[MODULE_ID].specimen = newSpecimen(definition.uuid, quality);

  await actor.createEmbeddedDocuments("Item", [data]);
}

/* -------------------------------------------- */
/*  Reveal                                      */
/* -------------------------------------------- */

export async function toggleFieldReveal(item: any, field: RevealableField): Promise<void> {
  const current = getFlags(item)?.specimen?.revealed[field] ?? false;
  await item.update({ [flagPath(`specimen.revealed.${field}`)]: !current });
}

export async function toggleEffectReveal(item: any, effectId: string): Promise<void> {
  const flags = getFlags(item);
  if (flags?.specimen) {
    const current = flags.specimen.revealed.effects?.[effectId] ?? false;
    await item.update({ [flagPath(`specimen.revealed.effects.${effectId}`)]: !current });
  } else if (flags?.meal) {
    const current = flags.meal.revealed?.[effectId] ?? false;
    await item.update({ [flagPath(`meal.revealed.${effectId}`)]: !current });
  }
}

/** Mark effects revealed on every specimen of this ingredient and quality in the actor's inventory. */
async function revealOnSpecimens(actor: any, sourceUuid: string, quality: Quality, effectIds: string[]): Promise<void> {
  const updates = actor.items
    .filter((i: any) => {
      const specimen = isSpecimen(i) ? getFlags(i)!.specimen! : null;
      return specimen?.sourceUuid === sourceUuid && specimen.quality === quality;
    })
    .map((i: any) => ({
      _id: i.id,
      ...Object.fromEntries(effectIds.map((id) => [flagPath(`specimen.revealed.effects.${id}`), true])),
    }));
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

/* -------------------------------------------- */
/*  Preparation                                 */
/* -------------------------------------------- */

/** Cast activities for every Spell effect, so eating the meal casts them through dnd5e. */
function castActivities(effects: EffectMap): Record<string, object> {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const activities: Record<string, object> = {};
  for (const [, effect] of sortedEffects(effects)) {
    const uuid = linkedSpellUuid(effect);
    if (!uuid) continue;
    const save = num(effect.params.dc);
    const attack = num(effect.params.attack);
    const _id = foundry.utils.randomID();
    activities[_id] = {
      _id,
      type: "cast",
      spell: {
        uuid,
        level: num(effect.params.level),
        spellbook: false,
        challenge: { override: save !== null || attack !== null, save, attack },
      },
    };
  }
  return activities;
}

function mealData(specimenItem: any): object {
  const { ingredient, specimen } = getFlags(specimenItem)!;
  const effects: EffectMap = foundry.utils.deepClone(ingredient!.levels[specimen!.quality]?.effects ?? {});
  const revealed = Object.fromEntries(Object.keys(effects).map((id) => [id, !!specimen!.revealed.effects?.[id]]));
  const meal: MealData = { sourceUuid: specimen!.sourceUuid, quality: specimen!.quality, effects, revealed };
  return {
    name: tf("Meal.Name", { name: specimenItem.name }),
    type: "consumable",
    img: ICONS.meal,
    system: { type: { value: "food" }, quantity: 1, activities: castActivities(effects) },
    flags: { core: { sheetClass: SHEET_ID }, [MODULE_ID]: { kind: "meal", meal } },
  };
}

function soupData(): object {
  return {
    name: t("Soup.Name"),
    type: "consumable",
    img: ICONS.soup,
    system: { type: { value: "food" }, quantity: 1 },
    flags: { core: { sheetClass: SHEET_ID }, [MODULE_ID]: { kind: "soup" } },
  };
}

/**
 * Spend one use of a specimen to prepare a meal (or Soup, if spoiled).
 * The specimen is deleted when its last use is spent.
 */
export async function prepare(item: any): Promise<void> {
  const flags = getFlags(item);
  if (!flags?.ingredient || !flags.specimen || !item.actor?.isOwner) return;

  const confirmed = await DialogV2.confirm({
    window: { title: item.name },
    content: `<p>${tf("Prepare.Confirm", { name: item.name })}</p>`,
  });
  if (!confirmed) return;

  const data: any = isSpoiled(flags.specimen) ? soupData() : mealData(item);
  await item.actor.createEmbeddedDocuments("Item", [data]);

  const spent = flags.specimen.usesSpent + 1;
  if (spent >= flags.ingredient.uses) await item.delete();
  else await item.update({ [flagPath("specimen.usesSpent")]: spent });

  ui.notifications.info(tf("Prepare.Done", { name: data.name }));
}

/* -------------------------------------------- */
/*  Eating                                      */
/* -------------------------------------------- */

async function applyBlinded(actor: any): Promise<void> {
  const effect = await ActiveEffect.implementation.fromStatusEffect("blinded");
  const data = effect.toObject();
  // A fresh object: v14 migrates the legacy `seconds` key into value/units.
  data.duration = { seconds: 3600 };
  await actor.createEmbeddedDocuments("ActiveEffect", [data]);
}

/** Cast a meal's linked spells, keeping the cast cards usable after the meal is deleted. */
async function castSpells(item: any): Promise<void> {
  const casts = item.system.activities?.getByType?.("cast") ?? [];
  for (const activity of casts) {
    const results = await activity.use({ consume: { spellSlot: false } }, {}, {});
    const spell = activity.cachedSpell;
    // Deleting the meal deletes its cached spells; dnd5e falls back to stored item data on the card.
    if (results?.message && spell) await results.message.setFlag("dnd5e", "item.data", spell.toObject());
  }
}

/** Eat a meal or Soup. Costs an Action; the item is deleted afterwards. */
export async function eat(item: any): Promise<void> {
  const flags = getFlags(item);
  const actor = item.actor;
  if (!flags || !actor?.isOwner) return;

  const confirmed = await DialogV2.confirm({
    window: { title: item.name },
    content: `<p>${tf("Eat.Confirm", { name: item.name })}</p>`,
  });
  if (!confirmed) return;

  const speaker = ChatMessage.getSpeaker({ actor });
  const { renderTemplate } = foundry.applications.handlebars;

  if (flags.kind === "soup") {
    // Stays quiet: nothing on the card mentions what the Soup does.
    const content = await renderTemplate(`${TEMPLATES}/chat-eat.hbs`, { actor: actor.name, item: item.name });
    await ChatMessage.create({ speaker, content });
    await applyBlinded(actor);
    await item.delete();
    return;
  }

  const meal = flags.meal;
  if (!meal) return;
  const effectIds = Object.keys(meal.effects);
  await revealOnSpecimens(actor, meal.sourceUuid, meal.quality, effectIds);

  const content = await renderTemplate(`${TEMPLATES}/chat-eat.hbs`, {
    actor: actor.name,
    item: item.name,
    quality: qualityLabel(meal.quality),
    effects: sortedEffects(meal.effects).map(([id, effect]) => effectView(id, effect)),
  });
  await ChatMessage.create({ speaker, content });

  await castSpells(item);
  await item.delete();
}

/** Route a dnd5e "use" of one of our items to the matching flow. */
export async function useItem(item: any): Promise<void> {
  const kind = getFlags(item)?.kind;
  if (kind === "ingredient") return prepare(item);
  if (kind === "meal" || kind === "soup") return eat(item);
}
