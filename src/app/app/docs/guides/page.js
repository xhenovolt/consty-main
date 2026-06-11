'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';

const guides = [
  {
    id: 'add-prospect',
    title: 'How to Add a Prospect',
    route: '/app/prospecting/new',
    description: 'A prospect is a potential customer you want to track through your sales pipeline.',
    steps: [
      'Navigate to Prospects (Growth → Prospects)',
      'Click "+ New Prospect" (top right)',
      'Fill required fields: Name, Email/Phone, Source, Industry',
      'Optionally add: WhatsApp, City, Country, Address',
      'Click "Create Prospect"',
    ],
    whatNext: 'Prospect appears in your list, starts at first pipeline stage, ready for follow-ups.',
    tips: [
      'Always add source to track where leads come from',
      'Assign prospects to sales agents for accountability',
      'Use tags to categorize (e.g., "Hot Lead", "Enterprise")',
    ],
  },
  {
    id: 'record-followup',
    title: 'How to Record a Follow-Up',
    route: '/app/prospecting/followups',
    description: 'Track every interaction with a prospect to maintain relationship history.',
    steps: [
      'Open the prospect from Prospects list',
      'Go to Activities tab',
      'Click "+ Add Activity"',
      'Select Activity Type (Call, Email, Meeting, Message, Note)',
      'Fill details: Subject, Description, Outcome, Activity Date',
      'Optionally schedule Next Follow-Up Date',
      'Click "Log Activity"',
    ],
    whatNext: 'Activity saved to history, scheduled follow-ups appear in dashboard, "Last Activity" date updates.',
    tips: [
      'Log activities immediately after calls/meetings',
      'Be specific in descriptions for future reference',
      'Always schedule next follow-up to maintain momentum',
      'Use outcomes to track prospect engagement',
    ],
  },
  {
    id: 'convert-prospect',
    title: 'How to Convert a Prospect to Client',
    route: '/app/prospecting/conversions',
    description: 'When a prospect agrees to do business, convert them to a client.',
    prerequisites: ['Prospect must be qualified (warmed up)', 'Prospect should be in "Ready to Convert" stage'],
    steps: [
      'Navigate to Growth → Conversions',
      'Click "Convert to Client"',
      'Verify information (auto-filled from prospect)',
      'Add notes documenting why they converted',
      'Click "Convert Now"',
    ],
    whatNext: 'Prospect status → "Converted", new client record created, appears in Clients list, original prospect preserved.',
    tips: [
      '⚠️ Cannot undo conversion - ensure prospect is qualified',
      'Always verify contact information before converting',
      'Conversion logs an activity on the prospect',
    ],
  },
  {
    id: 'create-deal',
    title: 'How to Create a Deal',
    route: '/app/deals/create',
    description: 'A deal represents a specific sales opportunity for a product/system.',
    prerequisites: ['Must have a client (convert prospect first if needed)', 'Must know which system/product you\'re selling'],
    steps: [
      'Navigate to Investments → Deals',
      'Click "+ New Deal"',
      'Fill required fields: Title, Client, System (REQUIRED), Value Estimate, Probability (0-100%), Stage',
      'Optionally add: Expected close date, notes, priority',
      'Click "Create Deal"',
    ],
    whatNext: 'Deal appears in list, shows in pipeline view, ready to track progression.',
    tips: [
      'Always select a system - crucial for revenue tracking',
      'Be realistic with probability estimates',
      'Update value estimate as deal progresses',
      'Deals can link to prospects who aren\'t clients yet',
    ],
    errors: [
      '"System is required" - You must select which product you\'re selling',
      '"Client or prospect required" - Select a client from dropdown',
    ],
  },
  {
    id: 'close-deal',
    title: 'How to Close a Deal',
    route: '/app/deals',
    description: 'When you win a deal, mark it as "Won" to auto-create a contract.',
    prerequisites: ['Deal must exist', 'Prospect must be converted to client (happens automatically if needed)', 'Deal must have system_id'],
    steps: [
      'Open the deal from Deals list',
      'Click green "Win Deal" or "Mark as Won" button',
      'Review auto-contract creation details',
      'Optionally configure: Installation fee, recurring billing, contract terms',
      'Click "Win Deal & Create Contract"',
    ],
    whatNext: 'Deal stage → "Won", contract automatically created with client/system linked, ready to record payment.',
    tips: [
      '✅ Winning is irreversible - make sure deal is truly closed',
      'Review contract details after auto-creation',
      'Can manually create contract if you prefer more control',
    ],
    errors: [
      '"Prospect must be converted first" - Convert prospect manually, then try again',
      '"Deal must have system" - Edit deal to add system, then win',
    ],
  },
  {
    id: 'record-payment',
    title: 'How to Record a Payment',
    route: '/app/payments',
    description: 'Track money received from clients.',
    prerequisites: ['Must have an active contract', 'Amount must be greater than 0'],
    steps: [
      'Navigate to Investments → Payments',
      'Click "+ Record Payment"',
      'Select Contract from dropdown',
      'Enter Amount Received (your currency)',
      'Select Date Received (when money arrived)',
      'Choose Payment Method (Cash, Bank Transfer, Mobile Money, Card, Crypto, Other)',
      'Optionally add Reference Number (transaction ID)',
      'Click "Record Payment"',
    ],
    whatNext: 'Payment appears in list with status "Pending Allocation", financial dashboard updates with new revenue, ready to allocate.',
    tips: [
      'Always select correct contract for accurate tracking',
      'Use reference numbers for audit trail',
      'Record payment date as actual receipt date, not invoice date',
      'Can record partial payments multiple times for same contract',
    ],
  },
  {
    id: 'allocate-funds',
    title: 'How to Allocate Funds',
    route: '/app/payments',
    description: 'Distribute received payments to different financial categories.',
    prerequisites: ['Payment must exist', 'Total allocations cannot exceed payment amount'],
    steps: [
      'Open payment from Payments list',
      'Click "Allocate Funds"',
      'Choose Allocation Type: Vault (savings), Operating (day-to-day), Expense (specific), Investment (growth)',
      'Enter amount to allocate (≤ remaining unallocated)',
      'Click "+ Add Another Allocation" for multiple categories',
      'Review total (must not exceed payment amount)',
      'Click "Save Allocations"',
    ],
    whatNext: 'Payment allocation_status updates (Pending/Partial/Allocated), vault balances update automatically, financial dashboard reflects new allocation.',
    tips: [
      'Common distribution: 40% vault, 40% operating, 20% expense',
      'Allocate funds immediately after recording payment',
      'Use expense allocations for specific known expenses',
      'Vault for long-term financial security',
    ],
  },
  {
    id: 'track-revenue',
    title: 'How to Track Revenue',
    route: '/app/finance',
    description: 'Monitor revenue by client, by system, and over time.',
    steps: [
      'Navigate to Finance → Finance Dashboard',
      'View Total Revenue Collected',
      'Check Revenue by System (product)',
      'Check Revenue by Client',
      'View Monthly Recurring Revenue (MRR)',
      'Analyze Revenue Trends',
      'Click systems or clients for detailed breakdown',
    ],
    metrics: [
      { metric: 'Total Revenue', meaning: 'Sum of all payments received' },
      { metric: 'Installation Revenue', meaning: 'One-time setup fees from contracts' },
      { metric: 'Recurring Revenue', meaning: 'Monthly ongoing revenue from active contracts' },
      { metric: 'Annual Projection', meaning: 'Recurring revenue × 12 months' },
    ],
    tips: [
      'Check dashboard daily for real-time updates',
      'Use system revenue to identify bestsellers',
      'Track client revenue to identify top customers',
      'Monitor recurring revenue for predictable income',
    ],
  },
  {
    id: 'view-dashboard',
    title: 'How to View Financial Dashboard',
    route: '/app/finance',
    description: 'Real-time view of your business financial health.',
    steps: [
      'Navigate to Finance → Finance Dashboard',
      'Review Top Section: Total Revenue, Total Expenses, Net Profit, Profit Margin %',
      'Check Cash Position: Vault Balance, Operating Balance, Investment Balance, Total Cash',
      'View Recurring Revenue: MRR, Annual Projection, Active Contracts',
      'Analyze Performance: Top Systems, Top Clients, Revenue Trends',
      'Filter by date range (This Month / Quarter / Year / All Time)',
      'Address any yellow alerts (payments needing allocation)',
    ],
    metrics: [
      { metric: 'Net Profit', meaning: 'Revenue - Expenses', goal: 'Stay positive (green)' },
      { metric: 'Profit Margin', meaning: '(Profit / Revenue) × 100', goal: 'Target 20%+' },
      { metric: 'Vault Balance', meaning: 'Emergency reserves', goal: 'Build to 6 months expenses' },
      { metric: 'Operating Balance', meaning: 'Available cash', goal: 'Maintain buffer' },
      { metric: 'MRR', meaning: 'Predictable monthly income', goal: 'Grow over time' },
    ],
    tips: [
      'Check dashboard every morning',
      'Set goal: 30% to vault, 50% to operating, 20% to expenses',
      'Track profit margin trends monthly',
      'Address data integrity alerts immediately',
    ],
  },
  {
    id: 'add-system',
    title: 'How to Add a System/Product',
    route: '/app/intellectual-property',
    description: 'Systems are the products or services you sell. Every deal must reference a system.',
    prerequisites: ['Know what you\'re selling'],
    steps: [
      'Navigate to Systems → IP Portfolio',
      'Click "+ Add System"',
      'Fill System Name (e.g., "ERP Software", "Consulting Package")',
      'Add Description (what it does)',
      'Select Category (if applicable)',
      'Set Status (Active/Inactive)',
      'Click "Create System"',
    ],
    whatNext: 'System appears in IP Portfolio, available when creating deals/contracts, revenue tracked per system.',
    tips: [
      'Create systems before creating deals',
      'Use clear, descriptive names',
      'Group related products by category',
      'Deactivate systems you no longer sell',
    ],
  },
];

