// src/utils/email.ts

/* Simplified Email Service.
  Replaces: src/backend/services/emailService.ts, SendGridProvider, etc.
*/
import sgMail from '@sendgrid/mail';

export interface EmailPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
  type?: 'contact' | 'rsvp';
}

export const sendEmail = async (data: EmailPayload): Promise<boolean> => {
  const apiKey = import.meta.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.error('Missing SENDGRID_API_KEY');
    return false;
  }

  sgMail.setApiKey(apiKey);

  const content = `
    New Message from Celebra.me:
    Name: ${data.name}
    Email: ${data.email}
    Phone: ${data.phone || 'N/A'}
    Type: ${data.type || 'General'}

    Message:
    ${data.message}
  `;

  const msg = {
    to: import.meta.env.EMAIL_TO,
    from: import.meta.env.EMAIL_FROM, // Must be verified in SendGrid
    subject: `New Contact: ${data.name} - ${data.type || 'Inquiry'}`,
    text: content,
  };

  try {
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Email send failed:', error);
    return false;
  }
};
