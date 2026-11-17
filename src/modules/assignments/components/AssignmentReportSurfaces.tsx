import type { ComponentProps } from "react";
import AssignmentReportBuilder from "./AssignmentReportBuilder";
import AssignmentReportsPanel from "./AssignmentReportsPanel";

type BuilderProps = ComponentProps<typeof AssignmentReportBuilder>;
type PanelProps = ComponentProps<typeof AssignmentReportsPanel>;

type BuilderSurfaceProps = {
  visible: boolean;
  builderProps: BuilderProps | null;
};

export function AssignmentReportBuilderSurface({
  visible,
  builderProps,
}: BuilderSurfaceProps) {
  if (!visible || !builderProps) return null;
  return <AssignmentReportBuilder {...builderProps} />;
}

type ReportsWorkspaceProps = {
  visible: boolean;
  panelProps: PanelProps;
};

export function AssignmentReportsWorkspace({
  visible,
  panelProps,
}: ReportsWorkspaceProps) {
  if (!visible) return null;

  return (
    <section className="phase4-documents assignment-reports-workspace">
      <AssignmentReportsPanel {...panelProps} />
    </section>
  );
}
