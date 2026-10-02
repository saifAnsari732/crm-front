import React from 'react';
import KisanConnectLayout from '../../components/layout/KisanConnectLayout';
import {
  Settings,
  CreditCard,
  PhoneCall,
  ShieldCheck,
  Lock,
  Database,
  CheckCircle2,
  Key,
} from 'lucide-react';

export default function SuperAdminSettings() {
  return (
    <KisanConnectLayout>
      <div className="space-y-6 pb-12">
        {/* Modern Super Admin Header Bar */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 rounded-md">
                System Security & Keys
              </span>
              <span className="text-xs text-slate-400 font-semibold">Platform Vault</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              Super Admin System Controls
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Razorpay live gateway keys, multi-tenant isolation telemetry, and platform support hotline configuration.
            </p>
          </div>
        </div>

        {/* Settings Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Razorpay Gateway Status */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Razorpay Live API Integration</h3>
                <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Operational • Production Account
                </span>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-semibold">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Razorpay Key ID:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border">
                  rzp_live_TNdSmDOKSX2g6I
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">HMAC SHA256 Signature Verification:</span>
                <span className="font-bold text-emerald-600">ENFORCED</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Currency Support:</span>
                <span className="font-bold text-slate-900">INR (Indian Rupee)</span>
              </div>
            </div>
          </div>

          {/* Platform Access & Hotline */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Platform Access & Support Hotline</h3>
                <span className="text-xs text-slate-500 font-medium">Customer Support Info</span>
              </div>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-semibold">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Support Phone Hotline:</span>
                <a href="tel:9511450914" className="font-black text-indigo-600 hover:underline text-sm">
                  +91 9511450914
                </a>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Free Trial Access Policy:</span>
                <span className="font-extrabold text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  DISABLED (Paid Subscriptions Only)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Multi-Tenant Isolation:</span>
                <span className="font-bold text-emerald-600">ISOLATED DATABASE COLLECTIONS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </KisanConnectLayout>
  );
}
