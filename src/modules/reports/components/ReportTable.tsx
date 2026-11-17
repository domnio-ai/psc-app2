import type {ReportData} from '../../../api'
import {displayReportValue,label} from '../utils/reportTableFormatting'

export default function ReportTable({
  data,
  page,
  onPage,
  onOpenAssignment,
}: {
  data: ReportData;
  page: number;
  onPage: (page: number) => void;
  onOpenAssignment: (id: string) => void;
}) {
  return (
    <div className="report-table-wrap">
      <div className="report-result-count">
        {data.pagination.total} filtered records
      </div>
      <table>
        <thead>
          <tr>
            {data.columns.map((column) => (
              <th key={column}>{label(column)}</th>
            ))}
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, index) => (
            <tr key={String(row.id || index)}>
              {data.columns.map((column) => (
                <td key={column}>{displayReportValue(column, row[column])}</td>
              ))}
              <td>
                {Boolean(row.id) && (
                  <button onClick={() => onOpenAssignment(String(row.id))}>
                    Open
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data.rows.length && (
        <div className="report-no-data">
          No records match the selected filters.
        </div>
      )}
      <footer>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {data.pagination.page} of {Math.max(1, data.pagination.pages)}
        </span>
        <button
          disabled={page >= data.pagination.pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </footer>
    </div>
  );
}
