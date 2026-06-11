'use client';

import Link from 'next/link';
import { ArrowLeft, TrendingUp, Clock, Calendar, BarChart3, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function FounderManualPage() {
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
        <div className="bg-gradient-to-br from-green-500 to-green-700 text-white rounded-xl p-8 shadow-lg mb-8">
          <h1 className="text-4xl font-bold mb-4">Consty Founder Operating Manual</h1>
          <p className="text-xl text-green-50">
            Your daily playbook for running Consty. This manual shows you <strong>exactly what to do every day</strong>.
          </p>
        </div>

        {/* The Big Picture */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">The Big Picture: Your Core Workflow</h2>
          <div className="space-y-3">
            {[
              { label: 'PROSPECT', desc: 'You find a lead', route: '/app/prospects' },
              { label: 'FOLLOW-UP', desc: 'You nurture them', route: '/app/followups' },
              { label: 'CONVERT', desc: 'They become a client', route: '/app/clients' },
              { label: 'DEAL', desc: 'You pitch a system or service', route: '/app/deals/new' },
              { label: 'LICENSE', desc: 'Auto-issued when deal is closed/won', route: '/app/licenses' },
              { label: 'PAYMENT', desc: 'Money arrives', route: '/app/payments' },
              { label: 'ALLOCATION', desc: 'You distribute the funds', route: '/app/allocations' },
              { label: 'DASHBOARD', desc: 'You see the profit', route: '/app/dashboard' },
              { label: 'LOG', desc: 'Record your daily operations', route: '/app/operations' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-muted rounded-lg hover:bg-muted transition">
                <div className="flex-shrink-0 w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-foreground">{item.label}</div>
                  <div className="text-muted-foreground text-sm">{item.desc}</div>
                </div>
                <Link href={item.route} className="text-green-600 hover:text-green-700 font-medium text-sm">
                  Go →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Routine */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-foreground">Your Daily Routine</h2>
          </div>

          {/* Morning */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-foreground mb-4 bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-500">
              MORNING (10 minutes)
            </h3>
            <div className="space-y-4 ml-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">1. Check Financial Dashboard</h4>
                    <ul className="text-foreground text-sm space-y-1 ml-4">
                      <li>• Total revenue (yesterday vs. all-time)</li>
                      <li>• Net profit (are you making money?)</li>
                      <li>• Vault balance (your safety net)</li>
                      <li>• Outstanding payments (pending allocations)</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      Action: If profit is negative or vault is low, prioritize closing deals today.
                    </p>
                  </div>
                  <Link
                    href="/app/finance"
                    className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Go
                  </Link>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">2. Review Today's Follow-Ups</h4>
                    <p className="text-foreground text-sm">Prospects you promised to call/email today</p>
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      Action: Reach out to each one. Log the interaction.
                    </p>
                  </div>
                  <Link
                    href="/app/prospecting/followups"
                    className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Go
                  </Link>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground mb-2">3. Check Pipeline</h4>
                    <p className="text-foreground text-sm">Where your deals are (stages)</p>
                    <p className="text-sm text-muted-foreground mt-2 italic">
                      Action: Identify which deals can move forward today.
                    </p>
                  </div>
                  <Link
                    href="/app/pipeline"
                    className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Go
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Throughout the Day */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-foreground mb-4 bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
              THROUGHOUT THE DAY
            </h3>
            <div className="space-y-6 ml-4">
              <div>
                <h4 className="font-semibold text-foreground mb-3">When a New Lead Comes In</h4>
                <ol className="space-y-2 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="font-bold text-green-600">1.</span>
                    <span><strong>Add Prospect</strong> → Route: <Link href="/app/prospecting/new" className="text-blue-600 hover:underline">/app/prospecting/new</Link><br />
                    Fields: Name, Email/Phone, Source → Save</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-green-600">2.</span>
                    <span><strong>Log Initial Contact</strong> → Add Activity (Call/Email) → Note discussion → Schedule next follow-up</span>
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2 ml-8 italic">Why: You now have a record. You won't forget this lead.</p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-3">When Someone is Ready to Buy</h4>
                <ol className="space-y-2 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="font-bold text-green-600">1.</span>
                    <span><strong>Convert Prospect to Client</strong> → Click "Convert to Client" button</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-green-600">2.</span>
                    <span><strong>Create a Deal</strong> → <Link href="/app/deals/create" className="text-blue-600 hover:underline">/app/deals/create</Link><br />
                    Select Client + <strong className="text-red-600">CRITICAL: Select System</strong> + Enter Value</span>
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2 ml-8 italic">Why: System enforces that every deal links to a product. No phantom revenue.</p>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-3">When You Close a Deal</h4>
                <ol className="space-y-2 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="font-bold text-green-600">1.</span>
                    <span><strong>Win the Deal</strong> → Click "Win Deal" → System auto-creates contract</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-green-600">2.</span>
                    <span><strong>Review Contract</strong> → <Link href="/app/contracts" className="text-blue-600 hover:underline">/app/contracts</Link> → Verify details</span>
                  </li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-3">When Money Arrives</h4>
                <ol className="space-y-2 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="font-bold text-green-600">1.</span>
                    <span><strong>Record Payment</strong> → <Link href="/app/payments" className="text-blue-600 hover:underline">/app/payments</Link> → Select Contract → Enter Amount + Date + Method</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-green-600">2.</span>
                    <span><strong>Allocate Immediately</strong> → 40% Vault, 40% Operating, 20% Expense</span>
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2 ml-8 italic">Why: Allocating prevents reckless spending. Vault builds security.</p>
              </div>
            </div>
          </div>

          {/* End of Day */}
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-4 bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
              END OF DAY (5 minutes)
            </h3>
            <ul className="space-y-2 ml-4 text-sm text-foreground">
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" /> Update deal pipeline (move or close)</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" /> Schedule tomorrow's follow-ups</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" /> Check unallocated payments (allocate within 24 hours)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2 ml-4 italic">Why: Clean slate for tomorrow. No tasks left behind.</p>
          </div>
        </div>

        {/* Weekly Routine */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-foreground">Weekly Routine (Monday Morning)</h2>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">1. Review Last Week's Performance</h4>
              <p className="text-sm text-foreground mb-2">Check revenue, expenses, net profit, top systems, top clients</p>
              <p className="text-xs text-muted-foreground italic">Action: Identify which products are selling. Double down on winners.</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">2. Pipeline Health</h4>
              <p className="text-sm text-foreground mb-2">Deals in each stage? Any stuck for &gt;2 weeks? Projected value?</p>
              <p className="text-xs text-muted-foreground italic">Action: For stuck deals, call to move forward or mark lost.</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">3. Prospect Pipeline</h4>
              <p className="text-sm text-foreground mb-2">Prospects in each stage? Conversion rate? Average time to convert?</p>
              <p className="text-xs text-muted-foreground italic">Action: If conversion rate &lt; 20%, improve pitch or qualify better.</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">4. Financial Goals</h4>
              <p className="text-sm text-foreground mb-2">Check vault balance</p>
              <p className="text-xs text-muted-foreground italic">Goal: Vault = 6 months operating expenses. If below, increase allocation %.</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-foreground">Key Metrics to Track</h2>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">Primary Metrics (Check Daily)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-3 font-semibold">Metric</th>
                    <th className="text-left p-3 font-semibold">Where to Find</th>
                    <th className="text-left p-3 font-semibold">What It Means</th>
                    <th className="text-left p-3 font-semibold">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: 'Net Profit', where: '/app/finance', means: 'Revenue - Expenses', target: 'Positive (green)' },
                    { metric: 'Vault Balance', where: '/app/finance', means: 'Long-term savings', target: '6 months operating expenses' },
                    { metric: 'Profit Margin', where: '/app/finance', means: '(Profit / Revenue) × 100', target: '20%+' },
                    { metric: 'Active Deals', where: '/app/pipeline', means: 'Deals not Won/Lost', target: 'Keep pipeline full' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-3 font-semibold">{row.metric}</td>
                      <td className="p-3 text-muted-foreground"><Link href={row.where} className="text-blue-600 hover:underline">{row.where}</Link></td>
                      <td className="p-3 text-muted-foreground">{row.means}</td>
                      <td className="p-3 text-muted-foreground">{row.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Secondary Metrics (Check Weekly)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-3 font-semibold">Metric</th>
                    <th className="text-left p-3 font-semibold">Where to Find</th>
                    <th className="text-left p-3 font-semibold">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: 'MRR', where: '/app/finance', target: 'Grow 10% MoM' },
                    { metric: 'Conversion Rate', where: '/app/prospecting/dashboard', target: '20%+' },
                    { metric: 'Average Deal Value', where: '/app/deals', target: 'Increase over time' },
                    { metric: 'Client Count', where: '/app/clients', target: 'Grow steadily' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-3 font-semibold">{row.metric}</td>
                      <td className="p-3 text-muted-foreground"><Link href={row.where} className="text-blue-600 hover:underline">{row.where}</Link></td>
                      <td className="p-3 text-muted-foreground">{row.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Rules to Live By */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Rules to Live By</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-green-50 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                ALWAYS
              </h3>
              <ul className="space-y-2 text-sm text-foreground">
                <li>• Log every prospect interaction</li>
                <li>• Allocate payments immediately</li>
                <li>• Link deals to systems</li>
                <li>• Follow up on scheduled dates</li>
                <li>• Check financial dashboard daily</li>
              </ul>
            </div>

            <div className="p-6 bg-red-50 rounded-lg border border-red-200">
              <h3 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                NEVER
              </h3>
              <ul className="space-y-2 text-sm text-foreground">
                <li>• Create deals without systems</li>
                <li>• Forget to convert prospects</li>
                <li>• Spend from vault</li>
                <li>• Ignore unallocated payments</li>
                <li>• Let deals sit for &gt;2 weeks</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Common Scenarios */}
        <div className="bg-card rounded-xl p-8 shadow-sm mb-8">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <h2 className="text-2xl font-bold text-foreground">Common Scenarios</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-foreground mb-2">Deal is Stuck (3+ weeks)</h4>
              <p className="text-sm text-foreground mb-2">
                <strong>Action:</strong> Call the client. Ask: "What's blocking us?" Offer discount/payment plan/demo. Move to Negotiation or Lost.
              </p>
              <p className="text-xs text-muted-foreground italic">Why: Deals don't close themselves. Follow up aggressively.</p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-foreground mb-2">Prospect Goes Cold (no response to 3 emails)</h4>
              <p className="text-sm text-foreground mb-2">
                <strong>Action:</strong> Try different channel (call if emailed, WhatsApp if called). If still no response after 7 days, archive.
              </p>
              <p className="text-xs text-muted-foreground italic">Why: Don't waste time on unresponsive leads.</p>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-foreground mb-2">Client Hasn't Paid (contract active, no payment)</h4>
              <p className="text-sm text-foreground mb-2">
                <strong>Action:</strong> Check contract terms. Send reminder email/call. Log activity. If &gt;30 days overdue, escalate or pause service.
              </p>
              <p className="text-xs text-muted-foreground italic">Why: Cash flow is critical.</p>
            </div>

            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <h4 className="font-semibold text-foreground mb-2">Vault is Low (&lt;1 month expenses)</h4>
              <p className="text-sm text-foreground mb-2">
                <strong>Action:</strong> Immediately increase vault allocation to 50%. Defer non-critical expenses. Focus on closing deals this week.
              </p>
              <p className="text-xs text-red-600 italic">Why: Vault is your safety net. Without it, one bad month can sink you.</p>
            </div>
          </div>
        </div>

        {/* Final Words */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-700 text-white rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-4">Final Words</h2>
          <div className="space-y-4 text-gray-100">
            <p>
              <strong>Consty is your co-pilot, not your replacement.</strong>
            </p>
            <p>
              It won't find prospects for you. It won't close deals for you. But it <strong>will</strong>:
            </p>
            <ul className="space-y-2 ml-6">
              <li>• Remember every lead so you don't</li>
              <li>• Enforce business rules so you don't make costly mistakes</li>
              <li>• Track your money so you know exactly where you stand</li>
              <li>• Show you the truth about your business</li>
            </ul>
            <p className="pt-4 text-xl font-semibold">
              Use it every day. Trust the workflow. Let it scale with you.
            </p>
            <p className="text-2xl font-bold text-green-400 pt-4">
              Now go build your business. Consty has your back.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
