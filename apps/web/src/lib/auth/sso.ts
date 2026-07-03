// SSO via WorkOS — SAML 2.0 / OIDC adapter for enterprise authentication
// 2 days of integration work per the advisory docs
// One enterprise deal at $10K/month pays for a year of cloud costs

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

const WORKOS_API_KEY = process.env.WORKOS_API_KEY || '';
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID || '';
const WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://busaraai.com';

/**
 * Initiate SSO login flow.
 * Redirects to WorkOS hosted authentication page.
 */
export async function initiateSSO(req: NextRequest): Promise<NextResponse> {
  if (!WORKOS_API_KEY) {
    return NextResponse.json({
      error: 'SSO not configured. Set WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.',
      docs: 'https://workos.com/docs/sso',
    }, { status: 501 });
  }

  const provider = new URL(req.url).searchParams.get('provider') || 'GoogleOAuth';
  const state = crypto.randomUUID();

  // Build WorkOS authorization URL
  const authUrl = new URL('https://api.workos.com/sso/authorize');
  authUrl.searchParams.set('client_id', WORKOS_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', WORKOS_REDIRECT_URI || `${APP_URL}/api/sso/callback`);
  authUrl.searchParams.set('provider', provider);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(authUrl.toString());
}

/**
 * Handle SSO callback from WorkOS.
 * Exchanges authorization code for user profile.
 */
export async function handleSSOCallback(req: NextRequest): Promise<any> {
  const code = new URL(req.url).searchParams.get('code');
  if (!code) {
    return { error: 'No authorization code provided' };
  }

  try {
    // Exchange code for profile via WorkOS API
    const response = await fetch('https://api.workos.com/sso/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKOS_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: WORKOS_CLIENT_ID,
        code,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { error: `WorkOS token exchange failed: ${err}` };
    }

    const data = await response.json();
    const user = data.user || {};

    return {
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      organizationId: data.organization_id,
      ssoProvider: data.connection_type,
    };
  } catch (err: any) {
    return { error: `SSO callback error: ${err.message}` };
  }
}

/**
 * Check if SSO is configured.
 */
export function isSSOConfigured(): boolean {
  return !!(WORKOS_API_KEY && WORKOS_CLIENT_ID);
}

/**
 * Get supported SSO providers.
 */
export function getSSOProviders() {
  return [
    { id: 'GoogleOAuth', name: 'Google', type: 'OAuth' },
    { id: 'MicrosoftOAuth', name: 'Microsoft 365', type: 'OAuth' },
    { id: 'GitHubOAuth', name: 'GitHub', type: 'OAuth' },
    { id: 'OktaSAML', name: 'Okta (SAML)', type: 'SAML' },
    { id: 'AzureSAML', name: 'Azure AD (SAML)', type: 'SAML' },
    { id: 'GoogleSAML', name: 'Google Workspace (SAML)', type: 'SAML' },
  ];
}
