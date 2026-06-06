import { isObject } from '@/lib/content-publication/_utils';
import {
	normalizeForPublication,
	type CanonicalJson,
} from '@/lib/content-publication/normalize-content';

export interface DiffExample {
	path: string;
	before: CanonicalJson | undefined;
	after: CanonicalJson | undefined;
}

export interface ContentDiff {
	changedPaths: string[];
	examples: DiffExample[];
}

const MAX_EXAMPLES = 20;

function pathFor(parent: string, segment: string): string {
	if (!parent) return segment;
	if (segment.startsWith('[')) return `${parent}${segment}`;
	return `${parent}.${segment}`;
}

function walkDiff(
	before: CanonicalJson | undefined,
	after: CanonicalJson | undefined,
	path: string,
	paths: string[],
	examples: DiffExample[],
): void {
	if (JSON.stringify(before) === JSON.stringify(after)) return;

	if (Array.isArray(before) || Array.isArray(after)) {
		const beforeArr = Array.isArray(before) ? before : [];
		const afterArr = Array.isArray(after) ? after : [];
		const length = Math.max(beforeArr.length, afterArr.length);
		for (let index = 0; index < length; index += 1) {
			walkDiff(
				beforeArr[index],
				afterArr[index],
				pathFor(path, `[${index}]`),
				paths,
				examples,
			);
		}
		return;
	}

	if (isObject(before) || isObject(after)) {
		const objBefore = isObject(before) ? before : {};
		const objAfter = isObject(after) ? after : {};
		const keys = new Set([...Object.keys(objBefore), ...Object.keys(objAfter)]);
		for (const key of [...keys].sort((a, b) => a.localeCompare(b))) {
			walkDiff(
				objBefore[key] as CanonicalJson | undefined,
				objAfter[key] as CanonicalJson | undefined,
				pathFor(path, key),
				paths,
				examples,
			);
		}
		return;
	}

	const finalPath = path || '$';
	paths.push(finalPath);
	if (examples.length < MAX_EXAMPLES) {
		examples.push({ path: finalPath, before, after });
	}
}

export function diffContent(before: unknown, after: unknown): ContentDiff {
	const changedPaths: string[] = [];
	const examples: DiffExample[] = [];
	walkDiff(
		normalizeForPublication(before),
		normalizeForPublication(after),
		'',
		changedPaths,
		examples,
	);
	return { changedPaths, examples };
}
