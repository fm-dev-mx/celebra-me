/**
 * CLI entry for building an observability snapshot in an isolated process.
 * Used by the Local dashboard API so sync probes do not block Astro's event loop.
 */

import { buildObservabilitySnapshot } from './snapshot.ts';

const snapshot = await buildObservabilitySnapshot();
process.stdout.write(JSON.stringify(snapshot));
