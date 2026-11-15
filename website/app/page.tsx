import Link from 'next/link';
import {
  IconBuildingStore,
  IconBarcode,
  IconReceiptTax,
  IconCashRegister,
  IconLayersLinked,
  IconShieldLock,
  IconBolt,
  IconArrowRight,
  IconCheck,
  IconChartBar,
  IconDatabase,
} from '@tabler/icons-react';

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero Glow Backdrop */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10">
        <div className="absolute top-12 left-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute top-24 right-1/4 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6">
          <IconBolt size={14} className="animate-pulse" />
          <span>v2.4 Enterprise Release: Dual Barcode & Multi-Store HQ Sync</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.15]">
          Retail Operations Without <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Complexity</span> or Downtime.
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          The all-in-one retail operating system: offline-resilient POS, 4-tier master catalog, automated GST compliance, and real-time inventory ledger across all your stores.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/onboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Onboard Your Organization
            <IconArrowRight size={18} />
          </Link>
          <a
            href={process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:5173'}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl border border-slate-700 hover:border-slate-500 bg-slate-900/60 hover:bg-slate-800 text-white font-semibold text-base transition-colors"
          >
            Launch POS Console
          </a>
        </div>

        {/* Feature Badges Grid */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
            <div className="text-2xl font-bold text-emerald-400">0ms</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Barcode Scanning Latency</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
            <div className="text-2xl font-bold text-teal-400">100%</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Offline POS Resilient</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
            <div className="text-2xl font-bold text-blue-400">Dual</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">Product & Batch Barcodes</div>
          </div>
          <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-sm">
            <div className="text-2xl font-bold text-purple-400">Auto</div>
            <div className="text-xs text-slate-400 mt-1 font-medium">GST & Credit Notes Engine</div>
          </div>
        </div>
      </section>

      {/* Interactive Features Section */}
      <section id="features" className="py-20 border-t border-slate-800/80 bg-[#070a13]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Core Capabilities</h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
              Engineered for High-Velocity Retail Counters
            </p>
            <p className="mt-4 text-slate-400 text-sm sm:text-base">
              Every feature is built around the actual counter workflow of cashiers, floor managers, and multi-location franchise owners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
                <IconCashRegister size={26} />
              </div>
              <h3 className="text-lg font-bold text-white">Thermal POS & Cashier Registers</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Lightning fast checkout with thermal receipt printing, shift opening/closing float reconciliations, and split cash/UPI/card tender.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Hold & resume active cart sessions</li>
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Auto-calculate change tender & denomination</li>
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> One-click invoice thermal printing</li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-5">
                <IconBarcode size={26} />
              </div>
              <h3 className="text-lg font-bold text-white">4-Tier Master Catalog & Dual Barcodes</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Centralized HQ master catalog with Category → Subcategory → Product → Batch hierarchy, supporting both manufacturer and batch-specific barcodes.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-blue-400" /> Org-wide product definitions with store pricing</li>
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-blue-400" /> Fast barcode scanner keyboard listener</li>
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-blue-400" /> Expiry date & batch-level tracking</li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-5">
                <IconReceiptTax size={26} />
              </div>
              <h3 className="text-lg font-bold text-white">Automated GST & Credit Notes</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Built-in Indian GST tax engine. Automatic tax breakdown (CGST, SGST, IGST) based on intra-state vs inter-state shipping and HSN rates.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-purple-400" /> GST-compliant B2B & B2C tax invoices</li>
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-purple-400" /> Credit notes with ledger balance adjustments</li>
                <li className="flex items-center gap-2"><IconCheck size={14} className="text-purple-400" /> GSTR-1 & GSTR-3B export reports</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-[#0b0f19] p-8 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold mb-4">
                <IconShieldLock size={14} />
                <span>Multi-Tenant Enterprise Security</span>
              </div>
              <h2 className="text-3xl font-extrabold text-white leading-tight">
                Database-Enforced Tenant Isolation & HQ Governance
              </h2>
              <p className="mt-4 text-slate-300 text-sm leading-relaxed">
                Organizations are cleanly partitioned with strict row-level security. Organization Admins govern central catalog, pricing rules, and new store onboarding, while store cashiers and managers only access their designated store premises.
              </p>

              <div className="mt-6 space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 mt-0.5">
                    <IconLayersLinked size={16} />
                  </div>
                  <div>
                    <strong className="text-white">Organization & Subdomain:</strong> Clean URL vanity slug and tenant scoping for future custom domains.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 mt-0.5">
                    <IconBuildingStore size={16} />
                  </div>
                  <div>
                    <strong className="text-white">Store-Scoped Cashier Sessions:</strong> Every terminal session is bound to an active store ID and register float.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-1 rounded bg-emerald-500/20 text-emerald-400 mt-0.5">
                    <IconDatabase size={16} />
                  </div>
                  <div>
                    <strong className="text-white">Atomic Provisioning:</strong> Google sign-in immediately links owner account, organization, flagship store, and admin roles in a single database transaction.
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Architecture Box */}
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-slate-400">
                <span>TENANT ONBOARDING PIPELINE</span>
                <span className="text-emerald-400">ACTIVE</span>
              </div>
              <div className="space-y-3">
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span>1. Google Identity Verified</span>
                  <span className="text-emerald-400 font-semibold">TOKEN OK</span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span>2. Organization & Subdomain Created</span>
                  <span className="text-emerald-400 font-semibold">PROVISIONED</span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span>3. Flagship Store Initialized</span>
                  <span className="text-emerald-400 font-semibold">STORE-01</span>
                </div>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span>4. Org Admin & Store Admin Linked</span>
                  <span className="text-emerald-400 font-semibold">RBAC GRANTED</span>
                </div>
                <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-center justify-between">
                  <span>5. JWT Auth Handoff to Dashboard</span>
                  <span className="font-bold">200 OK</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 border-t border-slate-800/80 bg-[#070a13]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">Simple & Predictable</h2>
            <p className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
              Plans Built for Every Scale of Retail
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Plan 1 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-lg">Single Store</h3>
                <p className="text-xs text-slate-400 mt-1">Perfect for standalone boutiques and neighborhood stores.</p>
                <div className="mt-4 text-3xl font-extrabold text-white">₹1,499<span className="text-xs text-slate-400 font-normal"> / month</span></div>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> 1 Physical Store</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Up to 3 POS Registers</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> 5,000 Catalog Items</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Automated GST Billing</li>
                </ul>
              </div>
              <Link href="/onboard" className="mt-8 block text-center py-2.5 rounded-lg border border-slate-700 hover:border-slate-500 font-semibold text-xs text-white">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Plan 2: Highlighted */}
            <div className="p-6 rounded-2xl border-2 border-emerald-500 bg-slate-900/80 shadow-xl shadow-emerald-500/10 flex flex-col justify-between relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px] uppercase tracking-wide">
                Most Popular
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Multi-Store Growth</h3>
                <p className="text-xs text-slate-400 mt-1">For expanding retail chains and franchise networks.</p>
                <div className="mt-4 text-3xl font-extrabold text-white">₹3,999<span className="text-xs text-slate-400 font-normal"> / month</span></div>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Up to 5 Stores</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Unlimited POS Registers</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Central HQ Master Catalog</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Store-to-Store Stock Transfers</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> GSTR-1, 3B Auto-Tax Export</li>
                </ul>
              </div>
              <Link href="/onboard" className="mt-8 block text-center py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-bold text-xs text-slate-950 shadow-md shadow-emerald-500/20">
                Get Started
              </Link>
            </div>

            {/* Plan 3 */}
            <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-lg">Enterprise Network</h3>
                <p className="text-xs text-slate-400 mt-1">Custom infrastructure for large retailers and supermarkets.</p>
                <div className="mt-4 text-3xl font-extrabold text-white">Custom<span className="text-xs text-slate-400 font-normal"> / annual</span></div>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Unlimited Stores & Staff</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Custom Vanity Subdomains</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> ERP & Accounting Integrations</li>
                  <li className="flex items-center gap-2"><IconCheck size={14} className="text-emerald-400" /> Dedicated 99.99% SLA</li>
                </ul>
              </div>
              <Link href="/onboard" className="mt-8 block text-center py-2.5 rounded-lg border border-slate-700 hover:border-slate-500 font-semibold text-xs text-white">
                Contact Enterprise Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-tr from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
            Ready to Take Control of Your Retail Network?
          </h2>
          <p className="mt-4 text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
            Sign in with Google, set up your organization and flagship store in 2 minutes, and start ringing sales immediately.
          </p>
          <div className="mt-8">
            <Link
              href="/onboard"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02]"
            >
              Start Free Onboarding Now
              <IconArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
