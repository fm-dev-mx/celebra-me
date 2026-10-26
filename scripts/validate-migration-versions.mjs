import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

/**
 * Rejects duplicate migration versions in supabase/migrations.
 * Supabase migration filenames start with a numeric timestamp (e.g. 20261026120000_name.sql).
 */
export function validateMigrationVersions(root = process.cwd(), trackedFiles) {
	const errors = [];
	const migrationsDir = path.join(root, 'supabase', 'migrations');
	const fileSet = new Set();
	if (existsSync(migrationsDir)) {
		try {
			for (const f of readdirSync(migrationsDir)) {
				if (f.endsWith('.sql')) fileSet.add(f);
			}
		} catch {
			// ignore directory read error
		}
	}
	if (trackedFiles) {
		for (const tf of trackedFiles) {
			const norm = normalizePath(tf);
			if (norm.startsWith('supabase/migrations/') && norm.endsWith('.sql')) {
				fileSet.add(norm.slice('supabase/migrations/'.length));
			}
		}
	}
	const byVersion = new Map();
	for (const filename of Array.from(fileSet).sort()) {
		const match = filename.match(/^(\d+)_/);
		if (!match) continue;
		const version = match[1];
		if (!byVersion.has(version)) {
			byVersion.set(version, []);
		}
		byVersion.get(version).push(filename);
	}

	for (const [version, filenames] of byVersion) {
		if (filenames.length > 1) {
			errors.push(
				`supabase/migrations: duplicate migration version '${version}' found in: ${filenames.join(', ')}`,
			);
		}
	}
	return errors;
}
