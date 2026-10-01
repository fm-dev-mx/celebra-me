import { createRequire } from 'node:module';
import { join } from 'node:path';

/** The exact `toMatchSnapshot` options used by both canonical capture suites. */
export const VISUAL_GATE_OPTIONS = { maxDiffPixelRatio: 0.001 } as const;

type PlaywrightComparator = (
	actual: Buffer,
	expected: Buffer,
	options?: { maxDiffPixelRatio?: number; threshold?: number },
) => { errorMessage: string; diff?: Buffer } | null;

export interface VisualGateComparison {
	passed: boolean;
	message: string;
	diff?: Buffer;
	differentPixels?: number;
	expectedSize?: { width: number; height: number };
	actualSize?: { width: number; height: number };
}

let comparator: PlaywrightComparator | undefined;

/**
 * Playwright's own PNG comparator, so review classification never diverges from the gate.
 * `playwright-core/lib/coreBundle` is an exported but internal entry point; the unit test pins
 * its behavior for the installed version.
 */
function loadComparator(): PlaywrightComparator {
	if (comparator) return comparator;
	const require = createRequire(join(process.cwd(), 'package.json'));
	const core = require('playwright-core/lib/coreBundle') as {
		utils?: { getComparator?: (mimeType: string) => PlaywrightComparator };
	};
	const resolved = core.utils?.getComparator?.('image/png');
	if (!resolved) throw new Error('Playwright PNG comparator is unavailable.');
	comparator = resolved;
	return resolved;
}

export function compareWithVisualGate(actual: Buffer, expected: Buffer): VisualGateComparison {
	if (actual.equals(expected)) return { passed: true, message: '' };
	const result = loadComparator()(actual, expected, VISUAL_GATE_OPTIONS);
	if (!result) return { passed: true, message: '' };
	const sizes = /Expected an image (\d+)px by (\d+)px, received (\d+)px by (\d+)px/u.exec(
		result.errorMessage,
	);
	const pixels = /(\d+) pixels \(ratio/u.exec(result.errorMessage);
	return {
		passed: false,
		message: result.errorMessage.trim(),
		...(result.diff ? { diff: result.diff } : {}),
		...(pixels ? { differentPixels: Number(pixels[1]) } : {}),
		...(sizes
			? {
					expectedSize: { width: Number(sizes[1]), height: Number(sizes[2]) },
					actualSize: { width: Number(sizes[3]), height: Number(sizes[4]) },
				}
			: {}),
	};
}
