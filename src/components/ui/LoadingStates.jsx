/**
 * components/loaders/LoadingSpinner.jsx
 * Reusable loading spinner component
 */

export function LoadingSpinner({ size = 'md', message = 'Loading...' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
  
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
      {message && <p className="mt-2 text-gray-600">{message}</p>}
    </div>
  );
}

/**
 * components/loaders/Skeleton.jsx
 * Reusable skeleton loading placeholder
 */

export function Skeleton({ count = 1, height = 'h-4', className = '' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} bg-gray-200 rounded animate-pulse ${i > 0 ? 'mt-2' : ''}`}
        ></div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="w-full">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 mb-3 p-4 border-b">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton key={colIdx} height="h-4" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <Skeleton height="h-6" className="mb-4 w-1/3" />
      <Skeleton count={3} className="space-y-3" />
    </div>
  );
}

/**
 * components/empty-states/EmptyState.jsx
 * Reusable empty state component
 */

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && <Icon className="w-12 h-12 text-gray-400 mb-4" />}
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

/**
 * components/error-states/ErrorState.jsx
 * Reusable error state component
 */

export function ErrorState({ title, description, onRetry }) {
  return (
    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{title}</h3>
          <div className="mt-2 text-sm text-red-700">{description}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm font-medium text-red-700 hover:text-red-600"
            >
              Try again →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * components/error-states/FormError.jsx
 * Form-level error component
 */

export function FormError({ error, message }) {
  if (!error && !message) return null;
  
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm dark:bg-red-900/30 dark:text-red-300">
      {message || error?.message || 'An error occurred'}
    </div>
  );
}

export function FieldError({ error }) {
  if (!error) return null;
  
  return <p className="text-red-500 text-xs mt-1">{error}</p>;
}
