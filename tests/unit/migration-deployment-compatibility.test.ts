import {
	evaluateAppDatabaseReadiness,
	evaluateMigrationDeploymentCompatibility,
	isHostedMigrateTarget,
	loadMigrationRolloutRegistry,
	resolveHostedMigrationIdentity,
	type MigrationRolloutRegistry,
} from '../../scripts/db/migration-deployment-compatibility';

const registry: MigrationRolloutRegistry = {
	migrations: {
		'20260730113000': {
			phase: 'expand',
			provides: ['public_guest_rsvp_rpc'],
		},
		'20260730164613': {
			phase: 'neutral',
			requiresDbCapabilities: ['public_guest_rsvp_rpc'],
			provides: ['public_guest_rsvp_rpc_comment_audit_fix'],
		},
		'20260730220544': {
			phase: 'expand',
			requiresDbCapabilities: ['public_guest_rsvp_rpc'],
			provides: ['public_guest_rsvp_rpc_pgcrypto_portable'],
		},
		__historical_rsvp_dml_revoke__: {
			phase: 'contract',
			requiresDeployedAppCapabilities: ['public_guest_rsvp_rpc_client'],
			revokes: ['direct_guest_service_role_dml'],
		},
	},
	appCapabilities: {
		public_guest_rsvp_rpc_client: {
			requiresDbCapabilities: ['public_guest_rsvp_rpc'],
		},
		direct_guest_service_role_dml_client: {
			requiresDbCapabilities: [],
		},
	},
};

const releaseVersions = ['20260730113000', '20260730164613', '20260730220544'];

