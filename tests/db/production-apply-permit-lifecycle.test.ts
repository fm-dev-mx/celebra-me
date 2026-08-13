/**
 * Integration coverage for the Production apply authorization/permit lifecycle.
 *
 * Reproduces the live failure: owner HITL confirmation issues an in-process permit,
 * but protected helpers that do not pass `productionPermit` still need the exact
 * AsyncLocalStorage binding. The first write after confirmation must see it.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SUPABASE_PROJECT_REFS } from '../../src/lib/intake/mutations/environment-identity.ts';
import { buildMigrationPlan, type MigrationPlan } from '../../scripts/db/migration-plan.ts';
import { OperatorError } from '../../scripts/db/operator-cli-ux.ts';
import {
	buildOwnerConfirmationCode,
	requireOwnerProductionApply,
} from '../../scripts/db/owner-production-apply.ts';
import { parseProductionApplyCliArgs } from '../../scripts/db/production-apply-cli-args.ts';
import {
	applyProductionApplyPlan,
	type ProductionApplyExecuteDeps,
} from '../../scripts/db/production-apply-orchestrator.ts';
import { evaluateSpawnProductionMutation } from '../../scripts/db/production-boundary-policy.ts';
import {
	clearProductionWritePermit,
	getProductionWritePermit,
	issueProductionWritePermit,
	resolveSpawnProductionBoundary,
	withProductionPermitScope,
} from '../../scripts/db/production-write-permit.ts';
import type { InvitationPackageData } from '../../scripts/provision/invitation-package.ts';
import type {
	PromotionApplyReport,
	PromotionPreflightReport,
} from '../../scripts/provision/invitation-promote.ts';

const PROD_URL = `postgresql://postgres:super-secret@db.${SUPABASE_PROJECT_REFS.production}.supabase.co:5432/postgres`;
const originalEnv = { ...process.env };

/** Exact recovery-integrity form that previously matched COPY FROM as a write. */
const RECOVERY_COPY_SQL =
	'COPY (select version::text from supabase_migrations.schema_migrations order by version) TO STDOUT';
const PROTECTED_UPDATE_SQL = "UPDATE public.invitations SET title = 'x'";

function cli(argv: string[]) {
	return parseProductionApplyCliArgs(['node', 'production-apply-cli.ts', ...argv]);
}

function schemaPlan(pending: string[] = ['20260812210000']): MigrationPlan {
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

function invitationPreflight(slug: string): PromotionPreflightReport {
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
			migrationHead: '20260812210000',
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
	} as PromotionPreflightReport;
}

function ownerEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	delete env.CELEBRA_AGENT_CONTEXT;
	return env;
}

function silenceStdio(): void {
	jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
	jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
	jest.spyOn(console, 'error').mockImplementation(() => undefined);
	jest.spyOn(console, 'info').mockImplementation(() => undefined);
	jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
		throw new Error(`process.exit:${code ?? ''}`);
	}) as never);
}

function probeProtectedWrite(sql: string = PROTECTED_UPDATE_SQL) {
	return resolveSpawnProductionBoundary('psql', ['--dbname', PROD_URL, '--command', sql]);
}

function throwIfDenied(
	decision: ReturnType<typeof resolveSpawnProductionBoundary>,
): asserts decision is { permission: 'allow' } {
	if (decision.permission === 'deny') {
		throw new OperatorError({
			title: 'Autorización de Production no reutilizable',
			cause: decision.message ?? 'missing permit',
			code: 'PRODUCTION_WRITE_PERMIT_REQUIRED',
			remediation: ['Ejecute pnpm prod:apply con --apply en una TTY del propietario.'],
		});
	}
}

async function confirmOwnerApply(
	input: Parameters<NonNullable<ProductionApplyExecuteDeps['requireOwnerApply']>>[0],
	options?: { assertReleaseEvidence?: () => { sha: string } },
): Promise<void> {
	await requireOwnerProductionApply({
		...input,
		env: ownerEnv(),
		selectIntent: () => 'proceed',
		readConfirmationLine: () =>
			buildOwnerConfirmationCode(input.operationVerb, input.bindingHex),
		assertReleaseEvidence: options?.assertReleaseEvidence ?? (() => ({ sha: 'abc1234' })),
	});
}

function baseDeps(): ProductionApplyExecuteDeps {
	return {
		preflightSchema: () => schemaPlan(),
		getProductionDbUrl: () => ({ url: PROD_URL }),
		resolvePackage: async (slug) => pkg(slug),
		runInvitationPreflight: async (packageData) =>
			invitationPreflight(packageData.invitation.slug),
	};
}

beforeEach(() => {
	delete process.env.CELEBRA_AGENT_CONTEXT;
	silenceStdio();
});

afterEach(() => {
	clearProductionWritePermit();
	for (const key of Object.keys(process.env)) {
		if (!(key in originalEnv)) delete process.env[key];
	}
	Object.assign(process.env, originalEnv);
	jest.restoreAllMocks();
});

