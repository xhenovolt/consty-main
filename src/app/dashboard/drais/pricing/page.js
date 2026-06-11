'use client';

/**
 * DRAIS Global Pricing Control
 * 
 * CONSTY CONTROLS PRICING
 * DRAIS CONSUMES PRICING
 * 
 * This is the power move: Consty becomes the pricing controller
 * that DRAIS fetches from via API
 */

import { useState } from 'react';
import { Plus, RefreshCw, Trash2, Edit2, DollarSign } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useDRAISPricing } from '@/hooks/useDRAISSchools';
import CreatePricingPlanModal from '@/components/drais/CreatePricingPlanModal';
import EditPricingPlanModal from '@/components/drais/EditPricingPlanModal';

export default function PricingControlDashboard() {
  const { showToast } = useToast();
  const { pricing, loading, error, mutate } = useDRAISPricing(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const handleRefresh = async () => {
    await mutate();
    showToast('Pricing configuration refreshed', 'success');
  };

  const handleDelete = async (id, planName) => {
    if (!window.confirm(`Delete pricing plan "${planName}"?`)) return;

    try {
      const response = await fetch(`/api/drais/pricing/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();
      if (!data.success) throw new Error(data.error);

      showToast(`Pricing plan deleted`, 'success');
      mutate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const activePlans = pricing?.filter((p) => p.is_active) || [];
  const inactivePlans = pricing?.filter((p) => !p.is_active) || [];

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pricing Control</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Set prices that DRAIS consumes globally
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            <Plus size={16} />
            New Plan
          </button>
        </div>
      </div>

      {/* ─── STATS ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Active Plans</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{activePlans.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Plans</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{pricing?.length || 0}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Price</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              $
              {activePlans.length > 0
                ? (
                    activePlans.reduce((sum, p) => sum + parseFloat(p.price), 0) /
                    activePlans.length
                  ).toFixed(0)
                : 0}
            </p>
          </div>
        </div>
      </div>

      {/* ─── ACTIVE PLANS ────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-white">Active Pricing Plans</h2>
        </div>

        {loading && !pricing ? (
          <div className="p-8 text-center text-gray-500">Loading pricing plans...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 dark:text-red-400">{error}</div>
        ) : activePlans.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No active pricing plans</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Plan Name
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Features
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {activePlans.map((plan) => (
                <tr
                  key={plan.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {plan.plan_name}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-green-600 dark:text-green-400">
                    <div className="flex items-center gap-1">
                      <DollarSign size={14} />
                      {parseFloat(plan.price).toLocaleString()}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {plan.currency}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {plan.description || '—'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {plan.features ? `${Object.keys(JSON.parse(plan.features)).length} features` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingPlan(plan)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded dark:bg-blue-900/30"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id, plan.plan_name)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded dark:bg-red-900/30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ─── INACTIVE PLANS ───────────────────────────────────────────────── */}
      {inactivePlans.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-800">
            <h2 className="font-bold text-gray-900 dark:text-white">Inactive Plans</h2>
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {inactivePlans.map((plan) => (
                <tr
                  key={plan.id}
                  className="opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {plan.plan_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    ${parseFloat(plan.price).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">Inactive</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── INFO BOX ─────────────────────────────────────────────────────── */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex gap-3">
        <DollarSign className="text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-green-900 dark:text-green-200">
          <strong>Power Move:</strong> DRAIS fetches pricing from{' '}
          <code className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
            /api/pricing
          </code>{' '}
          endpoint. Update prices here, and schools see changes immediately in DRAIS.
        </div>
      </div>

      {/* ─── MODALS ───────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <CreatePricingPlanModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            mutate();
            showToast('Pricing plan created', 'success');
          }}
        />
      )}

      {editingPlan && (
        <EditPricingPlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSuccess={() => {
            setEditingPlan(null);
            mutate();
            showToast('Pricing plan updated', 'success');
          }}
        />
      )}
    </div>
  );
}
