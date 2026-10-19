import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

// Deploy identity is read in exactly one module. Application code never consults NODE_ENV:
// edge runtimes report no NODE_ENV, and hosting platforms may inject any value at runtime.
// Retired hosting providers are caught by validate-retired-provider-references.mjs.
const DEPLOY_IDENTITY_MODULE = 'src/lib/server/deploy-identity.ts';
const DEPLOY_IDENTITY_RULES = [
	{
		pattern:
			/(?:getEnv\(\s*['"]CELEBRA_DEPLOY_ENV|(?:process|import\.meta)\.env(?:\.|\[\s*['"])CELEBRA_DEPLOY_ENV|\{[^}]*\bCELEBRA_DEPLOY_ENV\b[^}]*\}\s*=\s*(?:process|import\.meta)\.env)/,
		message: 'reads CELEBRA_DEPLOY_ENV outside src/lib/server/deploy-identity.ts',
		allow: (file) => file === DEPLOY_IDENTITY_MODULE,
	},
	{
		pattern: /getEnv\(\s*['"]NODE_ENV/,
		message: 'reads NODE_ENV dynamically; it is empty on edge runtimes',
	},
	{
		pattern:
			/NODE_ENV['"]?\]?\s*[!=]==?\s*['"]production['"]|['"]production['"]\s*[!=]==?\s*process\.env/,
		message: 'decides behavior from NODE_ENV; use src/lib/server/deploy-identity.ts',
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
