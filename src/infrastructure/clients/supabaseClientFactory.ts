// src/infrastructure/clients/supabaseClientFactory.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '@/core/config';
import { logError } from '@/backend/services/logger';
import { LogLevel } from '@/core/interfaces/loggerInput.interface';
import { ClientFactory } from './clientFactory';
import { getErrorMessage } from '@/core/utilities/errorUtils';
import { ConfigurationError } from '@/core/errors/configurationError';

export class SupabaseClientFactory extends ClientFactory<SupabaseClient> {
	protected get MODULE_NAME(): string {
		return 'SupabaseClientFactory';
	}

	// InitializeClient abstract method implementation
	protected async initializeClient(): Promise<SupabaseClient> {
		const { url, anonKey } = config.supabaseConfig;

		if (!url || !anonKey) {
			const errorMessage = 'Missing Supabase configuration (URL or ANON_KEY)';
			logError({
				level: LogLevel.ERROR,
				message: errorMessage,
				meta: { event: 'SupabaseClientInitialization', error: 'Missing URL or ANON_KEY' },
				module: this.MODULE_NAME,
			});
			throw new ConfigurationError(errorMessage, this.MODULE_NAME);
		}

		try {
			const supabase = createClient(url, anonKey);

			return supabase;
		} catch (error) {
			const errorMsg = getErrorMessage(error);
			throw new ConfigurationError(
				`SupabaseClient Initialization failed: ${errorMsg}`,
				this.MODULE_NAME,
				error
			);
		}
	}
}

export default SupabaseClientFactory;
