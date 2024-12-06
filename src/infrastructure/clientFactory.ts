// src/infrastructure/clientFactory.ts

export abstract class ClientFactory<T> {
	protected static clientPromise: Promise<any> | null = null;
	protected static readonly MAX_RETRIES = 3;
	protected static readonly MODULE_NAME: string;

	/**
	 * Retrieves the client instance, initializing it if necessary.
	 * @returns {Promise<any>} A promise resolving to the initialized client instance.
	 */
	public static async getClient(): Promise<any> {
		if (!this.clientPromise) {
			this.clientPromise = this.initializeClient();
		}
		return this.clientPromise;
	}

	/**
	 * Initializes the client instance.
	 * This method is abstract and must be implemented by subclasses.
	 * @returns {Promise<any>} A promise resolving to the initialized client instance.
	 * @throws {Error} If the method is not implemented by a subclass.
	 */
	protected static async initializeClient(): Promise<any> {
		throw new Error('initializeClient method must be implemented by subclasses');
	}
}
