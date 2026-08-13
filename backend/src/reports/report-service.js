import { query, transaction } from "../db.js";
import { audit } from "../audit.js";
import {
  getReportDefinition,
  reportCategories,
  reportRegistry,
} from "./report-registry.js";

const rolePermissions = {
  Administrator: [
    "VIEW_REPORTS",
    "VIEW_OPERATIONAL_REPORTS",
    "VIEW_EXECUTIVE_REPORTS",
    "VIEW_MANAGEMENT_REPORTS",
    "VIEW_AUDIT_REPORTS",
    "VIEW_FELIX_ANALYTICS",
    "GENERATE_REPORTS",
    "EXPORT_REPORTS",
    "MANAGE_REPORT_DEFINITIONS",
    "MANAGE_REPORT_ACCESS",
  ],
  "Research Manager": [
    "VIEW_REPORTS",
    "VIEW_OPERATIONAL_REPORTS",
    "VIEW_EXECUTIVE_REPORTS",
    "VIEW_MANAGEMENT_REPORTS",
    "VIEW_FELIX_ANALYTICS",
    "GENERATE_REPORTS",
    "EXPORT_REPORTS",
  ],
  Reviewer: ["VIEW_REPORTS", "VIEW_OPERATIONAL_REPORTS", "EXPORT_REPORTS"],
  "Research Officer": [
    "VIEW_REPORTS",
    "VIEW_OPERATIONAL_REPORTS",
    "EXPORT_REPORTS",
  ],
};
export const reportPermissions = (user) => rolePermissions[user.role] || [];
export const canAccessReport = (user, definition) =>
  Boolean(
    definition?.enabled &&
      reportPermissions(user).includes(definition.permission),
  );
export const reportScope = (user) =>
  ["Administrator", "Research Manager"].includes(user.role)
    ? { type: "ORGANISATION", division: null, userId: null }
    : {
        type: user.role === "Research Officer" ? "OWN" : "DIRECTORATE",
        division: user.division,
        userId: user.role === "Research Officer" ? user.id : null,
      };
const parseFilters = (input) => {
  const page = Math.max(1, Number(input.page) || 1),
    pageSize = Math.min(100, Math.max(10, Number(input.pageSize) || 25));
  const from = String(input.from || ""),
    to = String(input.to || "");
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from))
    throw Object.assign(new Error("Invalid from date."), { status: 400 });
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to))
    throw Object.assign(new Error("Invalid to date."), { status: 400 });
  if (from && to && from > to)
    throw Object.assign(new Error("From date cannot be after to date."), {
      status: 400,
    });
  return {
    from,
    to,
    division: String(input.division || ""),
    status: String(input.status || ""),
    priority: String(input.priority || ""),
    officer: String(input.officer || ""),
    category: String(input.category || ""),
    ageing: String(input.ageing || ""),
    overdue: String(input.overdue || "") === "true",
    search: String(input.search || ""),
    page,
    pageSize,
  };
};
const scopeSql = (scope, alias = "a", memberAlias = "am") =>
  scope.type === "ORGANISATION"
    ? { sql: "TRUE", values: [] }
    : scope.type === "DIRECTORATE"
      ? { sql: `${alias}.division=$SCOPE1`, values: [scope.division] }
      : {
          sql: `EXISTS(SELECT 1 FROM assignment_members ${memberAlias} WHERE ${memberAlias}.assignment_id=${alias}.id AND ${memberAlias}.user_id=$SCOPE1)`,
          values: [scope.userId],
        };