function GuideCard({ guide }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted transition text-left"
      >
        <div className="flex items-start gap-4 flex-1">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-1">{guide.title}</h3>
            <p className="text-sm text-muted-foreground">{guide.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          {guide.route && (
            <Link
              href={guide.route}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              Go
            </Link>
          )}
          <ChevronDown
            className={`w-5 h-5 text-muted-foreground transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-border space-y-6">
          {guide.prerequisites && (
            <div>
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Prerequisites
              </h4>
              <ul className="space-y-1 ml-6 text-sm text-foreground">
                {guide.prerequisites.map((prereq, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">✓</span>
                    <span>{prereq}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-foreground mb-3">Steps</h4>
            <ol className="space-y-2">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-foreground">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="flex-1 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {guide.whatNext && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-900 mb-2">What Happens Next</h4>
              <p className="text-sm text-green-800">{guide.whatNext}</p>
            </div>
          )}

          {guide.tips && (
            <div>
              <h4 className="font-semibold text-foreground mb-2">Tips</h4>
              <ul className="space-y-1 text-sm text-foreground">
                {guide.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guide.errors && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-semibold text-red-900 mb-2">Common Errors</h4>
              <ul className="space-y-1 text-sm text-red-800">
                {guide.errors.map((error, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-600 font-bold">✗</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {guide.metrics && (
            <div>
              <h4 className="font-semibold text-foreground mb-3">Metrics Explained</h4>
              <div className="space-y-2">
                {guide.metrics.map((m, i) => (
                  <div key={i} className="p-3 bg-muted rounded-lg">
                    <div className="font-semibold text-foreground text-sm">{m.metric}</div>
                    <div className="text-xs text-muted-foreground mt-1">{m.meaning}</div>
                    {m.goal && <div className="text-xs text-blue-600 mt-1 font-medium">Goal: {m.goal}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function UserGuidesPage() {
  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <Link
          href="/app/docs"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Documentation
        </Link>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl p-8 shadow-lg mb-8">
          <h1 className="text-4xl font-bold mb-4">User Guides</h1>
          <p className="text-xl text-blue-50">
            Step-by-step instructions for common tasks in Consty. Click any guide to expand it.
          </p>
        </div>

        {/* Workflow Overview */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-4">The Complete Workflow</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {[
              'ADD PROSPECT',
              'LOG FOLLOW-UPS',
              'CONVERT TO CLIENT',
              'CREATE DEAL',
              'WIN DEAL',
              'RECORD PAYMENT',
              'ALLOCATE FUNDS',
              'VIEW DASHBOARD',
            ].map((step, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 font-semibold rounded dark:bg-blue-900/30 dark:text-blue-300">
                  {i + 1}. {step}
                </span>
                {i < arr.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Guides */}
        <div className="space-y-4">
          {guides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>

        {/* FAQ Section */}
        <div className="bg-card rounded-xl p-8 shadow-sm mt-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Common Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I delete a prospect?',
                a: 'Yes, unless they\'ve been converted to a client. Once converted, prospect record is preserved.',
              },
              {
                q: 'What happens if I try to win a deal without a client?',
                a: 'If the deal has a prospect_id, the system will auto-convert the prospect to a client first.',
              },
              {
                q: 'Can I have multiple contracts with the same client?',
                a: 'Yes! A client can have many contracts (for different systems or recurring agreements).',
              },
              {
                q: 'How do I handle partial payments?',
                a: 'Record each payment separately, all linked to the same contract. The system tracks total paid.',
              },
              {
                q: 'Why can\'t I create a deal without a system?',
                a: 'Every deal must know what you\'re selling. This ensures accurate revenue tracking per product.',
              },
            ].map((item, i) => (
              <div key={i} className="p-4 bg-muted rounded-lg">
                <div className="font-semibold text-foreground mb-2">Q: {item.q}</div>
                <div className="text-sm text-foreground">A: {item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
