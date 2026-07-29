import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import {
	CRITICAL_BACKUP_KINDS,
	createArtifactManifest,
	validateCriticalBackupManifest,
	type CriticalBackupKind,
	type CriticalBackupManifest,
} from './backup-manifest.ts';

const values = new Map(
	process.argv.slice(2).map((argument) => {
		const [key, ...rest] = argument.replace(/^--/, '').split('=');
		return [key, rest.join('=')];
	}),
);
const outputArgument = values.get('output');
if (!outputArgument) throw new Error('Required: --output=<manifest.json>');
const output = resolve(outputArgument);
const artifacts = CRITICAL_BACKUP_KINDS.map((kind: CriticalBackupKind) => {
	const path = values.get(kind);
	if (!path) throw new Error(`Required: --${kind}=<artifact>`);
	return createArtifactManifest(kind, path);
});
const manifest: CriticalBackupManifest = {
	version: 1,
	createdAt: new Date().toISOString(),
	environment: 'production',
	projectRef: SUPABASE_PROJECT_REFS.production,
	artifacts,
};
validateCriticalBackupManifest(manifest);
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
console.info(`Critical backup manifest created and verified: ${output}`);
