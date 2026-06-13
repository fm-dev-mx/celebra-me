import {
	LOCAL_SUPABASE_URL,
	REFRESH_PARITY_TABLES,
	assertAppEnvIsLocal,
	assertLocalApiReachable,
	assertLocalDbReachable,
	assertNoProdCredentialsInLocalEnv,
	fail,
	getFirstSuperAdminEmail,
	getLocalSuperAdminPassword,
	loadAppEnv,
	parseTsv,
	REQUIRED_LOCAL_SUPER_ADMIN_EMAIL,
	runPsql,
	sqlLiteral,
	tryRunCommand,
} from './db-workflow-lib.ts';

interface CheckResult {
	name: string;
	ok: boolean;
	detail?: string;
}

function scalar(sql: string): string {
	const result = runPsql(`${sql}\n`);
	return result.stdout.trim();
}

function checkSql(name: string, sql: string, expected = '0'): CheckResult {
	const actual = scalar(sql);
	return {
		name,
		ok: actual === expected,
		detail: actual === expected ? undefined : `expected ${expected}, got ${actual}`,
	};
}

async function validateAssetApi(): Promise<CheckResult> {
	const invitationId = scalar('select id::text from public.invitations limit 1;');
	if (!invitationId) {
		return {
			name: 'Asset Library API empty state',
			ok: true,
			detail: 'skipped because there are no invitations',
		};
	}

	const result = tryRunCommand('node', ['scripts/db/_check-asset-api.mjs', invitationId], {
		env: loadAppEnv(),
	});

	if (result.status !== 0) {
		return {
			name: 'Asset Library API empty state',
			ok: false,
			detail: result.stderr.trim() || `exit code ${result.status}`,
		};
	}

	return {
		name: 'Asset Library API empty state',
		ok: /^\d+$/.test(result.stdout.trim()),
		detail: `rows=${result.stdout.trim()}`,
	};
}

async function main(): Promise<void> {
	const appEnv = loadAppEnv();
	assertNoProdCredentialsInLocalEnv();
	assertAppEnvIsLocal(appEnv);
	assertLocalApiReachable();
	assertLocalDbReachable();

	const requiredTables = [
		'app_user_roles',
		'audit_logs',
		'event_claim_codes',
		'event_memberships',
		'events',
		'guest_invitation_audit',
		'guest_invitations',
		'host_profiles',
		'intake_requests',
		'intake_submissions',
		'invitation_assets',
		'invitation_content_drafts',
		'invitations',
		'published_invitation_content',
	];

	const tableRows = parseTsv(
		runPsql(`
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type in ('BASE TABLE', 'VIEW')
  and table_name = any(array[${requiredTables.map((table) => `'${table}'`).join(',')}])
order by table_name;
`).stdout,
	).map((row) => row[0]);
	const missingTables = requiredTables.filter((table) => !tableRows.includes(table));

	const checks: CheckResult[] = [
		{
			name: 'Local Supabase URL',
			ok:
				appEnv.SUPABASE_URL === LOCAL_SUPABASE_URL &&
				appEnv.PUBLIC_SUPABASE_URL === LOCAL_SUPABASE_URL,
		},
		{
			name: 'Required public tables',
			ok: missingTables.length === 0,
			detail: missingTables.length ? `missing: ${missingTables.join(', ')}` : undefined,
		},
		checkSql(
			'events.owner_user_id auth orphans',
			`select count(*)::text
from public.events e
left join auth.users u on u.id = e.owner_user_id
where u.id is null;`,
		),
		checkSql(
			'invitations.created_by auth orphans',
			`select count(*)::text
from public.invitations i
left join auth.users u on u.id = i.created_by
where i.created_by is not null and u.id is null;`,
		),
		checkSql(
			'app_user_roles auth orphans',
			`select count(*)::text
from public.app_user_roles r
left join auth.users u on u.id = r.user_id
where u.id is null;`,
		),
		checkSql(
			'event_memberships auth orphans',
			`select count(*)::text
from public.event_memberships m
left join auth.users u on u.id = m.user_id
where u.id is null;`,
		),
		checkSql(
			'No marker invitation_assets rows',
			`select count(*)::text
from public.invitation_assets
where storage_path ilike '%marker%'
   or storage_path ilike '%fake%'
   or display_name ilike '%marker%'
   or display_name ilike '%fake%';`,
		),
		checkSql(
			'invitation-assets bucket registration',
			`select count(*)::text
from storage.buckets
where id = 'invitation-assets'
  and name = 'invitation-assets';`,
			'1',
		),
	];

	const superAdminEmail = getFirstSuperAdminEmail(appEnv);
	checks.push({
		name: 'Configured local super admin email',
		ok: superAdminEmail === REQUIRED_LOCAL_SUPER_ADMIN_EMAIL,
		detail:
			superAdminEmail === REQUIRED_LOCAL_SUPER_ADMIN_EMAIL
				? undefined
				: `expected ${REQUIRED_LOCAL_SUPER_ADMIN_EMAIL}, got ${superAdminEmail || '<unset>'}`,
	});

	if (superAdminEmail) {
		checks.push(
			checkSql(
				'Required local super admin exists',
				`select count(*)::text
from auth.users u
join public.app_user_roles r on r.user_id = u.id
where lower(u.email) = lower(${sqlLiteral(superAdminEmail)})
  and r.role = 'super_admin';`,
				'1',
			),
			checkSql(
				'Super admin auth metadata role',
				`select count(*)::text
from auth.users u
where lower(u.email) = lower(${sqlLiteral(superAdminEmail)})
  and u.raw_app_meta_data ->> 'role' = 'super_admin';`,
				'1',
			),
		);

		const password = getLocalSuperAdminPassword(appEnv);
		checks.push({
			name: 'Local super admin password configured',
			ok: Boolean(password),
			detail: password
				? undefined
				: 'expected LOCAL_SUPER_ADMIN_PASSWORD or RSVP_ADMIN_PASSWORD',
		});

		if (password) {
			const login = tryRunCommand('node', ['scripts/db/_check-admin-login.mjs'], {
				env: {
					...appEnv,
					LOCAL_ADMIN_EMAIL: superAdminEmail,
					LOCAL_ADMIN_PASSWORD: password,
				},
				redact: [password],
			});
			checks.push({
				name: 'Super admin local login',
				ok: login.status === 0 && login.stdout.trim() === 'ok',
				detail:
					login.status !== 0
						? login.stderr.trim() || `exit code ${login.status}`
						: undefined,
			});
		}
	}

	checks.push(await validateAssetApi());

	const rowCountUnions = REFRESH_PARITY_TABLES.map(
		(t, i) =>
			`select ${i} as idx, '${t}' as table_name, count(*) as row_count from public."${t}"`,
	).join('\n  union all ');
	const rowCounts = parseTsv(
		runPsql(`
select table_name, row_count::text
from (
  ${rowCountUnions}
) summary
order by table_name;
`).stdout,
	);

	const failed = checks.filter((check) => !check.ok);
	console.info('Local DB validation');
	for (const check of checks) {
		console.info(
			`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? ` (${check.detail})` : ''}`,
		);
	}
	console.info(`Rows: ${rowCounts.map(([table, count]) => `${table}=${count}`).join(', ')}`);

	if (failed.length) {
		fail(`${failed.length} local DB validation check(s) failed.`);
	}
}

main().catch((error: unknown) => {
	fail(error instanceof Error ? error.message : String(error));
});
