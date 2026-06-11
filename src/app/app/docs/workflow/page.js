'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, AlertCircle } from 'lucide-react';

export default function WorkflowPage() {
  const stages = [
    {
      number: 1,
      title: 'PROSPECT',
      description: 'You find a lead',
      route: '/app/prospecting/new',
      action: 'Add Prospect',
      details: [
        'Capture lead information',
        'Record source (where they came from)',
        'Assign to sales agent',
        'Tag and categorize',
      ],
      validates: ['Name + (Email OR Phone) required', 'Source tracking enabled'],
    },
    {
      number: 2,
      title: 'FOLLOW-UP',
      description: 'You nurture them',
      route: '/app/prospecting/followups',
      action: 'Log Activity',
      details: [
        'Log calls, emails, meetings',
        'Record outcomes (positive/neutral/negative)',
        'Schedule next touchpoint',
        'Build relationship history',
      ],
      validates: ['All interactions logged', 'Next follow-up always scheduled'],
    },
    {
      number: 3,
      title: 'CONVERT',
      description: 'They become a client',
      route: '/app/prospecting/conversions',
      action: 'Convert to Client',
      details: [
        'Verify prospect is qualified',
        'Convert prospect → client',
        'Client record created',
        'Original prospect preserved',
      ],
      validates: ['Cannot undo conversion', 'Client unlocks contract creation'],
    },
    {
      number: 4,
      title: 'DEAL',
      description: 'You pitch a product/system',
      route: '/app/deals/create',
      action: 'Create Deal',
      details: [
        'Select client',
        'Choose system (product you\'re selling)',
        'Enter value estimate',
        'Set probability %',
        'Assign stage (Lead → Qualification → Proposal)',
      ],
      validates: ['Must have system_id', 'Must have client_id or prospect_id', 'Revenue attribution secured'],
    },
    {
      number: 5,
      title: 'WIN',
      description: 'Deal closes successfully',
      route: '/app/deals',
      action: 'Win Deal',
      details: [
        'Mark deal as "Won"',
        'System auto-creates contract',
        'Contract links client + system',
        'Deal amount → contract installation fee',
      ],
      validates: ['Auto-conversion if prospect not client', 'Contract created atomically', 'No phantom contracts'],
    },
    {
      number: 6,
      title: 'PAYMENT',
      description: 'Money arrives',
      route: '/app/payments',
      action: 'Record Payment',
      details: [
        'Select contract',
        'Enter amount received',
        'Record payment date',
        'Choose payment method',
        'Add reference number',
      ],
      validates: ['Must link to contract', 'Amount must be > 0', 'Payment ready for allocation'],
    },
    {
      number: 7,
      title: 'ALLOCATION',
      description: 'You distribute the funds',
      route: '/app/payments',
      action: 'Allocate Funds',
      details: [
        'Distribute to categories:',
        '  • Vault (40%) - Long-term savings',
        '  • Operating (40%) - Day-to-day',
        '  • Expense (20%) - Specific costs',
        'Validation prevents over-allocation',
      ],
      validates: ['Total ≤ payment amount', 'Database trigger enforces rules', 'Financial discipline ensured'],
    },
    {
      number: 8,
      title: 'DASHBOARD',
      description: 'You see the profit',
      route: '/app/finance',
      action: 'View Metrics',
      details: [
        'Total revenue collected',
        'Net profit (revenue - expenses)',
        'Profit margin %',
        'Vault balance',
        'Top systems by revenue',
        'Top clients by revenue',
      ],
      validates: ['Real-time updates', 'All amounts reconciled', 'Data integrity verified'],
    },
  ];

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/app/docs"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documentation
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-xl p-8 shadow-lg mb-8">
          <h1 className="text-4xl font-bold mb-4">The Complete Workflow</h1>
          <p className="text-xl text-orange-50">
            The revenue cycle from prospect to profit. This is the only workflow you need to master.
          </p>
        </div>

        {/* Visual Flow */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">At a Glance</h2>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold">
            {stages.map((stage, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="px-4 py-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-sm">
                  {stage.number}. {stage.title}
                </div>
                {i < stages.length - 1 && (
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Stages */}
        <div className="space-y-6">
          {stages.map((stage, index) => (
            <div
              key={index}
              className="bg-card rounded-xl shadow-sm overflow-hidden border-l-4 border-blue-600"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">
                      {stage.number}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-foreground mb-1">{stage.title}</h3>
                      <p className="text-muted-foreground mb-3">{stage.description}</p>
                      <Link
                        href={stage.route}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                      >
                        {stage.action} →
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-600" />
                      What Happens
                    </h4>
                    <ul className="space-y-2">
                      {stage.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-blue-600 font-bold flex-shrink-0 mt-0.5">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-600" />
                      System Validates
                    </h4>
                    <ul className="space-y-2">
                      {stage.validates.map((validation, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                          <span className="text-green-600 font-bold flex-shrink-0 mt-0.5">✓</span>
                          <span>{validation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {index < stages.length - 1 && (
                <div className="flex justify-center py-3 bg-muted">
                  <ArrowRight className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Critical Business Rules */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 shadow-sm mt-8">
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-3">
            <AlertCircle className="w-7 h-7 text-red-600" />
            Critical Business Rules
          </h2>
          <div className="space-y-3">
            {[
              { rule: 'Every deal MUST have a system_id', why: 'Revenue attribution - know what you\'re selling' },
              { rule: 'Every deal MUST have client_id or prospect_id', why: 'No anonymous deals - know who you\'re selling to' },
              { rule: 'Contracts require clients (not prospects)', why: 'Formal agreements only with committed clients' },
              { rule: 'Payments must link to contracts', why: 'Revenue tracking and allocation accuracy' },
              { rule: 'Total allocations cannot exceed payment amount', why: 'Financial integrity - no phantom money' },
              { rule: 'Winning a deal auto-creates contract', why: 'Enforces revenue recognition consistency' },
            ].map((item, i) => (
              <div key={i} className="p-4 bg-card rounded-lg border border-red-200">
                <div className="font-semibold text-foreground mb-1">{item.rule}</div>
                <div className="text-sm text-muted-foreground italic">Why: {item.why}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Workflow Variations */}
        <div className="bg-card rounded-xl p-8 shadow-sm mt-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Workflow Variations</h2>
          
          <div className="space-y-6">
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-bold text-blue-900 mb-2 text-lg">🚀 Fast Track (Warm Lead)</h3>
              <p className="text-sm text-blue-800 mb-3">
                When a lead is already qualified and ready to buy:
              </p>
              <div className="text-sm text-blue-900 font-mono bg-card p-3 rounded">
                Add Prospect → Convert Immediately → Create Deal (with System) → Win Deal → Record Payment
              </div>
            </div>

            <div className="p-6 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-bold text-green-900 mb-2 text-lg">📈 Long Nurture (Enterprise)</h3>
              <p className="text-sm text-green-800 mb-3">
                When selling to large clients requires multiple touchpoints:
              </p>
              <div className="text-sm text-green-900 font-mono bg-card p-3 rounded">
                Add Prospect → Log 10-20 Follow-Ups → Demo/Proposal → Convert → Create Deal → Negotiate → Win → Record Payment
              </div>
            </div>

            <div className="p-6 bg-purple-50 rounded-lg border border-purple-200">
              <h3 className="font-bold text-purple-900 mb-2 text-lg">🔄 Recurring Revenue</h3>
              <p className="text-sm text-purple-800 mb-3">
                When client pays monthly/quarterly:
              </p>
              <div className="text-sm text-purple-900 font-mono bg-card p-3 rounded">
                Win Deal → Contract (with Recurring Enabled) → Record Payment Monthly → Allocate Each Time
              </div>
            </div>
          </div>
        </div>

        {/* Daily Founder Routine */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-xl p-8 shadow-lg mt-8">
          <h2 className="text-2xl font-bold mb-4">Your Daily Routine with This Workflow</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-green-400 mb-2">MORNING (10 min)</h3>
              <ul className="space-y-1 text-gray-200 text-sm ml-4">
                <li>• Check financial dashboard (profit, vault, revenue)</li>
                <li>• Review today's follow-ups</li>
                <li>• Check pipeline (deals in progress)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-blue-400 mb-2">THROUGHOUT DAY</h3>
              <ul className="space-y-1 text-gray-200 text-sm ml-4">
                <li>• Add new prospects as they come in</li>
                <li>• Log every interaction (calls, emails)</li>
                <li>• Move deals through stages</li>
                <li>• Record payments when money arrives</li>
                <li>• Allocate funds immediately</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-purple-400 mb-2">END OF DAY (5 min)</h3>
              <ul className="space-y-1 text-gray-200 text-sm ml-4">
                <li>• Update deal pipeline</li>
                <li>• Schedule tomorrow's follow-ups</li>
                <li>• Check unallocated payments</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-card rounded-xl p-8 shadow-sm mt-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">Master the Workflow</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/app/docs/founder"
              className="p-6 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition dark:hover:bg-green-900/20"
            >
              <div className="font-bold text-green-900 text-lg mb-2">Read Founder Manual</div>
              <div className="text-green-700 text-sm">Daily playbook with exact actions to take</div>
            </Link>
            <Link
              href="/app/docs/guides"
              className="p-6 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition dark:hover:bg-blue-900/20"
            >
              <div className="font-bold text-blue-900 text-lg mb-2">Browse Step-by-Step Guides</div>
              <div className="text-blue-700 text-sm">Detailed instructions for each workflow stage</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
