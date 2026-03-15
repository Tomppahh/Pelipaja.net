export const ROLES = {
  lobby: ["leader", "beta", "moderator", "admin"],
  admin: ["admin"],
  moderator: ["moderator", "admin"],
}


export function hasRole(userRole: string, roles: string[]) {
  return roles.includes(userRole);
}