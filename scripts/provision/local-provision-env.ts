import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { classifyDbTarget, verifyLocalIdentity } from '../db/db-guard.ts';

export interface LocalEnv {
	apiUrl: string;
	dbUrl: string;
	serviceRoleKey: string;
}

export function resolveLocalEnv(projectRoot?: string): LocalEnv {
	const root = projectRoot ?? process.cwd();

	let output: string;
	try {
		output = execFileSync('supabase', ['status', '-o', 'json'], {
			cwd: root,
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	} catch {
		throw new Error(
			'Local Supabase is required for invitation:update. Refusing to run without local Supabase status.',
		);
	}

	const status = JSON.parse(output) as Record<string, unknown>;
	const apiUrl = status.API_URL as string;
	const dbUrl = status.DB_URL as string;
	const serviceRoleKey = status.SERVICE_ROLE_KEY as string;

	if (typeof apiUrl !== 'string' || typeof dbUrl !== 'string' || typeof serviceRoleKey !== 'string') {
		throw new Error('Local Supabase status is incomplete. Refusing to run.');
	}

	const classification = classifyDbTarget(dbUrl, { apiUrl });
	const identity = verifyLocalIdentity({
		supabaseStatus: output,
		supabaseConfig: fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8'),
	});

	if (classification.target !== 'persistent-local' || !identity.ok) {
		throw new Error(
			`Refusing to run: local target verification failed (${classification.reason}${identity.errors.length ? '; ' + identity.errors.join(' ') : ''}).`,
		);
	}

	return { apiUrl, dbUrl, serviceRoleKey };
}
