import { describe, expect, it } from '@jest/globals';
import {
	DEFAULT_STATUS_SCHEMA_EVIDENCE,
	formatDomainUnverified,
	formatSchemaLifecycleLabel,
} from '../../scripts/status-core/schema-lifecycle-contract.ts';

describe('schema-lifecycle-contract', () => {
	it('defaults status probes to migration history parity evidence', () => {
		expect(DEFAULT_STATUS_SCHEMA_EVIDENCE).toBe('migration_history_parity');
	});

	it('labels UNVERIFIED schema as SCHEMA_UNVERIFIED for operators', () => {
		expect(formatSchemaLifecycleLabel('CURRENT')).toBe('CURRENT');
		expect(formatSchemaLifecycleLabel('BEHIND')).toBe('BEHIND');
		expect(formatSchemaLifecycleLabel('SCHEMA_DRIFT')).toBe('SCHEMA_DRIFT');
		expect(formatSchemaLifecycleLabel('UNVERIFIED')).toBe('SCHEMA_UNVERIFIED');
	});

	it('namespaces domain UNVERIFIED results', () => {
		expect(formatDomainUnverified('CONTENT').status).toBe('CONTENT_UNVERIFIED');
		expect(formatDomainUnverified('INVENTORY').status).toBe('INVENTORY_UNVERIFIED');
		expect(formatDomainUnverified('SCHEMA').detail).toMatch(/fail-closed/i);
	});
});
