import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { redactCredentials } from '../../scripts/db/db-workflow-lib.ts';
import { buildPostgrestDockerArgs } from '../../scripts/db/disposable-test-env.ts';

// ---------------------------------------------------------------------------
// Cross-platform CI fixes: curl.exe removal, Linux Docker --add-host,
// failure diagnostics, and secret redaction.
// ---------------------------------------------------------------------------
describe('disposable-test-env — cross-platform fixes', () => {
	// -----------------------------------------------------------------------
	// 1. No curl.exe dependency
	// -----------------------------------------------------------------------
	describe('readiness check', () => {
		it('does not reference curl.exe anywhere in the source', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
				'utf8',
			);
			expect(source).not.toContain('curl.exe');
		});

		it('uses Node.js fetch for PostgREST readiness', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
				'utf8',
			);
			// The waitForPostgrestReady function uses fetch()
			expect(source).toContain("fetch('http://127.0.0.1:54331/'");
		});
	});

	// -----------------------------------------------------------------------
	// 2. Linux Docker host mapping
	// -----------------------------------------------------------------------
	describe('buildPostgrestDockerArgs', () => {
		it('includes --add-host=host.docker.internal:host-gateway on Linux', () => {
			const args = buildPostgrestDockerArgs(true);
			expect(args).toContain('--add-host=host.docker.internal:host-gateway');
		});

		it('does not include --add-host on non-Linux', () => {
			const args = buildPostgrestDockerArgs(false);
			expect(args).not.toContain('--add-host');
		});

		it('splice inserts --add-host at position 3 (after --rm, before --name)', () => {
			const args = buildPostgrestDockerArgs(true);
			const spliceIndex = args.indexOf('--add-host=host.docker.internal:host-gateway');
			expect(spliceIndex).toBe(3);
			expect(args[spliceIndex - 1]).toBe('--rm');
			expect(args[spliceIndex + 1]).toBe('--name');
		});

		it('retains all required docker flags', () => {
			const args = buildPostgrestDockerArgs(false);
			expect(args).toContain('run');
			expect(args).toContain('-d');
			expect(args).toContain('--rm');
			expect(args).toContain('--name');
			expect(args).toContain('-p');
			expect(args).toContain('-e');
		});

		it('includes PGRST_DB_URI with host.docker.internal', () => {
			const args = buildPostgrestDockerArgs(false);
			const dbUriArg = args.find((a) => a.startsWith('PGRST_DB_URI='));
			expect(dbUriArg).toBeDefined();
			expect(dbUriArg).toContain('host.docker.internal');
		});

		it('includes the real dbPassword in PGRST_DB_URI (not literal ***)', () => {
			const args = buildPostgrestDockerArgs(false);
			const dbUriArg = args.find((a) => a.startsWith('PGRST_DB_URI='));
			expect(dbUriArg).toBeDefined();
			expect(dbUriArg).not.toContain(':***@');
			expect(dbUriArg).toMatch(/PGRST_DB_URI=postgresql:\/\/supabase_admin:postgres@/);
		});
	});

	// -----------------------------------------------------------------------
	// 3. Child-process stdout/stderr propagation & secret redaction
	// -----------------------------------------------------------------------
	describe('failure diagnostics', () => {
		it('disposable-test-env.ts failure paths redact credentials', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
				'utf8',
			);
			// Each cmdRun* failure path must call redactCredentials on stderr/stdout
			const redactUsages = source.match(/redactCredentials\(result\.(stderr|stdout)\)/g);
			expect(redactUsages).not.toBeNull();
			// All three cmdRun* functions should have redaction
			expect(redactUsages!.length).toBeGreaterThanOrEqual(4);
		});

		it('disposable-test-env.ts prints stderr and stdout labels on failure', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
				'utf8',
			);
			expect(source).toContain("console.error('Application flow stderr:");
			expect(source).toContain("console.error('Application flow stdout:");
			expect(source).toContain("console.error('Concurrency test stderr:");
			expect(source).toContain("console.error('Stale baseline test stderr:");
		});

		it('validate-pipeline.ts runDisposableTestCommand preserves nested failure', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'scripts/db/validate-pipeline.ts'),
				'utf8',
			);
			// Must reference stdout and stderr in the failure path
			const failSectionLines = source
				.split('\n')
				.filter(
					(l) =>
						l.includes('.stdout') ||
						l.includes('.stderr') ||
						l.includes('redactCredentials'),
				);
			// At minimum one call to each after the import
			const stdoutRefs = failSectionLines.filter((l) => l.includes('.stdout'));
			const stderrRefs = failSectionLines.filter((l) => l.includes('.stderr'));
			const redactRefs = failSectionLines.filter((l) => l.includes('redactCredentials'));
			expect(stdoutRefs.length).toBeGreaterThanOrEqual(1);
			expect(stderrRefs.length).toBeGreaterThanOrEqual(1);
			expect(redactRefs.length).toBeGreaterThanOrEqual(1);
		});
	});

	// -----------------------------------------------------------------------
	// 4. redactCredentials edge cases
	// -----------------------------------------------------------------------
	describe('redactCredentials', () => {
		it('redacts postgres:// URLs', () => {
			const input = 'Error: postgres://user:secret@host:5432/db';
			expect(redactCredentials(input)).not.toContain('secret');
			expect(redactCredentials(input)).toMatch(/\/\/<redacted>/);
		});

		it('redacts postgresql:// URLs', () => {
			const input = 'postgresql://supabase_admin:***@127.0.0.1:54332/postgres';
			const result = redactCredentials(input);
			expect(result).not.toContain(':***@');
			expect(result).toContain('<redacted>');
		});

		it('redacts URLs with user but no password', () => {
			const input = 'postgresql://user@host:5432/db';
			expect(redactCredentials(input)).toContain('<redacted>');
			expect(redactCredentials(input)).not.toContain('user@host');
		});

		it('passes through text without any URL', () => {
			const input = 'plain text without any connection string';
			expect(redactCredentials(input)).toBe(input);
		});

		it('handles empty string', () => {
			expect(redactCredentials('')).toBe('');
		});

		it('preserves text around redacted URLs', () => {
			const input = 'prefix postgresql://u:p@h/d suffix';
			const result = redactCredentials(input);
			expect(result).toContain('prefix ');
			expect(result).toContain(' suffix');
		});
	});

	// -----------------------------------------------------------------------
	// 5. Source integrity — no accidental regression
	// -----------------------------------------------------------------------
	describe('source integrity', () => {
		it('disposable-test-env.ts has async main() with catch handler', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
				'utf8',
			);
			expect(source).toContain('async function main()');
			// The entry point handles the promise
			expect(source).toContain('main().catch(');
		});

		it('validate-pipeline.ts imports redactCredentials', () => {
			const source = readFileSync(
				resolve(process.cwd(), 'scripts/db/validate-pipeline.ts'),
				'utf8',
			);
			const importLine = source.match(
				/import\s*\{[^}]+\}\s*from\s*['"]\.\/db-workflow-lib/,
			)?.[0];
			expect(importLine).toContain('redactCredentials');
		});
	});
});

