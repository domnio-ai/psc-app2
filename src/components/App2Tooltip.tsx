import { useId, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  content: ReactNode;
  className?: string;
};

export default function App2Tooltip({ children, content, className = "" }: Props) {
  const id = useId();
  return (
    <span
      className={`app2-tooltip ${className}`.trim()}
      tabIndex={0}
      aria-describedby={id}
    >
      {children}
      <span className="app2-tooltip-content" id={id} role="tooltip">
        {content}
      </span>
    </span>
  );
}
