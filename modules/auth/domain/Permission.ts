import { Role } from "./Role"

export type Permission =
  | "workshop:create"
  | "workshop:update"
  | "workshop:delete"
  | "workshop:read"
  | "registration:create"
  | "registration:read:own"
  | "registration:read:all"
  | "payment:create"
  | "checkin:preload"
  | "checkin:mark"
  | "csv:import"
  | "admin:dashboard"
  | "notification:send"

const PERMISSION_MAP: Record<Permission, Role[]> = {
  "workshop:create":       [Role.ORGANIZER],
  "workshop:update":       [Role.ORGANIZER],
  "workshop:delete":       [Role.ORGANIZER],
  "workshop:read":         [Role.STUDENT, Role.ORGANIZER, Role.CHECKIN_STAFF],
  "registration:create":   [Role.STUDENT],
  "registration:read:own": [Role.STUDENT],
  "registration:read:all": [Role.ORGANIZER],
  "payment:create":        [Role.STUDENT],
  "checkin:preload":       [Role.CHECKIN_STAFF],
  "checkin:mark":          [Role.CHECKIN_STAFF],
  "csv:import":            [Role.ORGANIZER],
  "admin:dashboard":       [Role.ORGANIZER],
  "notification:send":     [Role.ORGANIZER],
}

export function can(role: Role, permission: Permission): boolean {
  return PERMISSION_MAP[permission].includes(role)
}
