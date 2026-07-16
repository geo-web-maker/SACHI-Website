import styles from './DataTable.module.css';

export default function DataTable({ columns, rows, renderRow, emptyLabel = 'No records yet.' }) {
  return (
  <div className={styles.tableWrap}>
     <div className={styles.tableScroll}>
+      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>{emptyLabel}</td>
            </tr>
          ) : (
            rows.map((row) => renderRow(row))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
