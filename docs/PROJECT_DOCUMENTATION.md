# CloudWise AI — Production-Grade Agentic Cloud Optimization Platform

## Complete Project Documentation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Monetization & Pricing Model](#4-monetization--pricing-model)
5. [Platform Architecture](#5-platform-architecture)
6. [Multi-Agent System Design](#6-multi-agent-system-design)
7. [Agent Definitions & Roles](#7-agent-definitions--roles)
8. [Agent-to-Agent (A2A) Communication Protocol](#8-agent-to-agent-a2a-communication-protocol)
9. [Agentic RAG System](#9-agentic-rag-system)
10. [MCP Integration](#10-mcp-integration)
11. [Code Analysis Engine — The 7 Pillars](#11-code-analysis-engine--the-7-pillars)
12. [Cloud Configuration & Provider Recommendation Engine](#12-cloud-configuration--provider-recommendation-engine)
13. [Security Vulnerability Detection](#13-security-vulnerability-detection)
14. [User-Facing Features](#14-user-facing-features)
15. [Admin Panel](#15-admin-panel)
16. [Authentication & Authorization](#16-authentication--authorization)
17. [Data Privacy & Peer-to-Peer Architecture](#17-data-privacy--peer-to-peer-architecture)
18. [API Design & Input/Output Schemas](#18-api-design--inputoutput-schemas)
19. [Security Hardening (Blue Team)](#19-security-hardening-blue-team)
20. [Observability, Logging & Monitoring](#20-observability-logging--monitoring)
21. [Decision Explainability (XAI)](#21-decision-explainability-xai)
22. [Technology Stack](#22-technology-stack)
23. [Database Design](#23-database-design)
24. [Deployment Architecture](#24-deployment-architecture)
25. [Testing Strategy](#25-testing-strategy)
26. [Project Roadmap & Milestones](#26-project-roadmap--milestones)
27. [Appendix](#27-appendix)

---

## 1. Executive Summary

**CloudWise AI** is a production-grade, multi-agent AI platform that empowers developers and engineering teams to optimize their applications for cloud deployment. Users upload their code — or connect their GitHub, GitLab, or Google Drive repositories — and an orchestrated team of autonomous AI agents analyzes it across seven critical dimensions: **Security, Maintainability, Scalability, Observability, Testability, Modularity, and Efficiency**.

The platform then generates:
- A comprehensive code quality and best-practices audit report
- Tailored cloud infrastructure configuration recommendations (with visual graphs)
- A ranked comparison of cloud providers best suited for the user's specific application
- Step-by-step deployment documentation
- Security vulnerability flags and remediation guidance

All of this is achieved through a **peer-to-peer (P2P) data architecture** — the platform processes code transiently and does **not** persist any user code or data on its servers.

The system is built for production. No prototypes. No shortcuts.

---

## 2. Problem Statement

### The Core Problem: Small Teams Are Bleeding Money in the Cloud

Small development teams and startups **cannot afford to hire dedicated cloud engineers or DevOps experts** for every project. Yet they are forced to make critical cloud infrastructure decisions every day — decisions that directly impact their bottom line.

The result? **Catastrophic cost waste:**

- A team picks `m5.4xlarge` instances when `t3.medium` would handle 100% of their traffic → **$2,400/month wasted**
- A developer deploys to AWS because "everyone uses it" when GCP Cloud Run would cost 60% less for their Python API → **thousands wasted annually**
- An app with no auto-scaling sits on 5 reserved instances serving 10 requests/minute → **$800/month burning**
- Misconfigured load balancers, oversized databases, unused Elastic IPs, forgotten S3 buckets → **hidden costs compounding silently**

### The Real-World Pain

| Scenario | What Happens | Cost Impact |
|---|---|---|
| 3-person startup launches MVP | No cloud expertise, copy-paste configs from tutorials | 2–5x overspend from Day 1 |
| Freelance developer deploys client app | Picks wrong provider, wrong region, wrong instance type | Client gets $500/mo bill for a $50/mo workload |
| Small agency managing 10 projects | No standardized cloud strategy, each project configured ad-hoc | Cumulative $5K–$15K/year in waste |
| Junior dev team shipping fast | Hard-coded secrets, no security practices, no observability | One breach = company over; invisible costs accumulate |

### Why Small Teams Can't Fix This Themselves

1. **Expertise gap**: Cloud infrastructure is complex — AWS alone has 200+ services. Choosing the right combination requires deep specialist knowledge that small teams simply don't have.
2. **Time poverty**: Small teams are shipping features, not researching cloud pricing pages. They pick "good enough" and overpay for years.
3. **No feedback loop**: Without observability and cost monitoring from Day 1, teams don't realize they're overpaying until the bill arrives — and by then habits are set.
4. **Security blindness**: Small teams rarely have security reviews. They deploy vulnerable code because they don't know what to look for, creating ticking time bombs.
5. **Hiring is not an option**: A senior cloud architect costs **$150K–$200K/year**. A FinOps engineer costs **$120K–$170K/year**. Small teams and solo developers simply cannot afford this.

### The Gap in Existing Solutions

Current tools do not solve this problem for small teams:

| Solution Type | What It Does | Why It Fails Small Teams |
|---|---|---|
| **Cost dashboards** (AWS Cost Explorer, Cloudability) | Shows what you're spending | Doesn't tell you *what to change* or *how to fix it* |
| **Infrastructure scanners** (Infracost, Spot.io) | Estimates IaC costs | Requires IaC skills small teams don't have |
| **Security scanners** (Snyk, SonarQube) | Finds vulnerabilities | Doesn't connect security to cloud cost implications |
| **Cloud consultants** | Human expert audit | $5K–$20K per engagement — prohibitive for small budgets |
| **AI chatbots** | Answer cloud questions | Generic advice, no code-specific analysis, no actionable configs |

**None of these solutions analyze your actual code, recommend the right cloud for YOUR app, AND give you step-by-step deployment instructions — all in one place, for a fraction of the cost of an expert.**

### Our Position

CloudWise AI is the **cloud expert your small team can actually afford**. It is:
- **Proactive** — analyzes code *before* deployment, not after the damage is done
- **Holistic** — covers code quality, security, cloud config, and cost in one pass
- **Autonomous** — AI agents do the heavy lifting, not expensive human consultants
- **Actionable** — delivers step-by-step deployment guides, not just dashboards
- **Affordable** — pay-per-project pricing accessible to solo devs and small teams

---

## 3. Solution Overview

### Core Value Proposition

```
┌─────────────────────────────────────────────────────────────────┐
│                     User uploads code / connects repo           │
│                              │                                  │
│                              ▼                                  │
│              ┌──────────────────────────────┐                   │
│              │   CloudWise AI Agent Swarm   │                   │
│              │                              │                   │
│              │  ┌────────┐  ┌───────────┐   │                   │
│              │  │Planner │──│ Executor  │   │                   │
│              │  └────────┘  └───────────┘   │                   │
│              │  ┌────────┐  ┌───────────┐   │                   │
│              │  │ Critic │──│ Reporter  │   │                   │
│              │  └────────┘  └───────────┘   │                   │
│              └──────────────────────────────┘                   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Best        │  │ Cloud Config │  │ Security Vuln Report  │  │
│  │ Practices   │  │ + Provider   │  │ + Remediation Steps   │  │
│  │ Audit       │  │ Comparison   │  │                       │  │
│  └─────────────┘  └──────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Capabilities

| Capability | Description |
|---|---|
| **Code Upload / Repo Connect** | Upload ZIP/tarball or connect GitHub, GitLab, Google Drive |
| **7-Pillar Code Audit** | Analyze code across Security, Maintainability, Scalability, Observability, Testability, Modularity, Efficiency |
| **Cloud Config Recommendation** | Suggest optimal compute, storage, networking, and managed services |
| **Provider Comparison** | Rank AWS, Azure, GCP (and others) for the user's specific use case |
| **Security Scanning** | Detect vulnerabilities, misconfigurations, and threats |
| **Step-by-Step Deployment Docs** | Auto-generated, provider-specific deployment guides |
| **Visual Graphs** | Cost projections, resource utilization charts, architecture diagrams |
| **P2P / Zero-Persistence** | No user code stored on platform servers |
| **2FA Authentication** | TOTP-based two-factor authentication |
| **Admin Panel** | Agent management, API key rotation, RAG doc management, performance monitoring |

---

## 4. Monetization & Pricing Model

### 4.1 Business Model Overview

CloudWise AI operates on a **freemium + pay-per-project + subscription** hybrid model designed to be accessible to solo developers while scaling revenue with larger teams and heavier usage.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CloudWise AI Pricing Tiers                        │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │  FREE PEEK    │  │  PAY-PER-     │  │  MONTHLY              │   │
│  │               │  │  PROJECT      │  │  SUBSCRIPTION         │   │
│  │  • Summary    │  │               │  │                       │   │
│  │    scores     │  │  • Full       │  │  • Unlimited          │   │
│  │  • Top 3      │  │    report     │  │    analyses           │   │
│  │    findings   │  │  • All 7      │  │  • Priority           │   │
│  │  • Basic      │  │    pillars    │  │    processing         │   │
│  │    cloud hint │  │  • Cloud      │  │  • Team features      │   │
│  │               │  │    configs    │  │  • API access          │   │
│  │  FREE         │  │  • Deploy     │  │  • Custom RAG docs    │   │
│  │               │  │    guide      │  │                       │   │
│  │               │  │  • PDF export │  │  Starting $29/mo      │   │
│  │               │  │               │  │                       │   │
│  │               │  │  From $4.99   │  │                       │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Free Tier — "Sneak Peek"

Every user gets a **free preview** for each analysis to demonstrate value before asking for payment:

| What's Included (Free) | What's Locked (Paid) |
|---|---|
| Overall score (e.g., 72/100 — Grade B) | Per-pillar detailed breakdown |
| Top 3 most critical findings (summary only) | Full findings list with code locations |
| 1-line cloud provider recommendation ("GCP is best for your app") | Full provider comparison table + cost projections |
| Security risk level (HIGH / MEDIUM / LOW) | Complete vulnerability report with remediation steps |
| — | Step-by-step deployment guide |
| — | Architecture diagrams and graphs |
| — | PDF export |
| — | Re-analysis capability |

**Conversion Strategy:** The free peek gives users enough to understand the value. They see their score, see that critical issues exist, see which cloud is best — but need to pay to get the *actionable details* that actually save them money.

### 4.3 Pay-Per-Project Pricing

Pricing is based on **project size** (measured by files and lines of code) and **processing cost** (LLM tokens consumed, agent compute time):

| Tier | Project Size | Files | Lines of Code | Price | What's Included |
|---|---|---|---|---|---|
| **Micro** | Very small | 1–20 files | < 2,000 LOC | **$4.99** | Full report, all pillars, cloud config, deploy guide |
| **Small** | Small app | 21–50 files | 2,000–10,000 LOC | **$9.99** | Everything in Micro + more detailed analysis |
| **Medium** | Standard app | 51–150 files | 10,000–50,000 LOC | **$19.99** | Everything in Small + architecture diagrams |
| **Large** | Large app | 151–500 files | 50,000–200,000 LOC | **$39.99** | Everything in Medium + priority processing |
| **Enterprise** | Very large | 500+ files | 200,000+ LOC | **Custom** | Contact us for enterprise pricing |

**How We Calculate Cost:**
```python
def calculate_project_price(project_metrics: ProjectMetrics) -> Price:
    """
    Pricing formula considers:
    1. Base tier price (from size table above)
    2. Complexity multiplier (high cyclomatic complexity = more agent work)
    3. Language count multiplier (polyglot projects need more analysis)
    4. Our actual cost (LLM tokens + compute + margin)
    """
    base_price = get_tier_price(project_metrics.loc, project_metrics.file_count)
    complexity_factor = 1.0 + (project_metrics.avg_complexity - 10) * 0.02  # cap at 1.5x
    language_factor = 1.0 + (project_metrics.language_count - 1) * 0.1     # cap at 1.5x
    
    final_price = base_price * min(complexity_factor, 1.5) * min(language_factor, 1.5)
    return round_to_nearest(final_price, 0.99)  # e.g., $12.99, $24.99
```

### 4.4 Monthly Subscription Plans

| Plan | Price | Analyses/Month | Team Members | Features |
|---|---|---|---|---|
| **Starter** | **$29/mo** | 5 full analyses | 1 user | Full reports, PDF export, email support |
| **Pro** | **$79/mo** | 20 full analyses | Up to 5 users | Everything in Starter + API access, priority queue, GitHub/GitLab integration |
| **Team** | **$149/mo** | 50 full analyses | Up to 15 users | Everything in Pro + custom RAG docs, team dashboard, Slack integration |
| **Enterprise** | **Custom** | Unlimited | Unlimited | Everything in Team + SSO, SLA, dedicated support, on-premise option |

**Subscription Benefits vs. Pay-Per-Project:**
- **Cost savings**: Subscribers save 30–50% compared to per-project pricing at the same volume
- **Priority processing**: Subscribers get faster analysis (queue priority)
- **Team collaboration**: Shared project history, team dashboards
- **API access**: Programmatic access for CI/CD integration (Pro+)
- **Rollover**: Unused analyses roll over for 1 month (max 2x monthly limit)

### 4.5 Revenue Projections

```
┌──────────────────────────────────────────────────────────────┐
│  Revenue Model (Conservative Estimates)                       │
│                                                              │
│  Month 1-3 (Launch):                                         │
│  • 500 free users, 50 paid analyses/mo                       │
│  • 10 Starter subscriptions                                  │
│  • Revenue: ~$790/mo + $290/mo = ~$1,080/mo                  │
│                                                              │
│  Month 6:                                                    │
│  • 2,000 free users, 200 paid analyses/mo                    │
│  • 30 Starter + 10 Pro subscriptions                         │
│  • Revenue: ~$3,160/mo + $1,660/mo = ~$4,820/mo              │
│                                                              │
│  Month 12:                                                   │
│  • 8,000 free users, 500 paid analyses/mo                    │
│  • 80 Starter + 30 Pro + 10 Team subscriptions               │
│  • Revenue: ~$7,900/mo + $5,180/mo = ~$13,080/mo             │
│                                                              │
│  Our Costs Per Analysis:                                     │
│  • LLM tokens (GPT-4o): ~$0.30–$1.50 per analysis           │
│  • Compute (ephemeral container): ~$0.05–$0.15               │
│  • Infrastructure (amortized): ~$0.10                        │
│  • Total cost per analysis: ~$0.45–$1.75                     │
│  • Margin per paid analysis: 60–85%                          │
└──────────────────────────────────────────────────────────────┘
```

### 4.6 Payment UX Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Payment Flow                              │
│                                                              │
│  Step 1: User runs analysis                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Analysis complete! Your score: 72/100 (B)           │    │
│  │                                                      │    │
│  │  🔓 FREE PREVIEW:                                    │    │
│  │  • Overall score: 72/100                             │    │
│  │  • Top issues: 3 CRITICAL security findings          │    │
│  │  • Best provider: GCP (Cloud Run)                    │    │
│  │                                                      │    │
│  │  🔒 UNLOCK FULL REPORT ($9.99):                      │    │
│  │  • 47 detailed findings across 7 pillars             │    │
│  │  • Complete cloud config + cost projections           │    │
│  │  • Step-by-step GCP deployment guide                 │    │
│  │  • Security remediation instructions                 │    │
│  │  • PDF export                                        │    │
│  │                                                      │    │
│  │  [💳 Unlock Report — $9.99]  [📦 See Plans]          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Step 2: Payment                                             │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Secure checkout (Stripe)                            │    │
│  │                                                      │    │
│  │  Card: •••• •••• •••• 4242                           │    │
│  │  [Apple Pay]  [Google Pay]  [PayPal]                 │    │
│  │                                                      │    │
│  │  ☑ Save card for future purchases                    │    │
│  │                                                      │    │
│  │  💡 Save 40%! Get the Starter plan for $29/mo        │    │
│  │     (includes 5 analyses)                            │    │
│  │                                                      │    │
│  │  [Pay $9.99]                                         │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Step 3: Instant access                                      │
│  → Full report unlocked immediately                          │
│  → PDF download available                                    │
│  → Receipt sent to email                                     │
└──────────────────────────────────────────────────────────────┘
```

### 4.7 Secure Payment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Payment Security Architecture                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  PCI DSS Compliance — We NEVER touch raw card data        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  User ──→ Stripe.js (client-side) ──→ Stripe API ──→ Our API   │
│           Card info goes DIRECTLY      Tokenized     We only    │
│           to Stripe, never our         payment       receive    │
│           servers                      intent        payment    │
│                                                      confirmation│
│                                                                  │
│  Payment Flow:                                                   │
│  1. Frontend creates Stripe PaymentIntent via our backend       │
│  2. Stripe.js collects card data (never hits our server)        │
│  3. Stripe processes payment, returns confirmation              │
│  4. Our webhook receives payment_succeeded event                │
│  5. We unlock the report for the user                           │
│  6. Receipt generated and emailed                               │
│                                                                  │
│  Security Measures:                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ✅ PCI DSS Level 1 compliance (via Stripe)             │   │
│  │  ✅ No card data stored on our servers (EVER)           │   │
│  │  ✅ Stripe.js tokenization (client-side encryption)     │   │
│  │  ✅ Webhook signature verification (HMAC-SHA256)        │   │
│  │  ✅ Idempotency keys (prevent double charges)           │   │
│  │  ✅ TLS 1.3 for all payment communication               │   │
│  │  ✅ 3D Secure 2.0 (SCA) for European card payments     │   │
│  │  ✅ Fraud detection via Stripe Radar                    │   │
│  │  ✅ Automatic refund policy (within 7 days)             │   │
│  │  ✅ Payment audit logging (all transactions recorded)   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.8 Subscription Management

```python
# Subscription lifecycle managed via Stripe Billing
class SubscriptionService:
    """
    Handles:
    - Plan creation and upgrades/downgrades
    - Billing cycle management (monthly)
    - Usage tracking (analyses consumed this period)
    - Overage handling (soft limit + notification)
    - Cancellation with prorated refund
    - Failed payment retry (3 attempts over 7 days)
    - Dunning management (email reminders for failed payments)
    - Invoice generation and history
    """
    
    async def create_subscription(self, user_id: str, plan: str) -> Subscription:
        # 1. Create Stripe Customer (if not exists)
        # 2. Attach payment method
        # 3. Create Stripe Subscription
        # 4. Store subscription record in our DB
        # 5. Grant plan permissions immediately
        pass
    
    async def check_analysis_quota(self, user_id: str) -> QuotaStatus:
        # Returns: remaining analyses, rollover count, overage options
        pass
    
    async def handle_webhook(self, event: StripeEvent) -> None:
        # Handle: payment_succeeded, payment_failed, 
        #         subscription_updated, subscription_canceled,
        #         invoice_payment_failed
        pass
```

### 4.9 Payment API Endpoints

```
Payments & Billing
  POST   /api/v1/payments/create-intent       Create payment intent (per-project)
  POST   /api/v1/payments/confirm              Confirm payment
  GET    /api/v1/payments/history              User payment history
  GET    /api/v1/payments/invoices             List invoices
  GET    /api/v1/payments/invoices/{id}/pdf    Download invoice PDF
  
Subscriptions
  GET    /api/v1/subscriptions/plans           List available plans
  POST   /api/v1/subscriptions/create          Create subscription
  PUT    /api/v1/subscriptions/update          Upgrade/downgrade plan
  DELETE /api/v1/subscriptions/cancel          Cancel subscription
  GET    /api/v1/subscriptions/current         Get current subscription + usage
  GET    /api/v1/subscriptions/usage           Get analysis usage this period
  
Webhooks (Internal — Stripe → Our API)
  POST   /api/v1/webhooks/stripe               Stripe webhook handler

Admin — Revenue
  GET    /api/v1/admin/revenue/dashboard       Revenue metrics
  GET    /api/v1/admin/revenue/transactions    All transactions
  POST   /api/v1/admin/revenue/refund          Issue refund
  GET    /api/v1/admin/revenue/mrr             Monthly recurring revenue
  GET    /api/v1/admin/revenue/churn           Churn metrics
```

### 4.10 Admin Revenue Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Revenue Dashboard                          [Admin Panel]    │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ MRR         │ │ Revenue     │ │ Churn Rate  │           │
│  │ $4,820      │ │ (This Month)│ │   3.2%      │           │
│  │ ▲ +18%      │ │ $6,480      │ │ ▼ -0.5%     │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Paying Users│ │ Avg Revenue │ │ Cost/Analysis│           │
│  │    127      │ │ Per User    │ │   $0.92      │           │
│  │ ▲ +22%      │ │ $51.02      │ │ ▼ -8%        │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
│  Revenue Breakdown                                           │
│  ┌────────────────────────────┬──────────┬────────────────┐  │
│  │ Source                     │ Amount   │ % of Revenue   │  │
│  ├────────────────────────────┼──────────┼────────────────┤  │
│  │ Pay-per-project            │ $3,160   │ 48.8%          │  │
│  │ Starter subscriptions (30) │ $870     │ 13.4%          │  │
│  │ Pro subscriptions (10)     │ $790     │ 12.2%          │  │
│  │ Team subscriptions (10)    │ $1,490   │ 23.0%          │  │
│  │ Enterprise                 │ $170     │ 2.6%           │  │
│  └────────────────────────────┴──────────┴────────────────┘  │
│                                                              │
│  Conversion Funnel                                           │
│  Free Users: 2,000 → Paid Once: 200 (10%) → Subscribers:    │
│  50 (2.5%) → Team/Enterprise: 10 (0.5%)                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Platform Architecture

### High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            PRESENTATION LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                     │
│  │  Web App      │  │  Admin Panel │  │  API Gateway │                     │
│  │  (React/Next) │  │  (React)     │  │  (FastAPI)   │                     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                     │
└─────────┼──────────────────┼─────────────────┼─────────────────────────────┘
          │                  │                 │
          ▼                  ▼                 ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          API / GATEWAY LAYER                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  FastAPI Application Server                                         │   │
│  │  • Authentication Middleware (JWT + 2FA)                             │   │
│  │  • Rate Limiting                                                    │   │
│  │  • Request Validation (Pydantic schemas)                            │   │
│  │  • CORS / Security Headers                                          │   │
│  │  • Prompt Injection Filter                                          │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATION LAYER (LangGraph)                        │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Agent Orchestrator (Supervisor)                    │  │
│  │                                                                      │  │
│  │   ┌─────────┐  ┌───────────┐  ┌─────────┐  ┌──────────────────┐    │  │
│  │   │ Planner │→ │ Executors │→ │ Critic  │→ │ Report Generator │    │  │
│  │   │ Agent   │  │ (Multi)   │  │ Agent   │  │ Agent            │    │  │
│  │   └─────────┘  └───────────┘  └─────────┘  └──────────────────┘    │  │
│  │                                                                      │  │
│  │   Executors:                                                         │  │
│  │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │  │
│  │   │ Security     │ │ Best         │ │ Cloud Config │               │  │
│  │   │ Analyst      │ │ Practices    │ │ Advisor      │               │  │
│  │   │ Agent        │ │ Auditor      │ │ Agent        │               │  │
│  │   └──────────────┘ └──────────────┘ └──────────────┘               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    A2A Communication Bus                             │  │
│  │  (Structured message passing, shared state, event-driven)            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          INTELLIGENCE LAYER                                │
│                                                                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  Agentic RAG    │  │  LLM Gateway    │  │  Tool Registry           │  │
│  │  Engine         │  │  (Multi-model)  │  │  (Least Privilege)       │  │
│  │  • Cloud Docs   │  │  • OpenAI       │  │  • Code Parsers          │  │
│  │  • Security DBs │  │  • Anthropic    │  │  • Static Analyzers      │  │
│  │  • Best Practice│  │  • Local LLMs   │  │  • Cloud APIs            │  │
│  │    Knowledge    │  │                 │  │  • Pricing Calculators   │  │
│  └─────────────────┘  └─────────────────┘  └──────────────────────────┘  │
│                                                                            │
│  ┌─────────────────┐  ┌─────────────────┐                                 │
│  │  MCP Server     │  │  Verification   │                                 │
│  │  (Model Context │  │  Layer          │                                 │
│  │   Protocol)     │  │  (Anti-hallu-   │                                 │
│  │                 │  │   cination)     │                                 │
│  └─────────────────┘  └─────────────────┘                                 │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                       │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  PostgreSQL   │  │  Redis       │  │  ChromaDB /  │  │  Object      │  │
│  │  (Users,      │  │  (Sessions,  │  │  Pinecone    │  │  Storage     │  │
│  │   Admin,      │  │   Cache,     │  │  (Vector DB  │  │  (Temp code  │  │
│  │   Audit Logs) │  │   Rate Lim)  │  │   for RAG)   │  │   processing)│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                                            │
│  NOTE: User code is NEVER persisted. Processed in ephemeral containers.   │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        OBSERVABILITY LAYER                                 │
│                                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  OpenTelemetry│  │  LangSmith / │  │  Prometheus  │  │  Grafana     │  │
│  │  (Traces)     │  │  LangFuse    │  │  (Metrics)   │  │  (Dashboards)│  │
│  │              │  │  (LLM Traces)│  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Architecture Principles

| Principle | Implementation |
|---|---|
| **Separation of Concerns** | Each layer has a single responsibility |
| **Least Privilege** | Each agent only has access to the tools it needs |
| **Defense in Depth** | Multiple security layers (auth, input validation, prompt injection filter, output validation) |
| **Event-Driven** | Agents communicate via structured events, not direct coupling |
| **Stateless Processing** | Code analysis is stateless; no user data persists |
| **Horizontal Scalability** | Agents can be scaled independently |
| **Fail-Safe Defaults** | On error, agents default to safe/conservative outputs |

---

## 6. Multi-Agent System Design

### 6.1 Orchestration Model

We use a **Supervisor-Worker** pattern implemented via **LangGraph**, where a central Supervisor (Planner Agent) decomposes the user request into tasks, dispatches them to specialized Worker agents, and a Critic agent validates outputs before final report generation.

```
                    ┌──────────────────┐
                    │   User Request   │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Planner Agent   │
                    │  (Supervisor)    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────────┐
     │ Security   │ │ Best       │ │ Cloud Config   │
     │ Analyst    │ │ Practices  │ │ Advisor        │
     │ Agent      │ │ Auditor    │ │ Agent          │
     └──────┬─────┘ └──────┬─────┘ └───────┬────────┘
            │              │               │
            └──────────────┼───────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │   Critic Agent   │
                  │   (Validator)    │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Report Generator│
                  │  Agent           │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  Final Report    │
                  │  to User         │
                  └──────────────────┘
```

### 6.2 Agent Lifecycle

Every agent execution follows a strict lifecycle:

```
INIT → PLAN → EXECUTE → VALIDATE → RESPOND → LOG → TERMINATE
```

1. **INIT**: Agent receives task with defined input schema
2. **PLAN**: Agent reasons about subtasks, required tools, and approach (Chain-of-Thought)
3. **EXECUTE**: Agent invokes tools (with permissions) and gathers information
4. **VALIDATE**: Agent validates its own output against expected schema
5. **RESPOND**: Agent returns structured output to orchestrator
6. **LOG**: All decisions, tool calls, and outputs are logged
7. **TERMINATE**: Agent releases resources and exits

### 6.3 LangGraph State Machine

```python
# Conceptual LangGraph workflow definition
from langgraph.graph import StateGraph, END

workflow = StateGraph(AnalysisState)

# Nodes
workflow.add_node("planner", planner_agent)
workflow.add_node("security_analyst", security_analyst_agent)
workflow.add_node("best_practices_auditor", best_practices_auditor_agent)
workflow.add_node("cloud_config_advisor", cloud_config_advisor_agent)
workflow.add_node("critic", critic_agent)
workflow.add_node("report_generator", report_generator_agent)

# Edges
workflow.set_entry_point("planner")
workflow.add_edge("planner", "security_analyst")
workflow.add_edge("planner", "best_practices_auditor")
workflow.add_edge("planner", "cloud_config_advisor")
workflow.add_edge("security_analyst", "critic")
workflow.add_edge("best_practices_auditor", "critic")
workflow.add_edge("cloud_config_advisor", "critic")
workflow.add_conditional_edges(
    "critic",
    should_revise,
    {
        "revise": "planner",      # Loop back if quality is insufficient
        "approve": "report_generator"
    }
)
workflow.add_edge("report_generator", END)
```

---

## 7. Agent Definitions & Roles

### 7.1 Planner Agent (Supervisor)

| Property | Value |
|---|---|
| **Role** | Decomposes user request into structured subtasks and orchestrates execution |
| **Input** | User code metadata (language, framework, size, structure), user preferences |
| **Output** | Execution plan (ordered list of tasks with assigned agents) |
| **Tools** | `code_structure_analyzer`, `language_detector`, `framework_detector` |
| **Permissions** | Read-only access to code metadata; no access to code content |
| **Reasoning** | Chain-of-Thought planning with task dependency resolution |

**Prompt Template (Core):**
```
You are a Planner Agent responsible for analyzing a user's codebase metadata 
and creating an optimal execution plan. You must:
1. Identify the programming language(s) and framework(s)
2. Estimate codebase complexity
3. Determine which analysis agents are needed
4. Define the execution order with dependencies
5. Set quality thresholds for each task

NEVER access code content directly. Only use metadata tools.
ALWAYS output a structured JSON execution plan.
```

---

### 7.2 Security Analyst Agent

| Property | Value |
|---|---|
| **Role** | Scans code for security vulnerabilities, misconfigurations, and threats |
| **Input** | Code files (ephemeral), language/framework info from Planner |
| **Output** | Security report with severity-ranked findings and remediation steps |
| **Tools** | `static_analysis_scanner`, `dependency_vulnerability_checker`, `secret_detector`, `owasp_rule_engine`, `rag_security_knowledge_base` |
| **Permissions** | Read-only access to code files; access to security knowledge RAG; NO write access |
| **Max Tool Calls** | 15 per analysis session |

**Analysis Scope:**
- OWASP Top 10 vulnerabilities
- Hardcoded secrets/credentials
- Dependency vulnerabilities (CVEs)
- SQL injection, XSS, CSRF patterns
- Insecure cryptographic practices
- Improper error handling / information leakage
- Authentication/authorization weaknesses
- Insecure deserialization
- Server-side request forgery (SSRF)
- Infrastructure-as-Code misconfigurations

**Output Schema:**
```json
{
  "security_report": {
    "overall_risk_score": "HIGH | MEDIUM | LOW",
    "summary": "string",
    "findings": [
      {
        "id": "SEC-001",
        "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFO",
        "category": "string (e.g., 'OWASP-A01: Broken Access Control')",
        "title": "string",
        "description": "string",
        "affected_files": ["path/to/file.py:line_number"],
        "evidence": "string (code snippet)",
        "remediation": "string (step-by-step fix)",
        "references": ["URL to documentation"],
        "confidence": 0.95
      }
    ],
    "dependency_audit": {
      "total_dependencies": 0,
      "vulnerable_count": 0,
      "vulnerabilities": []
    }
  }
}
```

---

### 7.3 Best Practices Auditor Agent

| Property | Value |
|---|---|
| **Role** | Analyzes code quality across the 7 pillars |
| **Input** | Code files (ephemeral), execution plan from Planner |
| **Output** | Pillar-by-pillar audit report with scores and actionable suggestions |
| **Tools** | `code_complexity_analyzer`, `test_coverage_estimator`, `modularity_checker`, `logging_pattern_detector`, `documentation_coverage_tool`, `rag_best_practices_kb` |
| **Permissions** | Read-only access to code files; access to best-practices RAG; NO write access |
| **Max Tool Calls** | 20 per analysis session |

**The 7 Pillars Analysis:**

| Pillar | What We Check |
|---|---|
| **Secure** | Input validation, auth patterns, encryption usage, least privilege |
| **Maintainable** | Code readability, naming conventions, documentation, SOLID principles |
| **Scalable** | Stateless design, async patterns, database query optimization, caching |
| **Observable** | Logging, metrics, health checks, distributed tracing hooks |
| **Testable** | Test coverage, test quality, dependency injection, mock-ability |
| **Modular** | Separation of concerns, coupling/cohesion, interface boundaries |
| **Efficient** | Algorithm complexity, memory usage, unnecessary computations, N+1 queries |

**Output Schema:**
```json
{
  "best_practices_report": {
    "overall_score": 72,
    "grade": "B",
    "pillars": {
      "secure": {
        "score": 65,
        "grade": "C",
        "findings": [
          {
            "id": "BP-SEC-001",
            "severity": "HIGH",
            "title": "Missing input validation on API endpoints",
            "description": "...",
            "affected_files": ["src/api/routes.py:45"],
            "suggestion": "Add Pydantic schema validation...",
            "code_example": "...",
            "references": ["..."]
          }
        ]
      },
      "maintainable": { "score": 80, "grade": "B", "findings": [] },
      "scalable": { "score": 70, "grade": "B-", "findings": [] },
      "observable": { "score": 55, "grade": "D+", "findings": [] },
      "testable": { "score": 75, "grade": "B", "findings": [] },
      "modular": { "score": 85, "grade": "A-", "findings": [] },
      "efficient": { "score": 68, "grade": "C+", "findings": [] }
    },
    "top_recommendations": [
      {
        "priority": 1,
        "title": "Add structured logging",
        "impact": "HIGH",
        "effort": "LOW",
        "description": "..."
      }
    ]
  }
}
```

---

### 7.4 Cloud Configuration Advisor Agent

| Property | Value |
|---|---|
| **Role** | Recommends optimal cloud infrastructure and provider based on code analysis |
| **Input** | Code analysis results from other agents, app profile (language, framework, expected load) |
| **Output** | Cloud config recommendations, provider comparison, cost projections, deployment guide |
| **Tools** | `cloud_pricing_calculator`, `resource_estimator`, `architecture_pattern_matcher`, `rag_cloud_docs_kb`, `deployment_template_generator` |
| **Permissions** | Read access to analysis results; access to cloud documentation RAG; NO access to code files |
| **Max Tool Calls** | 25 per analysis session |

**Analysis Dimensions:**

1. **Compute**: Instance type/size, serverless vs. containers vs. VMs, auto-scaling config
2. **Storage**: Database type (SQL/NoSQL/Graph), object storage, caching layer
3. **Networking**: CDN, load balancer, DNS, VPC configuration
4. **Managed Services**: Message queues, search engines, ML services
5. **Cost Optimization**: Reserved instances, spot/preemptible, right-sizing

**Output Schema:**
```json
{
  "cloud_config_report": {
    "app_profile": {
      "type": "web_api | microservice | monolith | data_pipeline | ml_serving",
      "language": "python",
      "framework": "fastapi",
      "estimated_rps": "100-1000",
      "data_intensity": "MEDIUM",
      "compute_intensity": "LOW"
    },
    "recommended_config": {
      "compute": {
        "type": "container",
        "service": "ECS Fargate / Cloud Run / AKS",
        "specs": { "cpu": "2 vCPU", "memory": "4 GB", "instances": "2-10" },
        "auto_scaling": { "metric": "CPU", "target": "70%", "min": 2, "max": 10 }
      },
      "database": {
        "type": "PostgreSQL (managed)",
        "service": "RDS / Cloud SQL / Azure Database",
        "specs": { "instance": "db.t3.medium", "storage": "100 GB SSD", "read_replicas": 1 }
      },
      "caching": { "service": "ElastiCache / Memorystore / Azure Cache", "specs": {} },
      "storage": { "service": "S3 / GCS / Azure Blob", "specs": {} },
      "networking": {
        "cdn": true,
        "load_balancer": "Application Load Balancer",
        "vpc": { "availability_zones": 2 }
      }
    },
    "provider_comparison": [
      {
        "provider": "AWS",
        "suitability_score": 88,
        "monthly_cost_estimate": "$245-$420",
        "strengths": ["Largest service catalog", "Best container ecosystem"],
        "weaknesses": ["Complex pricing", "Steeper learning curve"],
        "deployment_complexity": "MEDIUM"
      },
      {
        "provider": "GCP",
        "suitability_score": 92,
        "monthly_cost_estimate": "$210-$380",
        "strengths": ["Best for Python/ML", "Simpler pricing", "Cloud Run"],
        "weaknesses": ["Smaller community", "Fewer managed services"],
        "deployment_complexity": "LOW"
      },
      {
        "provider": "Azure",
        "suitability_score": 78,
        "monthly_cost_estimate": "$260-$450",
        "strengths": ["Enterprise integration", "Hybrid cloud"],
        "weaknesses": ["UI complexity", "Documentation gaps"],
        "deployment_complexity": "MEDIUM"
      }
    ],
    "cost_projection": {
      "monthly": { "low": 210, "mid": 320, "high": 450 },
      "annual": { "low": 2520, "mid": 3840, "high": 5400 },
      "currency": "USD",
      "visualization_data": {}
    },
    "deployment_guide": {
      "recommended_provider": "GCP",
      "steps": [
        { "step": 1, "title": "Set up GCP project", "commands": [], "description": "..." },
        { "step": 2, "title": "Configure Cloud Run", "commands": [], "description": "..." }
      ]
    }
  }
}
```

---

### 7.5 Critic Agent (Validator)

| Property | Value |
|---|---|
| **Role** | Validates and critiques outputs from all Executor agents for accuracy, completeness, and consistency |
| **Input** | Outputs from Security Analyst, Best Practices Auditor, and Cloud Config Advisor |
| **Output** | Validation report with approval/revision decisions |
| **Tools** | `schema_validator`, `cross_reference_checker`, `confidence_scorer`, `rag_verification_kb` |
| **Permissions** | Read access to all agent outputs; NO access to code files or external services |
| **Max Tool Calls** | 10 per validation session |

**Validation Criteria:**
- Schema compliance (all outputs match expected structure)
- Cross-consistency (security findings align with best-practices findings)
- Confidence thresholds (findings below 0.7 confidence are flagged)
- Hallucination detection (claims are cross-referenced against RAG knowledge base)
- Completeness check (all requested pillars are covered)
- Actionability (every finding has a remediation/suggestion)

**Decision Logic:**
```
IF all_outputs_valid AND cross_consistent AND avg_confidence > 0.75:
    → APPROVE → send to Report Generator
ELSE IF minor_issues_found:
    → APPROVE_WITH_NOTES → send to Report Generator with caveats
ELSE:
    → REVISE → send back to Planner with specific revision requests
    (Max 2 revision loops to prevent infinite cycles)
```

---

### 7.6 Report Generator Agent

| Property | Value |
|---|---|
| **Role** | Synthesizes all validated agent outputs into a cohesive, user-friendly report |
| **Input** | Validated outputs from all agents, user preferences (detail level, format) |
| **Output** | Final comprehensive report with visualizations |
| **Tools** | `report_template_engine`, `chart_generator`, `markdown_renderer`, `pdf_exporter` |
| **Permissions** | Read access to validated agent outputs; write access to report generation only |
| **Max Tool Calls** | 10 per report generation |

**Report Sections:**
1. Executive Summary (overall scores, key risks, top recommendations)
2. Security Audit (findings table, severity distribution chart)
3. Best Practices Audit (7-pillar radar chart, per-pillar details)
4. Cloud Configuration (recommended architecture diagram, config details)
5. Provider Comparison (comparison table, cost projection graphs)
6. Deployment Guide (step-by-step with code snippets)
7. Appendix (methodology, confidence levels, references)

---

## 8. Agent-to-Agent (A2A) Communication Protocol

### 8.1 Message Format

All inter-agent communication follows a standardized message envelope:

```json
{
  "message_id": "uuid-v4",
  "timestamp": "ISO-8601",
  "sender": {
    "agent_id": "security_analyst_agent",
    "agent_type": "executor",
    "instance_id": "sa-001"
  },
  "recipient": {
    "agent_id": "critic_agent",
    "agent_type": "validator"
  },
  "message_type": "TASK_RESULT | TASK_REQUEST | REVISION_REQUEST | PING | STATUS",
  "correlation_id": "uuid-v4 (links to original user request)",
  "payload": {},
  "metadata": {
    "execution_time_ms": 4520,
    "tool_calls_used": 8,
    "confidence_score": 0.87,
    "tokens_consumed": 12450
  }
}
```

### 8.2 Communication Patterns

```
┌──────────────────────────────────────────────────────┐
│                   Communication Bus                   │
│                                                       │
│  Pattern 1: Fan-Out (Planner → Executors)            │
│  ─────────────────────────────────────                │
│  Planner sends parallel task requests to all          │
│  executor agents simultaneously.                      │
│                                                       │
│  Pattern 2: Fan-In (Executors → Critic)              │
│  ─────────────────────────────────────                │
│  Critic waits for all executor results before         │
│  beginning validation.                                │
│                                                       │
│  Pattern 3: Feedback Loop (Critic → Planner)         │
│  ─────────────────────────────────────                │
│  Critic can send revision requests back to            │
│  Planner (max 2 loops).                               │
│                                                       │
│  Pattern 4: Sequential (Critic → Reporter)           │
│  ─────────────────────────────────────                │
│  Report generation only starts after Critic           │
│  approval.                                            │
└──────────────────────────────────────────────────────┘
```

### 8.3 Shared State (LangGraph State)

```python
from typing import TypedDict, List, Optional
from pydantic import BaseModel

class AnalysisState(TypedDict):
    """Shared state accessible by all agents in the workflow."""
    
    # Input
    request_id: str
    user_id: str
    code_metadata: dict          # Language, framework, structure (no code content)
    user_preferences: dict       # Detail level, format preferences
    
    # Planner output
    execution_plan: dict
    
    # Executor outputs
    security_report: Optional[dict]
    best_practices_report: Optional[dict]
    cloud_config_report: Optional[dict]
    
    # Critic output
    validation_result: Optional[dict]
    revision_count: int          # Track revision loops (max 2)
    
    # Final output
    final_report: Optional[dict]
    
    # Metadata
    total_tokens_used: int
    total_execution_time_ms: int
    agent_trace_log: List[dict]  # Full execution trace
```

---

## 9. Agentic RAG System

### 9.1 Overview

The Agentic RAG (Retrieval-Augmented Generation) system is the knowledge backbone of CloudWise AI. Unlike simple RAG, our **Agentic RAG** allows agents to:
- Decide **when** to retrieve information (not every query needs retrieval)
- Formulate **optimal queries** based on the current analysis context
- **Cross-reference** multiple knowledge sources
- **Verify** their own outputs against retrieved knowledge

### 9.2 Knowledge Bases

| Knowledge Base | Content | Update Frequency | Source |
|---|---|---|---|
| **Cloud Provider Docs** | AWS, GCP, Azure official documentation, pricing pages, best practices guides | Weekly (automated sync) | Official docs, APIs |
| **Security Knowledge** | OWASP guidelines, CVE database, CIS benchmarks, NIST frameworks | Daily (CVE feed), Weekly (others) | NVD, OWASP, CIS |
| **Best Practices** | Language-specific guidelines, framework docs, design patterns, anti-patterns | Monthly | Community sources, official guides |
| **Deployment Templates** | IaC templates (Terraform, Pulumi, CloudFormation), Dockerfiles, CI/CD configs | On-demand (admin curated) | Admin uploads |
| **Pricing Data** | Current cloud pricing for compute, storage, networking, managed services | Daily | Cloud provider pricing APIs |

### 9.3 RAG Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Agent Query │ ──→ │  Query       │ ──→ │  Embedding   │
│  (natural    │     │  Reformulator│     │  Model       │
│   language)  │     │  (LLM)       │     │  (text-      │
└──────────────┘     └──────────────┘     │   embedding) │
                                          └──────┬───────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Reranker    │ ←── │  Retrieved   │ ←── │  Vector DB   │
│  (Cross-     │     │  Chunks      │     │  (ChromaDB / │
│   encoder)   │     │  (Top-K=20)  │     │   Pinecone)  │
└──────┬───────┘     └──────────────┘     └──────────────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  Top 5       │ ──→ │  Agent       │
│  Relevant    │     │  Response    │
│  Chunks      │     │  Generation  │
└──────────────┘     └──────────────┘
```

### 9.4 Document Ingestion Pipeline (Admin-Managed)

```
Admin uploads document (PDF, MD, HTML, TXT)
           │
           ▼
┌──────────────────────┐
│  Document Processor  │
│  • Format detection  │
│  • Text extraction   │
│  • Metadata parsing  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Chunking Engine     │
│  • Semantic chunking │
│  • Overlap: 100 tok  │
│  • Max chunk: 512 tok│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Embedding + Index   │
│  • Generate vectors  │
│  • Store in VectorDB │
│  • Update metadata   │
└──────────────────────┘
```

### 9.5 Anti-Hallucination via RAG Verification

Every agent output that makes a factual claim (e.g., "AWS RDS supports up to 64 TB storage") is cross-referenced against the RAG knowledge base by the Critic Agent:

```python
# Pseudo-code for verification
def verify_claim(claim: str, knowledge_base: str) -> VerificationResult:
    """
    Retrieves relevant documents and checks if the claim is supported.
    Returns: VERIFIED, CONTRADICTED, or UNVERIFIABLE
    """
    relevant_docs = rag_retrieve(claim, kb=knowledge_base, top_k=5)
    
    verification_prompt = f"""
    Claim: {claim}
    Evidence: {relevant_docs}
    
    Is this claim supported by the evidence? 
    Answer: VERIFIED / CONTRADICTED / UNVERIFIABLE
    Explanation: ...
    """
    return llm_verify(verification_prompt)
```

---

## 10. MCP Integration

### 10.1 What is MCP?

The **Model Context Protocol (MCP)** provides a standardized way to connect LLMs to external data sources and tools. CloudWise AI uses MCP to:
- Expose our tools (code analyzers, cloud APIs, RAG queries) as MCP-compliant resources
- Allow agents to discover and invoke tools dynamically
- Maintain a centralized tool registry with permission controls

### 10.2 MCP Server Architecture

```
┌──────────────────────────────────────────────────┐
│                  MCP Server                       │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │             Tool Registry                    │  │
│  │                                              │  │
│  │  Tool: code_structure_analyzer               │  │
│  │    Allowed Agents: [planner]                 │  │
│  │    Rate Limit: 5/min                         │  │
│  │                                              │  │
│  │  Tool: static_analysis_scanner               │  │
│  │    Allowed Agents: [security_analyst]         │  │
│  │    Rate Limit: 10/min                        │  │
│  │                                              │  │
│  │  Tool: cloud_pricing_calculator              │  │
│  │    Allowed Agents: [cloud_config_advisor]     │  │
│  │    Rate Limit: 20/min                        │  │
│  │                                              │  │
│  │  Tool: rag_query                             │  │
│  │    Allowed Agents: [ALL]                     │  │
│  │    Rate Limit: 30/min                        │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │          Permission Enforcer                 │  │
│  │  • Validates agent identity                  │  │
│  │  • Checks tool access permissions            │  │
│  │  • Enforces rate limits                      │  │
│  │  • Logs all tool invocations                 │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │          Output Validator                    │  │
│  │  • Validates tool output format              │  │
│  │  • Sanitizes outputs (remove PII, secrets)   │  │
│  │  • Size limits enforcement                   │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 10.3 MCP Tool Definitions

```python
# Example MCP tool definitions
from mcp import Tool, ToolParameter

tools = [
    Tool(
        name="code_structure_analyzer",
        description="Analyzes the structure of a codebase: files, directories, languages, frameworks",
        parameters=[
            ToolParameter(name="code_path", type="string", description="Ephemeral path to code"),
            ToolParameter(name="depth", type="integer", description="Analysis depth (1-3)", default=2),
        ],
        allowed_agents=["planner_agent"],
        rate_limit={"requests": 5, "window_seconds": 60},
        output_schema={"type": "object", "properties": {...}}
    ),
    Tool(
        name="static_analysis_scanner",
        description="Runs static analysis for security vulnerabilities",
        parameters=[
            ToolParameter(name="code_path", type="string"),
            ToolParameter(name="language", type="string"),
            ToolParameter(name="ruleset", type="string", default="owasp-top-10"),
        ],
        allowed_agents=["security_analyst_agent"],
        rate_limit={"requests": 10, "window_seconds": 60},
        output_schema={"type": "object", "properties": {...}}
    ),
    # ... more tools
]
```

---

## 11. Code Analysis Engine — The 7 Pillars

### 11.1 Pillar Definitions and Heuristics

#### Pillar 1: Secure

| Check | Method | Example Finding |
|---|---|---|
| Input validation | AST analysis + pattern matching | Missing validation on user input at `api/routes.py:45` |
| Hardcoded secrets | Regex patterns + entropy analysis | API key found in `config.py:12` |
| Dependency CVEs | OSV / NVD database lookup | `requests==2.25.0` has CVE-2023-32681 |
| Auth patterns | Framework-specific checks | No authentication middleware on admin routes |
| SQL injection | Taint analysis | Raw SQL query with user input at `db/queries.py:78` |
| XSS | Output encoding checks | Unescaped user input in template at `templates/profile.html:23` |
| CSRF | Token verification checks | Missing CSRF token on POST forms |
| Crypto | Algorithm detection | Using MD5 for password hashing at `auth/hash.py:15` |

#### Pillar 2: Maintainable

| Check | Method | Example Finding |
|---|---|---|
| Code complexity | Cyclomatic complexity (radon) | Function `process_data()` has complexity of 25 (threshold: 10) |
| Naming conventions | AST + naming pattern analysis | Variable `x` in `utils.py:34` — use descriptive names |
| Documentation | Docstring coverage analysis | Only 30% of public functions have docstrings |
| SOLID principles | Structural analysis | Class `UserManager` at 800 lines — violates SRP |
| Code duplication | Clone detection | 45-line block duplicated in 3 files |
| Consistent formatting | Style guide checks | Mixed tabs and spaces in `core/` directory |

#### Pillar 3: Scalable

| Check | Method | Example Finding |
|---|---|---|
| Stateless design | Session/global state detection | Global mutable state in `app.py:12` — use external store |
| Async patterns | Async/await usage analysis | Blocking I/O in async handler at `api/users.py:56` |
| DB queries | Query pattern analysis | N+1 query pattern in `services/orders.py:89` |
| Caching | Cache usage detection | No caching on expensive DB query in `reports.py:34` |
| Connection pooling | Connection management check | New DB connection per request in `db.py:23` |
| Horizontal scalability | Architecture pattern detection | File-based sessions prevent horizontal scaling |

#### Pillar 4: Observable

| Check | Method | Example Finding |
|---|---|---|
| Structured logging | Log statement analysis | Using `print()` instead of structured logger |
| Log levels | Log level usage analysis | All logs at INFO level — no DEBUG/WARNING/ERROR |
| Health checks | Endpoint detection | No `/health` or `/ready` endpoint found |
| Metrics | Metrics library detection | No Prometheus/StatsD metrics exported |
| Correlation IDs | Request tracing analysis | No request ID propagation across services |
| Error tracking | Error handling analysis | Bare `except:` clauses swallow errors at 5 locations |

#### Pillar 5: Testable

| Check | Method | Example Finding |
|---|---|---|
| Test existence | Test file detection | No test files found for `services/` module |
| Test coverage | Coverage estimation | Estimated coverage: 35% (target: 80%) |
| Dependency injection | Constructor analysis | Hard-coded dependencies in `OrderService.__init__` |
| Mock-ability | External call detection | Direct HTTP calls without abstraction in `api_client.py` |
| Test isolation | Test dependency analysis | Tests depend on external database |
| Test naming | Test method analysis | Tests lack descriptive names (`test_1`, `test_2`) |

#### Pillar 6: Modular

| Check | Method | Example Finding |
|---|---|---|
| Coupling | Import graph analysis | Circular dependency between `auth/` and `users/` |
| Cohesion | Module responsibility check | `utils.py` contains 50 unrelated functions |
| Interface boundaries | Public API analysis | Internal functions exposed in module `__init__.py` |
| Package structure | Directory analysis | Flat structure with 100+ files — needs package organization |
| Dependency direction | Layered architecture check | Data layer imports from presentation layer |
| Configuration | Config management check | Configuration scattered across 12 files |

#### Pillar 7: Efficient

| Check | Method | Example Finding |
|---|---|---|
| Algorithm complexity | Big-O estimation | O(n³) nested loop in `matcher.py:23` — consider hashmap |
| Memory usage | Allocation pattern detection | Loading entire file into memory at `processor.py:56` |
| Unnecessary computation | Dead code / redundancy detection | Same calculation performed 3 times in loop body |
| I/O optimization | I/O pattern analysis | Sequential API calls that could be parallelized |
| Resource cleanup | Resource management check | File handle not closed at `file_handler.py:78` |
| Data structure choice | Collection usage analysis | Using list for lookups — use set/dict for O(1) access |

### 11.2 Scoring System

Each pillar is scored on a 0–100 scale:

| Score | Grade | Meaning |
|---|---|---|
| 90–100 | A | Excellent — production-ready |
| 80–89 | B | Good — minor improvements recommended |
| 70–79 | C | Acceptable — several areas need attention |
| 60–69 | D | Below standard — significant improvements needed |
| 0–59 | F | Failing — critical issues must be addressed |

**Overall Score** = Weighted average of all pillars:
- Secure: **20%** (highest weight — security is paramount)
- Efficient: **15%**
- Scalable: **15%**
- Maintainable: **12.5%**
- Modular: **12.5%**
- Testable: **12.5%**
- Observable: **12.5%**

---

## 12. Cloud Configuration & Provider Recommendation Engine

### 12.1 Application Profiling

Before recommending infrastructure, the system profiles the application:

```
┌─────────────────────────────────────────────────┐
│              Application Profile                 │
│                                                  │
│  Type:        Web API (REST)                     │
│  Language:    Python 3.11                         │
│  Framework:   FastAPI                            │
│  Database:    PostgreSQL (detected in code)       │
│  Cache:       Redis (detected in requirements)   │
│  Queue:       Celery (detected)                  │
│  Storage:     S3-compatible (detected)           │
│  ML:          None detected                      │
│                                                  │
│  Estimated:                                      │
│  • RPS:       100–1,000                          │
│  • Data Size: 10–100 GB                          │
│  • Users:     1,000–10,000                       │
│  • Compute:   CPU-bound                          │
│  • I/O:       Moderate                           │
└─────────────────────────────────────────────────┘
```

### 12.2 Provider Comparison Matrix

```
╔══════════════════╦══════════╦══════════╦══════════╗
║ Dimension        ║   AWS    ║   GCP    ║  Azure   ║
╠══════════════════╬══════════╬══════════╬══════════╣
║ Compute          ║ ECS      ║ Cloud Run║ ACA      ║
║ Monthly Cost     ║ $180     ║ $145     ║ $195     ║
║ Database         ║ RDS      ║ Cloud SQL║ Azure DB ║
║ Monthly Cost     ║ $85      ║ $72      ║ $92      ║
║ Cache            ║ ElastiC  ║ MemStore ║ Az Cache ║
║ Monthly Cost     ║ $30      ║ $35      ║ $28      ║
║ ─────────────    ║──────────║──────────║──────────║
║ Total Monthly    ║ $295     ║ $252     ║ $315     ║
║ Annual           ║ $3,540   ║ $3,024   ║ $3,780   ║
║ ─────────────    ║──────────║──────────║──────────║
║ Fit Score        ║ 85/100   ║ 92/100   ║ 78/100   ║
║ Ease of Deploy   ║ ★★★☆☆   ║ ★★★★☆   ║ ★★★☆☆   ║
║ Free Tier        ║ 12 mo    ║ Always   ║ 12 mo    ║
╚══════════════════╩══════════╩══════════╩══════════╝
```

### 12.3 Visualization Outputs

The platform generates the following visual graphs for the user:

1. **Radar Chart** — 7-pillar scores visualization
2. **Cost Comparison Bar Chart** — Monthly costs across providers
3. **Cost Projection Line Chart** — 12-month cost projection with growth scenarios
4. **Architecture Diagram** — Recommended cloud architecture (auto-generated)
5. **Severity Distribution Pie Chart** — Security findings by severity
6. **Resource Utilization Heatmap** — Estimated resource usage over time

---

## 13. Security Vulnerability Detection

### 13.1 Multi-Layer Security Scanning

```
Layer 1: Static Application Security Testing (SAST)
├── AST-based pattern matching
├── Taint analysis (source → sink tracking)
├── Framework-specific rule engines
└── Custom rules (admin-configurable)

Layer 2: Software Composition Analysis (SCA)
├── Dependency tree resolution
├── CVE database matching (NVD, OSV, GitHub Advisory)
├── License compliance checking
└── Outdated dependency detection

Layer 3: Secret Detection
├── High-entropy string detection
├── Known secret patterns (API keys, tokens, passwords)
├── Git history scanning (if repo connected)
└── Environment variable analysis

Layer 4: Infrastructure-as-Code (IaC) Scanning
├── Terraform / CloudFormation analysis
├── Dockerfile security checks
├── Kubernetes manifest validation
└── CI/CD pipeline security review

Layer 5: AI-Powered Contextual Analysis
├── LLM-based logic vulnerability detection
├── Business logic flaw identification
├── Attack surface mapping
└── RAG-enhanced threat intelligence
```

### 13.2 Severity Classification

| Level | Meaning | Example | Action Required |
|---|---|---|---|
| **CRITICAL** | Immediate exploitation risk | Hardcoded database credentials | Block deployment |
| **HIGH** | Significant vulnerability | SQL injection vector | Fix before production |
| **MEDIUM** | Moderate risk, exploitation requires conditions | Missing rate limiting | Fix in next sprint |
| **LOW** | Minor issue, minimal risk | Verbose error messages | Fix when convenient |
| **INFO** | Informational, best practice suggestion | Consider adding CSP headers | Optional improvement |

---

## 14. User-Facing Features

### 14.1 User Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  CloudWise AI Dashboard                    [user@email.com]  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  New Analysis                                            │ │
│  │                                                          │ │
│  │  [📁 Upload Code]  [🔗 Connect GitHub]                   │ │
│  │  [🔗 Connect GitLab]  [🔗 Connect Google Drive]          │ │
│  │                                                          │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  Recent Analyses                                             │
│  ┌────────────────┬──────────┬───────────┬────────────────┐ │
│  │ Project        │ Score    │ Date      │ Status         │ │
│  ├────────────────┼──────────┼───────────┼────────────────┤ │
│  │ my-api-v2      │ 78/100 B │ 2026-02-17│ ✅ Complete    │ │
│  │ frontend-app   │ 65/100 C │ 2026-02-15│ ✅ Complete    │ │
│  │ ml-pipeline    │ —        │ 2026-02-17│ ⏳ Processing  │ │
│  └────────────────┴──────────┴───────────┴────────────────┘ │
│                                                              │
│  [📊 View Full Report]  [⬇️ Download PDF]  [🔄 Re-analyze]  │
└──────────────────────────────────────────────────────────────┘
```

### 14.2 Analysis Report View

```
┌──────────────────────────────────────────────────────────────┐
│  Analysis Report: my-api-v2                                  │
│                                                              │
│  Overall Score: 78/100 (B)                 🕐 Analyzed in 45s│
│                                                              │
│  ┌─── 7 Pillars Radar Chart ───────────┐                    │
│  │         Secure (65)                  │                    │
│  │           ╱╲                         │                    │
│  │    Eff   /  \   Maint               │                    │
│  │   (68)  /    \  (80)                │                    │
│  │        /  ██  \                      │                    │
│  │       /   ██   \                     │                    │
│  │  Mod─/────██────\─Test              │                    │
│  │ (85) \    ██    / (75)              │                    │
│  │       \   ██   /                     │                    │
│  │    Obs \  ██  / Scale               │                    │
│  │   (55)  \██/ (70)                   │                    │
│  └──────────────────────────────────────┘                    │
│                                                              │
│  🔴 3 Critical  🟠 5 High  🟡 12 Medium  🔵 8 Low          │
│                                                              │
│  [Security Tab] [Best Practices Tab] [Cloud Config Tab]      │
│  [Deployment Guide Tab] [Full Report PDF]                    │
└──────────────────────────────────────────────────────────────┘
```

### 14.3 Code Connection Flows

#### GitHub / GitLab Integration
1. User clicks "Connect GitHub/GitLab"
2. OAuth2 flow redirects to provider
3. User authorizes read-only access to selected repositories
4. Platform fetches code into ephemeral processing container
5. Analysis runs
6. Ephemeral container is destroyed (code is gone)
7. Only the analysis report (no code) is retained

#### Google Drive Integration
1. User clicks "Connect Google Drive"
2. OAuth2 flow with Google
3. User selects folder/files containing code
4. Platform downloads into ephemeral container
5. Same processing and destruction flow

#### Direct Upload
1. User uploads ZIP/tarball (max 500 MB)
2. File is streamed directly to ephemeral processing container
3. Never touches persistent storage
4. Same processing and destruction flow

---

## 15. Admin Panel

### 15.1 Admin Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  CloudWise AI — Admin Panel                    [Admin User]  │
│                                                              │
│  ┌─────────┬─────────────┬──────────┬─────────────────────┐ │
│  │ Overview│ Agent Mgmt  │ RAG Docs │ System Health        │ │
│  └─────────┴─────────────┴──────────┴─────────────────────┘ │
│                                                              │
│  Platform Metrics (Last 24h)                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Analyses    │ │ Active Users│ │ Avg. Score  │           │
│  │    127      │ │    84       │ │   72/100    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
│  Agent Performance                                           │
│  ┌────────────────────┬─────────┬──────────┬─────────────┐  │
│  │ Agent              │ Success │ Avg Time │ Tokens/Run  │  │
│  ├────────────────────┼─────────┼──────────┼─────────────┤  │
│  │ Planner            │  99.2%  │  2.3s    │   1,200     │  │
│  │ Security Analyst   │  97.8%  │  12.5s   │   8,500     │  │
│  │ Best Practices     │  98.5%  │  15.2s   │   10,200    │  │
│  │ Cloud Config       │  96.3%  │  8.7s    │   6,800     │  │
│  │ Critic             │  99.7%  │  5.1s    │   4,300     │  │
│  │ Report Generator   │  99.9%  │  3.8s    │   3,100     │  │
│  └────────────────────┴─────────┴──────────┴─────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 15.2 API Key Management

```
┌──────────────────────────────────────────────────────────────┐
│  API Key Management                                          │
│                                                              │
│  ┌────────────────┬──────────────┬──────────┬─────────────┐ │
│  │ Agent/Service  │ Key (masked) │ Status   │ Actions     │ │
│  ├────────────────┼──────────────┼──────────┼─────────────┤ │
│  │ OpenAI GPT-4   │ sk-...3xKm  │ 🟢 Active│ [Rotate][❌]│ │
│  │ Anthropic      │ sk-...9pLq  │ 🟢 Active│ [Rotate][❌]│ │
│  │ GitHub OAuth   │ ghp-...7mNw │ 🟢 Active│ [Rotate][❌]│ │
│  │ GCP Pricing    │ AIza...4kRt │ 🟡 Expiring│[Rotate][❌]│ │
│  │ AWS Pricing    │ AKIA...6jWs │ 🔴 Expired│ [Renew][❌] │ │
│  └────────────────┴──────────────┴──────────┴─────────────┘ │
│                                                              │
│  [+ Add New API Key]                                         │
│                                                              │
│  Key Rotation Policy: Every 90 days (configurable)           │
│  Encryption: AES-256-GCM at rest, TLS 1.3 in transit        │
└──────────────────────────────────────────────────────────────┘
```

### 15.3 RAG Document Management

```
┌──────────────────────────────────────────────────────────────┐
│  RAG Knowledge Base Management                               │
│                                                              │
│  ┌───────────────────┬─────────┬──────────┬──────────────┐  │
│  │ Collection        │ Docs    │ Chunks   │ Last Updated │  │
│  ├───────────────────┼─────────┼──────────┼──────────────┤  │
│  │ AWS Documentation │  342    │ 15,230   │ 2026-02-15   │  │
│  │ GCP Documentation │  287    │ 12,450   │ 2026-02-14   │  │
│  │ Azure Docs        │  305    │ 13,890   │ 2026-02-13   │  │
│  │ OWASP Guidelines  │   48    │  2,340   │ 2026-02-10   │  │
│  │ Best Practices    │  156    │  7,820   │ 2026-02-08   │  │
│  │ Pricing Data      │   24    │  1,150   │ 2026-02-17   │  │
│  └───────────────────┴─────────┴──────────┴──────────────┘  │
│                                                              │
│  [📤 Upload New Documents]  [🔄 Refresh All]  [🗑️ Purge]    │
│                                                              │
│  Upload supports: PDF, Markdown, HTML, TXT, DOCX             │
│  Auto-processing: Chunking → Embedding → Indexing            │
└──────────────────────────────────────────────────────────────┘
```

### 15.4 Admin Capabilities Summary

| Capability | Description |
|---|---|
| **API Key CRUD** | Add, view (masked), rotate, revoke API keys for LLM providers and external services |
| **Agent Configuration** | Enable/disable agents, adjust parameters, set tool permissions |
| **RAG Document Management** | Upload, remove, re-index documentation for RAG knowledge bases |
| **User Management** | View users, suspend accounts, view usage statistics |
| **Agent Performance Monitoring** | Success rates, latency, token usage, error rates per agent |
| **System Health** | Infrastructure metrics, queue depths, error rates |
| **Audit Logs** | Full audit trail of all admin actions |
| **Cost Tracking** | LLM token costs, infrastructure costs, per-analysis cost breakdown |

---

## 16. Authentication & Authorization

### 16.1 Authentication Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Authentication Flow                        │
│                                                              │
│  Step 1: Registration                                        │
│  ┌──────────────┐                                            │
│  │ Email +      │ → Server validates → Create account        │
│  │ Password     │   (strength check)   (bcrypt hash)         │
│  └──────────────┘                                            │
│                                                              │
│  Step 2: 2FA Setup (Mandatory)                               │
│  ┌──────────────┐                                            │
│  │ Generate     │ → Show QR code → User scans with          │
│  │ TOTP secret  │   (otpauth://)   Google Auth / Authy      │
│  └──────────────┘                                            │
│                                                              │
│  Step 3: Login                                               │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │ Email +      │ → │ Verify TOTP  │ → │ Issue JWT    │    │
│  │ Password     │   │ Code (6-dig) │   │ Access +     │    │
│  │              │   │              │   │ Refresh Token│    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│                                                              │
│  Step 4: Session Management                                  │
│  • Access Token: 15 min TTL (JWT, signed with RS256)         │
│  • Refresh Token: 7 day TTL (stored in HTTP-only cookie)     │
│  • Token rotation on each refresh                            │
│  • Concurrent session limit: 3 devices                       │
└──────────────────────────────────────────────────────────────┘
```

### 16.2 Authorization (RBAC)

| Role | Permissions |
|---|---|
| **User** | Upload code, connect repos, view own analyses, download reports |
| **Admin** | All user permissions + manage API keys, manage RAG docs, view all analytics, manage users |
| **Super Admin** | All admin permissions + manage admin accounts, system configuration |

### 16.3 Security Measures

| Measure | Implementation |
|---|---|
| **Password Policy** | Min 12 chars, uppercase, lowercase, number, special char |
| **2FA** | TOTP-based (RFC 6238), mandatory for all users |
| **JWT Security** | RS256 signing, short-lived tokens, refresh rotation |
| **Brute Force Protection** | 5 failed attempts → 15 min lockout, progressive delays |
| **Session Security** | HTTP-only, Secure, SameSite=Strict cookies |
| **CORS** | Strict origin whitelist, no wildcards |
| **Rate Limiting** | Per-user, per-endpoint rate limits |
| **Input Sanitization** | All inputs validated and sanitized server-side |

### 16.4 Enhanced Authentication Flow (Strict Session Management)

To ensure maximum security around session termination (the "Close Tab = Logout" requirement):

1. **Session Storage for Tokens**: Access and Refresh tokens are stored in `sessionStorage` on the client side. This storage is inherently cleared by the browser when the tab or window is closed.
2. **Zombie Cookie Cleanup**: If a user returns to the application with a lingering HttpOnly cookie (which persists across tab closures) but *without* the corresponding `sessionStorage` tokens, the application interprets this as an inconsistent state (likely a closed tab). It immediately:
    - Invalidates the session on the backend.
    - Clears the lingering cookies.
    - Redirects the user to the login page with a "Session Expired" notification.
3. **Dedicated 2FA Setup**: The 2FA setup process has been moved to a dedicated, isolated page (`/2fa-setup`) to prevent state leaks and ensure users complete the process before accessing the dashboard.

---

## 17. Data Privacy & Peer-to-Peer Architecture

### 17.1 Zero-Persistence Guarantee

```
┌─────────────────────────────────────────────────────────────────┐
│                   Data Flow — Zero Persistence                   │
│                                                                  │
│  User Code Journey:                                              │
│                                                                  │
│  [Upload/Fetch] → [Ephemeral Container] → [Analysis] → [Delete] │
│                          │                     │                  │
│                          │                     ▼                  │
│                    Code NEVER                Analysis             │
│                    touches disk              Results              │
│                    (RAM-only or             (No code              │
│                     encrypted tmpfs)        content,              │
│                                            only findings)         │
│                                                                  │
│  What IS stored (server-side):                                   │
│  ✅ User account info (email, hashed password, 2FA secret)       │
│  ✅ Analysis reports (findings, scores, recommendations)          │
│  ✅ Audit logs (who did what, when)                               │
│  ✅ Agent execution traces (for observability)                    │
│                                                                  │
│  What is NEVER stored:                                           │
│  ❌ Source code                                                   │
│  ❌ Repository contents                                           │
│  ❌ File contents                                                 │
│  ❌ Code snippets (beyond small evidence excerpts in findings)   │
│  ❌ OAuth tokens (ephemeral, used once, discarded)               │
└─────────────────────────────────────────────────────────────────┘
```

### 17.2 Ephemeral Processing Architecture

```
┌──────────────────────────────────────────────┐
│         Ephemeral Processing Pod              │
│                                               │
│  ┌──────────────────────────────────────────┐ │
│  │  Encrypted tmpfs (RAM-backed filesystem) │ │
│  │  • Max 500 MB                            │ │
│  │  • Auto-wipe on container exit           │ │
│  │  • No swap (memory-locked)               │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  ┌──────────────────────────────────────────┐ │
│  │  Analysis Runner                         │ │
│  │  • Network-isolated (no egress except    │ │
│  │    to internal agent services)            │ │
│  │  • Read-only code access                 │ │
│  │  • Time-limited (max 5 min)              │ │
│  │  • Non-root, minimal permissions         │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  Lifecycle: Create → Process → Destroy        │
│  Max TTL: 5 minutes                           │
│  Cleanup: Guaranteed (Kubernetes Job + TTL)   │
└──────────────────────────────────────────────┘
```

---

## 18. API Design & Input/Output Schemas

### 18.1 API Endpoints

```
Authentication
  POST   /api/v1/auth/register          Register new user
  POST   /api/v1/auth/login             Login (email + password)
  POST   /api/v1/auth/verify-2fa        Verify TOTP code
  POST   /api/v1/auth/refresh           Refresh access token
  POST   /api/v1/auth/logout            Logout (revoke tokens)
  POST   /api/v1/auth/setup-2fa         Initialize 2FA setup
  
Analysis
  POST   /api/v1/analysis/upload        Upload code for analysis
  POST   /api/v1/analysis/connect       Connect repo (GitHub/GitLab/Drive)
  GET    /api/v1/analysis/{id}          Get analysis status/result
  GET    /api/v1/analysis/{id}/report   Get full report
  GET    /api/v1/analysis/{id}/pdf      Download PDF report
  GET    /api/v1/analysis/history       List user's analyses
  POST   /api/v1/analysis/{id}/rerun    Re-run analysis
  
User
  GET    /api/v1/user/profile           Get user profile
  PUT    /api/v1/user/profile           Update user profile
  GET    /api/v1/user/connections       List connected repos
  DELETE /api/v1/user/connections/{id}  Remove repo connection

Admin
  GET    /api/v1/admin/dashboard        Admin dashboard metrics
  GET    /api/v1/admin/agents           List agent configurations
  PUT    /api/v1/admin/agents/{id}      Update agent configuration
  GET    /api/v1/admin/api-keys         List API keys (masked)
  POST   /api/v1/admin/api-keys         Add new API key
  PUT    /api/v1/admin/api-keys/{id}    Rotate API key
  DELETE /api/v1/admin/api-keys/{id}    Revoke API key
  GET    /api/v1/admin/rag/collections  List RAG collections
  POST   /api/v1/admin/rag/documents    Upload RAG document
  DELETE /api/v1/admin/rag/documents/{id} Remove RAG document
  POST   /api/v1/admin/rag/reindex      Trigger re-indexing
  GET    /api/v1/admin/users            List all users
  PUT    /api/v1/admin/users/{id}       Update user (suspend, role change)
  GET    /api/v1/admin/audit-log        View audit log
  GET    /api/v1/admin/performance      Agent performance metrics
  
Payments & Billing
  POST   /api/v1/payments/create-intent       Create payment intent (per-project)
  POST   /api/v1/payments/confirm              Confirm payment
  GET    /api/v1/payments/history              User payment history
  GET    /api/v1/payments/invoices             List invoices
  GET    /api/v1/payments/invoices/{id}/pdf    Download invoice PDF
  
Subscriptions
  GET    /api/v1/subscriptions/plans           List available plans
  POST   /api/v1/subscriptions/create          Create subscription
  PUT    /api/v1/subscriptions/update          Upgrade/downgrade plan
  DELETE /api/v1/subscriptions/cancel          Cancel subscription
  GET    /api/v1/subscriptions/current         Get current subscription + usage
  GET    /api/v1/subscriptions/usage           Get analysis usage this period

Webhooks (Internal)
  POST   /api/v1/webhooks/stripe               Stripe event handler

Admin — Revenue
  GET    /api/v1/admin/revenue/dashboard       Revenue metrics
  GET    /api/v1/admin/revenue/transactions    All transactions
  POST   /api/v1/admin/revenue/refund          Issue refund
  GET    /api/v1/admin/revenue/mrr             Monthly recurring revenue

Health
  GET    /api/v1/health                 Health check
  GET    /api/v1/health/ready           Readiness probe
  GET    /api/v1/health/live            Liveness probe
```

### 18.2 Key Request/Response Schemas

#### Analysis Upload Request
```json
POST /api/v1/analysis/upload
Content-Type: multipart/form-data

{
  "file": "<binary ZIP/tarball>",
  "preferences": {
    "detail_level": "standard | detailed | executive",
    "focus_areas": ["security", "efficiency"],
    "target_providers": ["aws", "gcp", "azure"],
    "expected_scale": {
      "users": "1000-10000",
      "requests_per_second": "100-500"
    }
  }
}
```

#### Analysis Response
```json
{
  "analysis_id": "uuid",
  "status": "queued | processing | completed | failed",
  "created_at": "ISO-8601",
  "estimated_completion": "ISO-8601",
  "progress": {
    "planner": "completed",
    "security_analyst": "in_progress",
    "best_practices_auditor": "in_progress",
    "cloud_config_advisor": "pending",
    "critic": "pending",
    "report_generator": "pending"
  }
}
```

---

## 19. Security Hardening (Blue Team)

### 19.1 Secure API Key Management

```python
# API keys are encrypted at rest using AES-256-GCM
# Decrypted only in-memory when needed by an agent
# Never logged, never included in error messages

class SecureKeyVault:
    """
    - Keys stored encrypted in PostgreSQL
    - Master key in cloud KMS (AWS KMS / GCP Cloud KMS / Azure Key Vault)
    - Key rotation enforced every 90 days
    - Access logged in audit trail
    - Keys are never returned in full via API (always masked)
    """
```

### 19.2 Prompt Injection Prevention

```
┌──────────────────────────────────────────────────────────────┐
│                Prompt Injection Defense Layers                │
│                                                              │
│  Layer 1: Input Sanitization                                 │
│  • Strip known injection patterns from code comments         │
│  • Detect and flag suspicious prompt-like content            │
│  • Character-level filtering for control characters          │
│                                                              │
│  Layer 2: Prompt Templating                                  │
│  • System prompts are hardcoded (not user-influenced)        │
│  • User content is always in {user_content} variable         │
│  • Clear delimiter between instructions and data             │
│                                                              │
│  Layer 3: Output Validation                                  │
│  • All LLM outputs parsed through strict JSON schemas        │
│  • Free-text fields length-limited and content-filtered      │
│  • Tool call validation (only allowed tools can execute)     │
│                                                              │
│  Layer 4: Behavioral Monitoring                              │
│  • Anomaly detection on agent behavior                       │
│  • Alert on unexpected tool calls or output patterns         │
│  • Automatic circuit-breaker on suspicious activity          │
└──────────────────────────────────────────────────────────────┘
```

### 19.3 Tool Output Validation

Every tool invocation goes through a validation pipeline:

```python
class ToolOutputValidator:
    def validate(self, tool_name: str, output: Any) -> ValidatedOutput:
        # 1. Schema validation — output matches expected JSON schema
        self.validate_schema(tool_name, output)
        
        # 2. Size validation — output within expected bounds
        self.validate_size(output, max_bytes=1_000_000)
        
        # 3. Content sanitization — remove any PII, secrets
        output = self.sanitize_content(output)
        
        # 4. Injection detection — check for prompt injection in outputs
        self.detect_injection(output)
        
        # 5. Consistency check — output makes sense for the tool
        self.validate_consistency(tool_name, output)
        
        return ValidatedOutput(data=output, is_safe=True)
```

### 19.4 Complete Security Checklist

| Category | Measure | Status |
|---|---|---|
| **Authentication** | Email + Password + TOTP 2FA | Required |
| **Authorization** | RBAC (User / Admin / Super Admin) | Required |
| **Transport** | TLS 1.3 everywhere | Required |
| **Data at Rest** | AES-256-GCM encryption | Required |
| **API Keys** | Encrypted storage, 90-day rotation | Required |
| **Input Validation** | Pydantic schemas on all endpoints | Required |
| **Prompt Injection** | 4-layer defense | Required |
| **Output Validation** | Schema + size + content validation | Required |
| **Rate Limiting** | Per-user, per-endpoint | Required |
| **CORS** | Strict origin whitelist | Required |
| **CSP** | Content Security Policy headers | Required |
| **Logging** | No PII/secrets in logs | Required |
| **Dependency Scanning** | CI/CD pipeline with Dependabot/Snyk | Required |
| **Penetration Testing** | Pre-launch and quarterly | Required |
| **Incident Response** | Documented runbook | Required |

## 19.5 Enterprise Security Hardening (Infrastructure & Application Layer)

We have implemented strict enterprise-grade security controls directly in the application code and infrastructure.

### 19.5.1 Advanced Rate Limiting (Distributed)

To prevent brute force, credential stuffing, and Denial of Service (DoS) attacks, we employ a **Redis-backed distributed rate limiter**.

- **Global Limit**: `200 requests/minute` per IP address.
- **Sensitive Endpoint Limits**:
  - `/api/v1/auth/login`: `10 requests/minute` (Prevents brute force on accounts).
  - `/api/v1/auth/register`: `5 requests/minute` (Prevents bot account creation).
  - `/api/v1/analysis/upload`: `5 requests/minute` (Prevents resource exhaustion via large file uploads).

### 19.5.2 Frontend Content Security Policy (CSP) & Headers

To mitigate Cross-Site Scripting (XSS), Clickjacking, and data exfiltration, the following strict headers are injected into every frontend response via `next.config.js`:

| Header | Value | Purpose |
|---|---|---|
| **Content-Security-Policy** | `default-src 'self'; script-src 'self' ...` | Restrict resource loading to trusted domains. |
| **Strict-Transport-Security** | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years. |
| **X-Frame-Options** | `SAMEORIGIN` | Prevent clickjacking (iframe embedding). |
| **X-Content-Type-Options** | `nosniff` | Prevent MIME-sniffing attacks. |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Protect user privacy/URL data. |
| **Permissions-Policy** | `geolocation=(), camera=(), microphone=()` | Disable unused browser features. |

### 19.5.3 Host Header Validation

To prevent Host Header Injection attacks (which can lead to cache poisoning or password reset link manipulation), the backend includes `TrustedHostMiddleware`.

- **Configuration**: The API *only* responds to requests where the `Host` header matches the configured domain (e.g., `api.cloudwise.ai`) or `localhost`.
- **Action**: All other requests are rejected immediately.

---

## 20. Observability, Logging & Monitoring

### 20.1 Three Pillars of Observability

```
┌──────────────────────────────────────────────────────────────┐
│              Observability Architecture                       │
│                                                              │
│  ┌─────────────────┐                                        │
│  │    TRACES        │  OpenTelemetry + LangSmith/LangFuse   │
│  │                  │  • End-to-end request tracing          │
│  │                  │  • Agent execution traces              │
│  │                  │  • LLM call traces (prompts, tokens)   │
│  │                  │  • Tool invocation traces              │
│  │                  │  • Cross-agent correlation IDs         │
│  └─────────────────┘                                        │
│                                                              │
│  ┌─────────────────┐                                        │
│  │    METRICS       │  Prometheus + Grafana                  │
│  │                  │  • Request latency (p50, p95, p99)     │
│  │                  │  • Agent success/failure rates         │
│  │                  │  • Token consumption per agent         │
│  │                  │  • Queue depths and processing times   │
│  │                  │  • Cost per analysis                   │
│  │                  │  • Active users, analyses/day          │
│  └─────────────────┘                                        │
│                                                              │
│  ┌─────────────────┐                                        │
│  │    LOGS          │  Structured JSON logging               │
│  │                  │  • Request/response logs               │
│  │                  │  • Agent decision logs                 │
│  │                  │  • Error logs with stack traces        │
│  │                  │  • Audit logs (admin actions)          │
│  │                  │  • Security event logs                 │
│  └─────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

### 20.2 Key Metrics & Alerts

| Metric | Alert Threshold | Action |
|---|---|---|
| Analysis error rate | > 5% in 5 min | Page on-call engineer |
| Agent latency (p99) | > 60s | Warning alert |
| LLM API error rate | > 10% in 1 min | Fallback to secondary provider |
| Queue depth | > 50 pending | Scale up workers |
| Memory usage | > 85% | Scale up / investigate leak |
| API response time (p95) | > 2s | Warning + investigation |
| Failed 2FA attempts | > 10/user/hour | Lock account + security alert |
| Unusual token usage | > 3x average | Cost alert + investigation |

### 20.3 Execution Logging Schema

```json
{
  "log_type": "agent_execution",
  "timestamp": "ISO-8601",
  "trace_id": "uuid",
  "span_id": "uuid",
  "correlation_id": "uuid (user request)",
  "agent": {
    "id": "security_analyst_agent",
    "instance": "sa-001"
  },
  "event": "tool_invocation",
  "data": {
    "tool": "static_analysis_scanner",
    "input_summary": "Scan Python files for OWASP top-10",
    "output_summary": "Found 3 HIGH, 2 MEDIUM findings",
    "execution_time_ms": 2345,
    "tokens_used": 450,
    "success": true
  },
  "decision_reasoning": "Chose OWASP ruleset based on detected web framework (FastAPI)"
}
```

---

## 21. Decision Explainability (XAI)

### 21.1 Explainability Framework

Every recommendation and finding includes an explanation chain:

```json
{
  "finding": {
    "title": "Recommend GCP Cloud Run over AWS ECS",
    "explanation_chain": [
      {
        "step": 1,
        "reasoning": "Application is a Python FastAPI service — GCP has first-class Python support",
        "evidence": "Detected FastAPI framework in requirements.txt",
        "confidence": 0.95
      },
      {
        "step": 2,
        "reasoning": "Application is stateless — ideal for serverless containers",
        "evidence": "No session state or local file storage detected in code",
        "confidence": 0.88
      },
      {
        "step": 3,
        "reasoning": "GCP Cloud Run has lower cost for 100-1000 RPS workloads",
        "evidence": "Pricing comparison from RAG: Cloud Run $0.00002400/vCPU-second vs ECS Fargate $0.04048/vCPU-hour",
        "confidence": 0.92,
        "source": "GCP Pricing Docs (retrieved 2026-02-17)"
      },
      {
        "step": 4,
        "reasoning": "Cloud Run has simpler deployment (no cluster management)",
        "evidence": "Deployment complexity scoring: Cloud Run 2/10, ECS 5/10",
        "confidence": 0.90
      }
    ],
    "overall_confidence": 0.91,
    "alternative_considered": "AWS ECS Fargate — viable but higher cost and complexity",
    "human_readable": "We recommend GCP Cloud Run because your Python FastAPI app is stateless, making it ideal for serverless containers. Cloud Run offers lower costs at your expected scale (100-1000 RPS) and significantly simpler deployment compared to AWS ECS."
  }
}
```

### 21.2 Confidence Scoring

Every agent output includes confidence scores:

| Score Range | Meaning | Display |
|---|---|---|
| 0.90 – 1.00 | Very High Confidence | Strong recommendation |
| 0.75 – 0.89 | High Confidence | Recommendation with notes |
| 0.60 – 0.74 | Moderate Confidence | Suggestion (verify manually) |
| 0.40 – 0.59 | Low Confidence | Possible concern (needs human review) |
| 0.00 – 0.39 | Very Low Confidence | Flagged for manual review only |

---

## 22. Technology Stack

### 22.1 Complete Stack

| Layer | Technology | Justification |
|---|---|---|
| **Frontend** | Next.js 14 (React) + TypeScript | SSR, great DX, TypeScript safety |
| **UI Components** | shadcn/ui + Tailwind CSS | Production-quality, accessible components |
| **Charts** | Recharts / D3.js | Flexible, performant data visualization |
| **Backend API** | FastAPI (Python) | Async, Pydantic validation, OpenAPI docs |
| **Agent Framework** | LangGraph + LangChain | State machines, tool orchestration, production-ready |
| **LLM Providers** | OpenAI GPT-4o, Anthropic Claude 3.5 | Multi-model for redundancy and cost optimization |
| **Vector Database** | ChromaDB (dev) / Pinecone (prod) | Scalable vector search for RAG |
| **Primary Database** | PostgreSQL 16 | Robust, feature-rich relational database |
| **Cache** | Redis 7 | Sessions, rate limiting, ephemeral caching |
| **Message Queue** | Redis Streams / RabbitMQ | Async task processing |
| **Object Storage** | MinIO (dev) / S3 (prod) | Temporary code storage (ephemeral) |
| **Payments** | Stripe (Checkout, Billing, Webhooks) | PCI-compliant, global payment methods |
| **Auth** | Custom JWT + PyOTP (TOTP) | Full control, TOTP-based 2FA |
| **Observability** | OpenTelemetry + LangSmith | Distributed tracing, LLM-specific observability |
| **Metrics** | Prometheus + Grafana | Industry-standard metrics and dashboards |
| **Logging** | Structlog (Python) | Structured JSON logging |
| **Containerization** | Docker + Docker Compose (dev) | Reproducible environments |
| **Orchestration** | Kubernetes (prod) | Scalability, ephemeral pod management |
| **CI/CD** | GitHub Actions | Automated testing, deployment |
| **IaC** | Terraform | Infrastructure as Code |
| **MCP** | Custom MCP Server (Python) | Model Context Protocol for tool management |

### 22.2 Project Structure

```
cloudwise-ai/
├── docs/                           # Documentation
│   └── PROJECT_DOCUMENTATION.md
├── frontend/                       # Next.js frontend
│   ├── src/
│   │   ├── app/                   # Next.js app router
│   │   │   ├── (auth)/            # Auth pages (login, register, 2fa)
│   │   │   ├── dashboard/         # User dashboard
│   │   │   ├── analysis/          # Analysis views
│   │   │   ├── admin/             # Admin panel
│   │   │   └── api/               # API routes (BFF)
│   │   ├── components/            # Reusable UI components
│   │   │   ├── ui/                # shadcn/ui components
│   │   │   ├── charts/            # Chart components
│   │   │   ├── reports/           # Report display components
│   │   │   └── layout/            # Layout components
│   │   ├── lib/                   # Frontend utilities
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── stores/                # State management (Zustand)
│   │   └── types/                 # TypeScript types
│   ├── public/                    # Static assets
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── backend/                        # FastAPI backend
│   ├── app/
│   │   ├── main.py                # FastAPI application entry
│   │   ├── config.py              # Configuration management
│   │   ├── api/                   # API endpoints
│   │   │   ├── v1/
│   │   │   │   ├── auth.py        # Auth endpoints
│   │   │   │   ├── analysis.py    # Analysis endpoints
│   │   │   │   ├── payments.py    # Payment endpoints
│   │   │   │   ├── subscriptions.py # Subscription endpoints
│   │   │   │   ├── webhooks.py    # Stripe webhook handler
│   │   │   │   ├── user.py        # User endpoints
│   │   │   │   ├── admin.py       # Admin endpoints
│   │   │   │   └── health.py      # Health checks
│   │   │   └── dependencies.py    # FastAPI dependencies
│   │   ├── models/                # SQLAlchemy models
│   │   │   ├── user.py
│   │   │   ├── analysis.py
│   │   │   ├── payment.py
│   │   │   ├── subscription.py
│   │   │   ├── api_key.py
│   │   │   └── audit_log.py
│   │   ├── schemas/               # Pydantic schemas
│   │   │   ├── auth.py
│   │   │   ├── analysis.py
│   │   │   ├── payment.py
│   │   │   ├── subscription.py
│   │   │   ├── report.py
│   │   │   └── admin.py
│   │   ├── services/              # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── analysis_service.py
│   │   │   ├── code_processor.py
│   │   │   ├── payment_service.py
│   │   │   ├── subscription_service.py
│   │   │   └── report_service.py
│   │   ├── middleware/            # FastAPI middleware
│   │   │   ├── auth.py            # JWT validation
│   │   │   ├── rate_limiter.py    # Rate limiting
│   │   │   ├── cors.py            # CORS configuration
│   │   │   └── prompt_guard.py    # Prompt injection filter
│   │   ├── security/             # Security utilities
│   │   │   ├── jwt.py
│   │   │   ├── totp.py
│   │   │   ├── encryption.py
│   │   │   └── key_vault.py
│   │   └── db/                   # Database
│   │       ├── session.py
│   │       ├── migrations/       # Alembic migrations
│   │       └── seed.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic.ini
├── agents/                         # Multi-agent system
│   ├── orchestrator/
│   │   ├── workflow.py            # LangGraph workflow definition
│   │   ├── state.py              # Shared state definition
│   │   └── supervisor.py         # Supervisor logic
│   ├── planner/
│   │   ├── agent.py              # Planner agent
│   │   ├── prompts.py            # Planner prompts
│   │   └── tools.py              # Planner tools
│   ├── security_analyst/
│   │   ├── agent.py              # Security analyst agent
│   │   ├── prompts.py
│   │   ├── tools.py
│   │   └── rules/                # Security rules
│   │       ├── owasp.py
│   │       ├── secrets.py
│   │       └── dependencies.py
│   ├── best_practices_auditor/
│   │   ├── agent.py              # Best practices auditor
│   │   ├── prompts.py
│   │   ├── tools.py
│   │   └── pillars/              # Per-pillar checkers
│   │       ├── secure.py
│   │       ├── maintainable.py
│   │       ├── scalable.py
│   │       ├── observable.py
│   │       ├── testable.py
│   │       ├── modular.py
│   │       └── efficient.py
│   ├── cloud_config_advisor/
│   │   ├── agent.py              # Cloud config agent
│   │   ├── prompts.py
│   │   ├── tools.py
│   │   └── providers/            # Provider-specific logic
│   │       ├── aws.py
│   │       ├── gcp.py
│   │       └── azure.py
│   ├── critic/
│   │   ├── agent.py              # Critic/validator agent
│   │   ├── prompts.py
│   │   └── validators.py
│   ├── report_generator/
│   │   ├── agent.py              # Report generator agent
│   │   ├── prompts.py
│   │   ├── templates/            # Report templates
│   │   └── charts.py             # Chart generation
│   └── common/
│       ├── base_agent.py         # Base agent class
│       ├── message.py            # A2A message format
│       ├── tool_validator.py     # Tool output validation
│       └── schemas.py            # Shared schemas
├── mcp_server/                     # MCP Server
│   ├── server.py                  # MCP server entry
│   ├── tool_registry.py          # Tool registration
│   ├── permission_enforcer.py    # Permission checks
│   └── tools/                    # Tool implementations
│       ├── code_analyzer.py
│       ├── static_scanner.py
│       ├── cloud_pricing.py
│       └── rag_query.py
├── rag/                            # RAG system
│   ├── ingestion/
│   │   ├── document_processor.py  # Document processing
│   │   ├── chunker.py            # Semantic chunking
│   │   └── embedder.py           # Embedding generation
│   ├── retrieval/
│   │   ├── retriever.py          # Vector search
│   │   ├── reranker.py           # Cross-encoder reranking
│   │   └── query_reformulator.py # Query optimization
│   ├── knowledge_bases/
│   │   ├── cloud_docs.py         # Cloud documentation KB
│   │   ├── security_kb.py        # Security knowledge KB
│   │   ├── best_practices_kb.py  # Best practices KB
│   │   └── pricing_kb.py         # Pricing data KB
│   └── verification/
│       └── claim_verifier.py     # Anti-hallucination verification
├── observability/                  # Observability configuration
│   ├── tracing.py                 # OpenTelemetry setup
│   ├── metrics.py                 # Prometheus metrics
│   ├── logging_config.py         # Structured logging setup
│   └── grafana/                   # Grafana dashboards (JSON)
│       ├── agent_performance.json
│       └── system_health.json
├── tests/                          # Test suite
│   ├── unit/
│   │   ├── agents/
│   │   ├── services/
│   │   └── security/
│   ├── integration/
│   │   ├── test_analysis_flow.py
│   │   ├── test_auth_flow.py
│   │   └── test_agent_communication.py
│   ├── e2e/
│   │   ├── test_full_analysis.py
│   │   └── test_admin_panel.py
│   └── conftest.py
├── infrastructure/                 # IaC & deployment
│   ├── docker/
│   │   ├── Dockerfile.frontend
│   │   ├── Dockerfile.backend
│   │   ├── Dockerfile.agents
│   │   └── Dockerfile.mcp
│   ├── docker-compose.yml         # Local development
│   ├── docker-compose.prod.yml   # Production
│   ├── kubernetes/               # K8s manifests
│   │   ├── deployments/
│   │   ├── services/
│   │   ├── configmaps/
│   │   └── secrets/
│   └── terraform/                # Terraform configs
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── .github/
│   └── workflows/
│       ├── ci.yml                # CI pipeline
│       ├── cd.yml                # CD pipeline
│       └── security-scan.yml     # Security scanning
├── .env.example                   # Environment variables template
├── README.md                      # Project README
├── Makefile                       # Development commands
└── pyproject.toml                 # Python project config
```

---

## 23. Database Design

### 23.1 Entity-Relationship Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    users     │     │    analyses      │     │  analysis_reports │
├──────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)      │──┐  │ id (PK)          │──┐  │ id (PK)          │
│ email        │  │  │ user_id (FK)     │  │  │ analysis_id (FK) │
│ password_hash│  └──│ status           │  └──│ report_type      │
│ totp_secret  │     │ source_type      │     │ data (JSONB)     │
│ role         │     │ source_ref       │     │ created_at       │
│ is_active    │     │ code_metadata    │     └──────────────────┘
│ stripe_cust_id│    │ preferences      │
│ created_at   │     │ overall_score    │     ┌──────────────────┐
│ updated_at   │     │ payment_id (FK)  │     │  api_keys        │
│ last_login   │     │ is_unlocked      │     ├──────────────────┤
└──────────────┘     │ created_at       │     │ id (PK)          │
                     │ completed_at     │     │ name             │
                     └──────────────────┘     │ encrypted_key    │
                                              │ provider         │
┌──────────────┐     ┌──────────────────┐     │ allowed_agents   │
│  audit_logs  │     │ agent_executions │     │ status           │
├──────────────┤     ├──────────────────┤     │ expires_at       │
│ id (PK)      │     │ id (PK)          │     │ rotated_at       │
│ user_id (FK) │     │ analysis_id (FK) │     │ created_by (FK)  │
│ action       │     │ agent_name       │     │ created_at       │
│ resource     │     │ status           │     └──────────────────┘
│ details      │     │ input_summary    │
│ ip_address   │     │ output_summary   │     ┌──────────────────┐
│ timestamp    │     │ tokens_used      │     │ rag_documents    │
└──────────────┘     │ execution_time_ms│     ├──────────────────┤
                     │ tool_calls       │     │ id (PK)          │
                     │ error_message    │     │ collection       │
                     │ trace_id         │     │ title            │
                     │ created_at       │     │ source_url       │
                     └──────────────────┘     │ file_path        │
                                              │ chunk_count      │
┌──────────────────┐                          │ status           │
│  user_connections│                          │ uploaded_by (FK) │
├──────────────────┤                          │ created_at       │
│ id (PK)          │                          │ updated_at       │
│ user_id (FK)     │                          └──────────────────┘
│ provider         │
│ access_token_enc │     ┌──────────────────┐
│ refresh_token_enc│     │    payments      │
│ scope            │     ├──────────────────┤
│ expires_at       │     │ id (PK)          │
│ created_at       │     │ user_id (FK)     │
└──────────────────┘     │ analysis_id (FK) │
                         │ stripe_payment_id│
┌──────────────────┐     │ amount_cents     │
│  subscriptions   │     │ currency         │
├──────────────────┤     │ status           │
│ id (PK)          │     │ payment_method   │
│ user_id (FK)     │     │ receipt_url      │
│ stripe_sub_id    │     │ created_at       │
│ plan             │     └──────────────────┘
│ status           │
│ current_period_start │
│ current_period_end   │
│ analyses_used    │
│ analyses_limit   │
│ cancel_at_period_end│
│ created_at       │
│ updated_at       │
└──────────────────┘
```

### 23.2 Key Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `users` | User accounts | email, password_hash, totp_secret (encrypted), role, stripe_cust_id |
| `analyses` | Analysis records | user_id, status, source_type, code_metadata, overall_score, payment_id, is_unlocked |
| `analysis_reports` | Generated reports per analysis | analysis_id, report_type (security/practices/cloud), data (JSONB) |
| `payments` | Payment transactions | user_id, analysis_id, stripe_payment_id, amount_cents, status |
| `subscriptions` | User subscriptions | user_id, stripe_sub_id, plan, status, analyses_used, analyses_limit |
| `agent_executions` | Agent execution trace per analysis | analysis_id, agent_name, tokens_used, execution_time_ms |
| `api_keys` | Encrypted API keys | name, encrypted_key, provider, allowed_agents, status |
| `rag_documents` | RAG document metadata | collection, title, chunk_count, status |
| `audit_logs` | Admin audit trail | user_id, action, resource, details, ip_address |
| `user_connections` | OAuth connections | user_id, provider (github/gitlab/drive), encrypted tokens |

---

## 24. Deployment Architecture

### 24.1 Production Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloud Provider (GCP/AWS)                     │
│                                                                  │
│  ┌───────────────┐                                              │
│  │  CDN (Cloud   │ ◄────── Static assets (Next.js)             │
│  │  CDN/CloudFront)│                                            │
│  └───────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌───────────────┐                                              │
│  │  Load Balancer│ ◄────── HTTPS termination                   │
│  │  (L7 / ALB)   │                                              │
│  └───────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 Kubernetes Cluster                         │  │
│  │                                                           │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  │
│  │  │Frontend │  │Backend  │  │Agent    │  │MCP      │    │  │
│  │  │Pods (3) │  │Pods (3) │  │Workers  │  │Server   │    │  │
│  │  │         │  │         │  │Pods (5) │  │Pods (2) │    │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │  │
│  │                                                           │  │
│  │  ┌──────────────────────┐                                │  │
│  │  │  Ephemeral Analysis  │ ◄── Kubernetes Jobs            │  │
│  │  │  Pods (on-demand)    │     (auto-created, TTL: 5min)  │  │
│  │  └──────────────────────┘                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ PostgreSQL  │  │ Redis       │  │ Vector DB   │            │
│  │ (Managed)   │  │ (Managed)   │  │ (Pinecone/  │            │
│  │             │  │             │  │  Managed)   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Cloud KMS   │  │ Prometheus  │  │ Grafana     │            │
│  │ (Key Mgmt)  │  │             │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 24.2 Local Development

```yaml
# docker-compose.yml services:
# - frontend (Next.js, port 3000)
# - backend (FastAPI, port 8000)
# - agent-worker (LangGraph workers)
# - mcp-server (MCP Server, port 8001)
# - postgres (PostgreSQL, port 5432)
# - redis (Redis, port 6379)
# - chromadb (ChromaDB, port 8002)
# - prometheus (Prometheus, port 9090)
# - grafana (Grafana, port 3001)
```

---

## 25. Testing Strategy

### 25.1 Testing Pyramid

```
           ╱╲
          ╱  ╲         E2E Tests (5%)
         ╱    ╲        Full user flows, real LLM calls (mocked in CI)
        ╱──────╲
       ╱        ╲      Integration Tests (25%)
      ╱          ╲     Agent communication, API endpoints, DB queries
     ╱────────────╲
    ╱              ╲    Unit Tests (70%)
   ╱                ╲   Individual functions, agent logic, validators
  ╱──────────────────╲
```

### 25.2 Testing Breakdown

| Test Type | What We Test | Tools |
|---|---|---|
| **Unit** | Agent logic, tool validators, scoring functions, schemas | pytest, unittest.mock |
| **Integration** | Agent-to-agent communication, API endpoints, DB operations | pytest, httpx, testcontainers |
| **E2E** | Full analysis flow (upload → report), auth flows, admin flows | Playwright (frontend), pytest (backend) |
| **Security** | Prompt injection, auth bypass, IDOR, rate limiting | Custom security test suite |
| **Performance** | Latency under load, concurrent analyses | Locust, k6 |
| **LLM-Specific** | Prompt effectiveness, output quality, hallucination rate | Custom eval suite + human review |

### 25.3 Agent-Specific Testing

```python
# Example: Testing the Security Analyst Agent
class TestSecurityAnalystAgent:
    
    def test_detects_hardcoded_secret(self):
        """Agent should flag hardcoded API keys."""
        code = 'API_KEY = "sk-1234567890abcdef"'
        result = security_analyst.analyze(code, language="python")
        assert any(f.category == "hardcoded_secret" for f in result.findings)
    
    def test_detects_sql_injection(self):
        """Agent should flag SQL injection vectors."""
        code = 'cursor.execute(f"SELECT * FROM users WHERE id = {user_input}")'
        result = security_analyst.analyze(code, language="python")
        assert any(f.category == "sql_injection" for f in result.findings)
    
    def test_respects_tool_permissions(self):
        """Agent should not call tools it doesn't have access to."""
        with pytest.raises(PermissionError):
            security_analyst.invoke_tool("cloud_pricing_calculator", {})
    
    def test_output_schema_compliance(self):
        """Agent output must match expected schema."""
        result = security_analyst.analyze(sample_code, language="python")
        SecurityReport.model_validate(result)  # Pydantic validation
    
    def test_max_tool_calls_enforced(self):
        """Agent should not exceed max tool call limit."""
        result = security_analyst.analyze(large_codebase, language="python")
        assert result.metadata.tool_calls_used <= 15
```

---

## 26. Project Roadmap & Milestones

### Phase 1: Foundation (Weeks 1-2)
- [x] Project documentation (this document)
- [ ] Project scaffolding (frontend + backend + agents directory structure)
- [ ] Database schema and migrations (including payments & subscriptions tables)
- [ ] Authentication system (JWT + TOTP 2FA)
- [ ] Basic API endpoints (auth, health)
- [ ] Docker Compose for local development

### Phase 2: Agent Core (Weeks 3-4)
- [ ] Base agent class with lifecycle management
- [ ] Planner Agent implementation
- [ ] A2A communication protocol
- [ ] LangGraph workflow definition
- [ ] MCP Server with tool registry
- [ ] Shared state management

### Phase 3: Executor Agents (Weeks 5-7)
- [ ] Security Analyst Agent
- [ ] Best Practices Auditor Agent (7 pillars)
- [ ] Cloud Configuration Advisor Agent
- [ ] Tool implementations for each agent
- [ ] Tool output validation

### Phase 4: Intelligence Layer (Weeks 7-8)
- [ ] RAG system setup (ingestion, retrieval, reranking)
- [ ] Knowledge base seeding (cloud docs, security, best practices)
- [ ] Critic Agent with verification
- [ ] Anti-hallucination pipeline
- [ ] Admin RAG document management

### Phase 5: Report & Visualization (Weeks 8-9)
- [ ] Report Generator Agent
- [ ] Chart/graph generation (radar, bar, line, architecture diagrams)
- [ ] PDF export
- [ ] Step-by-step deployment guide generation
- [ ] Free peek vs. full report gating logic

### Phase 6: Payments & Monetization (Weeks 9-10)
- [ ] Stripe integration (Checkout, Billing, Webhooks)
- [ ] Pay-per-project payment flow
- [ ] Subscription plan management (Starter, Pro, Team, Enterprise)
- [ ] Webhook handler (payment events, subscription lifecycle)
- [ ] Usage tracking and quota enforcement
- [ ] Invoice generation and history
- [ ] Admin revenue dashboard
- [ ] Payment security hardening (webhook signatures, idempotency)

### Phase 7: Frontend (Weeks 10-12)
- [ ] User dashboard
- [ ] Analysis upload/connect flows
- [ ] Free peek / paywall / unlock UX flow
- [ ] Stripe Checkout / subscription management UI
- [ ] Report viewing with interactive charts
- [ ] Admin panel (API keys, RAG docs, agent monitoring, revenue)
- [ ] 2FA setup flow
- [ ] Pricing page

### Phase 8: Integration & Code Connections (Weeks 12-13)
- [ ] GitHub OAuth integration
- [ ] GitLab OAuth integration
- [ ] Google Drive integration
- [ ] Ephemeral processing container setup
- [ ] P2P data flow validation

### Phase 9: Hardening & Production (Weeks 13-15)
- [ ] Security hardening (prompt injection, rate limiting, CORS)
- [ ] Payment security audit (PCI compliance verification)
- [ ] Observability setup (OpenTelemetry, Prometheus, Grafana)
- [ ] Comprehensive test suite (including payment flow tests)
- [ ] Performance testing
- [ ] Kubernetes deployment configuration
- [ ] CI/CD pipelines
- [ ] Documentation finalization

---

## 27. Appendix

### A. Glossary

| Term | Definition |
|---|---|
| **A2A** | Agent-to-Agent communication protocol |
| **Agentic RAG** | AI agents that autonomously decide when and how to use retrieval |
| **Blue Team** | Security-focused team building production-grade defenses |
| **CoT** | Chain-of-Thought reasoning — agents explain their reasoning step by step |
| **FinOps** | Financial Operations — optimizing cloud costs |
| **LangGraph** | Library for building stateful, multi-agent workflows as graphs |
| **MCP** | Model Context Protocol — standard for LLM-tool interaction |
| **OWASP** | Open Web Application Security Project |
| **P2P** | Peer-to-Peer — data stays with the user, never stored on our servers |
| **RAG** | Retrieval-Augmented Generation — grounding LLM outputs with retrieved knowledge |
| **RBAC** | Role-Based Access Control |
| **SAST** | Static Application Security Testing |
| **SCA** | Software Composition Analysis |
| **TOTP** | Time-based One-Time Password (RFC 6238) |
| **PCI DSS** | Payment Card Industry Data Security Standard |
| **SCA** (Payments) | Strong Customer Authentication — EU regulation for 3D Secure |
| **MRR** | Monthly Recurring Revenue |
| **XAI** | Explainable AI — making AI decisions transparent and understandable |

### B. References

1. OWASP Top 10 (2021): https://owasp.org/www-project-top-ten/
2. LangGraph Documentation: https://langchain-ai.github.io/langgraph/
3. Model Context Protocol Specification: https://modelcontextprotocol.io/
4. NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
5. OpenTelemetry: https://opentelemetry.io/
6. FastAPI: https://fastapi.tiangolo.com/
7. RFC 6238 (TOTP): https://tools.ietf.org/html/rfc6238
8. AWS Well-Architected Framework: https://aws.amazon.com/architecture/well-architected/
9. GCP Architecture Framework: https://cloud.google.com/architecture/framework
10. Azure Well-Architected Framework: https://learn.microsoft.com/en-us/azure/well-architected/

### C. Change Log

| Date | Version | Author | Changes |
|---|---|---|---|
| 2026-02-17 | 1.0.0 | Team | Initial comprehensive documentation |
| 2026-02-17 | 1.1.0 | Team | Added monetization model, updated problem statement, payment security |

---

*This document is the single source of truth for the CloudWise AI platform. All implementation decisions should reference this documentation.*
