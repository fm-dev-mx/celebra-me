#!/usr/bin/env tsx
/**
 * Splits the accepted visual manifest into the root manifest plus one manifest per demo.
 * Values are copied unchanged; running it on an already split manifest is a no-op.
 *
 * Usage: tsx scripts/screenshot/split-visual-demo-manifests.ts [path/to/manifest.json]
 */
import { resolve } from 'node:path';
import { readAcceptedManifestFile, writeAcceptedManifestFiles } from './visual-demo-manifests.ts';

const manifestPath = resolve(process.argv[2] ?? 'tests/e2e/visual-baselines/manifest.json');
writeAcceptedManifestFiles(manifestPath, readAcceptedManifestFile(manifestPath));
console.log(`Split demo visual manifests beside ${manifestPath}.`);
