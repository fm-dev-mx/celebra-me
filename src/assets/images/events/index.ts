/**
 * Central registry for event-specific image assets.
 *
 * To add a new event:
 * 1. Create a folder in `./events/[event-slug]`
 * 2. Create an `index.ts` in that folder following the assets pattern
 * 3. Export it here as a named namespace
 */
export * as GerardoSesenta from './gerardo-sesenta';
export * as DemoXv from './demo-xv';
