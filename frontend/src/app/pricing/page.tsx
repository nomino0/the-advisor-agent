"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeProvider";

interface Plan {
  name: string;
  price_cents: number;
  analyses_limit: number;
  features: string[];
}

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/v1/subscriptions/plans")
      .then((data) => setPlans(data.plans))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const highlight: Record<string, string> = {
    free: "border-slate-200",
    starter: "border-slate-200",
    pro: "border-blue-500 ring-2 ring-blue-500/20",
    team: "border-slate-200",
    enterprise: "border-slate-200",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Nav */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm"
          >
            &larr; Back
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CW</span>
            </div>
            <span className="font-bold text-slate-900 dark:text-white">Pricing Plans</span>
          </div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            Choose Your Plan
          </h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Pay per analysis or subscribe for a monthly quota. Enterprise plans
            include custom SLAs and dedicated support.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {Object.entries(plans).map(([key, plan]) => (
            <div
              key={key}
              className={`rounded-2xl border bg-white dark:bg-slate-900 p-6 flex flex-col ${
                highlight[key] || "border-slate-200"
              }`}
            >
              {key === "pro" && (
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                {plan.name}
              </h3>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">
                {plan.price_cents === 0 && key !== "enterprise"
                  ? "$0"
                  : key === "enterprise"
                  ? "Custom"
                  : `$${(plan.price_cents / 100).toFixed(0)}`}
                {plan.price_cents > 0 && key !== "enterprise" && (
                  <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                    /mo
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {plan.analyses_limit >= 999999
                  ? "Unlimited analyses"
                  : `${plan.analyses_limit} analyses/month`}
              </p>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  const token = typeof window !== "undefined" ? sessionStorage.getItem("access_token") : null;
                  if (!token) {
                    router.push("/login");
                    return;
                  }
                  toast.success(
                    `Subscription to ${plan.name} plan \u2014 Stripe checkout would open here.`
                  );
                }}
                className={`w-full py-2.5 rounded-lg font-semibold transition ${
                  key === "pro"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                {key === "free"
                  ? "Get Started"
                  : key === "enterprise"
                  ? "Contact Sales"
                  : "Subscribe"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
          All plans include peer-to-peer code analysis &mdash; your code never
          leaves your machine.
        </div>
      </main>
    </div>
  );
}
