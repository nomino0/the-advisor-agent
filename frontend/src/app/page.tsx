"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeProvider";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CW</span>
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              CloudWise AI
            </span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-block bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          AI-Powered Cloud Optimization
        </div>
        <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
          The Cloud Expert Your
          <br />
          <span className="text-blue-600 dark:text-blue-400">Small Team Can Afford</span>
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-10">
          Connect your repository. Get a complete analysis across 7 pillars —
          security, maintainability, scalability, and more. Plus optimal cloud
          configurations and step-by-step deployment guides.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/register"
            className="bg-blue-600 text-white px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/25"
          >
            Analyze Your Code — Free Preview
          </Link>
          <Link
            href="/login"
            className="border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-8 py-3.5 rounded-lg font-semibold text-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-12">
          What CloudWise AI Does
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: (<svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>),
              title: "Security Scanning",
              desc: "Detect vulnerabilities, hard-coded secrets, SQL injection risks, and OWASP Top 10 issues.",
            },
            {
              icon: (<svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>),
              title: "7-Pillar Code Audit",
              desc: "Analyze code across Security, Maintainability, Scalability, Observability, Testability, Modularity, and Efficiency.",
            },
            {
              icon: (<svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" /></svg>),
              title: "Cloud Recommendations",
              desc: "Get optimal cloud configurations for AWS, GCP, and Azure — tailored to your specific codebase.",
            },
            {
              icon: (<svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
              title: "Cost Optimization",
              desc: "Stop overpaying. See exactly what cloud resources you need and what they'll cost.",
            },
            {
              icon: (<svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>),
              title: "Deployment Guides",
              desc: "Step-by-step deployment instructions, auto-generated for your recommended cloud provider.",
            },
            {
              icon: (<svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" /></svg>),
              title: "AI Agent Swarm",
              desc: "6 specialized AI agents collaborate to analyze your code — Planner, Security Analyst, Auditor, Cloud Advisor, Critic, and Reporter.",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition"
            >
              <div className="mb-3">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-white dark:bg-slate-900 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-slate-900 dark:text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-12 text-lg">
            Free preview for every analysis. Pay only for the full report.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Free Peek
              </h3>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">$0</p>
              <p className="text-slate-500 dark:text-slate-400 mt-1 mb-6">per analysis</p>
              <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                <li>&#10003; Overall score & grade</li>
                <li>&#10003; Top 3 critical findings</li>
                <li>&#10003; Best provider recommendation</li>
                <li>&#10007; Full findings list</li>
                <li>&#10007; Deployment guide</li>
              </ul>
            </div>
            <div className="border-2 border-blue-600 rounded-xl p-8 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                Popular
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Pay per Project
              </h3>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                $4.99
                <span className="text-base font-normal text-slate-500 dark:text-slate-400">+</span>
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-1 mb-6">based on project size</p>
              <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                <li>&#10003; Everything in Free</li>
                <li>&#10003; Full 7-pillar report</li>
                <li>&#10003; Cloud cost projections</li>
                <li>&#10003; Deployment guide</li>
                <li>&#10003; PDF export</li>
              </ul>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Starter Plan
              </h3>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                $29<span className="text-base font-normal text-slate-500 dark:text-slate-400">/mo</span>
              </p>
              <p className="text-slate-500 dark:text-slate-400 mt-1 mb-6">5 analyses/month</p>
              <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                <li>&#10003; Everything in Pay-per-Project</li>
                <li>&#10003; 30-50% savings</li>
                <li>&#10003; Priority processing</li>
                <li>&#10003; Email support</li>
                <li>&#10003; Analysis rollover</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">CW</span>
            </div>
            <span className="text-white font-semibold">CloudWise AI</span>
          </div>
          <p>&copy; 2026 CloudWise AI. All rights reserved.</p>
          <p className="mt-2 text-sm">
            AI-powered cloud optimization for small teams and startups.
          </p>
        </div>
      </footer>
    </div>
  );
}
