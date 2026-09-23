export const MODULE_ID = "special-ingredient";

export const TEMPLATES = `modules/${MODULE_ID}/templates`;

/**
 * Items carry `flags.core.sheetClass = SHEET_ID` so they always open with the
 * module's sheet. Foundry builds the id from the class name, so the sheet
 * class must be named exactly SHEET_CLASS_NAME.
 */
export const SHEET_CLASS_NAME = "IngredientSheet";
export const SHEET_ID = `${MODULE_ID}.${SHEET_CLASS_NAME}`;

export const ICONS = {
  ingredient: "icons/consumables/plants/basil-herb-green.webp",
  meal: "icons/consumables/food/bowl-stew-brown.webp",
  soup: "icons/consumables/food/soup-broth-bowl-wooden-yellow.webp",
} as const;

/** Localization key prefix used throughout lang/en.json. */
export const I18N = "SPECIAL_INGREDIENT";

/** Small helper so all logs are easy to find in the console. */
export function log(...args: unknown[]): void {
  console.log(`${MODULE_ID} |`, ...args);
}

/** Localize a key relative to the module's namespace. */
export function t(key: string): string {
  return game.i18n.localize(`${I18N}.${key}`);
}

/** Format a key relative to the module's namespace. */
export function tf(key: string, data: Record<string, unknown>): string {
  return game.i18n.format(`${I18N}.${key}`, data);
}
