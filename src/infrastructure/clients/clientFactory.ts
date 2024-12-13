// src/infrastructure/clients/clientFactory.ts

import { InitializationError } from '@/core/errors/initializationError';
import logger from '@/backend/services/logger';
import { delay, getExponentialBackoffDelay } from '@/core/utilities/retryUtils';

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
				logger.info({
					message: `${this.MODULE_NAME} client initialized successfully`,
					module: this.MODULE_NAME,
					event: 'ClientInitialization',
				});
				return client;
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error);

				if (attempt < this.MAX_RETRIES) {
					// Lower severity for intermediate attempts
					logger.warn({
						message: `Attempt ${attempt} to initialize ${this.MODULE_NAME} failed. Retrying...`,
						meta: { error: errMsg },
						module: this.MODULE_NAME,
						event: 'ClientInitialization',
					});
					const backoffTime = getExponentialBackoffDelay(attempt, 1000);
					await delay(backoffTime);
				} else {
					// Final attempt
					logger.error({
						message: `Failed to initialize ${this.MODULE_NAME} after ${this.MAX_RETRIES} attempts.`,
						meta: { error: errMsg },
						module: this.MODULE_NAME,
						event: 'ClientInitialization',
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
