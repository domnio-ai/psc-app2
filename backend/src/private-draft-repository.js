import crypto from "node:crypto";
import fs from "node:fs/promises";
import { sanitizeTaskReportHtml } from "./task-report-formatting.js";

const safeText = (value) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim();

const safeFileBase = (value, fallback = "draft") =>
  safeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || fallback;

const draftSnapshotText = ({
  heading,
  reference = "",
  status = "Draft",
  sections = [],
  savedAt = new Date().toISOString(),
}) => {
  const lines = [
    heading,
    reference ? `Reference: ${reference}` : "",
    `Status: ${status}`,
    `Saved: ${savedAt}`,
    "",
  ];

  for (const section of sections) {
    const title = safeText(section?.title);
    const value = safeText(section?.value);
    if (!title && !value) continue;
    if (title) lines.push(title.toUpperCase());
    lines.push(value || "Not yet provided.");
    lines.push("");
  }

  return Buffer.from(lines.filter((line, index) => line || index > 2).join("\n"), "utf8");
};

export const buildAssignmentDraftSnapshot = (assignment) =>
  draftSnapshotText({
    heading: `${safeText(assignment.title) || "Assignment"} - ASSIGNMENT DRAFT`,
    reference: safeText(assignment.reference || assignment.id),
    savedAt: new Date(assignment.updated_at || assignment.created_at || Date.now()).toISOString(),
    sections: [
      { title: "Description", value: assignment.description },
      { title: "Objective", value: assignment.objective },
      { title: "Scope", value: assignment.scope },
      { title: "Instructions", value: assignment.instructions },
      { title: "Expected output", value: assignment.expected_output },
      { title: "Division", value: assignment.division },
      { title: "Priority", value: assignment.priority },
      { title: "Start date", value: assignment.start_date },
      { title: "Due date", value: assignment.due_date },
    ],
  });

export const buildTaskDraftSnapshot = ({ task, assignment }) =>
  draftSnapshotText({
    heading: `${safeText(task.title) || "Task"} - TASK DRAFT`,
    reference: safeText(task.reference || task.id),
    savedAt: new Date(task.updated_at || task.created_at || Date.now()).toISOString(),
    sections: [
      { title: "Assignment", value: assignment?.title },
      { title: "Description", value: task.description },
      { title: "Purpose", value: task.task_purpose },
      { title: "Specific instructions", value: task.specific_instructions },
      { title: "Expected contribution", value: task.expected_contribution },
      { title: "Expected findings", value: task.expected_findings },
      { title: "Expected output", value: task.expected_output },
      { title: "Evidence required", value: task.evidence_required },
      { title: "Status", value: task.status },
      { title: "Progress", value: `${Number(task.progress || 0)}%` },
      { title: "Notes", value: task.notes },
      { title: "Due date", value: task.due_date },
    ],
  });

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const taskReportContentHtml = (value) => {
  const raw = String(value ?? "").replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
  if (!raw) return '<p class="app2-task-report-empty">Not yet provided.</p>';

  // The shared report editor supplies HTML. Keep supported formatting, but
  // sanitize it here and again when the Repository reader serves the document.
  if (/<\/?[a-z][^>]*>/i.test(raw) || /&(?:amp;)*lt;\s*\/?\s*(?:p|br|hr|div|span|h[1-6]|strong|b|em|i|u|s|ul|ol|li|blockquote|table|thead|tbody|tr|th|td|colgroup|col|a|img)\b/i.test(raw)) {
    const sanitized = sanitizeTaskReportHtml(raw);
    return sanitized || '<p class="app2-task-report-empty">Not yet provided.</p>';
  }

  // Legacy/plain structured fields are converted to paragraphs, never injected
  // as HTML. This preserves line breaks without treating text as markup.
  return raw.split("\n").map((line) => line.trim()
    ? `<p>${escapeHtml(line.trim())}</p>`
    : '<p class="app2-task-report-empty">&nbsp;</p>').join("\n");
};

const taskReportSectionHtml = (title, value) =>
  `<div class="app2-task-report-section"><h2 class="app2-task-report-section-title">${escapeHtml(title)}</h2><div class="app2-task-report-section-content">${taskReportContentHtml(value)}</div></div>`;

