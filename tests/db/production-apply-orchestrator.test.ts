import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { buildMigrationPlan, type MigrationPlan } from '../../scripts/db/migration-plan.ts';
import { OperatorError } from '../../scripts/db/operator-cli-ux.ts';
import { MigrateApplyError } from '../../scripts/db/migrate-orchestrator.ts';
import { parseProductionApplyCliArgs } from '../../scripts/db/production-apply-cli-args.ts';
import {
	applyProductionApplyPlan,
	buildProductionApplyPlan,
	type ProductionApplyExecuteDeps,
} from '../../scripts/db/production-apply-orchestrator.ts';
import { toPublicProductionApplyPlan } from '../../scripts/db/production-apply-format.ts';
import {
	clearProductionWritePermit,
	getProductionWritePermit,
	issueProductionWritePermit,
	matchProductionWritePermit,
} from '../../scripts/db/production-write-permit.ts';
import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';
import type {
	PromotionApplyReport,
	PromotionPreflightReport,
} from '../../scripts/provision/invitation-promote.ts';
import type { UpdateScope } from '../../scripts/provision/semantic-delta.ts';

const PROD_URL = `postgresql://postgres:super-secret@db.${SUPABASE_PROJECT_REFS.production}.supabase.co:5432/postgres`;

function cli(argv: string[]) {
	return parseProductionApplyCliArgs(['node', 'production-apply-cli.ts', ...argv]);
}

function schemaPlan(pending: string[] = ['20260807120000']): MigrationPlan {
	return buildMigrationPlan({
		target: 'production',
		mode: 'preflight',
		sourceHead: 'abc1234',
		redactedTargetIdentity: 'production:redacted',
		pendingVersions: pending,
		expectedPin: null,
		phaseByVersion: Object.fromEntries(pending.map((version) => [version, 'expand'])),
		compatibilityStatus: 'allow',
		compatibilityReasons: ['ok'],
		releaseIdentity: { kind: 'head', value: 'abc1234' },
		deployedAppIdentity: { sha: null, capabilities: [] },
		authRequirement: 'production_owner_tty',
		backupRequirement: 'prod_critical_pre_post',
		executor: 'supabase_cli_push',
		verificationRequirement: 'history_and_mutation_contract',
		releaseEvidenceSha: null,
	});
}

function pkg(slug: string, hash = `hash-${slug}`): InvitationPackageData {
	return {
		schemaVersion: '1',
		packageHash: hash,
		sourceHash: `src-${slug}`,
		metadataHash: 'meta',
		projectionHash: 'proj',
		assetManifestHash: 'assets',
		definitionCreatedAt: '2026-08-12T00:00:00.000Z',
		sourceSlug: slug,
		invitation: {
			slug,
			managedIdentityId: `identity-${slug}`,
			previousSlugs: [],
			title: slug,
			eventType: 'boda',
			baseDemoId: 'demo',
			themeId: 'theme',
			kind: 'client',
			clientName: 'Test Client',
			hostLoginAlias: 'test-client',
			clientEmail: 'test@example.com',
			clientWhatsapp: '0000000000',
			photosReceived: false,
			snapshot: {},
		},
		draft: { status: 'draft', content: {} },
		publishedContent: { content: {} },
		event: { title: slug, eventType: 'boda', status: 'published' },
		assets: [],
	};
}

function invitationPreflight(
	slug: string,
	overrides: Partial<PromotionPreflightReport> = {},
): PromotionPreflightReport {
	return {
		status: 'PROMOTABLE',
		slug,
		packageHash: `hash-${slug}`,
		sourceHash: `src-${slug}`,
		projectionHash: 'proj',
		assetManifestHash: 'assets',
		targetDbUrl: PROD_URL,
		schema: {
			state: 'CURRENT',
			migrationHead: '20260807120000',
			pendingMigrations: [],
			extraMigrations: [],
			compatible: true,
			detail: 'ok',
		},
		backup: {
			required: false,
			acceptable: true,
			canonicalCommand: 'pnpm db:prod:backup:critical',
			detail: 'ok',
		},
		divergence: {
			safeManagedChanges: [],
			targetOwnedDifferences: [],
			managedDivergences: [],
			conflicts: [],
			blocksPromotion: false,
		},
		...overrides,
	} as PromotionPreflightReport;
}

