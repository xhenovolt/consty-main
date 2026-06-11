'use client';

import { useEffect, useState } from 'react';
import { Users, Building2, Plus, Mail, Phone, X, ChevronRight, UserPlus, Briefcase, Award } from 'lucide-react';
import { fetchWithAuth } from '@/lib/fetch-client';
import { useToast } from '@/components/ui/Toast';

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700', on_leave: 'bg-yellow-100 text-yellow-700',
  terminated: 'bg-red-100 text-red-700', contractor: 'bg-blue-100 text-blue-700',
};

export default function HRMPage() {
  const [tab, setTab] = useState('employees');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [empForm, setEmpForm] = useState({ first_name: '', last_name: '', email: '', phone: '', position: '', department_id: '', employment_type: 'full_time', salary: '', hire_date: new Date().toISOString().split('T')[0] });
  const [deptForm, setDeptForm] = useState({ name: '', description: '', head_employee_id: '' });
  const toast = useToast();

  const fetchData = async () => {
    try {
      const [empRes, deptRes] = await Promise.all([
        fetchWithAuth('/api/employees').then(r => r.json ? r.json() : r),
        fetchWithAuth('/api/departments').then(r => r.json ? r.json() : r),
      ]);
      if (empRes.success) {
        setEmployees(empRes.data || []);
        setStats(empRes.stats || {});
      }
      if (deptRes.success) setDepartments(deptRes.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const submitEmployee = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...empForm };
      if (payload.salary) payload.salary = parseFloat(payload.salary);
      const res = await fetchWithAuth('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = res.json ? await res.json() : res;
      if (json.success) {
        toast.success('Employee added');
        setShowForm(false);
        setEmpForm({ first_name: '', last_name: '', email: '', phone: '', position: '', department_id: '', employment_type: 'full_time', salary: '', hire_date: new Date().toISOString().split('T')[0] });
        fetchData();
      }
    } catch (err) { console.error(err); }
  };

  const submitDepartment = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim()) { toast.error('Department name is required'); return; }
    try {
      const res = await fetchWithAuth('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(deptForm) });
      const json = res.json ? await res.json() : res;
      if (json.success) {
        toast.success(`Department "${deptForm.name}" created`);
        setShowDeptForm(false);
        setDeptForm({ name: '', description: '', head_employee_id: '' });
        fetchData();
      } else {
        toast.error(json.error || 'Failed to create department');
      }
    } catch (err) { toast.error('Failed to create department'); console.error(err); }
  };

  const formatSalary = (v) => v ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v) : '—';

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Human Resources</h1>
        <p className="text-sm text-muted-foreground mt-1">Employee management, departments, and organizational structure</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="w-4 h-4" /> Active Employees</div>
          <div className="text-2xl font-bold text-foreground mt-1">{stats.active_count || 0}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="w-4 h-4" /> Departments</div>
          <div className="text-2xl font-bold text-foreground mt-1">{departments.length}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Briefcase className="w-4 h-4" /> Total Staff</div>
          <div className="text-2xl font-bold text-foreground mt-1">{employees.length}</div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Award className="w-4 h-4" /> Monthly Payroll</div>
          <div className="text-2xl font-bold text-foreground mt-1">{formatSalary(stats.total_salary)}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[{ id: 'employees', label: 'Employees', icon: Users }, { id: 'departments', label: 'Departments', icon: Building2 }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Employees Tab */}
      {tab === 'employees' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <UserPlus className="w-4 h-4" /> Add Employee
            </button>
          </div>

          {showForm && (
            <form onSubmit={submitEmployee} className="bg-card rounded-xl border p-5 space-y-3">
              <div className="flex justify-between items-center"><h3 className="font-semibold">Add Employee</h3><button type="button" onClick={() => setShowForm(false)}><X className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div><label className="text-xs text-muted-foreground">First Name *</label><input value={empForm.first_name} onChange={e => setEmpForm(f => ({ ...f, first_name: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Last Name *</label><input value={empForm.last_name} onChange={e => setEmpForm(f => ({ ...f, last_name: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Email *</label><input type="email" value={empForm.email} onChange={e => setEmpForm(f => ({ ...f, email: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Phone</label><input value={empForm.phone} onChange={e => setEmpForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Position *</label><input value={empForm.position} onChange={e => setEmpForm(f => ({ ...f, position: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Department</label><select value={empForm.department_id} onChange={e => setEmpForm(f => ({ ...f, department_id: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background"><option value="">None</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label className="text-xs text-muted-foreground">Employment Type</label><select value={empForm.employment_type} onChange={e => setEmpForm(f => ({ ...f, employment_type: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background">{['full_time', 'part_time', 'contractor', 'intern'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
                <div><label className="text-xs text-muted-foreground">Salary</label><input type="number" step="0.01" value={empForm.salary} onChange={e => setEmpForm(f => ({ ...f, salary: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Hire Date</label><input type="date" value={empForm.hire_date} onChange={e => setEmpForm(f => ({ ...f, hire_date: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Add Employee</button>
            </form>
          )}

          <div className="bg-card rounded-xl border divide-y">
            {employees.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No employees yet</p></div>
            ) : employees.map(emp => (
              <div key={emp.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-medium text-sm shrink-0">
                      {emp.first_name?.[0]}{emp.last_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-foreground truncate">{emp.first_name} {emp.last_name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[emp.status] || 'bg-gray-100 text-gray-600'}`}>{emp.status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{emp.position}</span>
                        {emp.department_name && <span>• {emp.department_name}</span>}
                        {emp.email && <span className="hidden sm:flex items-center gap-1"><Mail className="w-3 h-3" />{emp.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right ml-13 sm:ml-0 shrink-0">
                    <div className="text-sm font-medium text-foreground">{formatSalary(emp.salary)}</div>
                    <div className="text-xs text-muted-foreground">{emp.employment_type?.replace(/_/g, ' ')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {tab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowDeptForm(true)} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" /> Add Department
            </button>
          </div>

          {showDeptForm && (
            <form onSubmit={submitDepartment} className="bg-card rounded-xl border p-5 space-y-3">
              <div className="flex justify-between items-center"><h3 className="font-semibold">Add Department</h3><button type="button" onClick={() => setShowDeptForm(false)}><X className="w-4 h-4" /></button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs text-muted-foreground">Name *</label><input value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
                <div><label className="text-xs text-muted-foreground">Department Head</label><select value={deptForm.head_employee_id} onChange={e => setDeptForm(f => ({ ...f, head_employee_id: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm bg-background"><option value="">None</option>{employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}</select></div>
                <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Description</label><textarea value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm bg-background" /></div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create Department</button>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departments.map(dept => (
              <div key={dept.id} className="bg-card rounded-xl border p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-600" /> {dept.name}
                    </h3>
                    {dept.description && <p className="text-sm text-muted-foreground mt-1">{dept.description}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground"><Users className="w-4 h-4" /> {dept.employee_count || 0} employees</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><Briefcase className="w-4 h-4" /> {dept.role_count || 0} roles</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
