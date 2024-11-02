// src/utilities/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';
import config from '@/core/interfaces/config';
import logger from '@/utilities/logger';

if (!config.SUPABASE_CONFIG?.url || !config.SUPABASE_CONFIG?.anonKey) {
	const errorMessage = 'Missing environment variables SUPABASE_CONFIG.url or SUPABASE_CONFIG.anonKey';
	logger.error(errorMessage);
	throw new Error(errorMessage);
}

// Initialize Supabase client with secure URL and anon key from Config
const supabase = createClient(
	config.SUPABASE_CONFIG.url,
	config.SUPABASE_CONFIG.anonKey
);

export default supabase;

