export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:5173';

export interface GoogleAuthResponse {
  registered: boolean;
  email: string;
  first_name?: string;
  last_name?: string;
  access?: string;
  refresh?: string;
  user?: any;
  message?: string;
}

export interface OnboardPayload {
  id_token: string;
  organization_name: string;
  subdomain?: string;
  store_name?: string;
  store_address?: string;
  gst_number?: string;
  password?: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleAuthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/users/auth/google/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_token: idToken }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || data.id_token?.[0] || 'Google authentication failed');
  }
  return data;
}

export async function onboardOrganization(payload: OnboardPayload): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/users/auth/onboard-organization/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg =
      data.detail ||
      data.organization_name?.[0] ||
      data.subdomain?.[0] ||
      data.id_token?.[0] ||
      'Failed to onboard organization';
    throw new Error(errorMsg);
  }
  return data;
}

export function buildDashboardRedirectUrl(authPayload: any): string {
  const access = encodeURIComponent(authPayload.access || '');
  const refresh = encodeURIComponent(authPayload.refresh || '');
  const user = encodeURIComponent(JSON.stringify(authPayload.user || {}));
  return `${DASHBOARD_URL}/auth/callback?access=${access}&refresh=${refresh}&user=${user}`;
}
