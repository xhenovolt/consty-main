/**
 * Navigation Configuration - CONSTY CONSTRUCTION OS
 *
 * Single Source of Truth for all navigation
 * Core model: Projects → Payments → Documents → Teams
 *
 * Every route here exists in /src/app/app/
 */

import {
  Home,
  Target,
  Briefcase,
  DollarSign,
  Package,
  BarChart3,
  Settings,
  Shield,
  Palette,
  Type,
  Monitor,
  Building2,
  Users,
  Activity,
  Layers,
  Workflow,
  PieChart,
  BookOpen,
  Wrench,
  Image,
  Calculator,
  ClipboardCheck,
  GitBranch,
  Brain,
  BoxSelect,
  FileText,
  Bug,
  Zap,
  Crown,
  Code2,
  BookMarked,
  Bell,
  MessageCircle,
  CreditCard,
  Tag,
  Grid3X3,
  Banknote,
  TrendingUp,
} from 'lucide-react';

/**
 * PRIMARY NAVIGATION
 * Projects → Payments → Documents → Teams
 */
export const menuItems = [
  // === PRIMARY ===
  { label: 'Dashboard', href: '/app/dashboard', icon: Home, category: 'primary', permission: 'dashboard.view' },
  { label: 'Activity', href: '/app/activity', icon: Activity, category: 'primary', module: 'activity_logs', permission: 'activity_logs.view' },
  { label: 'Notifications', href: '/app/notifications', icon: Bell, category: 'primary' },
  { label: 'Messages', href: '/app/communication', icon: MessageCircle, category: 'primary', permission: 'communication.view' },

  // ──────────────────────── DELIVER ───────────────────────
  { kind: 'header', label: 'Deliver' },
  {
    label: 'Projects',
    icon: Briefcase,
    category: 'sections',
    module: 'projects',
    submenu: [
      { label: 'All Projects', href: '/app/projects', description: 'Plan, govern and execute project work', permission: 'projects.view' },
      { label: 'New Project', href: '/app/projects?new=1', description: 'Create a new project', permission: 'projects.create' },
    ],
  },
  {
    label: 'Approvals',
    icon: ClipboardCheck,
    category: 'sections',
    submenu: [
      { label: 'Pending Approvals', href: '/app/admin/approvals', description: 'Requests awaiting your decision', permission: 'approvals.manage' },
      { label: 'Approval Pipeline', href: '/app/approval-pipeline', description: 'Visual approval workflow', permission: 'approvals.manage' },
    ],
  },
  { label: 'Reports', href: '/app/reports', icon: BarChart3, category: 'sections', module: 'reports', permission: 'reports.view' },

  // ─────────────────────── RESOURCES ──────────────────────
  { kind: 'header', label: 'Resources' },
  { label: 'Resource Catalog', href: '/app/catalog', icon: Package, category: 'sections', module: 'projects', permission: 'projects.view' },

  // ──────────────────────── RECORDS ───────────────────────
  { kind: 'header', label: 'Records' },
  {
    label: 'Documents',
    icon: FileText,
    category: 'sections',
    module: 'documents',
    permission: 'documents.view',
    submenu: [
      { label: 'Overview',            href: '/app/admin/documents',           description: 'Document module dashboard',           permission: 'documents.view' },
      { label: 'Templates',           href: '/app/admin/documents/templates', description: 'Manage document templates',          permission: 'documents.manage' },
      { label: 'Generated Documents', href: '/app/admin/documents/generated', description: 'View and manage generated documents', permission: 'documents.view' },
      { label: 'Verification Portal', href: '/app/admin/documents/verify',    description: 'Look up a document verification ID',  permission: 'documents.view' },
      { label: 'Settings',            href: '/app/admin/documents/settings',  description: 'Branding, signatures, stamps',       permission: 'documents.manage' },
    ],
  },
  { label: 'Knowledge Base', href: '/app/knowledge', icon: BookOpen, category: 'sections', module: 'knowledge', permission: 'knowledge.view' },

  // ──────────────────────── FINANCE ───────────────────────
  { kind: 'header', label: 'Finance' },
  {
    label: 'Finance',
    icon: DollarSign,
    category: 'sections',
    module: 'finance',
    submenu: [
      { label: 'Overview', href: '/app/finance', description: 'Company financial overview', permission: 'finance.view' },
      { label: 'Accounts', href: '/app/finance/accounts', description: 'Bank, cash, and collections accounts', permission: 'accounts.view' },
      { label: 'Ledger', href: '/app/finance/ledger', description: 'Transaction history', permission: 'finance.view' },
      { label: 'Expenses', href: '/app/finance/expenses', description: 'Track site and office spending', permission: 'expenses.view' },
      { label: 'Transfers', href: '/app/finance/transfers', description: 'Move funds between accounts', permission: 'finance.view' },
      { label: 'Company Budgets', href: '/app/finance/budgets', description: 'Overhead and company budget limits', permission: 'budgets.view' },
      { label: 'Project Budgets', href: '/app/finance/project-budgets', description: 'Portfolio rollup of project budgets', permission: 'budgets.view' },
      { label: '---', href: '#', description: '', permission: null },
      { label: 'Banking', href: '/app/finance/banking', description: 'Internal cash and banking controls', permission: 'finance.manage' },
      { label: 'Employee Loans', href: '/app/finance/loans', description: 'Staff loan tracking', permission: 'finance.manage' },
      { label: 'Salary Advances', href: '/app/finance/advances', description: 'Advance disbursement tracking', permission: 'finance.manage' },
    ],
  },

  // ───────────────────── ORGANISATION ─────────────────────
  { kind: 'header', label: 'Organisation' },
  {
    label: 'Team',
    icon: Users,
    category: 'sections',
    submenu: [
      { label: 'Team Members', href: '/app/staff', description: 'Field and office team members', permission: 'staff.view' },
      { label: 'Org Hierarchy', href: '/app/org-hierarchy', description: 'Department & role tree', permission: 'staff.view' },
    ],
  },
  { label: 'Clients', href: '/app/clients', icon: Building2, category: 'sections', module: 'clients', permission: 'clients.view' },

  // ──────────────────────── GOVERN ────────────────────────
  { kind: 'header', label: 'Govern' },
  {
    label: 'Admin',
    icon: Shield,
    category: 'sections',
    module: 'roles',
    minHierarchy: 3,
    submenu: [
      { label: 'Users', href: '/app/admin/users', description: 'User accounts & roles', permission: 'users.view' },
      { label: 'Roles', href: '/app/admin/roles', description: 'Manage roles & permissions', permission: 'roles.manage' },
      { label: 'Permission Manager', href: '/app/admin/role-permissions', description: 'Toggle role permissions by module', permission: 'roles.manage' },
      { label: 'Access Simulator', href: '/app/admin/access-simulator', description: 'Preview what a role can access', permission: 'roles.manage' },
      { label: 'Authority Inspector', href: '/app/admin/authority-inspector', description: 'Verify authority levels and hierarchy enforcement', permission: 'roles.manage' },
      { label: 'Departments', href: '/app/admin/departments', description: 'Department management', permission: 'departments.view' },
      { label: 'Backups', href: '/app/admin/backups', description: 'System backups & restore', permission: 'backups.view' },
      { label: 'Audit Logs', href: '/app/admin/audit-logs', description: 'System audit trail', permission: 'audit.view' },
      { label: 'Identity Debug', href: '/app/admin/debug', description: 'User–Staff–Role integrity checker', permission: 'users.view', minHierarchy: 1 },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    category: 'sections',
    submenu: [
      { label: 'General', href: '/app/settings', description: 'Account & preferences' },
      { label: 'Appearance', href: '/app/settings/appearance', icon: Palette, description: 'Colors, gradients, glass' },
      { label: 'Typography', href: '/app/settings/typography', icon: Type, description: 'Font family, size & weight' },
      { label: 'Active Sessions', href: '/app/settings/sessions', icon: Shield, description: 'Manage logged-in devices' },
    ],
  },

  // ───────── MORE (inherited — hidden behind feature flags) ─────────
  { kind: 'header', label: 'More' },
  {
    label: 'Business Development',
    icon: Target,
    category: 'sections',
    featureFlag: 'module.business_dev',
    submenu: [
      { label: 'Bid Pipeline', href: '/app/pipeline', description: 'Incoming opportunities and bids', permission: 'pipeline.view' },
      { label: 'Leads', href: '/app/prospects', description: 'Track and qualify new opportunities', permission: 'prospects.view' },
      { label: 'Bids & Proposals', href: '/app/proposals', description: 'Client proposals, bids, and submissions', permission: 'prospects.view' },
      { label: 'Follow-ups', href: '/app/followups', description: 'Scheduled commercial touchpoints', permission: 'prospects.view' },
      { label: 'Payments', href: '/app/payments', description: 'Client payment tracking', permission: 'payments.view' },
      { label: 'Invoices', href: '/app/invoices', description: 'Invoices, certificates, and billing PDFs', permission: 'invoices.view' },
    ],
  },
  {
    label: 'Company OS (legacy)',
    icon: Building2,
    category: 'sections',
    featureFlag: 'module.legacy',
    submenu: [
      { label: 'Sites & Systems', href: '/app/systems', description: 'Inherited systems registry', permission: 'systems.view' },
      { label: 'Operations Log', href: '/app/operations', description: 'Daily operations log', permission: 'operations.view' },
      { label: 'Items', href: '/app/items', description: 'Asset register (→ Resource Catalog)', permission: 'assets.view' },
      { label: 'Materials', href: '/app/products', description: 'Legacy catalog (→ Resource Catalog)', permission: 'products.view' },
      { label: 'Media', href: '/app/media', description: 'Media files (→ Documents)', permission: 'media.view' },
      { label: 'Offerings', href: '/app/offerings', description: 'Service & package catalog', permission: 'offerings.view' },
      { label: 'Services', href: '/app/services', description: 'Service catalog', permission: 'services.view' },
      { label: 'Liabilities', href: '/app/liabilities', description: 'Commitments, retention, and debts', permission: 'finance.view' },
      { label: 'Control Tower', href: '/app/control-tower', description: 'Cross-project visibility', permission: 'staff.view' },
      { label: 'Decision Log', href: '/app/decision-log', description: 'Key decisions & rationale', permission: 'decision_logs.view' },
      { label: 'HRM', href: '/app/hrm', description: 'Employees & departments', permission: 'hrm.view' },
    ],
  },
  {
    label: 'Designs', icon: Palette, category: 'sections', module: 'designs', featureFlag: 'module.designs',
    submenu: [
      { label: 'My Designs', href: '/app/designs', description: 'Design gallery & templates', permission: 'designs.view' },
      { label: 'New Design', href: '/app/designs/editor/new', description: 'Open blank canvas editor', permission: 'designs.create' },
    ],
  },
  {
    label: 'Intelligence', icon: Brain, category: 'sections', module: 'intelligence', featureFlag: 'module.intelligence',
    submenu: [
      { label: 'Dashboard', href: '/app/intelligence', description: 'Role-based intelligence overview', permission: 'intelligence.view' },
      { label: 'Financial', href: '/app/financial-intelligence', description: 'Capital allocation & revenue', permission: 'finance.view' },
      { label: 'Issue Intelligence', href: '/app/issue-intelligence', description: 'Root causes & resolutions', permission: 'issue_intelligence.view' },
    ],
  },
  {
    label: 'Pricing', icon: Tag, category: 'sections', module: 'pricing', featureFlag: 'module.pricing',
    submenu: [
      { label: 'Pricing Plans', href: '/app/pricing', description: 'Centralized pricing', permission: 'pricing.view' },
      { label: 'Subscriptions', href: '/app/subscriptions', description: 'Client subscription management', permission: 'subscriptions.view' },
    ],
  },
  {
    label: 'DRAIS Control', icon: Workflow, category: 'sections', module: 'drais', featureFlag: 'module.drais',
    submenu: [
      { label: 'Schools', href: '/app/dashboard/drais/schools', description: 'School management & control', permission: 'drais.view' },
      { label: 'Integrations', href: '/app/dashboard/integrations', description: 'External system connections', permission: 'integrations.view' },
    ],
  },
];

/**
 * Quick access links for mobile bottom navigation
 */
export const quickAccessLinks = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/app/dashboard', permission: 'dashboard.view' },
  { id: 'projects', label: 'Projects', icon: Briefcase, href: '/app/projects', permission: 'projects.view' },
  { id: 'reports', label: 'Reports', icon: BarChart3, href: '/app/reports', permission: 'reports.view' },
  { id: 'finance', label: 'Finance', icon: DollarSign, href: '/app/finance', permission: 'finance.view' },
];

