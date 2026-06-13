import { isLocalSupabaseUrl } from './_shared.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const email = process.env.LOCAL_ADMIN_EMAIL;
const password = process.env.LOCAL_ADMIN_PASSWORD;

if (!supabaseUrl || !anonKey || !email || !password) {
	console.error('Missing required arguments');
	process.exit(1);
}

if (!isLocalSupabaseUrl(supabaseUrl)) {
	console.error(
		'Refusing to send admin credentials to a remote Supabase API. SUPABASE_URL must be a local URL.',
	);
	process.exit(1);
}

const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
	method: 'POST',
	headers: {
		apikey: anonKey,
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({ email, password }),
});
if (!response.ok) {
	console.error(`status=${response.status}`);
	process.exit(1);
}
const body = await response.json();
if (!body.access_token) process.exit(2);
console.log('ok');
