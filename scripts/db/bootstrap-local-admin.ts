import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	assertAppEnvIsLocal,
	assertLocalApiReachable,
	assertLocalDbReachable,
	assertNoProdCredentialsInLocalEnv,
	fail,
	loadAppEnv,
	log,
	requireLocalSuperAdminConfig,
	runCommand,
	runPsql,
	sqlLiteral,
} from './db-workflow-lib.ts';

function loadBootstrapSql(email: string, password: string): string {
	const scriptDir = fileURLToPath(new URL('.', import.meta.url));
	const sqlPath = resolve(scriptDir, 'sql', 'bootstrap-admin.sql');
	return readFileSync(sqlPath, 'utf8')
		.replaceAll('__ADMIN_EMAIL__', sqlLiteral(email))
		.replaceAll('__ADMIN_PASSWORD__', sqlLiteral(password));
}

function bootstrapLocalAdmin(email: string, password: string): void {
	runPsql(loadBootstrapSql(email, password), undefined, [password]);
}

function assertLoginWorks(appEnv: Record<string, string>, email: string, password: string): void {
	runCommand('node', ['scripts/db/_check-admin-login.mjs'], {
		env: {
			SUPABASE_URL: appEnv.SUPABASE_URL,
			SUPABASE_ANON_KEY: appEnv.SUPABASE_ANON_KEY,
			LOCAL_ADMIN_EMAIL: email,
			LOCAL_ADMIN_PASSWORD: password,
		},
		redact: [password],
	});
}

function main(): void {
	const appEnv = loadAppEnv();
	assertNoProdCredentialsInLocalEnv();
	assertAppEnvIsLocal(appEnv);
	assertLocalApiReachable();
	assertLocalDbReachable();

	const { email, password } = requireLocalSuperAdminConfig(appEnv);

	log('Bootstrap local super admin');
	log('- Target: local Supabase only');
	log(`- Email: ${email}`);

	bootstrapLocalAdmin(email, password);
	assertLoginWorks(appEnv, email, password);

	log('Local super admin bootstrap complete');
	log('- User exists in local auth.users');
	log('- raw_app_meta_data.role is super_admin');
	log('- public.app_user_roles has role = super_admin');
	log('- Password login succeeded');
}

try {
	main();
} catch (error: unknown) {
	fail(error instanceof Error ? error.message : String(error));
}