describe('backup evaluation vs write-protected psql', () => {
	it('treats recovery-integrity COPY TO STDOUT as read-only even with inner FROM', () => {
		expect(
			evaluateSpawnProductionMutation('psql', [
				'--dbname',
				PROD_URL,
				'--command',
				RECOVERY_COPY_SQL,
			]).permission,
		).toBe('allow');
		expect(
			evaluateSpawnProductionMutation('psql', [
				'--dbname',
				PROD_URL,
				'--command',
				'COPY public.invitations FROM STDIN',
			]).code,
		).toBe('PRODUCTION_WRITE_PERMIT_REQUIRED');
	});
});

describe('canonical Production apply permit lifecycle', () => {
	it('lets the first protected write see the owner permit after exact confirmation', async () => {
		const probes: Array<ReturnType<typeof resolveSpawnProductionBoundary>> = [];
		const result = await applyProductionApplyPlan(cli(['--schema', '--apply']), {
			...baseDeps(),
			requireOwnerApply: confirmOwnerApply,
			applySchema: async () => {
				const decision = probeProtectedWrite();
				probes.push(decision);
				throwIfDenied(decision);
				return { plan: schemaPlan(), wrote: true };
			},
		});
		expect(probes).toHaveLength(1);
		expect(probes[0]?.permission).toBe('allow');
		expect(result.wrote).toBe(true);
		expect(getProductionWritePermit()).toBeNull();
	});

	it('preserves the permit binding across awaited helpers inside the authorized scope', async () => {
		const result = await applyProductionApplyPlan(cli(['--schema', '--apply']), {
			...baseDeps(),
			requireOwnerApply: confirmOwnerApply,
			applySchema: async () => {
				await Promise.resolve();
				throwIfDenied(probeProtectedWrite());
				return { plan: schemaPlan(), wrote: true };
			},
		});
		expect(result.wrote).toBe(true);
		expect(getProductionWritePermit()).toBeNull();
	});

	it('blocks apply when the owner cancels instead of confirming', async () => {
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				requireOwnerApply: async (input) => {
					await requireOwnerProductionApply({
						...input,
						env: ownerEnv(),
						selectIntent: () => 'cancel',
						readConfirmationLine: () =>
							buildOwnerConfirmationCode(input.operationVerb, input.bindingHex),
						assertReleaseEvidence: () => ({ sha: 'abc1234' }),
					});
				},
				applySchema: async () => {
					throwIfDenied(probeProtectedWrite());
					return { plan: schemaPlan(), wrote: true };
				},
			}),
		).rejects.toThrow(/process\.exit:1|OWNER_CONFIRMATION_CANCELLED/);
		expect(getProductionWritePermit()).toBeNull();
	});

	it('blocks the first protected write when confirmation never issued a permit', async () => {
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				requireOwnerApply: async () => undefined,
				applySchema: async () => {
					throwIfDenied(probeProtectedWrite());
					return { plan: schemaPlan(), wrote: true };
				},
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_WRITE_PERMIT_REQUIRED' });
		expect(getProductionWritePermit()).toBeNull();
	});

	it('blocks a write bound to a different project than the owner permit', async () => {
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				requireOwnerApply: confirmOwnerApply,
				applySchema: async () => {
					const permit = getProductionWritePermit();
					expect(permit).not.toBeNull();
					permit!.projectRef = 'not-the-allowlisted-production-ref';
					throwIfDenied(probeProtectedWrite());
					return { plan: schemaPlan(), wrote: true };
				},
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_WRITE_PERMIT_REQUIRED' });
		expect(getProductionWritePermit()).toBeNull();
	});

	it('blocks a write whose operation does not match the owner permit', async () => {
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				requireOwnerApply: confirmOwnerApply,
				applySchema: async () => {
					const decision = withProductionPermitScope(
						{
							bindingHex: getProductionWritePermit()?.bindingHex ?? '',
							operationType: 'production_migration',
						},
						() => probeProtectedWrite(),
					);
					throwIfDenied(decision);
					return { plan: schemaPlan(), wrote: true };
				},
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_WRITE_PERMIT_REQUIRED' });
		expect(getProductionWritePermit()).toBeNull();
	});

	it('blocks a write after the reviewed plan artifact changes', async () => {
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				requireOwnerApply: confirmOwnerApply,
				applySchema: async () => {
					const permit = getProductionWritePermit();
					const decision = withProductionPermitScope(
						{
							bindingHex: `${permit?.bindingHex ?? 'deadbeef'}ff`,
							operationType: 'production_apply',
						},
						() => probeProtectedWrite(),
					);
					throwIfDenied(decision);
					return { plan: schemaPlan(), wrote: true };
				},
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_WRITE_PERMIT_REQUIRED' });
		expect(getProductionWritePermit()).toBeNull();
	});

	it('blocks owner confirmation when release evidence is stale', async () => {
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				requireOwnerApply: async (input) => {
					await confirmOwnerApply(input, {
						assertReleaseEvidence: () => {
							throw new OperatorError({
								title: 'Evidencia de release inválida',
								cause: 'HEAD sucio o SHA distinto.',
								code: 'RELEASE_CHECK_INVALID',
								remediation: ['Ejecute pnpm release-check en un HEAD limpio.'],
							});
						},
					});
				},
				applySchema: async () => {
					throwIfDenied(probeProtectedWrite());
					return { plan: schemaPlan(), wrote: true };
				},
			}),
		).rejects.toMatchObject({ code: 'RELEASE_CHECK_INVALID' });
		expect(getProductionWritePermit()).toBeNull();
	});

	it('does not let a live permit authorize a helper outside the bound operation scope', async () => {
		let captured: ReturnType<typeof getProductionWritePermit> = null;
		await applyProductionApplyPlan(cli(['--schema', '--apply']), {
			...baseDeps(),
			requireOwnerApply: confirmOwnerApply,
			applySchema: async () => {
				captured = getProductionWritePermit();
				throwIfDenied(probeProtectedWrite());
				return { plan: schemaPlan(), wrote: true };
			},
		});
		expect(captured).not.toBeNull();
		issueProductionWritePermit({
			projectRef: captured!.projectRef,
			operationType: captured!.operationType,
			bindingHex: captured!.bindingHex,
		});
		expect(probeProtectedWrite().permission).toBe('deny');
		expect(probeProtectedWrite().code).toBe('PRODUCTION_WRITE_PERMIT_REQUIRED');
	});

	it('blocks a child process that cannot inherit the in-process permit', () => {
		issueProductionWritePermit({
			projectRef: SUPABASE_PROJECT_REFS.production,
			operationType: 'production_apply',
			bindingHex: 'plan-child-scope',
		});
		const permit = getProductionWritePermit();
		expect(permit).not.toBeNull();
		permit!.pid = process.pid + 1;
		expect(
			withProductionPermitScope(
				{ bindingHex: 'plan-child-scope', operationType: 'production_apply' },
				() => probeProtectedWrite(),
			).permission,
		).toBe('deny');
	});

	it('blocks a write after the permit is cleared and still cleans up', async () => {
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				requireOwnerApply: confirmOwnerApply,
				applySchema: async () => {
					clearProductionWritePermit();
					throwIfDenied(probeProtectedWrite());
					return { plan: schemaPlan(), wrote: true };
				},
			}),
		).rejects.toMatchObject({ code: 'PRODUCTION_WRITE_PERMIT_REQUIRED' });
		expect(getProductionWritePermit()).toBeNull();
	});

	it('clears the permit when authorization succeeds but the first write never runs', async () => {
		let calls = 0;
		await expect(
			applyProductionApplyPlan(cli(['--schema', '--apply']), {
				...baseDeps(),
				preflightSchema: () => {
					calls += 1;
					return schemaPlan(calls === 1 ? ['20260812210000'] : ['20260812220000']);
				},
				requireOwnerApply: confirmOwnerApply,
				applySchema: async () => {
					throwIfDenied(probeProtectedWrite());
					return { plan: schemaPlan(), wrote: true };
				},
			}),
		).rejects.toMatchObject({ code: 'PLAN_DRIFT' });
		expect(getProductionWritePermit()).toBeNull();
	});

	it('clears the permit after a later write fails', async () => {
		const applyInvitation = jest.fn(async (): Promise<PromotionApplyReport> => {
			throwIfDenied(probeProtectedWrite());
			throw new OperatorError({
				title: 'Promoción fallida',
				cause: 'engine failed',
				code: 'INVITATION_APPLY_FAILED',
				remediation: ['retry'],
			});
		});
		await expect(
			applyProductionApplyPlan(cli(['--all-ready', '--apply']), {
				...baseDeps(),
				listSlugs: () => ['alpha'],
				runInvitationPreflight: async () => invitationPreflight('alpha'),
				requireOwnerApply: confirmOwnerApply,
				applySchema: async () => {
					throwIfDenied(probeProtectedWrite());
					return { plan: schemaPlan(), wrote: true };
				},
				applyInvitation,
			}),
		).rejects.toMatchObject({ code: 'INVITATION_APPLY_FAILED' });
		expect(applyInvitation).toHaveBeenCalledTimes(1);
		expect(getProductionWritePermit()).toBeNull();
	});

	it('clears the permit after a successful apply', async () => {
		await applyProductionApplyPlan(cli(['--schema', '--apply']), {
			...baseDeps(),
			requireOwnerApply: confirmOwnerApply,
			applySchema: async () => {
				throwIfDenied(probeProtectedWrite());
				return { plan: schemaPlan(), wrote: true };
			},
		});
		expect(getProductionWritePermit()).toBeNull();
	});
});