/**
 * Protected routes that require authentication
 */
export const protectedRoutes = ['/app/*'];

/**
 * Settings route
 */
export const settingsRoute = {
  href: '/app/settings',
  label: 'Settings',
};

/**
 * Public routes
 */
export const publicRoutes = ['/login', '/register'];

/**
 * Get all hrefs from menu items recursively
 */
export function getAllHrefs(items = menuItems) {
  const hrefs = [];
  items.forEach((item) => {
    if (item.href) hrefs.push(item.href);
    if (item.submenu) hrefs.push(...getAllHrefs(item.submenu));
  });
  return hrefs;
}

/**
 * Find a menu item by href
 */
export function findMenuItemByHref(href, items = menuItems) {
  for (const item of items) {
    if (item.href === href) return item;
    if (item.submenu) {
      const found = findMenuItemByHref(href, item.submenu);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Check if a route is active
 */
export function isRouteActive(currentPath, menuPath) {
  return currentPath === menuPath;
}

/**
 * Get parent menu items (sections with submenus)
 */
export function getParentMenuItems(items = menuItems) {
  return items.filter((item) => item.submenu && item.submenu.length > 0);
}

/**
 * Get all valid routes (flattened)
 */
export function getAllValidRoutes() {
  const routes = [];
  function traverse(items) {
    items.forEach((item) => {
      if (item.href) routes.push({ path: item.href, label: item.label, protected: item.href.startsWith('/app') });
      if (item.submenu) traverse(item.submenu);
    });
  }
  traverse(menuItems);
  return routes;
}

// ============================================================================
// ROUTE → PERMISSION MAP
// Built from menuItems at module-load time.
// Keys are exact paths; values are permission strings like 'finance.view'.
// ============================================================================

const _routePermissionMap = {};

function _buildMap(items) {
  items.forEach((item) => {
    if (item.href) {
      if (item.permission) {
        _routePermissionMap[item.href] = item.permission;
      } else if (item.module) {
        _routePermissionMap[item.href] = `${item.module}.view`;
      }
    }
    if (item.submenu) _buildMap(item.submenu);
  });
}
_buildMap(menuItems);

/**
 * Return the required permission key for a given path, or null if open to all.
 * Tries exact match first, then walks up path segments.
 *
 * @param {string} path - e.g. '/app/finance/ledger'
 * @returns {string|null} e.g. 'finance.view'
 */
export function getRoutePermission(path) {
  if (_routePermissionMap[path]) return _routePermissionMap[path];

  // Walk up: /app/finance/ledger → /app/finance → /app (stop)
  const parts = path.split('/');
  while (parts.length > 2) {
    parts.pop();
    const parent = parts.join('/');
    if (_routePermissionMap[parent]) return _routePermissionMap[parent];
  }

  return null;
}
