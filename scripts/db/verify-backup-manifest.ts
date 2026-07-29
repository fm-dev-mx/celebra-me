import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCriticalBackupManifest, type CriticalBackupManifest } from './backup-manifest.ts';

const manifestArg = process.argv.find((arg) => arg.startsWith('--manifest='));
if (!manifestArg) throw new Error('Usage: --manifest=<absolute-or-relative-path>');
const manifestPath = resolve(manifestArg.slice('--manifest='.length));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CriticalBackupManifest;
validateCriticalBackupManifest(manifest);
console.info(`Backup manifest verified: ${manifestPath}`);
