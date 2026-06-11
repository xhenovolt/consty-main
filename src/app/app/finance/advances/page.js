'use client';

import { useState, useEffect } from 'react';
import { Plus, CheckCircle, Warning } from 'lucide-react';

export default function SalaryAdvancesPage() {
  const [advances, setAdvances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    staff_id: '',
    amount: '',
    reason: '',
  });
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [advancesRes, staffRes] = await Promise.all([
        fetch('/api/finance/advances'),
        fetch('/api/staff'),
      ]);

      const advancesData = await advancesRes.json();
      const staffData = await staffRes.json();

      setAdvances(advancesData.advances || []);
      setStaff(staffData.staff || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createAdvance = async (e) => {
    e.preventDefault();
    if (!form.staff_id || !form.amount || !form.reason) return;

    try {
      const res = await fetch('/api/finance/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        loadData();
        setForm({ staff_id: '', amount: '', reason: '' });
        setShowForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (advanceId, status) => {
    try {
      const res = await fetch(`/api/finance/advances/${advanceId}`, {
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
    approved: 'bg-blue-50 border-blue-200',
    disbursed: 'bg-green-50 border-green-200',
    recovered: 'bg-gray-50 border-gray-200',
  };

  const reasonEmojis = {
    medical: '🏥',
    emergency: '🚨',
    education: '📚',
    family: '👨‍👩‍👧‍👦',
    other: '📝',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Salary Advances</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Request Advance
        </button>
      </div>

      {showForm && (
        <form onSubmit={createAdvance} className="bg-white border rounded-lg p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Staff Member</label>
              <select
                value={form.staff_id}
                onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Reason</label>
              <input
                type="text"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Medical emergency, education, etc..."
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              Request Advance
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
        {advances.map((advance) => (
          <div key={advance.id} className={`border rounded-lg p-4 ${statusColors[advance.status] || 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium">
                  {advance.first_name} {advance.last_name} - UGX {advance.amount.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">{advance.reason}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-white rounded text-xs font-medium">{advance.status}</span>
                {advance.status === 'pending' && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => updateStatus(advance.id, 'approved')}
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(advance.id, 'rejected')}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {advance.status === 'approved' && (
                  <button
                    onClick={() => updateStatus(advance.id, 'disbursed')}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    Mark Disbursed
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {advances.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No salary advances yet</p>
        </div>
      )}
    </div>
  );
}
