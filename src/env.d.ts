// src/env.d.ts

/// <reference types="astro/client" />
/// <reference types="framer-motion" />
// reference path="../.astro/types.d.ts"
/// <reference types="astro/content" />

interface ImportMetaEnv {
	readonly SUPABASE_URL: string;
	readonly SUPABASE_ANON_KEY: string;
	readonly SUPABASE_SERVICE_ROLE_KEY: string;
	readonly GMAIL_USER: string;
	readonly GMAIL_PASS: string;
	readonly CONTACT_FORM_RECIPIENT_EMAIL: string;
	readonly RSVP_TOKEN_SECRET: string;
	readonly RSVP_ADMIN_USER: string;
	readonly RSVP_ADMIN_PASSWORD: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