function baseDeps(options?: {
	pending?: string[];
	preflights?: Record<string, PromotionPreflightReport>;
}): ProductionApplyExecuteDeps {
	const preflights = options?.preflights ?? {};
	return {
		preflightSchema: () => schemaPlan(options?.pending ?? ['20260807120000']),
		listSlugs: () => Object.keys(preflights).sort((a, b) => a.localeCompare(b)),
		resolvePackage: async (slug) => pkg(slug),
		runInvitationPreflight: async (packageData) => {
			const slug = packageData.invitation.slug;
			return preflights[slug] ?? invitationPreflight(slug);
		},
		getProductionDbUrl: () => ({ url: PROD_URL }),
		preparePatch: (file) => ({
			file,
			path: file,
			sql: 'SELECT 1;',
			fingerprint: `patch-${file}`,
			manifest: {
				'script-id': 'test-patch',
				purpose: 'test',
				env: 'production',
				ticket: 'TEST-1',
				tables: 'public.example',
				operation: 'update',
				'expected-rows-min': '0',
				'expected-rows-max': '1',
				'requires-backup': 'true',
				'dry-run-query': 'select 1 from public.example',
				rollback: 'backup',
			},
		}),
	};
}

afterEach(() => {
	clearProductionWritePermit();
	jest.restoreAllMocks();
});

describe('production apply planning', () => {
	it('builds a read-only inspect plan without invoking writers', async () => {
		const plan = await buildProductionApplyPlan(
			cli([]),
			baseDeps({
				preflights: {
					alpha: invitationPreflight('alpha'),
					beta: invitationPreflight('beta', { status: 'IN_SYNC' }),
				},
			}),
		);
		expect(plan.scope.inspectAll).toBe(true);
		expect(plan.items.find((item) => item.domain === 'schema')?.readiness).toBe('READY');
		expect(plan.items.find((item) => item.id === 'alpha')?.readiness).toBe('READY');
		expect(plan.items.find((item) => item.id === 'beta')?.readiness).toBe('IN_SYNC');
		expect(JSON.stringify(toPublicProductionApplyPlan(plan))).not.toMatch(
			/postgres(ql)?:\/\//i,
		);
		expect(JSON.stringify(plan)).not.toContain('super-secret');
	});

	it('discovers pending schema for --schema', async () => {
		const plan = await buildProductionApplyPlan(cli(['--schema']), baseDeps());
		expect(plan.items).toHaveLength(1);
		expect(plan.items[0]).toMatchObject({
			domain: 'schema',
			readiness: 'READY',
			pendingVersions: ['20260807120000'],
		});
	});

	it('resolves one slug through invitation preflight, not wizard labels', async () => {
		const plan = await buildProductionApplyPlan(
			cli(['--slug', 'demo']),
			baseDeps({
				pending: [],
				preflights: {
					demo: invitationPreflight('demo', {
						status: 'BLOCKED',
						blockCode: 'MISSING_PREVIEW_APPROVAL',
					}),
				},
			}),
		);
		expect(plan.items.find((item) => item.id === 'demo')?.readiness).toBe('BLOCKED');
		expect(plan.items.find((item) => item.domain === 'schema')?.readiness).toBe(
			'NOT_APPLICABLE',
		);
	});

	it('uses the definition scope for both Production planning and preflight', async () => {
		const runInvitationPreflight = jest.fn(
			async (packageData: InvitationPackageData, updateScope?: UpdateScope) => {
				void updateScope;
				return invitationPreflight(packageData.invitation.slug);
			},
		);
		const plan = await buildProductionApplyPlan(cli(['--slug', 'demo']), {
			...baseDeps({ pending: [] }),
			resolveInvitationUpdateScope: () => 'content-and-assets',
			runInvitationPreflight,
		});

		expect(runInvitationPreflight).toHaveBeenCalledWith(
			expect.objectContaining({ invitation: expect.objectContaining({ slug: 'demo' }) }),
			'content-and-assets',
		);
		expect(plan.items.find((item) => item.id === 'demo')?.updateScope).toBe(
			'content-and-assets',
		);
	});

	it('preserves explicit multi-slug order', async () => {
		const plan = await buildProductionApplyPlan(
			cli(['--slugs', 'zeta,alpha']),
			baseDeps({
				pending: [],
				preflights: {
					zeta: invitationPreflight('zeta'),
					alpha: invitationPreflight('alpha'),
				},
			}),
		);
		expect(
			plan.items.filter((item) => item.domain === 'invitation').map((item) => item.id),
		).toEqual(['zeta', 'alpha']);
	});

	it('limits --all-ready to READY schema and invitations', async () => {
		const plan = await buildProductionApplyPlan(
			cli(['--all-ready']),
			baseDeps({
				preflights: {
					alpha: invitationPreflight('alpha'),
					beta: invitationPreflight('beta', { status: 'IN_SYNC' }),
					gamma: invitationPreflight('gamma', {
						status: 'BLOCKED',
						blockCode: 'MISSING_PREVIEW_APPROVAL',
					}),
				},
			}),
		);
		const mutations = plan.items.filter(
			(item) => item.readiness === 'READY' || item.readiness === 'READY_AFTER_SCHEMA',
		);
		expect(mutations.map((item) => item.id)).toEqual(['schema', 'alpha']);
		expect(plan.items.find((item) => item.id === 'gamma')?.readiness).toBe('BLOCKED');
		expect(plan.items.some((item) => item.domain === 'patch')).toBe(false);
	});

	it('excludes already-applied schema from mutation', async () => {
		const plan = await buildProductionApplyPlan(cli(['--schema']), baseDeps({ pending: [] }));
		expect(plan.items[0]?.readiness).toBe('IN_SYNC');
		expect(plan.planId).toBe(
			(await buildProductionApplyPlan(cli(['--schema']), baseDeps({ pending: [] }))).planId,
		);
	});
});

