import Swal from 'sweetalert2';

/**
 * Show a SweetAlert confirmation dialog
 * Returns true if confirmed, false if cancelled
 */
export async function confirm(message, options = {}) {
  const result = await Swal.fire({
    title: options.title || 'Are you sure?',
    text: message,
    icon: options.icon || 'warning',
    showCancelButton: true,
    confirmButtonColor: options.confirmColor || '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: options.confirmText || 'Yes, proceed',
    cancelButtonText: options.cancelText || 'Cancel',
    reverseButtons: true,
    customClass: {
      popup: 'rounded-xl',
      confirmButton: 'rounded-lg px-4 py-2 text-sm font-medium',
      cancelButton: 'rounded-lg px-4 py-2 text-sm font-medium',
    },
  });
  return result.isConfirmed;
}

/**
 * Confirmation for delete actions (red theme)
 */
export async function confirmDelete(itemName) {
  return confirm(`"${itemName}" will be permanently deleted. This cannot be undone.`, {
    title: 'Delete permanently?',
    icon: 'warning',
    confirmText: 'Delete',
    confirmColor: '#dc2626',
  });
}

/**
 * Confirmation for dangerous actions (orange theme)
 */
export async function confirmDangerous(message, title = 'This action has consequences') {
  return confirm(message, {
    title,
    icon: 'warning',
    confirmText: 'Yes, I understand',
    confirmColor: '#ea580c',
  });
}
