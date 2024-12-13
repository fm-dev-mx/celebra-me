// Importar la clase base
import { BaseError } from "@/core/errors/baseError";
import { ErrorCodes } from "./errorCodes";

// Definición de un error personalizado que extiende de BaseError
export class UnexpectedError extends BaseError {
	constructor(
		message: string = "An unexpected error occurred",
		module: string = "UnknownModule",
		originalError?: unknown
	) {
		super(
			message, // Mensaje descriptivo del error
			500, // Código de estado HTTP
			ErrorCodes.UNEXPECTED_ERROR, // Código de error
			module, // Módulo donde se originó el error
			originalError, // Error original si está disponible
			false // Este error no es operativo, indica un problema del sistema o programación
		);
	}
}