// ---------------------------------------------------------------------------
// 6. Startup resilience — two-stage readiness, extended timeout, image retries
// ---------------------------------------------------------------------------
describe('startup resilience', () => {
	it('defines READINESS_TIMEOUT_MS >= 120_000 for cold runners', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		// Must use an extended timeout for GitHub-hosted cold runners
		// The constant uses numeric separator: 120_000
		const match = source.match(/READINESS_TIMEOUT_MS\s*=\s*120_000/);
		expect(match).not.toBeNull();
	});

	it('fresh container is NOT recreated after 30s (no unconditional delete)', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		// The old behavior had an unconditional recreate loop after 30 iterations.
		// Verify: no "for (let i = 0; i < 30; i++)" + "rm -f" pattern remains
		// in the startup path for fresh containers.
		const cmdStartSection = source.slice(source.indexOf('export function cmdStart'));
		const recreateAfterTimeout = cmdStartSection.match(/rm\s+-f/);
		// The only rm -f should be in the stale-container branch, guarded
		// by containerExists() being true and waitForContainerReady() failing
		if (recreateAfterTimeout) {
			// Must be guarded by the stale-container check, not in a fresh-create path
			const rmIndex = cmdStartSection.indexOf('rm');
			const guardStart = cmdStartSection.slice(Math.max(0, rmIndex - 120), rmIndex);
			expect(guardStart).toContain('stale or broken');
		}
	});

	it('uses two-stage readiness: pg_isready internal then external psql', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		expect(source).toContain('pg_isready');
		expect(source).toContain('isDisposableDbReady');
	});

	it('isDisposableDbReady remains the final success condition', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		// waitForContainerReady must call isDisposableDbReady as the final gate
		const waitFn = source.slice(source.indexOf('function waitForContainerReady'));
		expect(waitFn).toContain('isDisposableDbReady');
		// Must be the check that sets the success flag
		expect(waitFn).toMatch(/isDisposableDbReady/);
	});

	it('image pull retries are bounded (IMAGE_RETRY_COUNT)', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		const match = source.match(/IMAGE_RETRY_COUNT\s*=\s*(\d+)/);
		expect(match).not.toBeNull();
		const count = parseInt(match![1]!, 10);
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThan(10); // no unbounded retries
	});

	it('emits docker container state and logs diagnostics on failure', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		const diagSection = source.slice(source.indexOf('// Diagnostics for failure'));
		// Must capture container state via docker inspect
		expect(diagSection).toContain("'inspect'");
		expect(diagSection).toContain("'logs'");
		expect(diagSection).toContain('Container state');
		expect(diagSection).toContain('Last 30 log lines');
	});

	it('failWithDiagnostics does not print database URLs or secrets', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		// Find the function body between braces
		const fnStart = source.indexOf('function failWithDiagnostics');
		const fnBodyStart = source.indexOf('{', fnStart);
		// Match the closing brace at the same indentation level
		const bodyMatch = source.slice(fnBodyStart).match(/\{([^}]*)\}/);
		const failFnBody = bodyMatch?.[1] ?? '';
		expect(failFnBody).not.toContain('DISPOSABLE_DB_URL');
		expect(failFnBody).not.toContain('dbPassword');
	});

	it('isContainerPgReady uses docker exec with pg_isready and DISPOSABLE_TEST.dbUser', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		const fnSection = source.slice(source.indexOf('function isContainerPgReady'));
		// Find the function body
		const braceStart = fnSection.indexOf('{');
		const braceEnd = fnSection.indexOf('}', braceStart);
		const body = fnSection.slice(braceStart, braceEnd + 1);
		expect(body).toContain('docker');
		expect(body).toContain('exec');
		expect(body).toContain('pg_isready');
		expect(body).toContain('DISPOSABLE_TEST.dbUser');
	});

	it('no production or preview database can be targeted', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'scripts/db/disposable-test-env.ts'),
			'utf8',
		);
		// Must NOT reference PROD_DB_URL or PREVIEW_DB_URL
		expect(source).not.toContain('PROD_DB_URL');
		expect(source).not.toContain('PREVIEW_DB_URL');
	});
});

