/**
 * Minimal ambient declarations for Foundry's runtime globals so the module
 * compiles standalone with no network dependency.
 *
 * These are intentionally typed loosely (`any`). For real IntelliSense and
 * type-checking, install the community types and remove this file:
 *   npm i -D github:League-of-Foundry-Developers/foundry-vtt-types#main
 * then add "fvtt-types" to compilerOptions.types in tsconfig.json.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const game: any;
declare const ui: any;
declare const canvas: any;
declare const CONFIG: any;
declare const Hooks: any;
declare const foundry: any;
declare const Item: any;
declare const ActiveEffect: any;
declare const ChatMessage: any;
declare const Folder: any;
declare function fromUuid(uuid: string, options?: object): Promise<any>;
declare function fromUuidSync(uuid: string, options?: object): any;
