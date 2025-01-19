// src/infrastructure/clients/clientFactory.ts

import { InitializationError } from '@/core/errors/initializationError';
// Use consistent logging approach
// Changed from "logger" to "logInfo" and "logError" for clarity/consistency
import { logInfo, logError } from '@/backend/services/logger';
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';
import { getErrorMessage } from '@/core/utilities/errorUtils';

export abstract class ClientFactory<T> {
	protected clientPromise: Promise<T> | null = null;
	protected readonly MAX_RETRIES = 3;

	protected abstract get MODULE_NAME(): string;

	public async getClient(): Promise<T> {
		if (!this.clientPromise) {
			this.clientPromise = this.initializeClientWithRetries();
		}
		return this.clientPromise;
	}

	private async initializeClientWithRetries(): Promise<T> {
		for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
			try {
				const client = await this.initializeClient();
				// Changed logger.info to logInfo
				logInfo({
					message: `${this.MODULE_NAME} client initialized successfully`,
					module: this.MODULE_NAME,
				});
				return client;
			} catch (error) {

				if (attempt < this.MAX_RETRIES) {
					const backoffTime = getExponentialBackoffDelay(attempt, 1000);
					await delay(backoffTime);
				} else {
					// Final attempt
					logError({
						message: `Failed to initialize ${this.MODULE_NAME} after ${this.MAX_RETRIES} attempts.`,
						module: this.MODULE_NAME,
						meta: {
							event: 'ClientInitialization',
							error: getErrorMessage(error),
							immediateNotification: true,
						},
					});
					throw new InitializationError(
						`Failed to initialize ${this.MODULE_NAME} after ${this.MAX_RETRIES} attempts.`,
						this.MODULE_NAME,
						error
					);
				}
			}
		}

		throw new InitializationError(
			`Unexpected error initializing ${this.MODULE_NAME}.`,
			this.MODULE_NAME
		);
	}

	protected abstract initializeClient(): Promise<T>;
}
