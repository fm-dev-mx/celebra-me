// src/core/errors/controllerError.ts

export class ControllerError extends Error {
	public originalError?: unknown;
	public module?: string;

	constructor(message: string, originalError?: unknown, module?: string) {
		super(message);
		this.name = 'ControllerError';
		this.originalError = originalError;
		this.module = module;
	}
}