const taskReportMetadataHtml = ({ reference, assignmentTitle, ownerName, savedAt }) => {
  const fields = [
    ["Reference", reference || "Not recorded"],
    ["Assignment", assignmentTitle || "Not specified"],
    ["Prepared by", ownerName || "Not recorded"],
    ["Status", "Draft"],
    ["Saved", savedAt],
  ];
  return `<div class="app2-task-report-meta">${fields.map(([label, value]) =>
    `<p class="app2-task-report-meta-item"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
  ).join("")}</div>`;
};

const taskReportReference = (task = {}) => {
  const supplied = safeText(
    task.report_reference ?? task.reportReference ?? task.reference,
  );
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Preserve any existing, meaningful report reference.
  if (supplied && !isUuid.test(supplied)) return supplied;

  // Stable, readable display reference derived from the existing task ID.
  // This is intentionally not a sequential institutional register number.
  const taskId = safeText(task.id ?? task.task_id);
  const compactId = taskId.replace(/[^0-9a-f]/gi, "").toUpperCase();
  const dateValue = task.created_at ?? task.createdAt ?? Date.now();
  const parsedDate = new Date(dateValue);
  const year = Number.isFinite(parsedDate.getTime())
    ? parsedDate.getFullYear()
    : new Date().getFullYear();

  if (compactId.length >= 16) {
    return `TR-${year}-${compactId.slice(0, 8)}-${compactId.slice(8, 12)}-${compactId.slice(12, 16)}`;
  }

  return taskId
    ? `TR-${year}-${taskId.replace(/[^a-z0-9]/gi, "").slice(0, 16).toUpperCase()}`
    : `TR-${year}-UNASSIGNED`;
};
export const buildTaskReportDraftSnapshot = ({ task, assignment, ownerName }) => {
  const title = safeText(task.contribution_title ?? task.contributionTitle) ||
    `${safeText(task.title) || "Task"} - TASK CONTRIBUTION REPORT DRAFT`;
  const reference = taskReportReference(task);
  const reportMode = safeText(task.report_mode ?? task.reportMode).toLowerCase();
  const savedAt = new Date(task.contribution_updated_at || task.updated_at || task.created_at || Date.now()).toISOString();

  // Use semantic HTML for the Repository working-copy mirror. The previous
  // .txt snapshot stripped all rich-text tags and made every heading a plain
  // paragraph, even though the authoritative Task Report draft retained HTML.
  const sections = reportMode === "blank"
    ? [{ title: "Report body", value: task.blank_content ?? task.blankContent }]
    : [
        { title: "Work completed", value: task.contribution_summary },
        { title: "Evidence reviewed", value: task.evidence_reviewed },
        { title: "Key findings", value: task.contribution_findings },
        { title: "Recommendations", value: task.contribution_recommendations },
        { title: "Challenges or limitations", value: task.contribution_challenges },
        { title: "Next actions", value: task.contribution_next_actions },
      ];

  const metadata = taskReportMetadataHtml({
    reference,
    assignmentTitle: assignment?.title,
    ownerName,
    savedAt,
  });
  const sectionMarkup = sections.map((section) => taskReportSectionHtml(section.title, section.value)).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body><div class="app2-task-report-draft"><div class="app2-psc-report-brand"><img src="/psc-logo.png" alt="Public Service Commission logo" width="118"><div><strong>PUBLIC SERVICE COMMISSION</strong><span>RESEARCH DEPARTMENT</span></div></div><p class="app2-task-report-kicker">TASK REPORT · WORKING DRAFT</p><h1 class="app2-task-report-title">${escapeHtml(title)}</h1>${metadata}${sectionMarkup}</div></body></html>`;
  return Buffer.from(html, "utf8");
};

