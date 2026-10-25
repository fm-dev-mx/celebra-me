/**
 * Pull request references on board tasks: `#N`, a bare number or this repository's pull URL. Pure, so the
 * view imports it in the browser through model.mjs.
 */
const OWN_PULL = /^(?:https?:\/\/)?github\.com\/fm-dev-mx\/celebra-me\/pull\/([1-9]\d*)\/?$/;
export const isForeignPull = (p) =>
	/\/pull\/\d+/.test(String(p)) && !OWN_PULL.test(String(p).trim());

/** Canonical `#N` from 398, "398", "#398" or this repository's pull URL; anything else stays. */
export function normalizePr(pr) {
	if (pr === undefined || pr === null || String(pr).trim() === '') return undefined;
	const s = String(pr).trim();
	const m = s.match(/^#?([1-9]\d*)$/) ?? s.match(OWN_PULL);
	return m ? `#${m[1]}` : pr;
}

/** The PR number of a task's `pr` (`#398`, 398 or this repository's pull URL); null when it holds none. */
export function prNumber(pr) {
	const m = String(normalizePr(pr) ?? '').match(/^#(\d+)$/);
	return m ? Number(m[1]) : null;
}
