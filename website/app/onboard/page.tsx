'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  IconBuildingStore,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconShieldCheck,
  IconSparkles,
  IconAlertCircle,
  IconLoader2,
  IconUserCheck,
} from '@tabler/icons-react';
import {
  verifyGoogleToken,
  onboardOrganization,
  buildDashboardRedirectUrl,
  GoogleAuthResponse,
} from '@/lib/api';

export default function OnboardPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [googleToken, setGoogleToken] = useState('mock:founder@apexretail.com:Alex:Rivera');
  const [verifiedGoogleUser, setVerifiedGoogleUser] = useState<GoogleAuthResponse | null>(null);

  const [orgName, setOrgName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [businessType, setBusinessType] = useState('General Retail & Supermarket');

  const [storeName, setStoreName] = useState('Main Flagship Store');
  const [storeAddress, setStoreAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');

  const [provisionStatus, setProvisionStatus] = useState<string>('Initializing...');

  // Auto-generate slug when orgName changes if subdomain wasn't manually typed
  const handleOrgNameChange = (name: string) => {
    setOrgName(name);
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSubdomain(slug);
  };

  // Step 1: Verify Google Identity
  const handleGoogleAuth = async (tokenToUse?: string) => {
    const token = tokenToUse || googleToken;
    if (!token.trim()) {
      setErrorMessage('Please provide a Google ID token or use 1-Click Demo Owner.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await verifyGoogleToken(token.trim());
      setVerifiedGoogleUser(res);

      if (res.registered && res.access) {
        // User already has an active tenant! Directly redirect to dashboard.
        setProvisionStatus('Existing organization found! Redirecting to dashboard...');
        window.location.href = buildDashboardRedirectUrl(res);
        return;
      }

      // New owner: advance to Step 2
      setStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to authenticate Google identity.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Provision Organization & Store
  const handleFinalSubmit = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setStep(4);
    setProvisionStatus('Verifying Google credentials with HQ...');

    try {
      await new Promise((r) => setTimeout(r, 600));
      setProvisionStatus('Creating organization tenant & subdomain...');

      await new Promise((r) => setTimeout(r, 600));
      setProvisionStatus('Configuring flagship store, registers, and inventory catalogs...');

      const payload = {
        id_token: googleToken,
        organization_name: orgName,
        subdomain: subdomain || undefined,
        store_name: storeName || 'Main Flagship Store',
        store_address: storeAddress,
        gst_number: gstNumber,
      };

      const result = await onboardOrganization(payload);

      setProvisionStatus('Provisioning completed! Redirecting to StoreApp Console...');
      await new Promise((r) => setTimeout(r, 800));

      // Redirect into Store App frontend callback
      window.location.href = buildDashboardRedirectUrl(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Onboarding failed. Please review your details.');
      setStep(3); // Step back so user can correct issues
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Step Tracker Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-3 border border-emerald-500/20">
          <IconSparkles size={14} />
          <span>Self-Serve Organization Onboarding</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Launch Your Retail Organization
        </h1>
        <p className="mt-2 text-slate-400 text-sm">
          Set up your company, provision your flagship store, and get your administrator credentials.
        </p>

        {/* Wizard Steps indicator */}
        <div className="mt-8 flex items-center justify-center max-w-md mx-auto">
          <div className="flex items-center w-full">
            {/* Step 1 */}
            <div className={`flex flex-col items-center ${step >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${step > 1 ? 'bg-emerald-500 text-slate-950 border-emerald-500' : step === 1 ? 'border-emerald-400 bg-emerald-950/60' : 'border-slate-700 bg-slate-900'}`}>
                {step > 1 ? <IconCheck size={14} /> : '1'}
              </div>
              <span className="text-[11px] mt-1 font-medium">Google Auth</span>
            </div>
            <div className={`flex-1 h-0.5 mx-2 ${step > 1 ? 'bg-emerald-500' : 'bg-slate-800'}`} />

            {/* Step 2 */}
            <div className={`flex flex-col items-center ${step >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${step > 2 ? 'bg-emerald-500 text-slate-950 border-emerald-500' : step === 2 ? 'border-emerald-400 bg-emerald-950/60' : 'border-slate-700 bg-slate-900'}`}>
                {step > 2 ? <IconCheck size={14} /> : '2'}
              </div>
              <span className="text-[11px] mt-1 font-medium">Company</span>
            </div>
            <div className={`flex-1 h-0.5 mx-2 ${step > 2 ? 'bg-emerald-500' : 'bg-slate-800'}`} />

            {/* Step 3 */}
            <div className={`flex flex-col items-center ${step >= 3 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${step > 3 ? 'bg-emerald-500 text-slate-950 border-emerald-500' : step === 3 ? 'border-emerald-400 bg-emerald-950/60' : 'border-slate-700 bg-slate-900'}`}>
                {step > 3 ? <IconCheck size={14} /> : '3'}
              </div>
              <span className="text-[11px] mt-1 font-medium">Flagship Store</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-sm flex items-start gap-3">
          <IconAlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      {/* Wizard Card Container */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-10 shadow-2xl">
        {/* STEP 1: Google Authentication */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center max-w-lg mx-auto">
              <h2 className="text-xl font-bold text-white">Sign In with Organization Owner Account</h2>
              <p className="text-xs text-slate-400 mt-1">
                Your Google identity will be registered as the primary Organization Administrator (`ORG_ADMIN`).
              </p>
            </div>

            {/* 1-Click Demo / Quick Start Option */}
            <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-semibold text-sm">
                <IconSparkles size={16} />
                <span>Instant Local / Demo Testing</span>
              </div>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                No Google OAuth Client setup required! Test the full onboarding flow with pre-configured demo owner credentials in 1 click:
              </p>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setGoogleToken('mock:founder@apexretail.com:Alex:Rivera');
                  handleGoogleAuth('mock:founder@apexretail.com:Alex:Rivera');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? <IconLoader2 size={16} className="animate-spin" /> : <IconUserCheck size={16} />}
                Try Demo Google Owner (1-Click)
              </button>
            </div>

            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] uppercase font-bold text-slate-500 absolute">
                Or Custom Token
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Google ID Token / Mock Token
                </label>
                <input
                  type="text"
                  value={googleToken}
                  onChange={(e) => setGoogleToken(e.target.value)}
                  placeholder="mock:email@domain.com:First:Last or real Google ID token"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-emerald-500 text-white text-sm outline-none transition-colors"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Format: <code className="text-emerald-400">mock:you@example.com:First:Last</code> or real Google ID token from Google Sign-In button.
                </p>
              </div>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleGoogleAuth()}
                className="w-full py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm flex items-center justify-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>Verifying Google Account...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with Google</span>
                    <IconArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Organization Setup */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">Company & Organization Details</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Signed in as <strong className="text-emerald-400">{verifiedGoogleUser?.email}</strong>
                </p>
              </div>
              <div className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                Step 2 of 3
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Organization / Legal Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  placeholder="e.g. Apex Retail Group or Aroma Cafe"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-emerald-500 text-white text-sm outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Unique Organization Subdomain / Slug
                </label>
                <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 focus-within:border-emerald-500 transition-colors overflow-hidden">
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="apex-retail"
                    className="flex-1 px-3.5 py-2.5 bg-transparent text-white text-sm outline-none"
                  />
                  <span className="px-3 text-xs text-slate-500 bg-slate-900 border-l border-slate-800 py-2.5">
                    .storeapp.local
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Used for tenant scoping and future custom vanity URLs. Auto-generated from your organization name.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Business Industry
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-emerald-500 text-white text-sm outline-none transition-colors"
                >
                  <option>General Retail & Supermarket</option>
                  <option>Apparel, Footwear & Fashion</option>
                  <option>Electronics & Mobile Accessories</option>
                  <option>Pharmacy & Healthcare</option>
                  <option>Cafe, Bakery & Quick Service</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <IconArrowLeft size={14} />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={!orgName.trim()}
                onClick={() => {
                  if (!orgName.trim()) {
                    setErrorMessage('Please enter an organization name.');
                    return;
                  }
                  setErrorMessage(null);
                  setStep(3);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md transition-all disabled:opacity-50"
              >
                <span>Continue to Flagship Store</span>
                <IconArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Flagship Store Setup */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">Configure Your First Store</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Store App creates an initial flagship store so you can start billing immediately.
                </p>
              </div>
              <div className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono">
                Step 3 of 3
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Store / Branch Name *
                </label>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g. Main Flagship Store or Connaught Place Branch"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-emerald-500 text-white text-sm outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Store Physical Address
                </label>
                <textarea
                  rows={2}
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="e.g. 104 Commercial Street, Bangalore, Karnataka"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-emerald-500 text-white text-sm outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  GST Number (Optional)
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. 29AAAAA0000A1Z5"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-emerald-500 text-white text-sm outline-none transition-colors"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Optional during onboarding. Can be configured later in Store Settings.
                </p>
              </div>

              {/* Summary of Roles */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 text-xs text-slate-300 space-y-2">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <IconShieldCheck size={16} className="text-emerald-400" />
                  <span>Roles Automatically Assigned to You:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-emerald-400 font-bold">ORG_ADMIN</span>
                    <p className="text-slate-400 mt-0.5">Full HQ control across all stores & catalog</p>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                    <span className="text-emerald-400 font-bold">STORE_ADMIN</span>
                    <p className="text-slate-400 mt-0.5">Direct POS register & inventory manager</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <IconArrowLeft size={14} />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={isLoading || !storeName.trim()}
                onClick={handleFinalSubmit}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <IconLoader2 size={16} className="animate-spin" />
                    <span>Provisioning Tenant...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Onboarding & Enter App</span>
                    <IconArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Provisioning Progress Screen */}
        {step === 4 && (
          <div className="py-12 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
              <IconLoader2 size={36} className="animate-spin" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white">Provisioning Your Organization</h2>
              <p className="mt-2 text-sm text-emerald-400 font-mono font-medium">
                {provisionStatus}
              </p>
            </div>

            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Please hold on while we initialize your tenant database schema, store records, and authentication tokens.
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center text-xs text-slate-500">
        Already have a staff or cashier account?{' '}
        <a
          href={process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:5173'}
          className="text-emerald-400 hover:underline font-semibold"
        >
          Sign in directly to StoreApp POS
        </a>
      </div>
    </div>
  );
}