const renumber = (sql, start) => {
  let index = start;
  return sql.replaceAll("$SCOPE1", () => `$${index++}`);
};
const assignmentWhere = (
  filters,
  scope,
  alias = "a",
  periodField = "created_at",
) => {
  const values = [];
  const scoped = scopeSql(scope, alias);
  let sql = renumber(scoped.sql, 1);
  values.push(...scoped.values);
  const add = (clause, value) => {
    values.push(value);
    sql += ` AND ${clause.replace("?", `$${values.length}`)}`;
  };
  if (filters.from) add(`${alias}.${periodField}::date>=?`, filters.from);
  if (filters.to) add(`${alias}.${periodField}::date<=?`, filters.to);
  if (filters.division) {
    if (scope.type !== "ORGANISATION" && filters.division !== scope.division)
      throw Object.assign(
        new Error("Requested directorate is outside your permitted scope."),
        { status: 403 },
      );
    add(`${alias}.division=?`, filters.division);
  }
  if (filters.status === "Overdue")
    sql += ` AND ${alias}.status<>'Completed' AND ${alias}.due_date<CURRENT_DATE`;
  else if (filters.status) add(`${alias}.status=?`, filters.status);
  if (filters.priority) add(`${alias}.priority=?`, filters.priority);
  if (filters.overdue)
    sql += ` AND ${alias}.status<>'Completed' AND ${alias}.due_date<CURRENT_DATE`;
  if (filters.search)
    add(
      `(${alias}.title ILIKE '%'||?||'%' OR ${alias}.description ILIKE '%'||$${values.length}||'%')`,
      filters.search,
    );
  return { sql, values };
};
const kpi = (
  key,
  label,
  value,
  status = "neutral",
  comparison = null,
  available = true,
) => ({ key, label, value, status, comparison, available });
const chart = (key, title, type, series, drillField = null) => ({
  key,
  title,
  type,
  series,
  drillField,
});
const paginate = async (baseSql, countSql, values, filters) => {
  const offset = (filters.page - 1) * filters.pageSize;
  const [rows, total] = await Promise.all([
    query(
      `${baseSql} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.pageSize, offset],
    ),
    query(countSql, values),
  ]);
  return {
    rows: rows.rows,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: Number(total.rows[0].total),
      pages: Math.ceil(Number(total.rows[0].total) / filters.pageSize),
    },
  };
};
async function assignmentStatus(filters, scope) {
  const w = assignmentWhere(filters, scope);
  const [summary, statuses, list] = await Promise.all([
    query(
      `SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE status='Completed')::int completed,COUNT(*)FILTER(WHERE status<>'Completed')::int active,COUNT(*)FILTER(WHERE status<>'Completed' AND due_date<CURRENT_DATE)::int overdue FROM assignments a WHERE ${w.sql}`,
      w.values,
    ),
    query(
      `SELECT status label,COUNT(*)::int value FROM assignments a WHERE ${w.sql} GROUP BY status ORDER BY status`,
      w.values,
    ),
    paginate(
      `SELECT a.id,a.title,a.division,a.status,a.priority,a.due_date,a.created_at FROM assignments a WHERE ${w.sql} ORDER BY a.created_at DESC`,
      `SELECT COUNT(*) total FROM assignments a WHERE ${w.sql}`,
      w.values,
      filters,
    ),
  ]);
  const s = summary.rows[0];
  return {
    kpis: [
      kpi("total", "Total", s.total),
      kpi("completed", "Completed", s.completed, "good"),
      kpi("active", "Active", s.active),
      kpi("overdue", "Overdue", s.overdue, s.overdue ? "danger" : "good"),
    ],
    charts: [
      chart("status", "Status distribution", "donut", statuses.rows, "status"),
    ],
    columns: [
      "title",
      "division",
      "status",
      "priority",
      "due_date",
      "created_at",
    ],
    ...list,
  };
}
async function overdueAgeing(filters, scope) {
  const w = assignmentWhere(filters, scope, "a", "due_date");
  const overdue = `${w.sql} AND a.status<>'Completed' AND a.due_date<CURRENT_DATE`;
  const [summary, buckets, list] = await Promise.all([
    query(
      `SELECT COUNT(*)::int overdue,COUNT(*)FILTER(WHERE priority='Critical')::int critical,COALESCE(ROUND(AVG(CURRENT_DATE-due_date)),0)::int average_age FROM assignments a WHERE ${overdue}`,
      w.values,
    ),
    query(
      `SELECT CASE WHEN CURRENT_DATE-due_date<=7 THEN '0–7 days' WHEN CURRENT_DATE-due_date<=14 THEN '8–14 days' WHEN CURRENT_DATE-due_date<=30 THEN '15–30 days' WHEN CURRENT_DATE-due_date<=60 THEN '31–60 days' ELSE '60+ days' END label,COUNT(*)::int value FROM assignments a WHERE ${overdue} GROUP BY 1 ORDER BY MIN(CURRENT_DATE-due_date)`,
      w.values,
    ),
    paginate(
      `SELECT a.id,a.title,a.division,a.priority,a.status,a.due_date,(CURRENT_DATE-a.due_date)::int overdue_days FROM assignments a WHERE ${overdue} ORDER BY overdue_days DESC`,
      `SELECT COUNT(*) total FROM assignments a WHERE ${overdue}`,
      w.values,
      filters,
    ),
  ]);
  const s = summary.rows[0];
  return {
    kpis: [
      kpi("overdue", "Overdue", s.overdue, s.overdue ? "danger" : "good"),
      kpi(
        "critical",
        "Critical overdue",
        s.critical,
        s.critical ? "danger" : "good",
      ),
      kpi("age", "Average overdue age", `${s.average_age} days`),
    ],
    charts: [chart("ageing", "Ageing buckets", "bar", buckets.rows, "ageing")],
    columns: ["title", "division", "priority", "due_date", "overdue_days"],
    ...list,
  };
}
async function workloadDistribution(filters, scope) {
  const w = assignmentWhere(filters, scope);
  const values = [...w.values];
  let officer = "";
  if (filters.officer) {
    values.push(filters.officer);
    officer = ` AND u.id=$${values.length}`;
  }
  const rows = (
    await query(
      `SELECT u.id,u.name,u.division,COUNT(DISTINCT a.id)FILTER(WHERE a.status<>'Completed')::int active,COUNT(DISTINCT a.id)FILTER(WHERE a.status='Completed')::int completed,COUNT(DISTINCT a.id)FILTER(WHERE a.status<>'Completed' AND a.due_date<CURRENT_DATE)::int overdue FROM users u LEFT JOIN assignment_members am ON am.user_id=u.id LEFT JOIN assignments a ON a.id=am.assignment_id AND ${w.sql} WHERE u.active=TRUE ${officer} GROUP BY u.id ORDER BY active DESC,u.name`,
      values,
    )
  ).rows;
  return {
    kpis: [
      kpi("officers", "Officers", rows.length),
      kpi(
        "active",
        "Active assignments",
        rows.reduce((n, r) => n + r.active, 0),
      ),
      kpi(
        "overdue",
        "Overdue",
        rows.reduce((n, r) => n + r.overdue, 0),
        "warning",
      ),
    ],
    charts: [
      chart(
        "workload",
        "Active workload by officer",
        "horizontal-bar",
        rows.map((r) => ({ label: r.name, value: r.active, id: r.id })),
        "officer",
      ),
    ],
    columns: ["name", "division", "active", "completed", "overdue"],
    rows,
    pagination: {
      page: 1,
      pageSize: rows.length,
      total: rows.length,
      pages: 1,
    },
  };
}
async function directoratePerformance(filters, scope) {
  const w = assignmentWhere(filters, scope);
  const rows = (
    await query(
      `SELECT division,COUNT(*)::int total,COUNT(*)FILTER(WHERE status='Completed')::int completed,COUNT(*)FILTER(WHERE status<>'Completed')::int active,COUNT(*)FILTER(WHERE status<>'Completed' AND due_date<CURRENT_DATE)::int overdue,CASE WHEN COUNT(*)=0 THEN 0 ELSE ROUND(COUNT(*)FILTER(WHERE status='Completed')*100.0/COUNT(*),1)END completion_rate FROM assignments a WHERE ${w.sql} GROUP BY division ORDER BY completion_rate DESC,division`,
      w.values,
    )
  ).rows;
  const totals = rows.reduce(
    (s, r) => ({
      total: s.total + r.total,
      completed: s.completed + r.completed,
      active: s.active + r.active,
      overdue: s.overdue + r.overdue,
    }),
    { total: 0, completed: 0, active: 0, overdue: 0 },
  );
  return {
    kpis: [
      kpi(
        "rate",
        "Completion rate",
        totals.total
          ? `${Math.round((totals.completed * 100) / totals.total)}%`
          : "0%",
      ),
      kpi("active", "Active", totals.active),
      kpi("completed", "Completed", totals.completed, "good"),
      kpi(
        "overdue",
        "Overdue",
        totals.overdue,
        totals.overdue ? "danger" : "good",
      ),
    ],
    charts: [
      chart(
        "directorates",
        "Directorate comparison",
        "horizontal-bar",
        rows.map((r) => ({
          label: r.division,
          value: Number(r.completion_rate),
        })),
        "division",
      ),
    ],
    columns: [
      "division",
      "total",
      "completed",
      "active",
      "overdue",
      "completion_rate",
    ],
    rows,
    pagination: {
      page: 1,
      pageSize: rows.length,
      total: rows.length,
      pages: 1,
    },
  };
}
async function executiveOverview(filters, scope) {
  const base = await allWorkStatus(
      { ...filters, pageSize: 10, page: 1 },
      scope,
    ),
    directorates = await allDirectoratePerformance(filters, scope);
  const w = assignmentWhere(filters, scope);
  const [priority, trend, exceptions, pending] = await Promise.all([
    query(
      `SELECT COUNT(*)FILTER(WHERE priority IN('High','Critical') AND status<>'Completed')::int high FROM assignments a WHERE ${w.sql}`,
      w.values,
    ),
    query(
      `SELECT to_char(date_trunc('month',created_at),'YYYY-MM') label,COUNT(*)::int received,COUNT(*)FILTER(WHERE status='Completed')::int completed FROM assignments a WHERE ${w.sql} GROUP BY 1 ORDER BY 1`,
      w.values,
    ),
    query(
      `SELECT id,title,division,status,priority,due_date,CASE WHEN due_date<CURRENT_DATE THEN 'Past deadline' WHEN priority IN('High','Critical') THEN 'High priority active work' ELSE 'Workflow exception' END exception FROM assignments a WHERE ${w.sql} AND status<>'Completed' AND(due_date<CURRENT_DATE OR priority IN('High','Critical'))ORDER BY priority='Critical' DESC,due_date NULLS LAST LIMIT 25`,
      w.values,
    ),
    query(
      "SELECT COUNT(DISTINCT assignment_id)::int total FROM assignment_reviews WHERE decision IN('Submitted','Under Review')",
      [],
    ),
  ]);
  const total = base.kpis.find((x) => x.key === "total").value,
    completed = base.kpis.find((x) => x.key === "completed").value;
  return {
    kpis: [
      kpi(
        "rate",
        "Completion rate",
        total ? `${Math.round((completed * 100) / total)}%` : "0%",
      ),
      ...base.kpis.filter((x) => ["active", "overdue"].includes(x.key)),
      kpi(
        "high",
        "Critical / high priority",
        priority.rows[0].high,
        priority.rows[0].high ? "warning" : "good",
      ),
      kpi(
        "turnaround",
        "Average turnaround",
        "Unavailable",
        "neutral",
        null,
        false,
      ),
      kpi("approval", "Awaiting approval", pending.rows[0].total),
    ],
    charts: [
      chart("trend", "Received and completed trend", "line", trend.rows),
      ...directorates.charts,
    ],
    sections: [
      { key: "exceptions", title: "Risks & exceptions", rows: exceptions.rows },
      {
        key: "decisions",
        title: "Management decisions required",
        rows: [],
        message: "No structured management-decision records exist in App2.",
      },
    ],
    columns: [
      "title",
      "division",
      "status",
      "priority",
      "due_date",
      "exception",
    ],
    rows: exceptions.rows,
    pagination: {
      page: 1,
      pageSize: 25,
      total: exceptions.rows.length,
      pages: 1,
    },
  };
}
async function researchOutputs(filters, scope) {
  const values = [];
  let where = "TRUE";
  if (scope.type === "OWN") {
    values.push(scope.userId);
    where += ` AND(p.lead_id=$${values.length} OR EXISTS(SELECT 1 FROM research_collaborators rc WHERE rc.project_id=p.id AND rc.user_id=$${values.length}))`;
  }
  if (filters.from) {
    values.push(filters.from);
    where += ` AND p.created_at::date>=$${values.length}`;
  }
  if (filters.to) {
    values.push(filters.to);
    where += ` AND p.created_at::date<=$${values.length}`;
  }
  if (filters.status) {
    values.push(filters.status);
    where += ` AND p.status=$${values.length}`;
  }
  const [status, trend, rows] = await Promise.all([
    query(
      `SELECT status label,COUNT(*)::int value FROM research_projects p WHERE ${where} GROUP BY status ORDER BY status`,
      values,
    ),
    query(
      `SELECT to_char(date_trunc('month',created_at),'YYYY-MM')label,COUNT(*)::int value FROM research_projects p WHERE ${where} GROUP BY 1 ORDER BY 1`,
      values,
    ),
    query(
      `SELECT p.id,p.title,p.status,p.start_date,p.end_date,u.name lead_name FROM research_projects p JOIN users u ON u.id=p.lead_id WHERE ${where} ORDER BY p.updated_at DESC`,
      values,
    ),
  ]);
  const total = rows.rows.length,
    completed = rows.rows.filter((row) => row.status === "Completed").length;
  return {
    kpis: [
      kpi("total", "Total outputs", total),
      kpi("completed", "Completed", completed, "good"),
      kpi("ongoing", "Ongoing", total - completed),
    ],
    charts: [
      chart("status", "Research status", "donut", status.rows, "status"),
      chart("trend", "Research output trend", "line", trend.rows),
    ],
    columns: ["title", "lead_name", "status", "start_date", "end_date"],
    rows: rows.rows,
    pagination: {
      page: 1,
      pageSize: rows.rows.length,
      total: rows.rows.length,
      pages: 1,
    },
  };
}
async function documentActivity(filters, scope) {
  const values = [];
  let where =
    scope.type === "ORGANISATION"
      ? "TRUE"
      : scope.type === "DIRECTORATE"
        ? "k.directorate=$1"
        : "k.created_by=$1";
  if (scope.type === "DIRECTORATE") values.push(scope.division);
  if (scope.type === "OWN") values.push(scope.userId);
  if (filters.from) {
    values.push(filters.from);
    where += ` AND k.created_at::date>=$${values.length}`;
  }
  if (filters.to) {
    values.push(filters.to);
    where += ` AND k.created_at::date<=$${values.length}`;
  }
  if (filters.status) {
    values.push(filters.status);
    where += ` AND k.status=$${values.length}`;
  }
  if (filters.category) {
    values.push(filters.category);
    where += ` AND k.category=$${values.length}`;
  }
  const [summary, categoryRows, growth, list] = await Promise.all([
    query(
      `SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE status='Published')::int approved,COUNT(*)FILTER(WHERE status='Pending Approval')::int pending,COUNT(*)FILTER(WHERE status='Archived' OR is_archived)::int archived FROM knowledge_items k WHERE ${where}`,
      values,
    ),
    query(
      `SELECT category label,COUNT(*)::int value FROM knowledge_items k WHERE ${where} GROUP BY category ORDER BY value DESC`,
      values,
    ),
    query(
      `SELECT to_char(date_trunc('month',created_at),'YYYY-MM')label,COUNT(*)::int value FROM knowledge_items k WHERE ${where} GROUP BY 1 ORDER BY 1`,
      values,
    ),
    paginate(
      `SELECT k.id,k.title,k.category,k.directorate,k.status,k.classification,k.created_at FROM knowledge_items k WHERE ${where} ORDER BY k.created_at DESC`,
      `SELECT COUNT(*) total FROM knowledge_items k WHERE ${where}`,
      values,
      filters,
    ),
  ]);
  const summaryRow = summary.rows[0];
  return {
    kpis: [
      kpi("documents", "Documents", summaryRow.total),
      kpi("approved", "Approved", summaryRow.approved, "good"),
      kpi(
        "pending",
        "Pending",
        summaryRow.pending,
        summaryRow.pending ? "warning" : "neutral",
      ),
      kpi("archived", "Archived", summaryRow.archived),
    ],
    charts: [
      chart("growth", "Repository growth", "line", growth.rows),
      chart(
        "category",
        "Documents by category",
        "bar",
        categoryRows.rows,
        "category",
      ),
    ],
    columns: [
      "title",
      "category",
      "directorate",
      "status",
      "classification",
      "created_at",
    ],
    ...list,
  };
}
async function felixUsage(filters) {
  const values = [];
  let where = "TRUE";
  if (filters.from) {
    values.push(filters.from);
    where += ` AND created_at::date>=$${values.length}`;
  }
  if (filters.to) {
    values.push(filters.to);
    where += ` AND created_at::date<=$${values.length}`;
  }
  const [jobs, statuses, trend, metrics] = await Promise.all([
    query(
      `SELECT COUNT(*)::int total,COUNT(*)FILTER(WHERE status='Completed')::int completed,COUNT(*)FILTER(WHERE status='Failed')::int failed FROM felix_document_index_jobs WHERE ${where}`,
      values,
    ),
    query(
      `SELECT status label,COUNT(*)::int value FROM felix_document_index_jobs WHERE ${where} GROUP BY status ORDER BY status`,
      values,
    ),
    query(
      `SELECT to_char(date_trunc('month',created_at),'YYYY-MM')label,COUNT(*)::int value FROM felix_document_index_jobs WHERE ${where} GROUP BY 1 ORDER BY 1`,
      values,
    ),
    query(
      `SELECT COUNT(*)::int questions,COUNT(*)FILTER(WHERE response_ok)::int successful,ROUND(AVG(confidence)*100,1) confidence,ROUND(AVG(response_ms))::int response_ms,SUM(source_count)::int citations FROM felix_report_metrics WHERE ${where}`,
      values,
    ),
  ]);
  const m = metrics.rows[0],
    hasQuestions = m.questions > 0;
  return {
    available: true,
    kpis: [
      kpi("jobs", "Indexing requests", jobs.rows[0].total),
      kpi("completed", "Completed", jobs.rows[0].completed, "good"),
      kpi(
        "failed",
        "Failed",
        jobs.rows[0].failed,
        jobs.rows[0].failed ? "danger" : "good",
      ),
      kpi("questions", "Questions asked", m.questions),
      kpi(
        "quality",
        "Successful responses",
        hasQuestions
          ? `${Math.round((m.successful * 100) / m.questions)}%`
          : "No queries",
        "neutral",
        null,
        hasQuestions,
      ),
      kpi(
        "confidence",
        "Average confidence",
        m.confidence === null ? "Not supplied" : `${m.confidence}%`,
        "neutral",
        null,
        m.confidence !== null,
      ),
      kpi(
        "latency",
        "Average response",
        m.response_ms === null ? "No queries" : `${m.response_ms} ms`,
        "neutral",
        null,
        hasQuestions,
      ),
    ],
    charts: [
      chart("status", "Indexing status", "donut", statuses.rows),
      chart("trend", "Indexing activity trend", "line", trend.rows),
    ],
    columns: [],
    rows: [],
    pagination: { page: 1, pageSize: 25, total: 0, pages: 0 },
    notices: hasQuestions
      ? []
      : ["Felix analytics will populate as users submit new questions."],
  };
}
async function executiveOverviewWithLifecycle(filters, scope) {
  const result = await executiveOverview(filters, scope),
    w = assignmentWhere(filters, scope);
  const lifecycle = (
      await query(
        `SELECT ROUND(AVG(EXTRACT(EPOCH FROM(completed_at-created_at))/86400),1) average_days,COUNT(*)FILTER(WHERE completed_at IS NOT NULL AND completed_at::date<=COALESCE(sla_due_date,due_date))::int within_sla,COUNT(*)FILTER(WHERE completed_at IS NOT NULL)::int completed FROM assignments a WHERE ${w.sql}`,
        w.values,
      )
    ).rows[0],
    average = lifecycle.average_days;
  result.kpis = result.kpis.map((item) =>
    item.key === "turnaround"
      ? kpi(
          "turnaround",
          "Average turnaround",
          average === null ? "No completed work" : `${average} days`,
          "neutral",
          null,
          average !== null,
        )
      : item,
  );
  result.kpis.push(
    kpi(
      "sla",
      "Completed within SLA",
      lifecycle.completed
        ? `${Math.round((lifecycle.within_sla * 100) / lifecycle.completed)}%`
        : "No completed work",
      "neutral",
      null,
      lifecycle.completed > 0,
    ),
  );
  const tw = taskWhere(filters, scope),
    taskExceptions = (
      await query(
        `SELECT t.id,'Task' work_type,t.title,a.title parent_assignment,a.division,t.status,t.priority,t.due_date,CASE WHEN t.due_date<CURRENT_DATE THEN 'Past deadline' WHEN t.priority IN('High','Critical') THEN 'High priority active task' ELSE 'Workflow exception' END exception FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE ${tw.sql} AND t.status<>'Completed' AND(t.due_date<CURRENT_DATE OR t.priority IN('High','Critical')) ORDER BY t.priority='Critical' DESC,t.due_date NULLS LAST LIMIT 25`,
        tw.values,
      )
    ).rows;
  result.rows = [
    ...result.rows.map((row) => ({
      ...row,
      work_type: "Assignment",
      parent_assignment: null,
    })),
    ...taskExceptions,
  ]
    .sort((a, b) =>
      String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")),
    )
    .slice(0, 25);
  result.columns = [
    "work_type",
    "title",
    "parent_assignment",
    "division",
    "status",
    "priority",
    "due_date",
    "exception",
  ];
  const exceptionSection = result.sections?.find(
    (section) => section.key === "exceptions",
  );
  if (exceptionSection) exceptionSection.rows = result.rows;
  result.pagination = {
    page: 1,
    pageSize: 25,
    total: result.rows.length,
    pages: 1,
  };
  return result;
}
const taskWhere = (filters, scope, periodField = "created_at") => {
  const values = [];
  let sql =
    scope.type === "ORGANISATION"
      ? "TRUE"
      : scope.type === "DIRECTORATE"
        ? `a.division=$1`
        : `(t.owner_id=$1 OR EXISTS(SELECT 1 FROM assignment_members tam WHERE tam.assignment_id=t.assignment_id AND tam.user_id=$1))`;
  if (scope.type !== "ORGANISATION")
    values.push(scope.type === "DIRECTORATE" ? scope.division : scope.userId);
  const add = (clause, value) => {
    values.push(value);
    sql += ` AND ${clause.replace("?", `$${values.length}`)}`;
  };
  if (filters.from) add(`t.${periodField}::date>=?`, filters.from);
  if (filters.to) add(`t.${periodField}::date<=?`, filters.to);
  if (filters.division) {
    if (scope.type !== "ORGANISATION" && filters.division !== scope.division)
      throw Object.assign(
        new Error("Requested directorate is outside your permitted scope."),
        { status: 403 },
      );
    add("a.division=?", filters.division);
  }
  if (filters.status === "Overdue")
    sql += ` AND t.status<>'Completed' AND t.due_date<CURRENT_DATE`;
  else if (filters.status) {
    const status =
      filters.status === "Ready for Review" ? "In Progress" : filters.status;
    add("t.status=?", status);
  }
  if (filters.priority) add("t.priority=?", filters.priority);
  if (filters.overdue)
    sql += ` AND t.status<>'Completed' AND t.due_date<CURRENT_DATE`;
  if (filters.search)
    add(
      `(t.title ILIKE '%'||?||'%' OR t.description ILIKE '%'||$${values.length}||'%' OR a.title ILIKE '%'||$${values.length}||'%')`,
      filters.search,
    );
  sql += ` AND t.archived_at IS NULL`;
  return { sql, values };
};
const pageRows = (rows, filters) => {
  const total = rows.length,
    start = (filters.page - 1) * filters.pageSize;
  return {
    rows: rows.slice(start, start + filters.pageSize),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      pages: Math.ceil(total / filters.pageSize),
    },
  };
};
async function allWorkStatus(filters, scope) {
  const aw = assignmentWhere(filters, scope),
    tw = taskWhere(filters, scope);
  const [assignments, tasks] = await Promise.all([
      query(
        `SELECT a.id,'Assignment' work_type,a.title,NULL::text parent_assignment,a.division,a.status,a.priority,a.due_date,a.created_at FROM assignments a WHERE ${aw.sql}`,
        aw.values,
      ),
      query(
        `SELECT t.id,'Task' work_type,t.title,a.title parent_assignment,a.division,t.status,t.priority,t.due_date,t.created_at FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE ${tw.sql}`,
        tw.values,
      ),
    ]),
    rows = [...assignments.rows, ...tasks.rows].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    ),
    completed = rows.filter((row) => row.status === "Completed").length,
    overdue = rows.filter(
      (row) =>
        row.status !== "Completed" &&
        row.due_date &&
        new Date(row.due_date) < new Date(new Date().toDateString()),
    ).length,
    statuses = [...new Set(rows.map((row) => row.status))]
      .sort()
      .map((label) => ({
        label,
        value: rows.filter((row) => row.status === label).length,
      }));
  return {
    kpis: [
      kpi("total", "Total work items", rows.length),
      kpi("assignments", "Assignments", assignments.rows.length),
      kpi("tasks", "Tasks", tasks.rows.length),
      kpi("completed", "Completed", completed, "good"),
      kpi("active", "Active", rows.length - completed),
      kpi("overdue", "Overdue", overdue, overdue ? "danger" : "good"),
    ],
    charts: [
      chart(
        "status",
        "Assignment and task status",
        "donut",
        statuses,
        "status",
      ),
      chart(
        "type",
        "Work by type",
        "bar",
        [
          { label: "Assignments", value: assignments.rows.length },
          { label: "Tasks", value: tasks.rows.length },
        ],
        "work_type",
      ),
    ],
    columns: [
      "work_type",
      "title",
      "parent_assignment",
      "division",
      "status",
      "priority",
      "due_date",
      "created_at",
    ],
    ...pageRows(rows, filters),
  };
}
async function allWorkOverdue(filters, scope) {
  const aw = assignmentWhere(filters, scope, "a", "due_date"),
    tw = taskWhere(filters, scope, "due_date");
  const [assignments, tasks] = await Promise.all([
      query(
        `SELECT a.id,'Assignment' work_type,a.title,NULL::text parent_assignment,a.division,a.priority,a.status,a.due_date,(CURRENT_DATE-a.due_date)::int overdue_days FROM assignments a WHERE ${aw.sql} AND a.status<>'Completed' AND a.due_date<CURRENT_DATE`,
        aw.values,
      ),
      query(
        `SELECT t.id,'Task' work_type,t.title,a.title parent_assignment,a.division,t.priority,t.status,t.due_date,(CURRENT_DATE-t.due_date)::int overdue_days FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE ${tw.sql} AND t.status<>'Completed' AND t.due_date<CURRENT_DATE`,
        tw.values,
      ),
    ]),
    rows = [...assignments.rows, ...tasks.rows].sort(
      (a, b) => b.overdue_days - a.overdue_days,
    ),
    critical = rows.filter((row) => row.priority === "Critical").length,
    average = rows.length
      ? Math.round(
          rows.reduce((sum, row) => sum + row.overdue_days, 0) / rows.length,
        )
      : 0,
    bucket = (value) =>
      value <= 7
        ? "0–7 days"
        : value <= 14
          ? "8–14 days"
          : value <= 30
            ? "15–30 days"
            : value <= 60
              ? "31–60 days"
              : "60+ days",
    labels = ["0–7 days", "8–14 days", "15–30 days", "31–60 days", "60+ days"],
    buckets = labels
      .map((label) => ({
        label,
        value: rows.filter((row) => bucket(row.overdue_days) === label).length,
      }))
      .filter((item) => item.value);
  return {
    kpis: [
      kpi(
        "overdue",
        "Overdue work items",
        rows.length,
        rows.length ? "danger" : "good",
      ),
      kpi("assignments", "Overdue assignments", assignments.rows.length),
      kpi("tasks", "Overdue tasks", tasks.rows.length),
      kpi(
        "critical",
        "Critical overdue",
        critical,
        critical ? "danger" : "good",
      ),
      kpi("age", "Average overdue age", `${average} days`),
    ],
    charts: [
      chart("ageing", "Ageing buckets", "bar", buckets, "ageing"),
      chart(
        "type",
        "Overdue by type",
        "bar",
        [
          { label: "Assignments", value: assignments.rows.length },
          { label: "Tasks", value: tasks.rows.length },
        ],
        "work_type",
      ),
    ],
    columns: [
      "work_type",
      "title",
      "parent_assignment",
      "division",
      "priority",
      "due_date",
      "overdue_days",
    ],
    ...pageRows(rows, filters),
  };
}
async function allWorkload(filters, scope) {
  const base = await workloadDistribution(filters, scope),
    tw = taskWhere(filters, scope);
  const tasks = (
      await query(
        `SELECT u.id,u.name,u.division,COUNT(t.id)FILTER(WHERE t.status<>'Completed')::int active,COUNT(t.id)FILTER(WHERE t.status='Completed')::int completed,COUNT(t.id)FILTER(WHERE t.status<>'Completed' AND t.due_date<CURRENT_DATE)::int overdue FROM users u LEFT JOIN assignment_tasks t ON t.owner_id=u.id LEFT JOIN assignments a ON a.id=t.assignment_id WHERE u.active=TRUE AND(${tw.sql.replaceAll("t.archived_at IS NULL", "(t.archived_at IS NULL OR t.id IS NULL)")}) GROUP BY u.id ORDER BY u.name`,
        tw.values,
      )
    ).rows,
    byId = new Map(
      base.rows.map((row) => [
        row.id,
        { ...row, assignment_active: row.active, task_active: 0 },
      ]),
    );
  for (const task of tasks) {
    const row = byId.get(task.id) || {
      id: task.id,
      name: task.name,
      division: task.division,
      active: 0,
      completed: 0,
      overdue: 0,
      assignment_active: 0,
      task_active: 0,
    };
    row.active += task.active;
    row.completed += task.completed;
    row.overdue += task.overdue;
    row.task_active = task.active;
    byId.set(task.id, row);
  }
  const rows = [...byId.values()].sort(
    (a, b) => b.active - a.active || a.name.localeCompare(b.name),
  );
  return {
    kpis: [
      kpi("officers", "Officers", rows.length),
      kpi(
        "active",
        "Active work items",
        rows.reduce((n, row) => n + row.active, 0),
      ),
      kpi(
        "tasks",
        "Active tasks",
        rows.reduce((n, row) => n + row.task_active, 0),
      ),
      kpi(
        "overdue",
        "Overdue",
        rows.reduce((n, row) => n + row.overdue, 0),
        "warning",
      ),
    ],
    charts: [
      chart(
        "workload",
        "Active workload by officer",
        "horizontal-bar",
        rows.map((row) => ({ label: row.name, value: row.active, id: row.id })),
        "officer",
      ),
    ],
    columns: [
      "name",
      "division",
      "assignment_active",
      "task_active",
      "active",
      "completed",
      "overdue",
    ],
    rows,
    pagination: {
      page: 1,
      pageSize: rows.length,
      total: rows.length,
      pages: 1,
    },
  };
}
async function allDirectoratePerformance(filters, scope) {
  const base = await directoratePerformance(filters, scope),
    tw = taskWhere(filters, scope),
    tasks = (
      await query(
        `SELECT a.division,COUNT(*)::int total,COUNT(*)FILTER(WHERE t.status='Completed')::int completed,COUNT(*)FILTER(WHERE t.status<>'Completed')::int active,COUNT(*)FILTER(WHERE t.status<>'Completed' AND t.due_date<CURRENT_DATE)::int overdue FROM assignment_tasks t JOIN assignments a ON a.id=t.assignment_id WHERE ${tw.sql} GROUP BY a.division`,
        tw.values,
      )
    ).rows,
    byDivision = new Map(
      base.rows.map((row) => [
        row.division,
        { ...row, assignments: row.total, tasks: 0 },
      ]),
    );
  for (const task of tasks) {
    const row = byDivision.get(task.division) || {
      division: task.division,
      total: 0,
      completed: 0,
      active: 0,
      overdue: 0,
      assignments: 0,
      tasks: 0,
    };
    row.total += task.total;
    row.completed += task.completed;
    row.active += task.active;
    row.overdue += task.overdue;
    row.tasks = task.total;
    byDivision.set(task.division, row);
  }
  const rows = [...byDivision.values()]
      .map((row) => ({
        ...row,
        completion_rate: row.total
          ? Math.round((row.completed * 1000) / row.total) / 10
          : 0,
      }))
      .sort((a, b) => b.completion_rate - a.completion_rate),
    totals = rows.reduce(
      (sum, row) => ({
        total: sum.total + row.total,
        completed: sum.completed + row.completed,
        active: sum.active + row.active,
        overdue: sum.overdue + row.overdue,
        tasks: sum.tasks + row.tasks,
      }),
      { total: 0, completed: 0, active: 0, overdue: 0, tasks: 0 },
    );
  return {
    kpis: [
      kpi(
        "rate",
        "Completion rate",
        totals.total
          ? `${Math.round((totals.completed * 100) / totals.total)}%`
          : "0%",
      ),
      kpi("work", "Work items", totals.total),
      kpi("tasks", "Tasks", totals.tasks),
      kpi("active", "Active", totals.active),
      kpi("completed", "Completed", totals.completed, "good"),
      kpi(
        "overdue",
        "Overdue",
        totals.overdue,
        totals.overdue ? "danger" : "good",
      ),
    ],
    charts: [
      chart(
        "directorates",
        "Directorate comparison",
        "horizontal-bar",
        rows.map((row) => ({
          label: row.division,
          value: Number(row.completion_rate),
        })),
        "division",
      ),
    ],
    columns: [
      "division",
      "assignments",
      "tasks",
      "total",
      "completed",
      "active",
      "overdue",
      "completion_rate",
    ],
    rows,
    pagination: {
      page: 1,
      pageSize: rows.length,
      total: rows.length,
      pages: 1,
    },
  };
}
const providers = {
  assignmentStatus: allWorkStatus,
  overdueAgeing: allWorkOverdue,
  workloadDistribution: allWorkload,
  directoratePerformance: allDirectoratePerformance,
  executiveOverview: executiveOverviewWithLifecycle,
  researchOutputs,
  documentActivity,
  felixUsage,
};
export async function reportCatalogue(user) {
  const permissions = reportPermissions(user);
  const [favouriteResult, overrideResult] = await Promise.all([
    query("SELECT report_key FROM user_report_favourites WHERE user_id=$1", [
      user.id,
    ]),
    query(
      "SELECT report_key,enabled,access_note FROM report_definition_overrides",
    ),
  ]);
  const favourites = new Set(favouriteResult.rows.map((r) => r.report_key));
  const overrides = new Map(
    overrideResult.rows.map((row) => [row.report_key, row]),
  );
  return [...reportRegistry.values()]
    .map((def) => ({
      ...def,
      ...(overrides.get(def.key) || {}),
      favourite: favourites.has(def.key),
    }))
    .filter((def) => def.enabled && permissions.includes(def.permission));
}
export async function reportSummary(user) {
  if (!["Administrator", "Research Manager"].includes(user.role))
    throw Object.assign(
      new Error(
        "The organisation-wide report summary is available only to managers.",
      ),
      { status: 403 },
    );
  const catalogue = await reportCatalogue(user),
    reports = [];
  for (const definition of catalogue.filter(
    (item) => item.available && item.provider,
  )) {
    try {
      const result = await reportData(user, definition.key, {
        page: 1,
        pageSize: 10,
      });
      reports.push({
        key: definition.key,
        title: definition.title,
        category: definition.category,
        level: definition.level,
        scope: result.scope,
        kpis: result.kpis.slice(0, 6),
        recordCount: result.pagination?.total ?? result.rows.length,
        generatedAt: result.generatedAt,
        available: true,
      });
    } catch (error) {
      reports.push({
        key: definition.key,
        title: definition.title,
        category: definition.category,
        level: definition.level,
        kpis: [],
        recordCount: 0,
        available: false,
        error: error.message,
      });
    }
  }
  return {
    scope: reportScope(user),
    reportCount: reports.length,
    availableCount: reports.filter((item) => item.available).length,
    reports,
    generatedAt: new Date().toISOString(),
  };
}
export async function reportData(user, key, input) {
  const definition = getReportDefinition(key);
  if (!definition)
    throw Object.assign(new Error("Report not found."), { status: 404 });
  const override = (
    await query(
      "SELECT enabled FROM report_definition_overrides WHERE report_key=$1",
      [key],
    )
  ).rows[0];
  if (override?.enabled === false)
    throw Object.assign(
      new Error("This report has been disabled by an administrator."),
      { status: 403, auditDenied: true },
    );
  if (!canAccessReport(user, definition))
    throw Object.assign(
      new Error("You do not have permission to view this report."),
      { status: 403, auditDenied: true },
    );
  if (!definition.available || !definition.provider)
    return {
      report: definition,
      filters: {},
      period: {},
      kpis: [],
      charts: [],
      columns: [],
      rows: [],
      pagination: { page: 1, pageSize: 25, total: 0, pages: 0 },
      generatedAt: new Date().toISOString(),
      scope: reportScope(user),
      available: false,
      notices: [definition.unavailableReason],
    };
  const filters = parseFilters(input),
    scope = reportScope(user),
    result = await providers[definition.provider](filters, scope);
  return {
    report: definition,
    filters,
    period: { from: filters.from || null, to: filters.to || null },
    ...result,
    generatedAt: new Date().toISOString(),
    scope,
    available: true,
    exportModel: {
      title: definition.title,
      period: { from: filters.from || null, to: filters.to || null },
      kpis: result.kpis,
      charts: result.charts,
      columns: result.columns,
      rows: result.rows,
    },
  };
}
export async function auditReportAccess(user, key, denied = false) {
  if (
    denied ||
    ["EXECUTIVE"].includes(getReportDefinition(key)?.level) ||
    getReportDefinition(key)?.category === "Audit & Compliance"
  )
    await transaction((client) =>
      audit(
        client,
        user.id,
        denied ? "REPORT_ACCESS_DENIED" : "REPORT_ACCESSED",
        "report",
        key,
        { role: user.role },
      ),
    );
}
export async function setFavourite(user, key, favourite) {
  if (!getReportDefinition(key))
    throw Object.assign(new Error("Report not found."), { status: 404 });
  if (favourite)
    await query(
      "INSERT INTO user_report_favourites(user_id,report_key)VALUES($1,$2)ON CONFLICT DO NOTHING",
      [user.id, key],
    );
  else
    await query(
      "DELETE FROM user_report_favourites WHERE user_id=$1 AND report_key=$2",
      [user.id, key],
    );
  return { key, favourite };
}
export async function reportViews(user, key) {
  if (!getReportDefinition(key))
    throw Object.assign(new Error("Report not found."), { status: 404 });
  return (
    await query(
      "SELECT id,name,filters,is_default,created_at,updated_at FROM user_report_views WHERE user_id=$1 AND report_key=$2 ORDER BY is_default DESC,updated_at DESC",
      [user.id, key],
    )
  ).rows;
}
export async function saveReportView(
  user,
  key,
  { name, filters, isDefault = false },
) {
  if (!getReportDefinition(key))
    throw Object.assign(new Error("Report not found."), { status: 404 });
  if (!name?.trim())
    throw Object.assign(new Error("A saved view name is required."), {
      status: 400,
    });
  return transaction(async (client) => {
    if (isDefault)
      await client.query(
        "UPDATE user_report_views SET is_default=FALSE WHERE user_id=$1 AND report_key=$2",
        [user.id, key],
      );
    return (
      await client.query(
        `INSERT INTO user_report_views(user_id,report_key,name,filters,is_default)VALUES($1,$2,$3,$4,$5)ON CONFLICT(user_id,report_key,name)DO UPDATE SET filters=EXCLUDED.filters,is_default=EXCLUDED.is_default,updated_at=NOW() RETURNING id,name,filters,is_default,created_at,updated_at`,
        [user.id, key, name.trim(), filters || {}, Boolean(isDefault)],
      )
    ).rows[0];
  });
}
export async function deleteReportView(user, key, id) {
  const removed = await query(
    "DELETE FROM user_report_views WHERE id=$1 AND user_id=$2 AND report_key=$3 RETURNING id",
    [id, user.id, key],
  );
  if (!removed.rowCount)
    throw Object.assign(new Error("Saved view not found."), { status: 404 });
  return { id };
}
export async function recordReportExport(user, key, format, filters, rowCount) {
  await transaction(async (client) => {
    await client.query(
      "INSERT INTO report_exports(user_id,report_key,format,filters,row_count)VALUES($1,$2,$3,$4,$5)",
      [user.id, key, format, filters || {}, rowCount],
    );
    await audit(client, user.id, "REPORT_EXPORTED", "report", key, {
      format,
      rowCount,
    });
  });
}
export const categories = () => reportCategories;
