'use client';

import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

export default function GettingStartedPage() {
  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <Link
          href="/app/docs"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documentation
        </Link>

        {/* Header */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Getting Started with Consty
          </h1>
          <p className="text-xl text-muted-foreground">
            Welcome to Consty, your Founder-First Business Operating System. This guide will help you understand the basics and get you operational in minutes.
          </p>
        </div>

        {/* What is Consty */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">What is Consty?</h2>
          <p className="text-foreground mb-4">
            Consty is a complete business operating system designed specifically for founders. It manages your entire revenue cycle:
          </p>
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {[
              'Prospect Management',
              'Client Conversion',
              'Deal Pipelines',
              'Contract Management',
              'Payment Tracking',
              'Financial Dashboard',
              'System Portfolio',
              'Revenue Analytics',
            ].map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* The Core Workflow */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-8 shadow-sm mb-8 border border-blue-200">
          <h2 className="text-2xl font-bold text-foreground mb-6">The Core Workflow</h2>
          <div className="space-y-4">
            {[
              { step: '1. Prospect', desc: 'Add a lead to your system', route: '/app/prospecting/new' },
              { step: '2. Follow-Up', desc: 'Log calls, emails, meetings', route: '/app/prospecting/followups' },
              { step: '3. Convert', desc: 'Turn prospect into client', route: '/app/prospecting/conversions' },
              { step: '4. Deal', desc: 'Create sales opportunity', route: '/app/deals/create' },
              { step: '5. Win', desc: 'Close deal → auto-create contract', route: '/app/deals' },
              { step: '6. Payment', desc: 'Record money received', route: '/app/payments' },
              { step: '7. Allocate', desc: 'Distribute funds (vault, operating, expense)', route: '/app/payments' },
              { step: '8. Dashboard', desc: 'View profit, revenue, metrics', route: '/app/finance' },
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-4 bg-card rounded-lg p-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground">{item.step}</div>
                  <div className="text-muted-foreground text-sm">{item.desc}</div>
                </div>
                <Link
                  href={item.route}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium whitespace-nowrap"
                >
                  Go →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* First Steps */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Your First Steps</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold dark:bg-green-900/30 dark:text-green-300">1</span>
                Add Your First System/Product
              </h3>
              <p className="text-foreground ml-8 mb-2">
                Before creating deals, you must define what you're selling.
              </p>
              <Link
                href="/app/intellectual-property"
                className="ml-8 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Go to IP Portfolio →
              </Link>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold dark:bg-green-900/30 dark:text-green-300">2</span>
                Add Your First Prospect
              </h3>
              <p className="text-foreground ml-8 mb-2">
                Add a potential customer to start tracking your sales pipeline.
              </p>
              <Link
                href="/app/prospecting/new"
                className="ml-8 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Add Prospect →
              </Link>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold dark:bg-green-900/30 dark:text-green-300">3</span>
                Read the Founder Manual
              </h3>
              <p className="text-foreground ml-8 mb-2">
                Learn your daily routine and key metrics to track.
              </p>
              <Link
                href="/app/docs/founder"
                className="ml-8 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Read Founder Manual →
              </Link>
            </div>
          </div>
        </div>

        {/* Key Concepts */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Key Concepts</h2>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Prospect vs. Client</h4>
              <p className="text-foreground text-sm">
                <strong>Prospect:</strong> A potential customer you're nurturing. <br />
                <strong>Client:</strong> A converted prospect who's ready to buy. You cannot create contracts with prospects, only clients.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">System (Product)</h4>
              <p className="text-foreground text-sm">
                A system is what you sell (software, service, product). Every deal and contract must reference a system. This ensures revenue attribution.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Deal → Contract → Payment</h4>
              <p className="text-foreground text-sm">
                A <strong>Deal</strong> represents a sales opportunity. When won, it auto-creates a <strong>Contract</strong>. When money arrives, you record a <strong>Payment</strong> linked to that contract.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Allocation</h4>
              <p className="text-foreground text-sm">
                When you receive a payment, you allocate it to categories: Vault (savings), Operating (working capital), Expense (specific costs), Investment (growth).
              </p>
            </div>
          </div>
        </div>

        {/* Business Rules */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
            <h2 className="text-2xl font-bold text-foreground">Important Business Rules</h2>
          </div>
          <ul className="space-y-2 text-foreground">
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold">•</span>
              <span>Every deal <strong>must</strong> have a system_id (which product you're selling)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold">•</span>
              <span>Every deal <strong>must</strong> have a client_id or prospect_id (who you're selling to)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold">•</span>
              <span>You cannot create contracts with prospects - convert them to clients first</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold">•</span>
              <span>Payments must link to contracts, not clients or deals directly</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold">•</span>
              <span>You cannot allocate more money than a payment received</span>
            </li>
          </ul>
        </div>

        {/* Next Steps */}
        <div className="bg-card rounded-xl p-8 shadow-sm">
          <h2 className="text-2xl font-bold text-foreground mb-4">Next Steps</h2>
          <div className="space-y-3">
            <Link
              href="/app/docs/founder"
              className="block p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition dark:hover:bg-green-900/20"
            >
              <div className="font-semibold text-green-900">Read the Founder Operating Manual</div>
              <div className="text-green-700 text-sm">Your daily playbook for running Consty</div>
            </Link>
            <Link
              href="/app/docs/guides"
              className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition dark:hover:bg-blue-900/20"
            >
              <div className="font-semibold text-blue-900">Browse User Guides</div>
              <div className="text-blue-700 text-sm">Step-by-step tutorials for common tasks</div>
            </Link>
            <Link
              href="/app/docs/modules"
              className="block p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition dark:hover:bg-purple-900/20"
            >
              <div className="font-semibold text-purple-900">Explore Module Documentation</div>
              <div className="text-purple-700 text-sm">Deep dive into each system component</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
