import fs from 'node:fs';
import path from 'node:path';
import { planStaticLanes } from '../../scripts/ops/ci-static-parallel';

describe('parallel static lanes', () => {
	it('runs every ci:static command exactly once, with the type check and build on their own', () => {
		const manifest = JSON.parse(
			fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
		) as { scripts: Record<string, string> };
		const ciStatic = manifest.scripts['ci:static'];
		const lanes = planStaticLanes(ciStatic);
		expect(lanes.types).toEqual(['pnpm type-check']);
		expect(lanes.build).toEqual(['pnpm build:app']);
		const declared = ciStatic.split('&&').map((command) => command.trim());
		expect(Object.values(lanes).flat().sort()).toEqual([...declared].sort());
		expect(lanes.checks).toEqual(
			declared.filter((command) => !['pnpm type-check', 'pnpm build:app'].includes(command)),
		);
	});

	it('rejects a ci:static that drops a dedicated lane, repeats a command or chains shell code', () => {
		expect(() => planStaticLanes('pnpm type-check && pnpm lint')).toThrow('pnpm build:app');
		expect(() =>
			planStaticLanes('pnpm type-check && pnpm lint && pnpm lint && pnpm build:app'),
		).toThrow('repeats');
		expect(() => planStaticLanes('pnpm type-check && echo ok && pnpm build:app')).toThrow(
			'plain pnpm scripts',
		);
	});
});
