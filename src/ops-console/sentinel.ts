/**
 * Marker the production bundle check (`scripts/check-ops-console-bundle.mjs`) looks for in
 * `dist/`. The console renders it, so any build that pulls the console in carries this string.
 */
export const OPS_CONSOLE_SENTINEL = '__CELEBRA_OPS_CONSOLE__';
