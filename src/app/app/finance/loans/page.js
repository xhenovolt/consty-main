'use client';

import { useState, useEffect } from 'react';
import { Plus, Check, X } from 'lucide-react';

export default function EmployeeLoansPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    from_staff_id: '',
    to_staff_id: '',
    amount: '',
    description: '',
  });
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [loansRes, staffRes] = await Promise.all([
        fetch('/api/finance/loans'),
        fetch('/api/staff'),
      ]);

      const loansData = await loansRes.json();
      const staffData = await staffRes.json();

      setLoans(loansData.loans || []);
      setStaff(staffData.staff || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createLoan = async (e) => {
    e.preventDefault();
    if (!form.from_staff_id || !form.to_staff_id || !form.amount) return;

    try {
      const res = await fetch('/api/finance/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        loadData();
        setForm({ from_staff_id: '', to_staff_id: '', amount: '', description: '' });
        setShowForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateLoanStatus = async (loanId, status) => {
    try {
      const res = await fetch(`/api/finance/loans/${loanId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  const statusColors = {
    pending: 'bg-yellow-50 border-yellow-200',
    approved: 'bg-green-50 border-green-200',
    repaid: 'bg-blue-50 border-blue-200',
    defaulted: 'bg-red-50 border-red-200',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Employee Loans</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Loan
        </button>
      </div>

      {showForm && (
        <form onSubmit={createLoan} className="bg-white border rounded-lg p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Loaning Staff</label>
              <select
                value={form.from_staff_id}
                onChange={(e) => setForm({ ...form, from_staff_id: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              >
                <option value="">Select...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Borrowing Staff</label>
              <select
                value={form.to_staff_id}
                onChange={(e) => setForm({ ...form, to_staff_id: e.target.value })}
                className="w-full border rounded px-3 py-2"
                required
              >
                <option value="">Select...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount (UGX)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Reason for loan..."
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              Create Loan
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-300 text-gray-900 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {loans.map((loan) => (
          <div key={loan.id} className={`border rounded-lg p-4 ${statusColors[loan.status] || 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">
                  {loan.from_staff_name} → {loan.to_staff_name}
                </p>
                <p className="text-sm text-gray-600">UGX {loan.amount.toLocaleString()}</p>
                {loan.description && <p className="text-xs text-gray-600 mt-1">{loan.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-white rounded text-xs font-medium">{loan.status}</span>
                {loan.status === 'pending' && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateLoanStatus(loan.id, 'approved')}
                      className="bg-green-600 text-white p-1 rounded hover:bg-green-700"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateLoanStatus(loan.id, 'rejected')}
                      className="bg-red-600 text-white p-1 rounded hover:bg-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {loan.status === 'approved' && (
                  <button
                    onClick={() => updateLoanStatus(loan.id, 'repaid')}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Mark Repaid
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {loans.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No employee loans yet</p>
        </div>
      )}
    </div>
  );
}
