// src/backend/utilities/logger.ts
import { createLogger, format, Logger, transports } from 'winston';
import config from '@/core/config';
import { sanitizeObject } from './dataSanitization';
import { EmailTransport } from './emailTransport'; // Custom transport for email notifications
import { EmailService } from '../services/emailService';
import { SendGridProvider } from '../services/sendGridProvider';

const logLevel: string =
	process.env.LOG_LEVEL || (config.environment === 'production' ? 'info' : 'debug');
const isProduction: boolean = config.environment === 'production';

/**
 * Custom format to sanitize sensitive data in logs.
 */
const sanitizeSensitiveData = format((info) => {
	if (typeof info.message === 'object' && info.message !== null) {
		info.message = sanitizeObject(info.message);
	}

	if (info.meta && typeof info.meta === 'object') {
		info.meta = sanitizeObject(info.meta);
	}

	return info;
});

const productionFormat = format.combine(format.json());
const developmentFormat = format.combine(
	format.colorize(),
	format.printf(({ timestamp, level, message, ...meta }) => {
		let log = `[${timestamp}] ${level}: ${message}`;
		if (Object.keys(meta).length > 0) {
			log += ` ${JSON.stringify(meta, null, 2)}`;
		}
		return log;
	})
);

// Ensure that config.emailConfig is used and that it contains sendgridApiKey.
const { sendgridApiKey } = config.alertEmailConfig;

// Instantiate EmailService and SendGridProvider once
const emailProvider = new SendGridProvider(sendgridApiKey);
const emailService = new EmailService(emailProvider); // Should now work if no cycles and proper export

const logger: Logger = createLogger({
	level: logLevel,
	format: format.combine(
		format.errors({ stack: true }),
		format.splat(),
		format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		sanitizeSensitiveData(),
		isProduction ? productionFormat : developmentFormat
	),
	transports: [
		new transports.Console(),
		new transports.File({ filename: 'logs/error.log', level: 'error' }),
		new transports.File({ filename: 'logs/combined.log' }),
		// Use the already initialized EmailService for critical alerts
		new EmailTransport({
			level: 'critical',
			emailService: emailService,
		}),
	],
	exitOnError: false,
});

export default logger;