describe('migration / deployment compatibility contract', () => {
	it('treats local and disposable-test as unconstrained by hosted deployment identity even for contract migrations', () => {
		const resultLocal = evaluateMigrationDeploymentCompatibility({
			target: 'local',
			targetReleaseSha: null,
			deployedAppSha: null,
			deployedAppCapabilities: [],
			dbAppliedVersions: ['20260730113000', '20260730164613'],
			candidateVersions: ['__historical_rsvp_dml_revoke__'],
			targetReleaseMigrationVersions: [],
			registry,
		});
		expect(resultLocal.status).toBe('allow');

		const resultDisposable = evaluateMigrationDeploymentCompatibility({
			target: 'disposable-test',
			targetReleaseSha: null,
			deployedAppSha: null,
			deployedAppCapabilities: [],
			dbAppliedVersions: ['20260730113000', '20260730164613'],
			candidateVersions: ['__historical_rsvp_dml_revoke__'],
			targetReleaseMigrationVersions: [],
			registry,
		});
		expect(resultDisposable.status).toBe('allow');

		expect(isHostedMigrateTarget('local')).toBe(false);
		expect(isHostedMigrateTarget('disposable-test')).toBe(false);
	});

	it('blocks hosted targets when deployment/release identity is unavailable', () => {
		const result = evaluateMigrationDeploymentCompatibility({
			target: 'production',
			targetReleaseSha: null,
			deployedAppSha: null,
			deployedAppCapabilities: [],
			dbAppliedVersions: ['20260730113000'],
			candidateVersions: ['20260730220544'],
			targetReleaseMigrationVersions: releaseVersions,
			registry,
		});
		expect(result.status).toBe('block');
		expect(result.reasons.join(' ')).toMatch(/target-release Git identity|clean HEAD/);
	});

	it('allows a migration that belongs to the authorized target release', () => {
		const result = evaluateMigrationDeploymentCompatibility({
			target: 'preview',
			targetReleaseSha: 'abc1234',
			deployedAppSha: null,
			deployedAppCapabilities: [],
			dbAppliedVersions: ['20260730113000', '20260730164613'],
			candidateVersions: ['20260730220544'],
			targetReleaseMigrationVersions: releaseVersions,
			registry,
		});
		expect(result.status).toBe('allow');
		expect(result.phaseByVersion['20260730220544']).toBe('expand');
	});

	it('allows ordinary hosted candidates without an explicit rollout registry phase', () => {
		// 20260806120000 is expand in the real registry but omitted here to prove
		// ordinary SQL does not require ceremony when the migration file exists.
		const ordinaryVersion = '20260806120000';
		const result = evaluateMigrationDeploymentCompatibility({
			target: 'production',
			targetReleaseSha: 'abc1234',
			deployedAppSha: null,
			deployedAppCapabilities: [],
			dbAppliedVersions: ['20260730113000'],
			candidateVersions: [ordinaryVersion],
			targetReleaseMigrationVersions: [...releaseVersions, ordinaryVersion],
			registry,
		});
		expect(result.status).toBe('allow');
		expect(result.phaseByVersion[ordinaryVersion]).toBe('unspecified');
	});

	it('blocks hosted candidates when the migration SQL file cannot be classified', () => {
		const result = evaluateMigrationDeploymentCompatibility({
			target: 'production',
			targetReleaseSha: 'abc1234',
			deployedAppSha: null,
			deployedAppCapabilities: [],
			dbAppliedVersions: ['20260730113000'],
			candidateVersions: ['20990101000000'],
			targetReleaseMigrationVersions: [...releaseVersions, '20990101000000'],
			registry,
		});
		expect(result.status).toBe('block');
		expect(result.reasons.join(' ')).toMatch(/Unable to classify SQL risk|Migration file not found/);
	});

	it('blocks a migration absent from the authorized target release', () => {
		const result = evaluateMigrationDeploymentCompatibility({
			target: 'preview',
			targetReleaseSha: 'abc1234',
			deployedAppSha: null,
			deployedAppCapabilities: [],
			dbAppliedVersions: ['20260730113000'],
			candidateVersions: ['20990101000000'],
			targetReleaseMigrationVersions: releaseVersions,
			registry,
		});
		expect(result.status).toBe('block');
		expect(result.reasons.join(' ')).toMatch(/not present in authorized target release/);
	});

	it('allows authorized expand before the replacement application is deployed', () => {
		const result = evaluateMigrationDeploymentCompatibility({
			target: 'production',
			targetReleaseSha: 'abc1234',
			deployedAppSha: null,
			deployedAppCapabilities: ['direct_guest_service_role_dml_client'],
			dbAppliedVersions: [],
			candidateVersions: ['20260730113000'],
			targetReleaseMigrationVersions: releaseVersions,
			registry,
		});
		expect(result.status).toBe('allow');
		expect(result.phaseByVersion['20260730113000']).toBe('expand');
	});

	it('blocks contract before the replacement application is deployed (historical RSVP outage class)', () => {
		const result = evaluateMigrationDeploymentCompatibility({
			target: 'production',
			targetReleaseSha: 'abc1234',
			deployedAppSha: null,
			deployedAppCapabilities: ['direct_guest_service_role_dml_client'],
			dbAppliedVersions: ['20260730113000'],
			candidateVersions: ['__historical_rsvp_dml_revoke__'],
			targetReleaseMigrationVersions: [...releaseVersions, '__historical_rsvp_dml_revoke__'],
			registry,
		});
		expect(result.status).toBe('block');
		expect(result.reasons.join(' ')).toMatch(/Contract migration/);
		expect(result.reasons.join(' ')).toMatch(/public_guest_rsvp_rpc_client/);
	});

	it('resolves hosted identity without treating credentials as deployed-app evidence', () => {
		const identity = resolveHostedMigrationIdentity({
			CELEBRA_TARGET_RELEASE_SHA: 'abc1234',
			// No deployed app SHA / capabilities — worktree/branch/creds are irrelevant here
		});
		expect(identity.deployedAppSha).toBeNull();
		expect(identity.deployedAppCapabilities).toEqual([]);
		expect(identity.targetReleaseSha).toBe('abc1234');
	});

	it('allows contract after required deployment and verification evidence exists', () => {
		const result = evaluateMigrationDeploymentCompatibility({
			target: 'production',
			targetReleaseSha: 'abc1234',
			deployedAppSha: 'def5678',
			deployedAppCapabilities: ['public_guest_rsvp_rpc_client'],
			dbAppliedVersions: ['20260730113000'],
			candidateVersions: ['__historical_rsvp_dml_revoke__'],
			targetReleaseMigrationVersions: [...releaseVersions, '__historical_rsvp_dml_revoke__'],
			registry,
		});
		expect(result.status).toBe('allow');
	});

	it('reports ENVIRONMENT NOT READY when the application is ahead of required DB state', () => {
		const result = evaluateAppDatabaseReadiness({
			deployedAppCapabilities: ['public_guest_rsvp_rpc_client'],
			dbAppliedVersions: [],
			registry,
		});
		expect(result.status).toBe('environment_not_ready');
		expect(result.reasons.join(' ')).toMatch(/ENVIRONMENT NOT READY/);
	});

	it('clears ENVIRONMENT NOT READY when candidates supply the required DB capability', () => {
		const result = evaluateAppDatabaseReadiness({
			deployedAppCapabilities: ['public_guest_rsvp_rpc_client'],
			dbAppliedVersions: [],
			candidateVersions: ['20260730113000'],
			registry,
		});
		expect(result.status).toBe('allow');
	});

	it('loads the repository rollout registry and keeps RSVP expand/contract semantics', () => {
		const live = loadMigrationRolloutRegistry();
		expect(live.migrations['20260730220544']?.phase).toBe('expand');
		expect(live.migrations['__historical_rsvp_dml_revoke__']?.phase).toBe('contract');
		expect(
			live.migrations['__historical_rsvp_dml_revoke__']?.requiresDeployedAppCapabilities,
		).toEqual(['public_guest_rsvp_rpc_client']);
	});
});