export const buildGeneratedReportDraftSnapshot = ({ sections }) => {
  const sectionsHtml = sections.map((section) =>
    taskReportSectionHtml(section.title, section.content)
  ).join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div class="app2-task-report-draft"><div class="app2-repository-report-content">${sectionsHtml}</div></div></body></html>`;
  return Buffer.from(html, "utf8");
};

export const savePrivateDraftRepositoryVersion = async ({
  client,
  actor,
  ownerId,
  entityType,
  entityId,
  assignmentId = null,
  title,
  description,
  documentType,
  subject,
  sourceType,
  tags = [],
  bytes,
  fileExtension = ".txt",
  storeDocument,
  audit,
}) => {
  if (!ownerId) {
    throw Object.assign(
      new Error("A private repository draft must have an owner."),
      { statusCode: 400 },
    );
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");

  const existing = (
    await client.query(
      `SELECT k.*
       FROM knowledge_items k
       JOIN repository_entity_links rel ON rel.knowledge_id=k.id
       WHERE rel.entity_type=$1
         AND rel.entity_id=$2::uuid
         AND k.document_type=$3
         AND k.status='Draft'
         AND k.is_archived=FALSE
       ORDER BY k.created_at DESC
       LIMIT 1
       FOR UPDATE OF k`,
      [entityType, entityId, documentType],
    )
  ).rows[0] || null;

  if (existing) {
    const latest = (
      await client.query(
        `SELECT id,version_number,sha256_hash
         FROM knowledge_versions
         WHERE knowledge_id=$1
         ORDER BY version_number DESC
         LIMIT 1`,
        [existing.id],
      )
    ).rows[0] || null;

    if (latest?.sha256_hash === sha256) {
      await client.query(
        `UPDATE knowledge_items
         SET title=$1,
             description=$2,
             tags=$3,
             author=$4,
             subject=$5,
             updated_at=NOW()
         WHERE id=$6`,
        [title, description, tags, actor.name || null, subject, existing.id],
      );

      return {
        documentId: existing.id,
        version: Number(latest.version_number || existing.current_version || 1),
        versionCreated: false,
      };
    }
  }

  const normalizedExtension = fileExtension === ".html" ? ".html" : ".txt";
  const stored = await storeDocument(bytes, normalizedExtension);
  let keepStoredFile = false;

  try {
    const originalName = `${safeFileBase(title)}-draft${normalizedExtension}`;
    const mimeType = normalizedExtension === ".html"
      ? "text/html; charset=utf-8"
      : "text/plain; charset=utf-8";

    let item = existing;

    if (!item) {
      item = (
        await client.query(
          `INSERT INTO knowledge_items(
             title,description,category,tags,author,document_date,status,created_by,
             current_version,source_type,source_url,directorate,document_type,subject,
             classification,felix_enabled,reviewer_id,is_archived
           )
           VALUES(
             $1,$2,'Working Drafts',$3,$4,CURRENT_DATE,'Draft',$5,
             0,$6,'',NULL,$7,$8,'INTERNAL',FALSE,NULL,FALSE
           )
           RETURNING *`,
          [
            title,
            description,
            tags,
            actor.name || null,
            ownerId,
            sourceType,
            documentType,
            subject,
          ],
        )
      ).rows[0];

      await client.query(
        `INSERT INTO repository_entity_links(
           knowledge_id,entity_type,entity_id,linked_by
         )
         VALUES($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`,
        [item.id, entityType, entityId, actor.id],
      );

      if (assignmentId) {
        await client.query(
          `INSERT INTO repository_entity_links(
             knowledge_id,entity_type,entity_id,linked_by
           )
           VALUES($1,'assignment',$2,$3)
           ON CONFLICT DO NOTHING`,
          [item.id, assignmentId, actor.id],
        );

        await client.query(
          `INSERT INTO knowledge_assignment_links(
             knowledge_id,assignment_id,linked_by
           )
           VALUES($1,$2,$3)
           ON CONFLICT DO NOTHING`,
          [item.id, assignmentId, actor.id],
        );
      }
    }

    const nextVersion = Number(
      (
        await client.query(
          `SELECT COALESCE(MAX(version_number),0)::int + 1 AS next_version
           FROM knowledge_versions
           WHERE knowledge_id=$1`,
          [item.id],
        )
      ).rows[0].next_version,
    );

    await client.query(
      `UPDATE knowledge_versions
       SET is_current=FALSE
       WHERE knowledge_id=$1
         AND is_current=TRUE`,
      [item.id],
    );

    await client.query(
      `INSERT INTO knowledge_versions(
         knowledge_id,version_number,uploader_id,original_name,stored_name,
         storage_path,mime_type,size_bytes,sha256_hash,is_current,notes
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10)`,
      [
        item.id,
        nextVersion,
        actor.id,
        originalName,
        stored.storedName,
        stored.storagePath,
        mimeType,
        bytes.length,
        sha256,
        "Automatic private draft snapshot from APP2 Save.",
      ],
    );

    await client.query(
      `UPDATE knowledge_items
       SET title=$1,
           description=$2,
           tags=$3,
           author=$4,
           subject=$5,
           status='Draft',
           reviewer_id=NULL,
           felix_enabled=FALSE,
           current_version=$6,
           updated_at=NOW()
       WHERE id=$7`,
      [
        title,
        description,
        tags,
        actor.name || null,
        subject,
        nextVersion,
        item.id,
      ],
    );

    await audit(
      client,
      actor.id,
      "PRIVATE_REPOSITORY_DRAFT_SAVED",
      entityType,
      entityId,
      {
        repositoryDocumentId: item.id,
        repositoryVersion: nextVersion,
        documentType,
        ownerId,
      },
    );

    keepStoredFile = true;

    return {
      documentId: item.id,
      version: nextVersion,
      versionCreated: true,
    };
  } finally {
    if (!keepStoredFile && stored?.absolutePath) {
      await fs.unlink(stored.absolutePath).catch(() => {});
    }
  }
};


export const promotePrivateDraftToPublished = async ({
  client,
  actor,
  entityType,
  entityId,
  draftDocumentType,
  finalDocumentType,
  title,
  description,
  categoryName,
  categoryId = null,
  tags = [],
  author = null,
  subject = null,
  sourceType,
  directorate = null,
  classification = "INTERNAL",
  approvedBy,
  approvedAt,
  originalName,
  stored,
  mimeType,
  bytes,
  sha256,
  notes,
  assignmentId = null,
  audit,
}) => {
  const existingDraft = (
    await client.query(
      `SELECT k.*
       FROM knowledge_items k
       JOIN repository_entity_links rel ON rel.knowledge_id=k.id
       WHERE rel.entity_type=$1
         AND rel.entity_id=$2::uuid
         AND k.document_type=$3
         AND k.status='Draft'
         AND k.is_archived=FALSE
       ORDER BY k.created_at DESC
       LIMIT 1
       FOR UPDATE OF k`,
      [entityType, entityId, draftDocumentType],
    )
  ).rows[0] || null;

  let item = existingDraft;

  if (!item) {
    item = (
      await client.query(
        `INSERT INTO knowledge_items(
           title,description,category,category_id,tags,author,document_date,status,
           created_by,approved_by,approved_at,current_version,source_type,source_url,
           directorate,document_type,subject,classification,felix_enabled,
           reviewed_by,reviewed_at,is_archived
         )
         VALUES(
           $1,$2,$3,$4,$5,$6,CURRENT_DATE,'Published',
           $7,$8,$9,0,$10,'',$11,$12,$13,$14,TRUE,
           $8,$9,FALSE
         )
         RETURNING *`,
        [
          title,
          description,
          categoryName,
          categoryId,
          tags,
          author,
          actor.id,
          approvedBy,
          approvedAt,
          sourceType,
          directorate,
          finalDocumentType,
          subject,
          classification,
        ],
      )
    ).rows[0];

    await client.query(
      `INSERT INTO repository_entity_links(
         knowledge_id,entity_type,entity_id,linked_by
       )
       VALUES($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [item.id, entityType, entityId, actor.id],
    );

    if (assignmentId) {
      await client.query(
        `INSERT INTO repository_entity_links(
           knowledge_id,entity_type,entity_id,linked_by
         )
         VALUES($1,'assignment',$2,$3)
         ON CONFLICT DO NOTHING`,
        [item.id, assignmentId, actor.id],
      );

      await client.query(
        `INSERT INTO knowledge_assignment_links(
           knowledge_id,assignment_id,linked_by
         )
         VALUES($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [item.id, assignmentId, actor.id],
      );
    }
  }

  const nextVersion = Number(
    (
      await client.query(
        `SELECT COALESCE(MAX(version_number),0)::int + 1 AS next_version
         FROM knowledge_versions
         WHERE knowledge_id=$1`,
        [item.id],
      )
    ).rows[0].next_version,
  );

  await client.query(
    `UPDATE knowledge_versions
     SET is_current=FALSE
     WHERE knowledge_id=$1
       AND is_current=TRUE`,
    [item.id],
  );

  const version = (
    await client.query(
      `INSERT INTO knowledge_versions(
         knowledge_id,version_number,uploader_id,original_name,stored_name,
         storage_path,mime_type,size_bytes,sha256_hash,is_current,
         approved_by,approved_at,notes
       )
       VALUES(
         $1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,
         $10,$11,$12
       )
       RETURNING *`,
      [
        item.id,
        nextVersion,
        actor.id,
        originalName,
        stored.storedName,
        stored.storagePath,
        mimeType,
        bytes.length,
        sha256,
        approvedBy,
        approvedAt,
        notes,
      ],
    )
  ).rows[0];

  await client.query(
    `UPDATE knowledge_items
     SET title=$1,
         description=$2,
         category=$3,
         category_id=$4,
         tags=$5,
         author=$6,
         status='Published',
         approved_by=$7,
         approved_at=$8,
         current_version=$9,
         source_type=$10,
         directorate=$11,
         document_type=$12,
         subject=$13,
         classification=$14,
         felix_enabled=TRUE,
         reviewed_by=$7,
         reviewed_at=$8,
         updated_at=NOW()
     WHERE id=$15`,
    [
      title,
      description,
      categoryName,
      categoryId,
      tags,
      author,
      approvedBy,
      approvedAt,
      nextVersion,
      sourceType,
      directorate,
      finalDocumentType,
      subject,
      classification,
      item.id,
    ],
  );

  await audit(
    client,
    actor.id,
    existingDraft
      ? "PRIVATE_REPOSITORY_DRAFT_PROMOTED"
      : "REPOSITORY_FINAL_CREATED_WITHOUT_PRIOR_DRAFT",
    entityType,
    entityId,
    {
      repositoryDocumentId: item.id,
      finalVersion: nextVersion,
      draftDocumentType,
      finalDocumentType,
      preservedDraftLineage: Boolean(existingDraft),
    },
  );

  return {
    item: {
      ...item,
      title,
      status: "Published",
      document_type: finalDocumentType,
      current_version: nextVersion,
      felix_enabled: true,
    },
    version,
    preservedDraftLineage: Boolean(existingDraft),
  };
};


export const archivePrivateOperationalDrafts = async ({
  client,
  actor,
  entityType,
  entityId,
  documentTypes,
  finalRepositoryDocumentId,
  audit,
}) => {
  if (!Array.isArray(documentTypes) || documentTypes.length === 0) return [];

  const archived = (
    await client.query(
      `UPDATE knowledge_items
       SET status='Archived',
           is_archived=TRUE,
           felix_enabled=FALSE,
           updated_at=NOW()
       WHERE id IN(
         SELECT rel.knowledge_id
         FROM repository_entity_links rel
         JOIN knowledge_items draft_item ON draft_item.id=rel.knowledge_id
         WHERE rel.entity_type=$1
           AND rel.entity_id=$2::uuid
           AND draft_item.document_type=ANY($3::varchar[])
           AND draft_item.status='Draft'
           AND COALESCE(draft_item.is_archived,FALSE)=FALSE
           AND ($4::uuid IS NULL OR draft_item.id<>$4::uuid)
       )
       RETURNING id,document_type,title`,
      [entityType, entityId, documentTypes, finalRepositoryDocumentId || null],
    )
  ).rows;

  for (const row of archived) {
    await audit(
      client,
      actor.id,
      'PRIVATE_REPOSITORY_OPERATIONAL_DRAFT_ARCHIVED',
      'knowledge',
      row.id,
      {
        entityType,
        entityId,
        documentType: row.document_type,
        finalRepositoryDocumentId,
        reason: 'Final governed report published',
      },
    );
  }

  return archived;
};
