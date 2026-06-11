'use client';

import { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, Receipt, PiggyBank } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency } from '@/lib/format-currency';
import Link from 'next/link';

function StatCard({ label, value, icon: Icon, color = 'blue', href }) {
  const Card = (
    <div className={`bg-card rounded-xl border p-5 ${href ? 'hover:border-blue-300 transition cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Icon className="w-3.5 h-3.5" />{label}</div>
      <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{Card}</Link> : Card;
}

export default function FinancePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchWithAuth('/api/reports?type=overview');
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;


  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance</h1>
        <p className="text-sm text-muted-foreground mt-1">Financial overview and quick links</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Balance" value={formatCurrency(data?.accounts?.reduce((s, a) => s + parseFloat(a.balance || 0), 0) || 0)} icon={Wallet} color="blue" href="/app/finance/accounts" />
        <StatCard label="Total Income" value={formatCurrency(data?.financial?.total_income)} icon={TrendingUp} color="emerald" href="/app/finance/ledger" />
        <StatCard label="Total Expenses" value={formatCurrency(data?.financial?.total_expenses)} icon={TrendingDown} color="red" href="/app/finance/expenses" />
        <StatCard label="Net Position" value={formatCurrency(data?.financial?.net_position)} icon={DollarSign} color="purple" />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { href: '/app/finance/accounts', icon: Wallet, name: 'Accounts', desc: 'Manage bank and cash accounts' },
          { href: '/app/finance/ledger', icon: DollarSign, name: 'Ledger', desc: 'Full transaction history' },
          { href: '/app/finance/expenses', icon: Receipt, name: 'Expenses', desc: 'Track and categorize expenses' },
          { href: '/app/finance/transfers', icon: ArrowRightLeft, name: 'Transfers', desc: 'Move money between accounts' },
          { href: '/app/finance/budgets', icon: PiggyBank, name: 'Budgets', desc: 'Set and track spending limits' },
        ].map(link => (
          <Link key={link.href} href={link.href} className="bg-card rounded-xl border p-5 hover:border-blue-300 hover:shadow-sm transition">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><link.icon className="w-5 h-5 text-blue-600" /></div>
              <div>
                <div className="font-medium text-foreground">{link.name}</div>
                <div className="text-xs text-muted-foreground">{link.desc}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Account Balances Preview */}
      {data?.accounts && data.accounts.length > 0 && (
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Account Balances</h2>
            <Link href="/app/finance/accounts" className="text-sm text-blue-600 hover:text-blue-700">View All</Link>
          </div>
          <div className="divide-y">
            {data.accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${parseFloat(a.balance) >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-foreground">{a.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{a.type}</span>
                </div>
                <span className={`text-sm font-medium ${parseFloat(a.balance) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(a.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
