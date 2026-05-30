import { Resend } from 'resend';

let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

interface SendEmailParams {
  to: string[];
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ id: string }> {
  const resend = getResend();
  const from = process.env.RESEND_FROM_EMAIL ?? 'reportes@seguridad.app';

  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error || !data) {
    throw new Error(`Error al enviar correo: ${error?.message ?? 'Unknown error'}`);
  }

  return { id: data.id };
}
