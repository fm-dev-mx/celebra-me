// src/infrastructure/supabaseClient.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '@/core/config';
import logger from '@/backend/utilities/logger';

/**
 * SupabaseClientManager class implementing the Singleton pattern.
 * Manages a single instance of the Supabase client for use throughout the application.
 */
class SupabaseClientManager {
	private static instance: SupabaseClient | null = null;

	/**
	 * Private constructor to prevent direct instantiation.
	 */
	private constructor() {
		// Private to prevent direct instantiation
	}

	/**
	 * Retrieves the singleton instance of the Supabase client.
	 * @returns {SupabaseClient} The Supabase client instance.
	 */
	public static async getInstance(): Promise<SupabaseClient> {
		if (!SupabaseClientManager.instance) {
			SupabaseClientManager.instance = await SupabaseClientManager.initializeClient();
		}
		return SupabaseClientManager.instance;
	}

	/**
	 * Initializes the Supabase client with configurations.
	 * @returns {SupabaseClient} The initialized Supabase client.
	 * Includes error handling for missing configurations
	 * and a simple retry mechanism for connection issues.
	 */
	private static async initializeClient(): Promise<SupabaseClient> {
		const { url, anonKey } = config.supabaseConfig;
		const maxRetries = 3;
		let attempt = 0;

		while (attempt < maxRetries) {
			if (!url || !anonKey) {
				const errorMessage = 'Missing Supabase configuration: SUPABASE_URL or SUPABASE_ANON_KEY';
				logger.error(errorMessage);
				throw new Error(errorMessage);
			}

			try {
				const supabase = createClient(url, anonKey);
				logger.info('Supabase client initialized successfully.');
				return supabase;
			} catch (error) {
				attempt++;
				logger.error(`Error initializing Supabase client (Attempt ${attempt}/${maxRetries}):`, error);
				if (attempt >= maxRetries) {
					throw error;
				}
				await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
			}
		}

		// Should not reach here
		throw new Error('Failed to initialize Redis client after multiple attempts.');
	}
}

export default SupabaseClientManager;

