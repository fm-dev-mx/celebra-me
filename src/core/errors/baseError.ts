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

	constructor(
		message: string,
		statusCode: number,
		code: string,
		module: string,
		isOperational = true
	) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain
		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.code = code;
		this.module = module;
		this.isOperational = isOperational;

		Error.captureStackTrace(this, this.constructor);
	}
}
