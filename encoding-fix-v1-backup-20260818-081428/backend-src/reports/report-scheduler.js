import { query } from "../db.js";
import { sendMail } from "../mailer.js";
import { reportData, recordReportExport } from "./report-service.js";
import { renderReportExport } from "./report-export.js";

const nextDate = (frequency, from = new Date()) => {
  const next = new Date(from);
  if (frequency === "Daily") next.setDate(next.getDate() + 1);
  else if (frequency === "Weekly") next.setDate(next.getDate() + 7);
  else next.setMonth(next.getMonth() + 1);
  return next;
};
let running = false;
export async function runDueReportSchedules() {
  if (running) return;
  running = true;
  try {
    const due = (
      await query(
        `SELECT s.*,u.name,u.email,u.role,u.division FROM report_schedules s JOIN users u ON u.id=s.owner_id WHERE s.enabled=TRUE AND s.next_run_at<=NOW() ORDER BY s.next_run_at LIMIT 10`,
      )
    ).rows;
    for (const schedule of due) {
      try {
        const user = {
            id: schedule.owner_id,
            name: schedule.name,
            email: schedule.email,
            role: schedule.role,
            division: schedule.division,
          },
          result = await reportData(user, schedule.report_key, {
            ...schedule.filters,
            page: 1,
            pageSize: 100,
          }),
          file = await renderReportExport(schedule.format, result.exportModel);
        await sendMail({
          to: schedule.recipient_emails.join(","),
          subject: `App2 scheduled report: ${result.report.title}`,
          text: `The scheduled report “${result.report.title}” is attached. It was generated from your permitted App2 data scope.`,
          attachments: [
            {
              filename: `${schedule.report_key}.${file.extension}`,
              content: file.buffer,
              contentType: file.type,
            },
          ],
        });
        await recordReportExport(
          user,
          schedule.report_key,
          schedule.format,
          schedule.filters,
          result.rows.length,
        );
        await query(
          "UPDATE report_schedules SET last_run_at=NOW(),last_status='Delivered',last_error=NULL,next_run_at=$1,updated_at=NOW() WHERE id=$2",
          [nextDate(schedule.frequency), schedule.id],
        );
      } catch (error) {
        await query(
          "UPDATE report_schedules SET last_run_at=NOW(),last_status='Failed',last_error=$1,next_run_at=$2,updated_at=NOW() WHERE id=$3",
          [
            String(error.message || error).slice(0, 2000),
            nextDate(schedule.frequency),
            schedule.id,
          ],
        );
      }
    }
  } finally {
    running = false;
  }
}
export function startReportScheduler() {
  void runDueReportSchedules().catch(console.error);
  const timer = setInterval(
    () => void runDueReportSchedules().catch(console.error),
    60000,
  );
  timer.unref?.();
  return () => clearInterval(timer);
}
