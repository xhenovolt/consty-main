'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Users, Banknote, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function BankingPage() {
  const [stats, setStats] = useState({
    totalLoans: 0,
    totalAdvances: 0,
    activeAccounts: 0,
    mutationWarnings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBankingStats();
  }, []);

  const loadBankingStats = async () => {
    try {
      // Load loans
      const loansRes = await fetch('/api/finance/loans?status=approved');
      const loansData = await loansRes.json();

      // Load advances
      const advancesRes = await fetch('/api/finance/advances?status=approved');
      const advancesData = await advancesRes.json();

      // Load accounts
      const accountsRes = await fetch('/api/finance/banking/accounts');
      const accountsData = await accountsRes.json();

      setStats({
        totalLoans: loansData.total || 0,
        totalAdvances: advancesData.total || 0,
        activeAccounts: accountsData.total || 0,
        mutationWarnings: 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const modules = [
    {
      icon: Banknote,
      title: 'Employee Loans',
      description: 'Track peer-to-peer loans between staff',
      href: '/app/finance/loans',
      color: 'blue',
      stat: stats.totalLoans,
    },
    {
      icon: TrendingUp,
      title: 'Salary Advances',
      description: 'Manage advance disbursements',
      href: '/app/finance/advances',
      color: 'green',
      stat: stats.totalAdvances,
    },
    {
      icon: DollarSign,
      title: 'Banking Accounts',
      description: 'Link staff to financial accounts',
      href: '/app/finance/banking',
      color: 'purple',
      stat: stats.activeAccounts,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Banknote className="w-8 h-8" />
          Internal Banking System
        </h1>
        <p className="text-gray-600 mt-2">Manage employee financial relationships and account mutability</p>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            const colorClass = {
              blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
              green: 'bg-green-50 border-green-200 hover:bg-green-100',
              purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
            }[module.color];

            return (
              <Link
                key={module.href}
                href={module.href}
                className={`border rounded-lg p-6 transition ${colorClass}`}
              >
                <Icon className={`w-8 h-8 mb-3 text-${module.color}-600`} />
                <h2 className="text-lg font-bold mb-2">{module.title}</h2>
                <p className="text-sm text-gray-600 mb-4">{module.description}</p>
                <div className="text-2xl font-bold text-gray-900">{module.stat}</div>
                <div className="text-xs text-gray-600 mt-2">Active records</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
