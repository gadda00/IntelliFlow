/**
 * Email notification API endpoint.
 * 
 * Sends alert emails via configurable email service (Resend, SendGrid, etc.)
 * Reads API key from EMAIL_API_KEY environment variable.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body, data } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 });
    }

    const emailApiKey = process.env.EMAIL_API_KEY;
    const emailService = process.env.EMAIL_SERVICE || 'resend'; // 'resend' | 'sendgrid' | 'postmark'

    if (!emailApiKey) {
      // No email service configured — log and return success
      console.log('[Email Alert] No EMAIL_API_KEY configured. Alert would have been sent:');
      console.log(`  To: ${to}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Body: ${body.substring(0, 200)}...`);
      return NextResponse.json({ 
        success: false, 
        message: 'Email service not configured. Set EMAIL_API_KEY env var.' 
      });
    }

    // Format email HTML
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00d4ff;">Busara AI Alert</h2>
        <p style="font-size: 16px;">${body}</p>
        ${data ? `
          <h3 style="margin-top: 20px;">Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${Object.entries(data).map(([key, value]) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${key}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${String(value).substring(0, 500)}</td>
              </tr>
            `).join('')}
          </table>
        ` : ''}
        <p style="margin-top: 20px; color: #888; font-size: 12px;">
          Sent by Busara AI · ${new Date().toISOString()}
        </p>
      </div>
    `;

    // Send via configured service
    if (emailService === 'resend') {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Busara AI <alerts@busara.ai>',
          to,
          subject,
          html,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json({ error: `Resend API error: ${err}` }, { status: 502 });
      }
      return NextResponse.json({ success: true, service: 'resend' });
    }

    if (emailService === 'sendgrid') {
      const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: process.env.EMAIL_FROM || 'alerts@busara.ai' },
          subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        return NextResponse.json({ error: `SendGrid API error: ${err}` }, { status: 502 });
      }
      return NextResponse.json({ success: true, service: 'sendgrid' });
    }

    return NextResponse.json({ error: `Unknown email service: ${emailService}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
