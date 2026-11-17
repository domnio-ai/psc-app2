export type TaskManagementPerson = {
  id: string;
  name: string;
  role: string;
  active?: boolean;
  supervisor_id?: string | null;
};

export type TaskReviewerOption = {
  id: string;
  name: string;
};

export type TaskAssigneeOption = {
  id: string;
  name: string;
  role: string;
};

export const deriveTaskReviewerOptions = (
  users: TaskManagementPerson[],
  assignmentMembers: TaskManagementPerson[],
  ownerId: string,
): TaskReviewerOption[] => {
  const owner = assignmentMembers.find((candidate) => candidate.id === ownerId);

  return users
    .filter((member) => {
      const assignmentMember = assignmentMembers.some(
        (candidate) => candidate.id === member.id,
      );

      return Boolean(
        member.active &&
          member.role !== "System Admin" &&
          member.id !== ownerId &&
          (assignmentMember ||
            (owner?.supervisor_id &&
              (member.id === owner.supervisor_id ||
                member.supervisor_id === owner.supervisor_id))),
      );
    })
    .map((member) => ({
      id: member.id,
      name: member.name,
    }));
};

export const deriveTaskAssigneeOptions = (
  assignmentMembers: TaskManagementPerson[],
): TaskAssigneeOption[] =>
  assignmentMembers.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
  }));
