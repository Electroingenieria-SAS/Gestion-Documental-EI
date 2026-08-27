export type AppRole = "super_admin" | "records_admin" | "office_admin" | "editor" | "viewer" | "auditor";
export type Profile = {
  id: string;
  organization_id: string | null;
  office_id: string | null;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  active: boolean;
};
export type NavKey = "dashboard" | "trd" | "expedientes" | "fuid" | "radicacion" | "transferencias" | "archivo" | "retencion" | "aprobaciones" | "auditoria" | "usuarios";
