import { sendEmail } from '@/utils/email';
import nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

describe('Email Service (Gmail/Nodemailer)', () => {
	const samplePayload = {
		name: 'John Doe',
		email: 'john@example.com',
		message: 'Hello!',
		type: 'contact' as const,
	};

	const mockSendMail = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'error').mockImplementation(() => {});

		// Mock transporter creation
		(mockedNodemailer.createTransport as jest.Mock).mockReturnValue({
			sendMail: mockSendMail,
		});

		// Set process.env mock values
		process.env.GMAIL_USER = 'test@gmail.com';
		process.env.GMAIL_PASS = 'app-password';
		process.env.CONTACT_FORM_RECIPIENT_EMAIL = 'recipient@test.com';
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('sendEmail utility', () => {
		it('should create transporter and send mail with correct params', async () => {
			mockSendMail.mockResolvedValue({ messageId: '123' });

			const result = await sendEmail(samplePayload);

			expect(mockedNodemailer.createTransport).toHaveBeenCalledWith({
				host: 'smtp.gmail.com',
				port: 465,
				secure: true,
				auth: {
					user: 'test@gmail.com',
					pass: 'app-password',
				},
			});

			expect(mockSendMail).toHaveBeenCalledWith(
				expect.objectContaining({
					from: expect.stringContaining('test@gmail.com'),
					to: 'recipient@test.com',
					subject: expect.stringContaining('John Doe'),
					text: expect.stringContaining('Hello!'),
				}),
			);

			expect(result).toBe(true);
		});

		it('should return false if credentials are missing', async () => {
			process.env.GMAIL_USER = '';

			const result = await sendEmail(samplePayload);

			expect(result).toBe(false);
			expect(mockSendMail).not.toHaveBeenCalled();
		});

		it('should handle nodemailer failure gracefully', async () => {
			mockSendMail.mockRejectedValue(new Error('Auth failed'));

			const result = await sendEmail(samplePayload);

			expect(result).toBe(false);
			expect(console.error).toHaveBeenCalled();
		});
	});
});
