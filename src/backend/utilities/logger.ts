// src/backend/utilities/logger.ts

import { createLogger, format, transports, Logger } from 'winston';
import config from '@/core/config';

const logLevel = process.env.LOG_LEVEL || (config.environment === 'production' ? 'info' : 'debug');

const isProduction = config.environment === 'production';

const logger: Logger = createLogger({
	level: logLevel,
	format: format.combine(
		format.errors({ stack: true }), // Incluye trazas de pila en errores
		format.splat(), // Habilita la interpolación de strings
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		isProduction
			? format.json() // En producción, utiliza formato JSON estructurado
			: format.combine(
				format.colorize(), // En desarrollo, agrega color
				format.printf(({ timestamp, level, message, stack, ...meta }) => {
					let log = `[${timestamp}] ${level}: ${message}`;
					if (Object.keys(meta).length > 0) {
						log += ` ${JSON.stringify(meta)}`;
					}
					if (stack) {
						log += `\n${stack}`;
					}
					return log;
				})
			)
	),
	transports: [
		new transports.Console(),
		// Puedes agregar otros transports si es necesario
	],
	exitOnError: false,
});

export default logger;
