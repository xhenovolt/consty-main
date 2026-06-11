'use client';

/**
 * ResponsiveTable — wraps data tables with horizontal scroll on mobile
 * Usage: <ResponsiveTable><table>...</table></ResponsiveTable>
 */
export function ResponsiveTable({ children, className = '' }) {
  return (
    <div className={`overflow-x-auto -mx-4 sm:mx-0 ${className}`}>
      <div className="min-w-full inline-block align-middle px-4 sm:px-0">
        {children}
      </div>
    </div>
  );
}

/**
 * MobileCard — renders a card view of table row data on mobile, table on desktop
 * Usage:
 *   <MobileCardTable
 *     headers={['Name', 'Email', 'Role']}
 *     rows={data}
 *     renderRow={(item) => [item.name, item.email, item.role]}
 *     renderCard={(item) => <div>...</div>}
 *   />
 */
export function MobileCardTable({ headers, rows, renderRow, renderCard, keyExtractor, emptyMessage = 'No data found' }) {
  if (rows.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">{emptyMessage}</div>;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="text-left px-4 py-3 font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((item, i) => {
              const cells = renderRow(item);
              return (
                <tr key={keyExtractor ? keyExtractor(item) : i} className="hover:bg-muted">
                  {cells.map((cell, j) => (
                    <td key={j} className="px-4 py-3">{cell}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {rows.map((item, i) => (
          <div key={keyExtractor ? keyExtractor(item) : i}>
            {renderCard ? renderCard(item) : (
              <div className="bg-card rounded-xl border p-4 space-y-2">
                {headers.map((h, j) => {
                  const cells = renderRow(item);
                  return (
                    <div key={j} className="flex justify-between items-start gap-2">
                      <span className="text-xs text-muted-foreground shrink-0">{h}</span>
                      <span className="text-sm text-foreground text-right">{cells[j]}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
