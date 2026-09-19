jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));
jest.mock('node:fs', () => ({ readFileSync: jest.fn() }));

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readCaptureSourceEvidence } from '../../../scripts/screenshot/source-evidence';

describe('capture workspace fingerprints', () => {
	beforeEach(() => {
		jest.mocked(execFileSync).mockImplementation((_command, args) => {
			const command = (args as string[]).join(' ');
			if (command.includes('--show-toplevel')) return '/synthetic-repo';
			if (command === 'rev-parse HEAD') return 'a'.repeat(40);
			if (command.startsWith('ls-files')) return 'src/example.ts\0';
			return '';
		});
		jest.mocked(readFileSync).mockReturnValue(Buffer.from('version one'));
	});

	it('distinguishes content edits to the same untracked path without storing file contents', () => {
		const before = readCaptureSourceEvidence();
		jest.mocked(readFileSync).mockReturnValue(Buffer.from('version two'));
		const after = readCaptureSourceEvidence();
		expect(before.untrackedSourceSha256).not.toBe(after.untrackedSourceSha256);
		expect(before.dirty).toBe(true);
		expect(JSON.stringify(before)).not.toContain('version one');
		expect(before.role).toBe('capture-workspace');
	});

	it('records unknowns rather than a clean workspace when Git cannot be read', () => {
		jest.mocked(execFileSync).mockImplementation(() => {
			throw new Error('not a repo');
		});
		expect(readCaptureSourceEvidence()).toMatchObject({
			status: 'unavailable',
			dirty: null,
			head: null,
		});
	});
});
