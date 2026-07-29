import { describe, expect, it } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	loadConflictResolutionsFile,
	parseConflictResolutionsJson,
	suggestConflictResolutionsFile,
} from '../../scripts/provision/conflict-resolutions.ts';

describe('conflict-resolutions', () => {
	it('parses a path map', () => {
		expect(parseConflictResolutionsJson({ 'envelope.tooltipText': 'package' })).toEqual({
			'envelope.tooltipText': 'package',
		});
	});

	it('accepts an empty object', () => {
		expect(parseConflictResolutionsJson({})).toEqual({});
	});

	it('rejects invalid choices', () => {
		expect(() => parseConflictResolutionsJson({ 'envelope.tooltipText': 'keep' })).toThrow(
			/Resolución inválida/,
		);
	});

	it.each([
		['root array', []],
		['non-object root', 'package'],
	])('rejects a %s', (_label, value) => {
		expect(() => parseConflictResolutionsJson(value)).toThrow(/objeto JSON/);
	});

	it('suggests target as the default keep-editor choice', () => {
		expect(suggestConflictResolutionsFile([{ path: 'envelope.tooltipText' }])).toEqual({
			resolutions: { 'envelope.tooltipText': 'target' },
		});
	});

	it('loads a wrapped { resolutions } file', () => {
		const dir = mkdtempSync(join(tmpdir(), 'conflict-resolutions-'));
		const path = join(dir, 'resolutions.json');
		try {
			writeFileSync(
				path,
				JSON.stringify({
					resolutions: {
						'envelope.tooltipText': 'package',
						'envelope.microcopy': 'target',
					},
				}),
			);
			expect(loadConflictResolutionsFile(path)).toEqual({
				'envelope.tooltipText': 'package',
				'envelope.microcopy': 'target',
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('rejects a bare path map file', () => {
		const dir = mkdtempSync(join(tmpdir(), 'conflict-resolutions-'));
		const path = join(dir, 'resolutions.json');
		try {
			writeFileSync(path, JSON.stringify({ 'envelope.tooltipText': 'package' }));
			expect(() => loadConflictResolutionsFile(path)).toThrow(/resolutions/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('throws when the resolutions file is missing', () => {
		expect(() =>
			loadConflictResolutionsFile(join(tmpdir(), 'missing-conflict-resolutions.json')),
		).toThrow(/No se encontró el archivo de resoluciones/);
	});
});