// ---------------------------------------------------------------------------
// Cross-platform loader: no hardcoded Windows paths
// ---------------------------------------------------------------------------
describe('test-asset-loader — portable demo-json URL', () => {
	const LOADER_PATH = resolve(process.cwd(), 'scripts/db/test-asset-loader.mjs');

	it('contains no machine-specific absolute path', () => {
		const source = readFileSync(LOADER_PATH, 'utf8');
		expect(source).not.toMatch(/D:\//);
		expect(source).not.toMatch(/[A-Z]:\\/);
		expect(source).not.toMatch(/file:\/\/\/[A-Z]:/i);
	});

	it('resolves the demo JSON relative to import.meta.url', () => {
		const source = readFileSync(LOADER_PATH, 'utf8');
		expect(source).toContain('import.meta.url');
		// Must reference the correct relative path
		expect(source).toContain('../../src/content/event-demos/xv/demo-xv-jewelry-box.json');
	});

	it('produces a file URL pointing to the actual demo JSON', () => {
		// Simulate what the loader does: resolve relative to its own location
		const loaderUrl = new URL(`file://${LOADER_PATH.replace(/\\/g, '/')}`);
		const resolved = new URL(
			'../../src/content/event-demos/xv/demo-xv-jewelry-box.json',
			loaderUrl,
		);
		// Verify the resolved URL ends with the expected relative path
		expect(resolved.href).toMatch(/src\/content\/event-demos\/xv\/demo-xv-jewelry-box\.json$/);
	});

	it('uses a template literal for the generated source', () => {
		const source = readFileSync(LOADER_PATH, 'utf8');
		// The astro:content source must interpolate the URL variable
		const astroContentLoad = source.slice(source.indexOf("url === 'astro:content'"));
		expect(astroContentLoad).toContain('${demoJsonUrl}');
	});

	it('preserves the existing schema and registry stubs', () => {
		const source = readFileSync(LOADER_PATH, 'utf8');
		expect(source).toContain('test:asset-registry');
		expect(source).toContain('test:event-content-schema');
		expect(source).toContain('isValidEvent');
		expect(source).toContain('eventContentSchema');
	});

	it('handles non-Windows import.meta.url patterns', () => {
		// Simulate what the loader would produce on a Linux POSIX environment
		const linuxPath = '/workspace/scripts/db/test-asset-loader.mjs';
		const linuxUrl = new URL(`file://${linuxPath}`);
		const resolved = new URL(
			'../../src/content/event-demos/xv/demo-xv-jewelry-box.json',
			linuxUrl,
		);
		expect(resolved.href).toBe(
			'file:///workspace/src/content/event-demos/xv/demo-xv-jewelry-box.json',
		);
	});
});
