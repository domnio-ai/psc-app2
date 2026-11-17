export const managerRoles = [
  'System Admin',
  'Director',
  'Deputy Director',
  'Assistant Director',
];

export const canDecideLeaveRequests = role => managerRoles.includes(role);