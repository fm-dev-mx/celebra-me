import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');

function resolveModule(specifier: string): string | undefined {
	if (!specifier.startsWith('@/')) return undefined;
	const base = path.join(SRC, specifier.slice(2));
	return [base, `${base}.ts`, path.join(base, 'index.ts')].find(
		(candidate) => candidate.endsWith('.ts') && existsSync(candidate),
	);
}

/** Static value imports only: `import type` is erased and `import()` is loaded on demand. */
function staticImports(file: string): string[] {
	const source = readFileSync(file, 'utf8');
	return [
		...source.matchAll(/^(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?'([^']+)'/gm),
	].map((match) => match[1]);
}

function collectGraph(entry: string): { files: Set<string>; specifiers: Set<string> } {
	const files = new Set<string>();
	const specifiers = new Set<string>();
	const pending = [entry];
	while (pending.length > 0) {
		const file = pending.pop() as string;
		if (files.has(file)) continue;
		files.add(file);
		for (const specifier of staticImports(file)) {
			specifiers.add(specifier);
			const resolved = resolveModule(specifier);
			if (resolved) pending.push(resolved);
		}
	}
	return { files, specifiers };
}

describe('browser tracking client weight', () => {
	it('does not pull Zod into public pages', () => {
		const { files, specifiers } = collectGraph(path.join(SRC, 'lib/tracking/client.ts'));

		expect(files).toContain(path.join(SRC, 'lib/tracking/event-names.ts'));
		expect([...specifiers].filter((name) => /zod/.test(name))).toEqual([]);
	});

	it('detects Zod behind the ingestion contract', () => {
		const { specifiers } = collectGraph(path.join(SRC, 'lib/tracking/event-contract.ts'));

		expect(specifiers).toContain('@/lib/schemas/zod-jitless');
	});
});
