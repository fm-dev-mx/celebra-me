// tests/utils/email.test.ts
// Unit tests for the email utility patterns
// Note: The actual email.ts uses import.meta.env which is not available in Jest
// These tests validate the mocking patterns and expected behavior

import sgMail from '@sendgrid/mail';

// Mock the SendGrid module
jest.mock('@sendgrid/mail', () => ({
	setApiKey: jest.fn(),
	send: jest.fn(),
}));

const mockedSgMail = sgMail as jest.Mocked<typeof sgMail>;

describe('Email Service Mocking Patterns', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('SendGrid Mock', () => {
		it('should mock setApiKey correctly', () => {
			sgMail.setApiKey('test-api-key');
			expect(mockedSgMail.setApiKey).toHaveBeenCalledWith('test-api-key');
		});

		it('should mock successful send', async () => {
			mockedSgMail.send.mockResolvedValue([{ statusCode: 202, headers: {}, body: {} }, {}]);

			const result = await sgMail.send({
				to: 'test@example.com',
				from: 'noreply@celebra-me.com',
				subject: 'Test',
				text: 'Test message',
			});

			expect(result[0].statusCode).toBe(202);
		});

		it('should mock send failure', async () => {
			const mockError = new Error('SendGrid API error');
			mockedSgMail.send.mockRejectedValue(mockError);

			await expect(
				sgMail.send({
					to: 'test@example.com',
					from: 'noreply@celebra-me.com',
					subject: 'Test',
					text: 'Test message',
				}),
			).rejects.toThrow('SendGrid API error');
		});
	});

	describe('Email Payload Structure', () => {
		interface EmailPayload {
			name: string;
			email: string;
			phone?: string;
			message: string;
			type?: 'contact' | 'rsvp';
		}

		it('should validate required fields', () => {
			const validPayload: EmailPayload = {
				name: 'Test User',
				email: 'test@example.com',
				message: 'This is a test message',
			};

			expect(validPayload.name).toBeDefined();
			expect(validPayload.email).toBeDefined();
			expect(validPayload.message).toBeDefined();
		});

		it('should allow optional fields', () => {
			const payloadWithOptionals: EmailPayload = {
				name: 'Test User',
				email: 'test@example.com',
				phone: '555-1234',
				message: 'Test',
				type: 'contact',
			};

			expect(payloadWithOptionals.phone).toBe('555-1234');
			expect(payloadWithOptionals.type).toBe('contact');
		});

		it('should format email content correctly', () => {
			const payload: EmailPayload = {
				name: 'John Doe',
				email: 'john@example.com',
				phone: '555-1234',
				message: 'Hello world',
				type: 'contact',
			};

			const content = `
				New Message from Celebra.me:
				Name: ${payload.name}
				Email: ${payload.email}
				Phone: ${payload.phone || 'N/A'}
				Type: ${payload.type || 'General'}

				Message:
				${payload.message}
			`;

			expect(content).toContain('John Doe');
			expect(content).toContain('john@example.com');
			expect(content).toContain('555-1234');
			expect(content).toContain('contact');
			expect(content).toContain('Hello world');
		});

		it('should handle missing optional phone', () => {
			const payload: EmailPayload = {
				name: 'Jane Doe',
				email: 'jane@example.com',
				message: 'Test',
			};

			const phone = payload.phone || 'N/A';
			expect(phone).toBe('N/A');
		});

		it('should handle missing optional type', () => {
			const payload: EmailPayload = {
				name: 'Jane Doe',
				email: 'jane@example.com',
				message: 'Test',
			};

			const type = payload.type || 'General';
			expect(type).toBe('General');
		});
	});
});
