/* eslint-disable @typescript-eslint/no-explicit-any -- Foundry documents are untyped (see foundry-shim.d.ts). */
/**
 * Special Ingredient — entry point.
 *
 * GMs define magical ingredients as world Items, drop harvested specimens onto
 * characters, and reveal their properties over time. Players prepare
 * specimens into meals and eat them. See docs/design.md.
 */

import { createDefinition, harvest, useItem } from "./actions";
import { log, MODULE_ID, t, TEMPLATES } from "./constants";
import { isDefinition, kindOf } from "./data";
import { IngredientSheet } from "./sheet";

Hooks.once("init", () => {
  log("Initializing");

  foundry.applications.apps.DocumentSheetConfig.registerSheet(Item, MODULE_ID, IngredientSheet, {
    types: ["consumable"],
    makeDefault: false,
    canBeDefault: false,
    label: "SPECIAL_INGREDIENT.Directory.Create",
  });

  foundry.applications.handlebars.loadTemplates([`${TEMPLATES}/sheet.hbs`, `${TEMPLATES}/chat-eat.hbs`]);
});

// dnd5e has set CONFIG.Item.documentClass by now.
Hooks.once("setup", () => {
  // Route every "use" of an owned ingredient, meal or Soup (sheet, favourites, hotbar) to our flows.
  const proto = CONFIG.Item.documentClass.prototype;
  const original = proto.use;
  proto.use = function (this: any, ...args: unknown[]) {
    if (this.isEmbedded && kindOf(this)) return useItem(this);
    return original.apply(this, args);
  };
});

// Dropping a definition onto a character sheet opens the Specimen Quality dialog instead of copying it.
Hooks.on("dropActorSheetData", (actor: any, _sheet: unknown, data: any) => {
  if (data?.type !== "Item" || !data.uuid) return;
  const item = fromUuidSync(data.uuid, { strict: false });
  if (!isDefinition(item)) return;

  if (!game.user.isGM) {
    ui.notifications.warn(t("Harvest.GMOnly"));
    return false;
  }
  if (actor.isOwner) harvest(actor, item);
  return false;
});

// A "Create Ingredient" button in the Items sidebar.
Hooks.on("renderItemDirectory", (_app: unknown, html: any) => {
  if (!game.user.isGM) return;
  const root: HTMLElement | undefined = html instanceof HTMLElement ? html : html?.[0];
  const actions = root?.querySelector(".header-actions");
  if (!actions || actions.querySelector(`.${MODULE_ID}-create`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add(`${MODULE_ID}-create`);
  button.innerHTML = `<i class="fas fa-seedling"></i> ${t("Directory.Create")}`;
  button.addEventListener("click", () => createDefinition());
  actions.append(button);
});
