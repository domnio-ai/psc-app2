import { useEffect, useMemo, useState } from "react";
import { api, type ApiUser } from "../../api";

export type TaskReportReviewerOption = {
  id: string;
  name: string;
  role: string;
};

type Params = {
  token: string;
  assignmentId?: string | null;
  ownerId?: string | null;
  enabled: boolean;
};

type Result = {
  options: TaskReportReviewerOption[];
  loading: boolean;
  error: string;
  retry: () => void;
};

const normalizeReviewerOptions = (
  rows: ApiUser[],
  ownerId: string,
): TaskReportReviewerOption[] =>
  rows
    .filter(
      (row) =>
        row.active &&
        row.id !== ownerId &&
        row.role !== "System Admin",
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
    }));

export function useTaskReportReviewerOptions({
  token,
  assignmentId,
  ownerId,
  enabled,
}: Params): Result {
  const [rows, setRows] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!enabled || !assignmentId || !ownerId) {
      setRows([]);
      setLoading(false);
      setError("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .assignmentReviewerCandidates(token, assignmentId, ownerId)
      .then((reviewers) => {
        if (!cancelled) setRows(reviewers);
      })
      .catch((reason) => {
        if (cancelled) return;
        setRows([]);
        setError(
          reason instanceof Error
            ? reason.message
            : "Eligible Task Report reviewers could not be loaded.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, assignmentId, ownerId, enabled, retryCount]);

  const options = useMemo(
    () => normalizeReviewerOptions(rows, ownerId || ""),
    [rows, ownerId],
  );

  return { options, loading, error, retry: () => setRetryCount((count) => count + 1) };
}
