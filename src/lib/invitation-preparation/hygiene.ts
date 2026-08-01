/**
 * Info-hygiene lints for durable invitation preparation Markdown (Goal 3 A3 / A7).
 * Does not strip legitimate celebrant event facts — only path/chat/credential leaks and
 * parseable demo crossover claims.
 */

export interface HygieneFinding {
	rule: string;
	message: string;
	line: number;
}

const HYGIENE_RULES: Array<{
	rule: string;
	pattern: RegExp;
	message: string;
}> = [
	{
		rule: 'absolute-windows-user-path',
		pattern: /[A-Za-z]:\\Users\\/iu,
		message: 'Absolute Windows user path (C:\\Users\\…) must not appear in durable prep Markdown.',
	},
	{
		rule: 'onedrive-path',
		pattern: /OneDrive/iu,
		message: 'OneDrive path must not appear in durable prep Markdown; use opaque source labels.',
	},
	{
		rule: 'clientes-folder',
		pattern: /Clientes[/\\]/iu,
		message: 'Clientes\\ folder path must not appear in durable prep Markdown.',
	},
	{
		rule: 'whatsapp-chat-title',
		pattern: /WhatsApp Chat\s*-/iu,
		message: 'WhatsApp chat-folder titles must not be persisted; use source:wa-export.',
	},
	{
		rule: 'payroll-hr-portal',
		pattern:
			/(payroll|\bn[oó]mina\b|hr-portal|human[\s-]?resources[/\s.]+portal|workday\.|adp\.com|bamboohr)/iu,
		message: 'Payroll / HR-portal URLs or references must not appear in durable prep Markdown.',
	},	{
		rule: 'credential-bearing-url',
		pattern:
			/(https?:\/\/[^\s)|`]*(?:[?&](?:token|api[_-]?key|access_token|auth)=|[^\s)|`]*:(?:sk|pk)_[a-zA-Z0-9]+))/iu,
		message: 'Credential-bearing URL must not appear in durable prep Markdown.',
	},
];

/**
 * A7: flag explicit claims that real and demo share the same _assetSlug (demo crossover).
 */
const DEMO_CROSSOVER =
	/(?:real|client).{0,80}_assetSlug.{0,40}(?:===|==|equals?|same as|identical).{0,40}(?:demo|counterpart)/iu;

export function lintInvitationPreparationHygiene(
	markdown: string,
	fileLabel = 'document',
): HygieneFinding[] {
	const findings: HygieneFinding[] = [];
	const lines = markdown.split(/\r?\n/u);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNo = i + 1;
		for (const rule of HYGIENE_RULES) {
			if (rule.pattern.test(line)) {
				findings.push({
					rule: rule.rule,
					message: `${fileLabel}:${lineNo}: ${rule.message}`,
					line: lineNo,
				});
			}
		}
		if (DEMO_CROSSOVER.test(line)) {
			findings.push({
				rule: 'demo-assetslug-crossover',
				message: `${fileLabel}:${lineNo}: A7: Do not claim real and demo share the same _assetSlug.`,
				line: lineNo,
			});
		}
	}

	return findings;
}

export function isCanonicalPreparationStatePath(relativePath: string): boolean {
	const normalized = relativePath.replace(/\\/g, '/');
	if (!normalized.startsWith('docs/invitations/')) return false;
	if (!normalized.endsWith('.md')) return false;
	const base = normalized.slice('docs/invitations/'.length);
	if (base.includes('/')) return false;
	if (base.toLowerCase() === 'readme.md') return false;
	if (/-merge-conflicts\.md$/i.test(base)) return false;
	if (/-asset-report\.md$/i.test(base)) return false;
	if (/-copy-audit\.md$/i.test(base)) return false;
	if (/-finalization\.md$/i.test(base)) return false;
	return true;
}

/** Meta index that documents hygiene rules — not scanned for the same forbidden tokens. */
export function shouldLintInvitationDocHygiene(relativePath: string): boolean {
	const normalized = relativePath.replace(/\\/g, '/');
	if (!normalized.startsWith('docs/invitations/')) return false;
	if (!normalized.endsWith('.md')) return false;
	const base = normalized.slice('docs/invitations/'.length);
	if (base.toLowerCase() === 'readme.md') return false;
	return true;
}
