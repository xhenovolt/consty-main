'use client';

import { useEffect, useState } from 'react';
import { Plus, Users, DollarSign, CheckCircle, Calendar, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';
import { PayoutModal } from '@/components/modals/PayoutModal';

export default function HRPage() {
  const [activeTab, setActiveTab] = useState('employees');
  const [staff, setStaff] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [employeeAccounts, setEmployeeAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const toast = useToast();

  useEffect(() => {
    loadHRData();
  }, [activeTab]);

  const loadHRData = async () => {
    setLoading(true);
    try {
      const requests = [];
      
      if (activeTab === 'employees' || activeTab === 'accounts') {
        requests.push(fetchWithAuth('/api/staff'));
      }
      if (activeTab === 'accounts') {
        requests.push(fetchWithAuth('/api/employee-accounts'));
      }
      if (activeTab === 'payroll') {
        requests.push(fetchWithAuth('/api/payouts'));
      }

      const results = await Promise.all(requests);
      
      for (const res of results) {
        const data = await res.json();
        if (data.success) {
          if (data.data[0]?.email) setStaff(data.data);
          else if (data.data[0]?.staff_id) {
            if (activeTab === 'accounts') setEmployeeAccounts(data.data);
            else setPayouts(data.data);
          }
        }
      }
    } catch (err) {
      toast.error('Failed to load HR data:' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openPayoutModal = (staffId) => {
    setSelectedStaffId(staffId);
    setShowPayoutModal(true);
  };

  const handlePayoutSuccess = () => {
    loadHRData();
  };

  const handleDeletePayout = async (id) => {
    if (confirm('Delete this payout record?')) {
      try {
        const res = await fetchWithAuth(`/api/payouts/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          toast.success('Payout deleted');
          loadHRData();
        }
      } catch (err) {
        toast.error('Failed to delete payout');
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <Users className={styles.icon} />
          <h1>HR Module</h1>
          <p>Manage employees, payroll, and human resources</p>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'employees' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('employees')}
        >
          <Users size={18} /> Employees
        </button>
        <button
          className={activeTab === 'accounts' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('accounts')}
        >
          <DollarSign size={18} /> Employee Accounts
        </button>
        <button
          className={activeTab === 'payroll' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('payroll')}
        >
          <CheckCircle size={18} /> Payroll
        </button>
      </div>

      {/* EMPLOYEES TAB */}
      {activeTab === 'employees' && (
        <div className={styles.tabContent}>
          <div className={styles.section}>
            <h2>Staff Directory</h2>
            {loading ? (
              <div className={styles.loading}>Loading employees...</div>
            ) : staff.length === 0 ? (
              <div className={styles.empty}>No employees found. <a href="/app/staff">Add employees</a></div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Salary</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(emp => (
                      <tr key={emp.id}>
                        <td><strong>{emp.name}</strong></td>
                        <td>{emp.email}</td>
                        <td>{emp.role_name || 'Unassigned'}</td>
                        <td>{emp.dept_name || 'Unassigned'}</td>
                        <td>
                          <span className={`${styles.badge} ${
                            emp.employment_status === 'active' ? styles.success :
                            emp.employment_status === 'on_leave' ? styles.warning :
                            styles.error
                          }`}>
                            {emp.employment_status || 'active'}
                          </span>
                        </td>
                        <td>
                          {emp.salary ? `UGX ${parseFloat(emp.salary).toLocaleString()}` : '-'}
                        </td>
                        <td>
                          <button
                            onClick={() => openPayoutModal(emp.id)}
                            className={styles.actionBtn}
                            title="Record payment"
                          >
                            <DollarSign size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EMPLOYEE ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <div className={styles.tabContent}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Employee Accounts</h2>
              <button className={styles.btn} onClick={() => {/* TODO: Add employee account modal */}}>
                <Plus size={18} /> Link Account
              </button>
            </div>
            {loading ? (
              <div className={styles.loading}>Loading accounts...</div>
            ) : employeeAccounts.length === 0 ? (
              <div className={styles.empty}>No employee accounts linked</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Account</th>
                      <th>Currency</th>
                      <th>Current Balance</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeAccounts.map(acc => (
                      <tr key={acc.id}>
                        <td><strong>{acc.staff_name}</strong></td>
                        <td>{acc.account_name}</td>
                        <td>{acc.currency}</td>
                        <td>
                          {acc.currency} {parseFloat(acc.balance).toLocaleString()}
                        </td>
                        <td>
                          <span className={`${styles.badge} ${
                            acc.status === 'active' ? styles.success :
                            acc.status === 'suspended' ? styles.warning :
                            styles.error
                          }`}>
                            {acc.status}
                          </span>
                        </td>
                        <td>
                          <button className={styles.actionBtn} title="Edit">
                            <Edit2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PAYROLL TAB */}
      {activeTab === 'payroll' && (
        <div className={styles.tabContent}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Payroll History</h2>
              <button
                className={styles.btn}
                onClick={() => {
                  setSelectedStaffId(null);
                  setShowPayoutModal(true);
                }}
              >
                <Plus size={18} /> Record Payout
              </button>
            </div>
            {loading ? (
              <div className={styles.loading}>Loading payroll...</div>
            ) : payouts.length === 0 ? (
              <div className={styles.empty}>No payouts recorded</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Reference</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map(payout => (
                      <tr key={payout.id}>
                        <td><strong>{payout.staff_name}</strong></td>
                        <td>
                          <span className={`${styles.badge} ${styles.info}`}>
                            {payout.payout_type}
                          </span>
                        </td>
                        <td>
                          {payout.currency} {parseFloat(payout.amount).toLocaleString()}
                        </td>
                        <td>{new Date(payout.payout_date).toLocaleDateString()}</td>
                        <td>
                          <span className={`${styles.badge} ${
                            payout.status === 'completed' ? styles.success :
                            payout.status === 'pending' ? styles.warning :
                            payout.status === 'processed' ? styles.info :
                            styles.error
                          }`}>
                            {payout.status}
                          </span>
                        </td>
                        <td>{payout.reference || '-'}</td>
                        <td>
                          <button
                            className={styles.actionBtn}
                            onClick={() => handleDeletePayout(payout.id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <PayoutModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        staffId={selectedStaffId}
        onSuccess={handlePayoutSuccess}
      />
    </div>
  );
}
