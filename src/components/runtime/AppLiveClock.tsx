import { useEffect, useState } from "react";

export default function AppLiveClock({ variant }: { variant: "login" | "header" }) {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (variant === "login") {
    return (
      <>
        {clock.toLocaleDateString("en-KE", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}{" "}
        | {clock.toLocaleTimeString("en-KE")}
      </>
    );
  }

  return (
    <div className="live-time">
      <span>
        {clock.toLocaleDateString("en-KE", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </span>
      <strong>
        {clock.toLocaleTimeString("en-KE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </strong>
    </div>
  );
}
