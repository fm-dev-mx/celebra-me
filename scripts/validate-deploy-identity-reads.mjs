import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

// Deploy identity is read in exactly one module; hosting-platform identity and the
// dynamic NODE_ENV (empty on edge runtimes) are never consulted by application code.
const DEPLOY_IDENTITY_MODULE = 'src/lib/server/deploy-identity.ts';
const DEPLOY_IDENTITY_RULES = [
	{
		pattern:
			/\bVERCEL(?:_ENV|_GIT_COMMIT_SHA|_GIT_COMMIT_REF|_GIT_PREVIOUS_SHA|_DEPLOYMENT_ID|_REGION|_URL)?\b/,
		message: 'reads hosting-platform identity; use src/lib/server/deploy-identity.ts',
	},
	{
		pattern: /x-vercel-id/i,
		message: 'reads a hosting-platform request id',
	},
	{
		pattern:
			/(?:getEnv\(\s*['"]CELEBRA_DEPLOY_ENV|process\.env(?:\.|\[\s*['"])CELEBRA_DEPLOY_ENV)/,
		message: 'reads CELEBRA_DEPLOY_ENV outside src/lib/server/deploy-identity.ts',
		allow: (file) => file === DEPLOY_IDENTITY_MODULE,
	},
	{
		pattern: /getEnv\(\s*['"]NODE_ENV/,
		message: 'reads NODE_ENV dynamically; it is empty on edge runtimes',
	},
];

export function validateDeployIdentityReads(root, trackedFiles) {
	const errors = [];
	for (const trackedFile of trackedFiles) {
		const relativeFile = normalizePath(trackedFile);
		if (!relativeFile.startsWith('src/')) continue;
		const absolute = path.join(root, ...relativeFile.split('/'));
		if (!existsSync(absolute)) continue;
		let content;
		try {
			content = readFileSync(absolute, 'utf8');
		} catch {
			continue;
		}
		content.split(/\r?\n/).forEach((lineText, idx) => {
			for (const rule of DEPLOY_IDENTITY_RULES) {
				if (rule.allow?.(relativeFile)) continue;
				if (rule.pattern.test(lineText)) {
					errors.push(`${relativeFile}:${idx + 1}: ${rule.message}.`);
				}
			}
		});
	}
	return errors;
}
