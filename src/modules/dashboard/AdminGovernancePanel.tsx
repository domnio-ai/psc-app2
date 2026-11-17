import "./admin-governance-panel.css";

type Props = {
  activeUsers: number;
  currentResearch: number;
  pendingReviews: number;
  pendingRepository: number;
  unreadNotifications: number;
  finalisationQueue: number;
  onNavigate: (destination: string) => void;
  onOpenReports: (subject: string) => void;
};

const AdminGovernancePanel = ({
  activeUsers,
  currentResearch,
  pendingReviews,
  pendingRepository,
  unreadNotifications,
  finalisationQueue,
  onNavigate,
  onOpenReports,
}: Props) => {
  const governancePending = pendingReviews + pendingRepository + finalisationQueue;

  return (
    <section className="admin-governance-panel" aria-label="System administration command controls">
      <header>
        <div>
          <p>SYSTEM GOVERNANCE</p>
          <h2>Administrator control layer</h2>
          <span>
            Directorate operations use the same live command-centre data as management. These controls add system-wide governance, audit and configuration functions.
          </span>
        </div>
        <b>SYSTEM SCOPE</b>
      </header>

      <div className="admin-governance-kpis">
        <article><span>Active users</span><strong>{activeUsers}</strong><small>Enabled accounts in system scope</small></article>
        <article><span>Current research</span><strong>{currentResearch}</strong><small>Open governed Research projects</small></article>
        <article><span>Governance queue</span><strong>{governancePending}</strong><small>Reviews, repository approvals and finalisations</small></article>
        <article><span>Unread alerts</span><strong>{unreadNotifications}</strong><small>Notifications requiring awareness</small></article>
      </div>

      <div className="admin-governance-actions">
        <button type="button" onClick={() => onNavigate("Team & Users")}><strong>Users & roles</strong><span>Accounts, hierarchy and access governance</span></button>
        <button type="button" onClick={() => onNavigate("Audit Logs")}><strong>Audit trail</strong><span>Immutable system and workflow activity</span></button>
        <button type="button" onClick={() => onNavigate("Settings")}><strong>System settings</strong><span>Environment, security and notification controls</span></button>
        <button type="button" onClick={() => onNavigate("Felix Administration")}><strong>Felix governance</strong><span>AI health, indexing and evidence services</span></button>
        <button type="button" onClick={() => onNavigate("Document Repository")}><strong>Repository governance</strong><span>{pendingRepository} document item{pendingRepository === 1 ? "" : "s"} awaiting approval</span></button>
        <button type="button" onClick={() => onOpenReports("System-wide operational governance")}><strong>Executive analytics</strong><span>Open system-wide reports and operational intelligence</span></button>
      </div>
    </section>
  );
};

export default AdminGovernancePanel;
