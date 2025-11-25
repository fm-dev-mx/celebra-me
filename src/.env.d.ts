// src/env.d.ts

/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_ANON_KEY: string;
  readonly SENDGRID_API_KEY: string;
  readonly EMAIL_FROM: string;
  readonly EMAIL_TO: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
