export type TaskReportSaveQueue = {
  current: Promise<void> | null;
};

/** Acquire the per-workspace draft-write lock and release it in a finally block. */
export async function acquireTaskReportSaveQueue(
  queue: TaskReportSaveQueue,
): Promise<() => void> {
  while (queue.current) await queue.current;

  let release!: () => void;
  const currentWrite = new Promise<void>((resolve) => {
    release = resolve;
  });
  queue.current = currentWrite;

  return () => {
    release();
    if (queue.current === currentWrite) queue.current = null;
  };
}
