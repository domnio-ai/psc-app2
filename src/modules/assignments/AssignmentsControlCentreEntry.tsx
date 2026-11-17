import type { ApiAssignment } from "../../api";
import AssignmentsPortfolio from "./AssignmentsPortfolio";
import "./assignments-control-centre-entry.css";
import "./assignments-dashboard-standard.css";

import "./assignments-final-prelock-v1.css";
import "./assignment-portfolio-visual-v1.css";
type Props = {
  active: boolean;
  canCreate: boolean;
  currentUserName: string;
  rows: ApiAssignment[];
  notice: string;
  onCreate: () => void;
  onOpen: (assignment: ApiAssignment) => void | Promise<void>;
  onEdit: (assignment?: ApiAssignment) => void;
  onDelete: (assignment: ApiAssignment) => void | Promise<void>;
  onUpdateStatus: (assignment: ApiAssignment, status: string) => Promise<void>;
};

export default function AssignmentsControlCentreEntry({
  active,
  canCreate,
  currentUserName,
  rows,
  notice,
  onCreate,
  onOpen,
  onEdit,
  onDelete,
  onUpdateStatus,
}: Props) {
  if (!active) return null;

  return (
    <section
      className="assignment-management-view assignments-control-centre-entry"
      aria-label="Assignments Control Centre"
    >
      {canCreate && (
        <div className="assignments-control-centre-actions">
          <button type="button" onClick={onCreate}>
            + New Assignment
          </button>
        </div>
      )}

      <AssignmentsPortfolio
        rows={rows}
        currentUserName={currentUserName}
        isManager={canCreate}
        notice={notice}
        onOpen={onOpen}
        onEdit={onEdit}
        onDelete={onDelete}
        onUpdateStatus={onUpdateStatus}
      />
    </section>
  );
}
