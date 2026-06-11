/**
 * Sales Utility Functions
 * Helper functions for formatting and displaying sales data
 */

export { formatCurrency } from '@/lib/format-currency';

/**
 * Get status color class
 * @param {string} status - Payment status
 * @returns {string} Tailwind color class
 */
export function getStatusColor(status) {
  const colors = {
    'Paid': 'text-green-700 dark:text-green-300',
    'Partially Paid': 'text-blue-700 dark:text-blue-300',
    'Pending': 'text-yellow-700 dark:text-yellow-300',
    'Credit': 'text-orange-700 dark:text-orange-300',
    'Overdue': 'text-red-700 dark:text-red-300',
  };
  return colors[status] || 'text-gray-700 dark:text-gray-300';
}

/**
 * Get status background color class
 * @param {string} status - Payment status
 * @returns {string} Tailwind background color class
 */
export function getStatusBgColor(status) {
  const bgColors = {
    'Paid': 'bg-green-100 dark:bg-green-900/30',
    'Partially Paid': 'bg-blue-100 dark:bg-blue-900/30',
    'Pending': 'bg-yellow-100 dark:bg-yellow-900/30',
    'Credit': 'bg-orange-100 dark:bg-orange-900/30',
    'Overdue': 'bg-red-100 dark:bg-red-900/30',
  };
  return bgColors[status] || 'bg-gray-100';
}

/**
 * Calculate payment progress percentage
 * @param {number} total - Total amount
 * @param {number} paid - Paid amount
 * @returns {number} Progress percentage (0-100)
 */
export function calculatePaymentProgress(total, paid) {
  const totalNum = parseFloat(total) || 0;
  const paidNum = parseFloat(paid) || 0;
  
  if (totalNum <= 0) {
    return 0;
  }
  
  const progress = (paidNum / totalNum) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

export default {
  formatCurrency,
  getStatusColor,
  getStatusBgColor,
  calculatePaymentProgress,
};
