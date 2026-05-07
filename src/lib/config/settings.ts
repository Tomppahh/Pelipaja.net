export const ROLES = {
  lobby: ["user", "leader", "beta", "moderator", "admin"],
  admin: ["admin"],
  moderator: ["moderator", "admin"],
}


export function hasRole(userRole: string, roles: string[]) {
  return roles.includes(userRole);
}