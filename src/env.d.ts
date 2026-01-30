// src/env.d.ts

/// <reference types="astro/client" />
/// <reference types="astro/content" />

interface ImportMetaEnv {
	readonly SUPABASE_URL: string;
	readonly SUPABASE_ANON_KEY: string;
	readonly GMAIL_USER: string;
	readonly GMAIL_PASS: string;
	readonly CONTACT_FORM_RECIPIENT_EMAIL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
