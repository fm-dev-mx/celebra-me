import fs from 'node:fs';
import path from 'node:path';

describe('framer-motion v14 migration and contract', () => {
	it('pins framer-motion to version ^14 in package.json', () => {
		const pkgPath = path.resolve(process.cwd(), 'package.json');
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
		expect(pkg.dependencies['framer-motion']).toMatch(/^\^14\./);
	});

	it('exports all runtime symbols expected by Celebra-me components from framer-motion', () => {
		const actualMotion = jest.requireActual<typeof import('framer-motion')>('framer-motion');

		expect(actualMotion.motion).toBeDefined();
		expect(typeof actualMotion.motion).toBe('function');
		expect(actualMotion.motion.div).toBeDefined();
		expect(actualMotion.AnimatePresence).toBeDefined();
		expect(typeof actualMotion.useReducedMotion).toBe('function');
		expect(actualMotion.MotionGlobalConfig).toBeDefined();
		expect(typeof actualMotion.MotionGlobalConfig).toBe('object');
	});

	it('supports skipAnimations toggling on MotionGlobalConfig for visual capture parity', () => {
		const actualMotion = jest.requireActual<typeof import('framer-motion')>('framer-motion');
		const original = actualMotion.MotionGlobalConfig.skipAnimations;

		try {
			actualMotion.MotionGlobalConfig.skipAnimations = true;
			expect(actualMotion.MotionGlobalConfig.skipAnimations).toBe(true);

			actualMotion.MotionGlobalConfig.skipAnimations = false;
			expect(actualMotion.MotionGlobalConfig.skipAnimations).toBe(false);
		} finally {
			actualMotion.MotionGlobalConfig.skipAnimations = original;
		}
	});

	it('keeps framer-motion included in vite optimizeDeps in astro.config.mjs', () => {
		const astroConfigPath = path.resolve(process.cwd(), 'astro.config.mjs');
		const content = fs.readFileSync(astroConfigPath, 'utf8');
		expect(content).toContain("include: ['framer-motion']");
	});

	it('references framer-motion in env.d.ts for global type awareness', () => {
		const envPath = path.resolve(process.cwd(), 'src/env.d.ts');
		const content = fs.readFileSync(envPath, 'utf8');
		expect(content).toContain('/// <reference types="framer-motion" />');
	});
});
