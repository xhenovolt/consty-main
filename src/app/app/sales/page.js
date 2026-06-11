'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Edit2, Trash2, Eye, DollarSign, TrendingUp } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { formatCurrency, getStatusColor, getStatusBgColor, calculatePaymentProgress } from '@/lib/sales';
import { useToast } from '@/components/ui/Toast';
import { confirmDelete } from '@/lib/confirm';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    product_service: '',
    quantity: '',
    unit_price: '',
    sale_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    notes: '',
  });

  // Fetch sales with filters
  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
      });

      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetchWithAuth(`/api/sales?${params}`);
      const result = await response.json();

      if (result.success) {
        setSales(result.data);
        setTotalPages(result.pagination.pages);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, statusFilter, startDate, endDate]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter) params.append('status', statusFilter);

      const response = await fetchWithAuth(`/api/sales/report?${params}`);
      const result = await response.json();

      if (result.success) {
        setMetrics(result.data.metrics);
      }
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  }, [startDate, endDate, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchSales();
    fetchMetrics();
  }, [fetchSales, fetchMetrics]);

  // Handle form changes
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({ ...prev, [name]: value }));
  };

  // Add new sale
  const handleAddSale = async (e) => {
    e.preventDefault();
    try {
      if (!formData.customer_name || !formData.product_service || !formData.quantity || formData.unit_price === '') {
        setError('Please fill in all required fields');
        return;
      }

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity),
          unit_price: parseFloat(formData.unit_price),
        }),
      });

      const result = await response.json();
      if (result.success) {
        setFormData({
          customer_name: '',
          customer_email: '',
          product_service: '',
          quantity: '',
          unit_price: '',
          sale_date: new Date().toISOString().split('T')[0],
          notes: '',
        });
        setShowAddModal(false);
        fetchSales();
        fetchMetrics();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Update sale
  const handleUpdateSale = async (e) => {
    e.preventDefault();
    try {
      const response = await fetchWithAuth(`/api/sales/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          product_service: formData.product_service,
          quantity: parseInt(formData.quantity),
          unit_price: parseFloat(formData.unit_price),
          sale_date: formData.sale_date,
          notes: formData.notes,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setEditingId(null);
        setFormData({
          customer_name: '',
          customer_email: '',
          product_service: '',
          quantity: '',
          unit_price: '',
          sale_date: new Date().toISOString().split('T')[0],
          notes: '',
        });
        setShowAddModal(false);
        fetchSales();
        fetchMetrics();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete sale
  const handleDeleteSale = async (id) => {
    if (!await confirmDelete('sale')) return;

    try {
      const response = await fetchWithAuth(`/api/sales/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        fetchSales();
        fetchMetrics();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Add payment
  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      if (!paymentData.amount || parseFloat(paymentData.amount) <= 0) {
        setError('Please enter a valid amount');
        return;
      }

      const response = await fetchWithAuth(`/api/sales/${selectedSale.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(paymentData.amount),
          payment_date: paymentData.payment_date,
          payment_method: paymentData.payment_method,
          notes: paymentData.notes,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setPaymentData({
          amount: '',
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: 'Bank Transfer',
          notes: '',
        });
        setShowPaymentModal(false);
        // Refresh sale details
        const detailResponse = await fetchWithAuth(`/api/sales/${selectedSale.id}`);
        const detailResult = await detailResponse.json();
        if (detailResult.success) {
          setSelectedSale(detailResult.data);
        }
        fetchSales();
        fetchMetrics();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // View details
  const handleViewDetails = async (saleId) => {
    try {
      const response = await fetchWithAuth(`/api/sales/${saleId}`);
      const result = await response.json();
      if (result.success) {
        setSelectedSale(result.data);
        setShowDetailsModal(true);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Edit sale
  const handleEditSale = (sale) => {
    setFormData({
      customer_name: sale.customer_name,
      customer_email: sale.customer_email || '',
      product_service: sale.product_service,
      quantity: sale.quantity.toString(),
      unit_price: sale.unit_price.toString(),
      sale_date: sale.sale_date.split('T')[0],
      notes: sale.notes || '',
    });
    setEditingId(sale.id);
    setShowAddModal(true);
  };

  // Metric cards
  const MetricCard = ({ label, value, icon: Icon, color }) => (
    <div className="bg-card rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${color}`} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-foreground">Sales Management</h1>
            <button
              onClick={() => {
                setEditingId(null);
                setFormData({
                  customer_name: '',
                  customer_email: '',
                  product_service: '',
                  quantity: '',
                  unit_price: '',
                  sale_date: new Date().toISOString().split('T')[0],
                  notes: '',
                });
                setShowAddModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Sale
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Total Revenue"
              value={formatCurrency(metrics.total_revenue)}
              icon={DollarSign}
              color="text-green-600 dark:text-green-400"
            />
            <MetricCard
              label="Total Collected"
              value={formatCurrency(metrics.total_collected)}
              icon={TrendingUp}
              color="text-blue-600 dark:text-blue-400"
            />
            <MetricCard
              label="Outstanding"
              value={formatCurrency(metrics.total_outstanding)}
              icon={DollarSign}
              color="text-red-600 dark:text-red-400"
            />
            <MetricCard
              label="Collection Rate"
              value={`${metrics.collection_rate}%`}
              icon={TrendingUp}
              color="text-purple-600 dark:text-purple-400"
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-card rounded-lg p-4 border border-border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Search customer or product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : sales.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No sales found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Customer</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Product</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Qty</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Total</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Status</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Payment</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-gray-700">
                    {sales.map((sale) => {
                      // some records may originate from a deal that hasn't been converted yet
                      const recordKey = sale.id || sale.sale_id || sale.deal_id || Math.random();
                      const isConverted = !!(sale.id || sale.sale_id);
                      return (
                        <tr key={recordKey} className="hover:bg-muted dark:hover:bg-muted transition-colors">
                        <td className="px-6 py-4 text-sm text-foreground">{sale.customer_name}</td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">{sale.product_service}</td>
                        <td className="px-6 py-4 text-sm text-foreground">{sale.quantity}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-foreground">
                          {formatCurrency(sale.total_amount)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBgColor(sale.status)} ${getStatusColor(sale.status)}`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full"
                                  style={{ width: `${calculatePaymentProgress(sale.total_amount, sale.total_paid)}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {Math.round(calculatePaymentProgress(sale.total_amount, sale.total_paid))}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => isConverted && handleViewDetails(sale.id || sale.sale_id)}
                              disabled={!isConverted}
                              className={`p-2 rounded transition-colors ${!isConverted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted dark:hover:bg-muted'}`}
                              title={isConverted ? 'View details' : 'Convert deal to sale to view'}
                            >
                              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </button>
                            <button
                              onClick={() => isConverted && handleEditSale(sale)}
                              disabled={!isConverted}
                              className={`p-2 rounded transition-colors ${!isConverted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted dark:hover:bg-muted'}`}
                              title={isConverted ? 'Edit' : 'Cannot edit unrecorded sale'}
                            >
                              <Edit2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </button>
                            <button
                              onClick={() => isConverted && handleDeleteSale(sale.id || sale.sale_id)}
                              disabled={!isConverted}
                              className={`p-2 rounded transition-colors ${!isConverted ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted dark:hover:bg-muted'}`}
                              title={isConverted ? 'Delete' : 'Cannot delete until sale is recorded'}
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-border flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-border rounded-lg disabled:opacity-50 hover:bg-muted dark:hover:bg-muted transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-border rounded-lg disabled:opacity-50 hover:bg-muted dark:hover:bg-muted transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Sale Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">
                {editingId ? 'Edit Sale' : 'Add New Sale'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingId(null);
                }}
                className="text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={editingId ? handleUpdateSale : handleAddSale} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground">Customer Name *</label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleFormChange}
                  required
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Email</label>
                <input
                  type="email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleFormChange}
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Product/Service *</label>
                <input
                  type="text"
                  name="product_service"
                  value={formData.product_service}
                  onChange={handleFormChange}
                  required
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground">Quantity *</label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleFormChange}
                    required
                    min="1"
                    className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">Unit Price *</label>
                  <input
                    type="number"
                    name="unit_price"
                    value={formData.unit_price}
                    onChange={handleFormChange}
                    required
                    step="0.01"
                    min="0"
                    className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formData.quantity && formData.unit_price && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Total Amount: <span className="font-bold">{formatCurrency(parseFloat(formData.quantity) * parseFloat(formData.unit_price))}</span>
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground">Sale Date</label>
                <input
                  type="date"
                  name="sale_date"
                  value={formData.sale_date}
                  onChange={handleFormChange}
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleFormChange}
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  {editingId ? 'Update Sale' : 'Add Sale'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingId(null);
                  }}
                  className="flex-1 border border-border text-foreground px-4 py-2 rounded-lg hover:bg-muted dark:hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Details Modal */}
      {showDetailsModal && selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Sale Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Sale Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="text-lg font-semibold text-foreground">{selectedSale.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-lg font-semibold text-foreground">{selectedSale.customer_email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product/Service</p>
                  <p className="text-lg font-semibold text-foreground">{selectedSale.product_service}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={`inline-block mt-1 px-3 py-1 text-xs font-semibold rounded-full ${getStatusBgColor(selectedSale.status)} ${getStatusColor(selectedSale.status)}`}>
                    {selectedSale.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quantity</p>
                  <p className="text-lg font-semibold text-foreground">{selectedSale.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unit Price</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(selectedSale.unit_price)}</p>
                </div>
              </div>

              {/* Amount Summary */}
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(selectedSale.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Paid:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(selectedSale.total_paid)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between">
                  <span className="text-muted-foreground">Remaining Balance:</span>
                  <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(selectedSale.remaining_balance)}</span>
                </div>
              </div>

              {/* Payment Progress */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Payment Progress</span>
                  <span className="text-sm font-semibold text-foreground">
                    {Math.round(calculatePaymentProgress(selectedSale.total_amount, selectedSale.total_paid))}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${calculatePaymentProgress(selectedSale.total_amount, selectedSale.total_paid)}%` }}
                  />
                </div>
              </div>

              {/* Payments History */}
              {selectedSale.payments && selectedSale.payments.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground mb-4">Payment History</h3>
                  <div className="space-y-2">
                    {selectedSale.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex justify-between items-center p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-foreground">{formatCurrency(payment.amount)}</p>
                          <p className="text-sm text-muted-foreground">
                            {payment.payment_method} • {new Date(payment.payment_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              {selectedSale.remaining_balance > 0 && (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setShowPaymentModal(true);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  Add Payment
                </button>
              )}

              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full border border-border text-foreground px-4 py-2 rounded-lg hover:bg-muted dark:hover:bg-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">Add Payment</h2>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Sale Amount</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(selectedSale.total_amount)}</p>
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Remaining Balance</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(selectedSale.remaining_balance)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Payment Amount *</label>
                <input
                  type="number"
                  name="amount"
                  value={paymentData.amount}
                  onChange={handlePaymentChange}
                  required
                  step="0.01"
                  min="0"
                  max={selectedSale.remaining_balance}
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Payment Method</label>
                <select
                  name="payment_method"
                  value={paymentData.payment_method}
                  onChange={handlePaymentChange}
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Payment Date</label>
                <input
                  type="date"
                  name="payment_date"
                  value={paymentData.payment_date}
                  onChange={handlePaymentChange}
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">Notes</label>
                <textarea
                  name="notes"
                  value={paymentData.notes}
                  onChange={handlePaymentChange}
                  className="mt-1 w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  Record Payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 border border-border text-foreground px-4 py-2 rounded-lg hover:bg-muted dark:hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
