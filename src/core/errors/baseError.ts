// src/core/errors/baseError.ts

/**
 * BaseError class that extends the native Error.
 * All custom errors in the application should extend from this class.
 */
export class BaseError extends Error {
	public statusCode: number;
	public code: string;
	public module: string;
	public isOperational: boolean;
	public originalError?: unknown;

	/**
	 * Creates a new BaseError instance.
	 * @param message - A human-readable message describing the error.
	 * @param statusCode - The HTTP status code associated with this error.
	 * @param code - A unique code identifying the type of this error.
	 * @param module - The module name where this error originated.
	 * @param originalError - The original error object, if any.
	 * @param isOperational - Indicates if the error is operational (user-related, expected) or programming/system-related.
	 */
	constructor(
		message: string,
		statusCode: number,
		code: string,
		module: string,
		originalError?: unknown,
		isOperational = true
	) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain
		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.code = code;
		this.module = module;
		this.isOperational = isOperational;
		this.originalError = originalError;

		Error.captureStackTrace(this, this.constructor);
	}
}