describe('production apply execution', () => {
	it('authorizes once then delegates schema before invitations', async () => {
		const order: string[] = [];
		const requireOwnerApply = jest.fn(async (input: { bindingHex: string }) => {
			order.push('authorize');
			issueProductionWritePermit({
				projectRef: SUPABASE_PROJECT_REFS.production,
				operationType: 'production_apply',
				bindingHex: input.bindingHex,
			});
		});
		const applySchema = jest.fn(async () => {
			order.push('schema');
			return { plan: schemaPlan(), wrote: true };
		});
		const applyInvitation = jest.fn(
			async (input: {
				packageData: InvitationPackageData;
				authorizedPlanBindingHex: string;
				updateScope?: UpdateScope;
			}) => {
				order.push(input.packageData.invitation.slug);
				return {
					...invitationPreflight(input.packageData.invitation.slug),
					status: 'PROMOTED',
				} as PromotionApplyReport;
			},
		);
		const result = await applyProductionApplyPlan(cli(['--all-ready', '--apply']), {
			...baseDeps({
				preflights: {
					alpha: invitationPreflight('alpha'),
					beta: invitationPreflight('beta'),
				},
			}),
			resolveInvitationUpdateScope: () => 'content-and-assets',
			requireOwnerApply,
			applySchema,
			applyInvitation,
		});
		expect(requireOwnerApply).toHaveBeenCalledTimes(1);
		expect(order).toEqual(['authorize', 'schema', 'alpha', 'beta']);
		expect(result.wrote).toBe(true);
		expect(result.outcomes.find((row) => row.id === 'schema')?.outcome).toBe(
			'APPLIED_AND_VERIFIED',
		);
		expect(applySchema).toHaveBeenCalledTimes(1);
		expect(applyInvitation.mock.calls.map((call) => call[0].updateScope)).toEqual([
			'content-and-assets',
			'content-and-assets',
		]);
		const schemaCall = applySchema.mock.calls[0] as unknown as [
			{ authorizedPlanBindingHex: string },
		];
		expect(schemaCall[0].authorizedPlanBindingHex).toBe(result.plan.planId);
		expect(JSON.stringify(result)).not.toMatch(/postgres(ql)?:\/\/postgres:super-secret/);
	});

	it('does not prompt when everything is already applied', async () => {
		const requireOwnerApply = jest.fn(async () => undefined);
		const result = await applyProductionApplyPlan(cli(['--schema', '--apply']), {
			...baseDeps({ pending: [] }),
			requireOwnerApply,
		});
		expect(requireOwnerApply).not.toHaveBeenCalled();
		expect(result.wrote).toBe(false);
		expect(result.outcomes[0]?.outcome).toBe('already_applied');
	});

	it('replans read-only after APPLIED_VERIFICATION_FAILED and never repeats the schema write', async () => {
		let pending = ['20260807120000'];
		const applySchema = jest.fn(async () => {
			pending = [];
			throw new MigrateApplyError({
				state: 'APPLIED_VERIFICATION_FAILED',
				plan: schemaPlan(['20260807120000']),
				error: new Error('post-write verifier failed'),
			});
		});
		const deps: ProductionApplyExecuteDeps = {
			...baseDeps(),
			preflightSchema: () => schemaPlan(pending),
			requireOwnerApply: async (input) => {
				issueProductionWritePermit({
					projectRef: SUPABASE_PROJECT_REFS.production,
					operationType: 'production_apply',
					bindingHex: input.bindingHex,
				});
			},
			applySchema,
		};

		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), deps),
		).rejects.toMatchObject({
			state: 'APPLIED_VERIFICATION_FAILED',
			code: 'APPLIED_VERIFICATION_FAILED',
		});
		expect(applySchema).toHaveBeenCalledTimes(1);

		const retryOwnerGate = jest.fn(async () => undefined);
		const retry = await applyProductionApplyPlan(cli(['--schema', '--apply']), {
			...deps,
			requireOwnerApply: retryOwnerGate,
		});
		expect(retry.wrote).toBe(false);
		expect(retry.outcomes[0]?.outcome).toBe('already_applied');
		expect(retryOwnerGate).not.toHaveBeenCalled();
		expect(applySchema).toHaveBeenCalledTimes(1);
	});

	it('refuses inspect-all --apply before any writer', async () => {
		const applySchema = jest.fn(async () => ({ plan: schemaPlan(), wrote: true }));
		await expect(
			applyProductionApplyPlan(
				{
					help: false,
					json: false,
					apply: true,
					schema: false,
					slugs: [],
					allReady: false,
					inspectAll: true,
				},
				{
					...baseDeps(),
					applySchema,
				},
			),
		).rejects.toMatchObject({ code: 'SCOPE_REQUIRED' });
		expect(applySchema).not.toHaveBeenCalled();
	});

	it('stops dependent invitations when schema apply fails', async () => {
		const applyInvitation = jest.fn(
			async (): Promise<PromotionApplyReport> =>
				invitationPreflight('alpha') as PromotionApplyReport,
		);
		await expect(
			applyProductionApplyPlan(cli(['--all-ready', '--apply']), {
				...baseDeps({
					preflights: { alpha: invitationPreflight('alpha') },
				}),
				requireOwnerApply: async (input) => {
					issueProductionWritePermit({
						projectRef: SUPABASE_PROJECT_REFS.production,
						operationType: 'production_apply',
						bindingHex: input.bindingHex,
					});
				},
				applySchema: async () => {
					throw new OperatorError({
						title: 'schema failed',
						cause: 'push failed',
						code: 'SCHEMA_APPLY_FAILED',
						remediation: ['retry'],
					});
				},
				applyInvitation,
			}),
		).rejects.toMatchObject({ code: 'SCHEMA_APPLY_FAILED' });
		expect(applyInvitation).not.toHaveBeenCalled();
	});

	it('stops subsequent invitations after the first failure', async () => {
		const applyInvitation = jest.fn(async (): Promise<PromotionApplyReport> => {
			throw new OperatorError({
				title: 'alpha failed',
				cause: 'engine failed',
				code: 'INVITATION_APPLY_FAILED',
				remediation: ['retry'],
			});
		});

		await expect(
			applyProductionApplyPlan(cli(['--slugs', 'alpha,beta', '--apply']), {
				...baseDeps({
					pending: [],
					preflights: {
						alpha: invitationPreflight('alpha'),
						beta: invitationPreflight('beta'),
					},
				}),
				requireOwnerApply: async (input) => {
					issueProductionWritePermit({
						projectRef: SUPABASE_PROJECT_REFS.production,
						operationType: 'production_apply',
						bindingHex: input.bindingHex,
					});
				},
				applyInvitation,
			}),
		).rejects.toMatchObject({ code: 'INVITATION_APPLY_FAILED' });
		expect(applyInvitation).toHaveBeenCalledTimes(1);
	});

	it('fails closed when live evidence drifts after authorization', async () => {
		let calls = 0;
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				preflightSchema: () => {
					calls += 1;
					return schemaPlan(calls === 1 ? ['20260807120000'] : ['20260808120000']);
				},
				requireOwnerApply: async (input) => {
					issueProductionWritePermit({
						projectRef: SUPABASE_PROJECT_REFS.production,
						operationType: 'production_apply',
						bindingHex: input.bindingHex,
					});
				},
				applySchema: async () => ({ plan: schemaPlan(), wrote: true }),
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' });
	});

	it('rejects UNKNOWN and BLOCKED explicit scopes before any writer', async () => {
		const applyInvitation = jest.fn(
			async (): Promise<PromotionApplyReport> =>
				invitationPreflight('demo') as PromotionApplyReport,
		);
		await expect(
			applyProductionApplyPlan(cli(['--slug', 'demo', '--apply']), {
				...baseDeps({
					pending: [],
					preflights: {
						demo: invitationPreflight('demo', {
							status: 'BLOCKED',
							blockCode: 'MISSING_PREVIEW_APPROVAL',
						}),
					},
				}),
				applyInvitation,
			}),
		).rejects.toMatchObject({ code: 'BLOCKED_NOT_APPLICABLE' });
		expect(applyInvitation).not.toHaveBeenCalled();
	});

	it('requires --owner-user-id before writers when a patch is in the plan', async () => {
		const requireOwnerApply = jest.fn(async () => undefined);
		const applySchema = jest.fn(async () => ({ plan: schemaPlan(), wrote: true }));
		await expect(
			applyProductionApplyPlan(
				{
					help: false,
					json: false,
					apply: true,
					schema: false,
					slugs: [],
					allReady: false,
					inspectAll: false,
					patchFile: 'scripts/manual/x.sql',
				},
				{
					...baseDeps({ pending: [] }),
					requireOwnerApply,
					applySchema,
				},
			),
		).rejects.toMatchObject({ code: 'OWNER_USER_ID_REQUIRED' });
		expect(requireOwnerApply).not.toHaveBeenCalled();
		expect(applySchema).not.toHaveBeenCalled();
	});

	it('does not accept a permit for a different plan', async () => {
		issueProductionWritePermit({
			projectRef: SUPABASE_PROJECT_REFS.production,
			operationType: 'production_apply',
			bindingHex: 'deadbeefdeadbeef',
		});
		const applySchema = jest.fn(async (input: { authorizedPlanBindingHex: string }) => {
			const match = matchProductionWritePermit({
				dbUrl: PROD_URL,
				bindingHex: input.authorizedPlanBindingHex,
				operationType: 'production_apply',
			});
			if (match !== 'ok') {
				throw new OperatorError({
					title: 'Autorización de Production no reutilizable',
					cause: match,
					code: 'PRODUCTION_WRITE_PERMIT_REQUIRED',
					remediation: ['x'],
				});
			}
			return { plan: schemaPlan(), wrote: true };
		});
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				requireOwnerApply: async () => undefined,
				applySchema,
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_WRITE_PERMIT_REQUIRED' });
		expect(applySchema).toHaveBeenCalled();
	});

	it('rejects a package changed after authorization before its write and clears the permit', async () => {
		let resolves = 0;
		const applyInvitation = jest.fn(
			async (): Promise<PromotionApplyReport> =>
				({ ...invitationPreflight('alpha'), status: 'PROMOTED' }) as PromotionApplyReport,
		);
		await expect(
			applyProductionApplyPlan(cli(['--slug', 'alpha', '--apply']), {
				...baseDeps({ pending: [], preflights: { alpha: invitationPreflight('alpha') } }),
				resolvePackage: async (slug) => {
					resolves += 1;
					return pkg(slug, resolves >= 3 ? 'hash-changed' : 'hash-alpha');
				},
				requireOwnerApply: async (input) => {
					issueProductionWritePermit({
						projectRef: SUPABASE_PROJECT_REFS.production,
						operationType: 'production_apply',
						bindingHex: input.bindingHex,
					});
				},
				applyInvitation,
			}),
		).rejects.toMatchObject({ code: 'ARTIFACT_DRIFT' });
		expect(applyInvitation).not.toHaveBeenCalled();
		expect(getProductionWritePermit()).toBeNull();
	});

	it('stops before a changed second package after the first package is applied', async () => {
		const resolves: Record<string, number> = { alpha: 0, beta: 0 };
		const applyInvitation = jest.fn(
			async (input: { packageData: InvitationPackageData }) =>
				({
					...invitationPreflight(input.packageData.invitation.slug),
					status: 'PROMOTED',
				}) as PromotionApplyReport,
		);
		await expect(
			applyProductionApplyPlan(cli(['--slugs', 'alpha,beta', '--apply']), {
				...baseDeps({
					pending: [],
					preflights: {
						alpha: invitationPreflight('alpha'),
						beta: invitationPreflight('beta'),
					},
				}),
				resolvePackage: async (slug) => {
					resolves[slug] = (resolves[slug] ?? 0) + 1;
					return pkg(
						slug,
						slug === 'beta' && resolves[slug] >= 3
							? 'hash-beta-changed'
							: `hash-${slug}`,
					);
				},
				requireOwnerApply: async (input) => {
					issueProductionWritePermit({
						projectRef: SUPABASE_PROJECT_REFS.production,
						operationType: 'production_apply',
						bindingHex: input.bindingHex,
					});
				},
				applyInvitation,
			}),
		).rejects.toMatchObject({ code: 'ARTIFACT_DRIFT' });
		expect(applyInvitation).toHaveBeenCalledTimes(1);
		expect(applyInvitation.mock.calls[0]?.[0].packageData.invitation.slug).toBe('alpha');
		expect(getProductionWritePermit()).toBeNull();
	});

	it('rejects a patch changed after authorization before backup or write', async () => {
		let preparations = 0;
		const applyPatch = jest.fn(async () => ({ state: 'APPLIED_AND_VERIFIED' as const }));
		const ensurePatchBackup: NonNullable<ProductionApplyExecuteDeps['ensurePatchBackup']> =
			jest.fn(() => ({ manifestPath: '.tmp/test-backup.json' }));
		await expect(
			applyProductionApplyPlan(
				cli([
					'--patch',
					'scripts/manual/production-patches/test.sql',
					'--owner-user-id',
					'550e8400-e29b-41d4-a716-446655440000',
					'--apply',
				]),
				{
					...baseDeps({ pending: [] }),
					preparePatch: (file) => {
						preparations += 1;
						return {
							...baseDeps().preparePatch!(file),
							fingerprint: preparations >= 3 ? 'patch-drifted' : 'patch-reviewed',
						};
					},
					requireOwnerApply: async (input) => {
						issueProductionWritePermit({
							projectRef: SUPABASE_PROJECT_REFS.production,
							operationType: 'production_apply',
							bindingHex: input.bindingHex,
						});
					},
					ensurePatchBackup,
					applyPatch,
				},
			),
		).rejects.toMatchObject({ code: 'ARTIFACT_DRIFT' });
		expect(ensurePatchBackup).not.toHaveBeenCalled();
		expect(applyPatch).not.toHaveBeenCalled();
		expect(getProductionWritePermit()).toBeNull();
	});

	it('requires and revalidates a current critical backup before applying a patch', async () => {
		const ensurePatchBackup: NonNullable<ProductionApplyExecuteDeps['ensurePatchBackup']> =
			jest.fn(() => ({ manifestPath: '.tmp/test-backup.json' }));
		const revalidatePatchBackup: NonNullable<
			ProductionApplyExecuteDeps['revalidatePatchBackup']
		> = jest.fn(() => undefined);
		const applyPatch = jest.fn(async () => ({ state: 'APPLIED_AND_VERIFIED' as const }));
		await applyProductionApplyPlan(
			cli([
				'--patch',
				'scripts/manual/production-patches/test.sql',
				'--owner-user-id',
				'550e8400-e29b-41d4-a716-446655440000',
				'--apply',
			]),
			{
				...baseDeps({ pending: [] }),
				preparePatch: (file) => ({
					...baseDeps().preparePatch!(file),
					fingerprint: 'patch-reviewed',
				}),
				requireOwnerApply: async (input) => {
					issueProductionWritePermit({
						projectRef: SUPABASE_PROJECT_REFS.production,
						operationType: 'production_apply',
						bindingHex: input.bindingHex,
					});
				},
				ensurePatchBackup,
				revalidatePatchBackup,
				applyPatch,
			},
		);
		expect(ensurePatchBackup).toHaveBeenCalledTimes(1);
		expect(revalidatePatchBackup).toHaveBeenCalledWith(
			expect.objectContaining({ manifestPath: '.tmp/test-backup.json' }),
		);
		expect(applyPatch).toHaveBeenCalledTimes(1);
		expect(getProductionWritePermit()).toBeNull();
	});
});
