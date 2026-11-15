import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { IconBuildingStore, IconArrowRight, IconShieldCheck } from '@tabler/icons-react';

export const metadata: Metadata = {
  title: 'StoreApp — Modern Retail ERP & Point of Sale',
  description:
    'Cloud-native, offline-resilient retail ERP and POS engine with dual barcode catalog, automated GST, and multi-tenant store operations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
        {/* Header Navigation */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0b0f19]/80 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <IconBuildingStore size={22} />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight text-white">
                  Store<span className="text-emerald-400">App</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Cloud ERP
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <Link href="/#features" className="hover:text-white transition-colors">
                Features
              </Link>
              <Link href="/#architecture" className="hover:text-white transition-colors">
                Architecture
              </Link>
              <Link href="/#pricing" className="hover:text-white transition-colors">
                Pricing
              </Link>
              <a
                href="https://github.com/kartset/store-app"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors"
              >
                Docs & GitHub
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <a
                href={process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:5173'}
                className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700/60 hover:border-slate-500 transition-colors"
              >
                Log In
              </a>
              <Link
                href="/onboard"
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
                <IconArrowRight size={16} />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-[#070a12] py-12 text-slate-400 text-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <IconBuildingStore className="text-emerald-400" size={24} />
                <span className="font-bold text-white text-lg">StoreApp Retail OS</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Full-featured point of sale, 4-tier inventory management, and automated GST compliance for multi-store retail enterprises.
              </p>
              <div className="flex items-center gap-2 text-xs text-emerald-400 pt-1">
                <IconShieldCheck size={16} />
                <span>Enterprise SOC2 & GST E-Way Ready</span>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Product</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/#features" className="hover:text-white">Point of Sale (POS)</Link></li>
                <li><Link href="/#features" className="hover:text-white">Central Master Catalog</Link></li>
                <li><Link href="/#features" className="hover:text-white">Inventory & GRN</Link></li>
                <li><Link href="/#features" className="hover:text-white">GST Invoicing & Reports</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Onboarding</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/onboard" className="hover:text-white">Register Organization</Link></li>
                <li><Link href="/onboard" className="hover:text-white">Provision Flagship Store</Link></li>
                <li><Link href="/#pricing" className="hover:text-white">Pricing & Plans</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold text-xs uppercase tracking-wider mb-3">Platform</h4>
              <ul className="space-y-2 text-xs">
                <li><span className="text-slate-500">React 19 + Mantine Core UI</span></li>
                <li><span className="text-slate-500">Django 6.1 + PostgreSQL 16</span></li>
                <li><span className="text-slate-500">Next.js 14 Self-Serve Onboarding</span></li>
                <li><span className="text-slate-500">Docker Containerized</span></li>
              </ul>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-8 border-t border-slate-900 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} StoreApp Inc. All rights reserved. Built for modern retail commerce.
          </div>
        </footer>
      </body>
    </html>
  );
}
