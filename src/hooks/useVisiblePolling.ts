import { useEffect, useRef } from "react";

/**
 * Runs a refresh immediately, then at the requested interval only while the
 * browser tab is visible. The latest callback is kept in a ref so ordinary
 * App renders do not tear down and recreate the timer.
 */
export function useVisiblePolling(
  enabled: boolean,
  task: () => void | Promise<void>,
  intervalMs: number,
) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let timer: number | null = null;
    let running = false;

    const run = async () => {
      if (disposed || running || document.visibilityState === "hidden") return;
      running = true;
      try {
        await taskRef.current();
      } finally {
        running = false;
      }
    };

    const stopTimer = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const startTimer = () => {
      stopTimer();
      if (disposed || document.visibilityState === "hidden") return;
      void run();
      timer = window.setInterval(() => void run(), intervalMs);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopTimer();
      else startTimer();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    startTimer();

    return () => {
      disposed = true;
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
