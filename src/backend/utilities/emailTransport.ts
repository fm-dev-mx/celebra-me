// src/backend/utilities/emailTransport.ts

import Transport from 'winston-transport';
import { EmailService } from '@/backend/services/emailService';
import { EmailData } from '@/core/interfaces/emailData.interface';
import config from '@/core/config';
import { buildErrorNotificationEmailContent } from '@/backend/utilities/emailContentBuilder';

interface EmailTransportOptions extends Transport.TransportStreamOptions {
	emailService: EmailService;
	maxEmailsPerMinute?: number;
}

export class EmailTransport extends Transport {
	private emailService: EmailService;
	private maxEmailsPerMinute: number;
	private emailCount: number;
	private interval: NodeJS.Timeout;

	constructor(opts: EmailTransportOptions) {
		super(opts);
		this.emailService = opts.emailService;
		this.maxEmailsPerMinute = opts.maxEmailsPerMinute || 5;
		this.emailCount = 0;
		this.interval = setInterval(() => {
			this.emailCount = 0;
		}, 60000);
	}

	async log(info: any, callback: () => void) {
		setImmediate(() => {
			this.emit('logged', info);
		});

		// Rate limiting mechanism
		if (this.emailCount >= this.maxEmailsPerMinute) {
			callback();
			return;
		}

		this.emailCount++;

		// Build email content using the shared utility
		const emailContent = buildErrorNotificationEmailContent(info);

		const emailData: EmailData = {
			to: config.alertEmailConfig.recipient,
			from: config.alertEmailConfig.sender,
			subject: `Critical Error Alert: ${info.message}`,
			html: emailContent,
		};

		try {
			// Use EmailService to send the email
			await this.emailService.sendEmail(emailData);
		} catch (error) {
			// Handle errors in sending email (optional)
		}

		callback();
	}
}

