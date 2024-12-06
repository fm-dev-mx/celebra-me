// src/infrastructure/supabaseClient.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '@/core/config';
import logger from '@/backend/utilities/logger';
import { ClientFactory } from '@/infrastructure/clientFactory'
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';

export class SupabaseClientFactory extends ClientFactory<SupabaseClient> {
	protected static readonly MODULE_NAME = 'SupabaseClientFactory';

	protected static async initializeClient(): Promise<SupabaseClient> {
		const { url, anonKey } = config.supabaseConfig;

		// Validate configuration
		if (!url || !anonKey) {
			const errorMessage =
				'Missing Supabase configuration: SUPABASE_URL or SUPABASE_ANON_KEY';
			logger.error({
				message: errorMessage,
				meta: { event: 'SupabaseClientInitialization', missingConfig: { url } },
				module: this.MODULE_NAME,
			});
			throw new Error(errorMessage);
		}

		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				const supabase = createClient(url, anonKey);

				logger.info({
					message: 'Supabase client initialized successfully.',
					meta: { event: 'SupabaseClientInitialization' },
					module: this.MODULE_NAME,
				});

				return supabase;
			} catch (error) {
				logger.error({
					message: `Error initializing Supabase client (Attempt ${attempt}/${this.MAX_RETRIES}): ${error instanceof Error ? error.message : String(error)}`,
					meta: {
						event: 'SupabaseClientInitialization',
						stack: error instanceof Error ? error.stack : undefined,
					},
					module: this.MODULE_NAME,
				});

				if (attempt === this.MAX_RETRIES) {
					logger.log({
						level: 'critical',
						message:
							'Failed to initialize Supabase client after multiple attempts.',
						meta: {
							event: 'SupabaseClientInitialization',
							attempts: attempt,
							error: error instanceof Error ? error.message : String(error),
						},
						module: this.MODULE_NAME,
					});
					// Do not throw to prevent application crash; return null or handle accordingly

					return Promise.reject(new Error('SupabaseClient Initialization failed'));
				}

				// Exponential backoff with jitter
				const backoff = getExponentialBackoffDelay(attempt, 1000);
				await delay(backoff);
			}
		}

		return Promise.reject(new Error('SupabaseClient Initialization failed'));
	}
}

export default SupabaseClientFactory;
