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
  {
    label: 'Dashboard',
    href: '/app/dashboard',
    icon: Home,
    category: 'primary',
    permission: 'dashboard.view',
  },
  {
    label: 'Command Center',
    href: '/app/command-center',
    icon: Zap,
    category: 'primary',
    permission: 'command_center.view',
    minHierarchy: 3,
  },
  {
    label: 'Activity',
    href: '/app/activity',
    icon: Activity,
    category: 'primary',
    module: 'activity_logs',
    permission: 'activity_logs.view',
  },
  {
    label: 'Notifications',
    href: '/app/notifications',
    icon: Bell,
    category: 'primary',
    // Visible to all authenticated users — no permission required
  },
  {
    label: 'Messages',
    href: '/app/communication',
    icon: MessageCircle,
    category: 'primary',
    permission: 'communication.view',
  },

  // === SITES & SYSTEMS ===
  {
    label: 'Sites & Systems',
    icon: Monitor,
    category: 'sections',
    module: 'systems',
    submenu: [
      { label: 'Site Systems', href: '/app/systems', description: 'Project systems, tools, and delivery infrastructure', permission: 'systems.view' },
      { label: 'Licenses', href: '/app/licenses', description: 'Active software and access licenses', permission: 'licenses.view' },
      { label: 'Operations Log', href: '/app/operations', description: 'Daily site and operations log', permission: 'operations.view' },
      { label: 'Platform Costs', href: '/app/system-costs', description: 'Technology and platform overhead tracking', permission: 'systems.view' },
    ],
  },

  // === SERVICES ===
  {
    label: 'Services',
    href: '/app/services',
    icon: Layers,
    category: 'sections',
    module: 'services',
    permission: 'services.view',
  },

  // === PRE-CONSTRUCTION ===
  {
    label: 'Project Pipeline',
    icon: Target,
    category: 'sections',
    module: 'pipeline',
    submenu: [
      { label: 'Bid Pipeline', href: '/app/pipeline', description: 'Visual view of incoming opportunities and bids', permission: 'pipeline.view' },
      { label: 'Leads', href: '/app/prospects', description: 'Track and qualify new opportunities', permission: 'prospects.view' },
      { label: 'Bids & Proposals', href: '/app/proposals', description: 'Client proposals, bids, and submissions', permission: 'prospects.view' },
      { label: 'Follow-ups', href: '/app/followups', description: 'Scheduled commercial touchpoints', permission: 'prospects.view' },
      { label: 'Clients', href: '/app/clients', description: 'Awarded and active clients', permission: 'clients.view' },
    ],
  },

  // === PROJECTS & BILLING ===
  {
    label: 'Projects',
    icon: Briefcase,
    category: 'sections',
    module: 'deals',
    submenu: [
      { label: 'All Projects', href: '/app/deals', description: 'Active, completed, and archived project work', permission: 'deals.view' },
      { label: 'New Project', href: '/app/deals/new', description: 'Create a new project record', permission: 'deals.create' },
      { label: 'Site Tasks', href: '/app/obligations', description: 'Track obligations, deliverables, and site actions', permission: 'obligations.view' },
      { label: 'Payments', href: '/app/payments', description: 'Client payment tracking', permission: 'payments.view' },
      { label: 'Invoices', href: '/app/invoices', description: 'Invoices, certificates, and billing PDFs', permission: 'invoices.view' },
      { label: 'Budget Allocations', href: '/app/allocations', description: 'Project fund allocation tracking', permission: 'allocations.view' },
    ],
  },

  // === PRODUCTS ===
  {
    label: 'Materials',
    href: '/app/products',
    icon: Package,
    category: 'sections',
    module: 'products',
    permission: 'products.view',
  },

  // === OPERATIONS ===
  {
    label: 'Operations',
    icon: Building2,
    category: 'sections',
    submenu: [
      { label: 'Team Members', href: '/app/staff', description: 'Field and office team members', permission: 'staff.view' },
      { label: 'Org Hierarchy', href: '/app/org-hierarchy', description: 'Department & role tree', permission: 'staff.view' },
      { label: 'Control Tower', href: '/app/control-tower', description: 'Cross-project visibility and structural health', permission: 'staff.view' },
      { label: 'Items', href: '/app/items', description: 'Materials, tools, and shared assets', permission: 'assets.view' },
      { label: 'Knowledge Base', href: '/app/knowledge', description: 'Standard procedures and project knowledge', permission: 'knowledge.view' },
      { label: 'Liabilities', href: '/app/liabilities', description: 'Commitments, retention, and debts', permission: 'finance.view' },
      { label: 'Offerings', href: '/app/offerings', description: 'Service and package catalog', permission: 'offerings.view' },
      { label: 'Media', href: '/app/media', description: 'Site photos, files, and project media', permission: 'media.view' },
    ],
  },

  // === FINANCE ===
  {
    label: 'Finance',
    icon: DollarSign,
    category: 'sections',
    module: 'finance',
    submenu: [
      { label: 'Overview', href: '/app/finance', description: 'Financial dashboard', permission: 'finance.view' },
      { label: 'Accounts', href: '/app/finance/accounts', description: 'Bank, cash, and collections accounts', permission: 'accounts.view' },
      { label: 'Ledger', href: '/app/finance/ledger', description: 'Project transaction history', permission: 'finance.view' },
      { label: 'Expenses', href: '/app/finance/expenses', description: 'Track site and office spending', permission: 'expenses.view' },
      { label: 'Transfers', href: '/app/finance/transfers', description: 'Move funds between accounts', permission: 'finance.view' },
      { label: 'Budgets', href: '/app/finance/budgets', description: 'Project and overhead budget limits', permission: 'budgets.view' },
      { label: '---', href: '#', description: '', permission: null },
      { label: 'Banking', href: '/app/finance/banking', description: 'Internal cash and banking controls', permission: 'finance.manage' },
      { label: 'Employee Loans', href: '/app/finance/loans', description: 'Staff loan tracking', permission: 'finance.manage' },
      { label: 'Salary Advances', href: '/app/finance/advances', description: 'Advance disbursement tracking', permission: 'finance.manage' },
    ],
  },

  // === DOCS ===
  {
    label: 'Docs',
    href: '/app/docs',
    icon: BookOpen,
    category: 'sections',
    module: 'knowledge',
    permission: 'knowledge.view',
  },

  // === INTELLIGENCE ===
  {
    label: 'Intelligence',
    icon: Brain,
    category: 'sections',
    module: 'intelligence',
    submenu: [
      { label: 'Dashboard', href: '/app/intelligence', description: 'Role-based intelligence overview', permission: 'intelligence.view' },
      { label: 'Tech Stacks', href: '/app/tech-intelligence', description: 'Reusable technology stacks', permission: 'systems.view' },
      { label: 'Engineering', href: '/app/engineering', description: 'Bugs, features & tech tracking', permission: 'bug_tracking.view' },
      { label: 'Issue Intelligence', href: '/app/issue-intelligence', description: 'Root causes & resolutions', permission: 'issue_intelligence.view' },
      { label: 'Financial', href: '/app/financial-intelligence', description: 'Capital allocation & revenue', permission: 'finance.view' },
      { label: 'HRM', href: '/app/hrm', description: 'Employees & departments', permission: 'hrm.view' },
      { label: 'Documents', href: '/app/documents', description: 'Document center', permission: 'documents.view' },
      { label: 'Decision Log', href: '/app/decision-log', description: 'Key decisions & rationale', permission: 'decision_logs.view' },
    ],
  },

  // === DESIGNS ===
  {
    label: 'Designs',
    icon: Palette,
    category: 'sections',
    module: 'designs',
    submenu: [
      { label: 'My Designs', href: '/app/designs', description: 'Design gallery & templates', permission: 'designs.view' },
      { label: 'New Design', href: '/app/designs/editor/new', description: 'Open blank canvas editor', permission: 'designs.create' },
    ],
  },

  // === PRICING & SUBSCRIPTIONS ===
  {
    label: 'Pricing',
    icon: Tag,
    category: 'sections',
    module: 'pricing',
    submenu: [
      { label: 'Pricing Plans', href: '/app/pricing', description: 'Centralized pricing for all systems', permission: 'pricing.view' },
      { label: 'Subscriptions', href: '/app/subscriptions', description: 'Client subscription management', permission: 'subscriptions.view' },
    ],
  },

  // === REPORTS ===
  {
    label: 'Reports',
    href: '/app/reports',
    icon: BarChart3,
    category: 'sections',
    module: 'reports',
    permission: 'reports.view',
  },

  // === DRAIS CONTROL ===
  {
    label: 'DRAIS Control',
    icon: Workflow,
    category: 'sections',
    module: 'drais',
    submenu: [
      { label: 'Schools', href: '/app/dashboard/drais/schools', description: 'School management & control', permission: 'drais.view' },
      { label: 'Pricing', href: '/app/dashboard/drais/pricing', description: 'Global pricing control', permission: 'drais.view' },
      { label: 'Activity', href: '/app/dashboard/drais/activity', description: 'Real-time activity monitoring', permission: 'drais.view' },
      { label: 'Integrations', href: '/app/dashboard/integrations', description: 'External system connections', permission: 'integrations.view' },
    ],
  },

  // === ADMIN ===
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
      { label: 'Approvals', href: '/app/admin/approvals', description: 'Pending approval requests', permission: 'approvals.manage' },
      { label: 'Approval Pipeline', href: '/app/approval-pipeline', description: 'Visual approval workflow', permission: 'approvals.manage' },
      { label: 'Backups', href: '/app/admin/backups', description: 'System backups & restore', permission: 'backups.view' },
      { label: 'Audit Logs', href: '/app/admin/audit-logs', description: 'System audit trail', permission: 'audit.view' },
      { label: 'Identity Debug', href: '/app/admin/debug', description: 'User–Staff–Role integrity checker', permission: 'users.view', minHierarchy: 1 },
      { label: 'DRAIS Health',    href: '/app/admin/drais/health', description: 'DRAIS Platform v1 shadow-consumer observability', permission: 'audit.view' },
    ],
  },

  // === ORGANIZATION DOCUMENTS ===
  // Promoted from a nested admin sub-item to its own top-level section
  // because the sidebar only renders one level of submenu. The previous
  // nested submenu was invisible. Children point at the real admin pages
  // (not the thin component wrappers under /app/documents/*).
  {
    label: 'Organization Documents',
    icon: FileText,
    category: 'sections',
    module: 'documents',
    permission: 'documents.view',
    submenu: [
      { label: 'Overview',            href: '/app/admin/documents',           description: 'Document module dashboard',         permission: 'documents.view' },
      { label: 'Templates',           href: '/app/admin/documents/templates', description: 'Manage document templates',        permission: 'documents.manage' },
      { label: 'Generated Documents', href: '/app/admin/documents/generated', description: 'View and manage generated documents', permission: 'documents.view' },
      { label: 'Verification Portal', href: '/app/admin/documents/verify',    description: 'Look up a document verification ID',  permission: 'documents.view' },
      { label: 'Settings',            href: '/app/admin/documents/settings',  description: 'Branding, signatures, stamps',     permission: 'documents.manage' },
    ],
  },

  // === SETTINGS ===
  {
    label: 'Settings',
    icon: Settings,
    category: 'sections',
    // Settings visible to all authenticated users
    submenu: [
      { label: 'General', href: '/app/settings', description: 'Account & preferences' },
      { label: 'Appearance', href: '/app/settings/appearance', icon: Palette, description: 'Colors, gradients, glass' },
      { label: 'Typography', href: '/app/settings/typography', icon: Type, description: 'Font family, size & weight' },
      { label: 'Active Sessions', href: '/app/settings/sessions', icon: Shield, description: 'Manage logged-in devices' },
    ],
  },
];

/**
 * Quick access links for mobile bottom navigation
 */
export const quickAccessLinks = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/app/dashboard', permission: 'dashboard.view' },
  { id: 'systems', label: 'Systems', icon: Monitor, href: '/app/systems', permission: 'systems.view' },
  { id: 'deals', label: 'Deals', icon: Briefcase, href: '/app/deals', permission: 'deals.view' },
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
