import { isLocalSupabaseUrl } from './_shared.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const invitationId = process.argv[2];

if (!supabaseUrl || !serviceRoleKey || !invitationId) {
	console.error('Missing required arguments');
	process.exit(1);
}

if (!isLocalSupabaseUrl(supabaseUrl)) {
	console.error(
		'Refusing to use service-role credentials against a remote Supabase API. SUPABASE_URL must be a local URL.',
	);
	process.exit(1);
}

const response = await fetch(
	`${supabaseUrl}/rest/v1/invitation_assets?invitation_id=eq.${invitationId}&select=id`,
	{
		headers: {
			apikey: serviceRoleKey,
			Authorization: `Bearer ${serviceRoleKey}`,
		},
	},
);
if (!response.ok) {
	console.error(`status=${response.status}`);
	process.exit(1);
}
const body = await response.json();
if (!Array.isArray(body)) process.exit(2);
console.log(String(body.length));
