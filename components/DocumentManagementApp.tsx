"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { NavKey, Profile } from "@/lib/types";

type Row = Record<string, any>;
type Toast = { kind: "ok" | "error" | "info"; text: string } | null;

const NAV: { key: NavKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "Tablero", icon: "▦" },
  { key: "trd", label: "TRD maestra", icon: "▤" },
  { key: "expedientes", label: "Expedientes", icon: "▱" },
  { key: "fuid", label: "FUID / Inventario", icon: "≡" },
  { key: "radicacion", label: "Radicación", icon: "↗" },
  { key: "transferencias", label: "Transferencias", icon: "⇄" },
  { key: "archivo", label: "Archivo físico", icon: "▣" },
  { key: "retencion", label: "Retención", icon: "◷" },
  { key: "aprobaciones", label: "Aprobaciones", icon: "✓" },
  { key: "auditoria", label: "Auditoría", icon: "◎" },
  { key: "usuarios", label: "Usuarios", icon: "♙" },
];

const ROLE_NAMES: Record<string, string> = {
  super_admin: "Super administrador",
  records_admin: "Administrador documental",
  office_admin: "Administrador de dependencia",
  editor: "Editor",
  viewer: "Consulta",
  auditor: "Auditor",
};

const safeText = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));
const fmtDate = (v: any) => (v ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(new Date(v)) : "—");
const fmtDateTime = (v: any) => (v ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(v)) : "—");

function csvDownload(filename: string, rows: Row[], columns: [string, string][]) {
  const esc = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [columns.map(([, label]) => esc(label)).join(","), ...rows.map((r) => columns.map(([k]) => esc(r[k])).join(","))].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function StatusPill({ value }: { value: any }) {
  const txt = safeText(value);
  const normalized = txt.toLowerCase();
  const tone = normalized.includes("open") || normalized.includes("approved") || normalized.includes("active") || normalized.includes("matched") ? "good"
    : normalized.includes("pending") || normalized.includes("review") || normalized.includes("draft") ? "warn"
    : normalized.includes("closed") || normalized.includes("transferred") ? "neutral" : "neutral";
  return <span className={`pill ${tone}`}>{txt}</span>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><strong>Sin registros</strong><span>{text}</span></div>;
}

function Loader() { return <div className="loader"><span /><span /><span /></div>; }

export default function DocumentManagementApp() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nav, setNav] = useState<NavKey>("dashboard");
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [query, setQuery] = useState("");
  const [offices, setOffices] = useState<Row[]>([]);
  const [trd, setTrd] = useState<Row[]>([]);
  const [expedientes, setExpedientes] = useState<Row[]>([]);
  const [fuid, setFuid] = useState<Row[]>([]);
  const [radications, setRadications] = useState<Row[]>([]);
  const [transfers, setTransfers] = useState<Row[]>([]);
  const [boxes, setBoxes] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<Row[]>([]);
  const [tasks, setTasks] = useState<Row[]>([]);
  const [audits, setAudits] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedExpediente, setSelectedExpediente] = useState<Row | null>(null);
  const [documents, setDocuments] = useState<Row[]>([]);
  const [controlSheet, setControlSheet] = useState<Row[]>([]);
  const [showNewExp, setShowNewExp] = useState(false);
  const [showNewRad, setShowNewRad] = useState(false);
  const [showNewTransfer, setShowNewTransfer] = useState(false);
  const [showNewBox, setShowNewBox] = useState(false);
  const [showUser, setShowUser] = useState(false);

  const notify = useCallback((kind: "ok" | "error" | "info", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/login"); return; }
      const user = sessionData.session.user;
      const { data: p, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error || !p || !p.active) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }
      setProfile(p as Profile);
      const { data: unitData } = await supabase.from("organizational_units").select("id,name,code,unit_type,active").eq("active", true).order("name");
      setOffices(unitData || []);
      setBooting(false);
    })();
  }, [router]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const tables = ["trd_entries", "expedientes", "fuid_items", "radications", "transfers", "archive_boxes", "approval_requests"];
    const results = await Promise.all(tables.map((t) => supabase.from(t).select("*", { head: true, count: "exact" })));
    const c: Record<string, number> = {};
    tables.forEach((t, i) => c[t] = results[i].count || 0);
    const { count: due } = await supabase.from("expedientes").select("*", { head: true, count: "exact" }).not("retention_management_due", "is", null).lte("retention_management_due", new Date().toISOString().slice(0, 10));
    c.retention_due = due || 0;
    setCounts(c);
    const { data } = await supabase.from("expedientes").select("id,expediente_code,title,status,phase,retention_management_due,updated_at,organizational_units(name)").order("updated_at", { ascending: false }).limit(7);
    setExpedientes(data || []);
    setLoading(false);
  }, []);

  const loadNav = useCallback(async (target: NavKey) => {
    if (!profile) return;
    setLoading(true);
    setQuery("");
    try {
      if (target === "dashboard") await loadDashboard();
      if (target === "trd") {
        const { data, error } = await supabase.from("trd_entries").select("id,official_code,system_code,name,level,classification,support_format,retention_management_raw,retention_central_raw,disposition,review_state,requires_valuation,source_sheet,organizational_units(name)").order("source_sheet").order("source_row").limit(1000);
        if (error) throw error; setTrd(data || []);
      }
      if (target === "expedientes" || target === "retencion") {
        const { data, error } = await supabase.from("expedientes").select("*,organizational_units(name),trd_entries(name,official_code,system_code,retention_management_raw,retention_central_raw)").order("updated_at", { ascending: false }).limit(800);
        if (error) throw error; setExpedientes(data || []);
      }
      if (target === "fuid") {
        const { data, error } = await supabase.from("fuid_items").select("*,organizational_units(name)").order("created_at", { ascending: false }).limit(700);
        if (error) throw error; setFuid(data || []);
      }
      if (target === "radicacion") {
        const { data, error } = await supabase.from("radications").select("*,organizational_units(name)").order("received_or_sent_at", { ascending: false }).limit(500);
        if (error) throw error; setRadications(data || []);
      }
      if (target === "transferencias") {
        const { data, error } = await supabase.from("transfers").select("*,organizational_units(name)").order("transfer_date", { ascending: false }).limit(500);
        if (error) throw error; setTransfers(data || []);
      }
      if (target === "archivo") {
        const { data, error } = await supabase.from("archive_boxes").select("*,physical_locations(name,code)").order("created_at", { ascending: false }).limit(500);
        if (error) throw error; setBoxes(data || []);
      }
      if (target === "aprobaciones") {
        const [a, t] = await Promise.all([
          supabase.from("approval_requests").select("*").order("created_at", { ascending: false }).limit(300),
          supabase.from("workflow_tasks").select("*").order("created_at", { ascending: false }).limit(300),
        ]);
        if (a.error) throw a.error; if (t.error) throw t.error;
        setApprovals(a.data || []); setTasks(t.data || []);
      }
      if (target === "auditoria") {
        const { data, error } = await supabase.from("audit_logs").select("*").order("occurred_at", { ascending: false }).limit(500);
        if (error) throw error; setAudits(data || []);
      }
      if (target === "usuarios") {
        const { data, error } = await supabase.from("profiles").select("*,organizational_units(name)").order("full_name").limit(500);
        if (error) throw error; setProfiles(data || []);
      }
    } catch (e: any) { notify("error", e.message || "No fue posible cargar la información."); }
    setLoading(false);
  }, [loadDashboard, notify, profile]);

  useEffect(() => { if (profile) loadNav(nav); }, [nav, profile, loadNav]);

  async function logout() { await supabase.auth.signOut(); router.replace("/login"); }

  const searchRows = useCallback((rows: Row[]) => {
    const q = query.trim().toLocaleLowerCase("es");
    if (!q) return rows;
    return rows.filter((r) => JSON.stringify(r).toLocaleLowerCase("es").includes(q));
  }, [query]);

  const trdForExpediente = useMemo(() => trd.filter((r) => r.level === "series" || r.level === "subseries"), [trd]);

  async function ensureTrd() {
    if (trd.length) return;
    const { data } = await supabase.from("trd_entries").select("id,official_code,system_code,name,level,disposition,organizational_units(name)").in("level", ["series", "subseries"]).order("name").limit(1000);
    setTrd(data || []);
  }

  async function openNewExp() { await ensureTrd(); setShowNewExp(true); }

  async function createExpediente(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!profile?.organization_id) return;
    const fd = new FormData(e.currentTarget);
    const trdId = String(fd.get("trd_entry_id") || "");
    const trdRow = trd.find((x) => x.id === trdId);
    const officeId = String(fd.get("office_id") || profile.office_id || "");
    const code = String(fd.get("expediente_code") || "").trim();
    const { error } = await supabase.from("expedientes").insert({
      organization_id: profile.organization_id, office_id: officeId, trd_entry_id: trdId,
      expediente_code: code, title: String(fd.get("title") || "").trim(), description: String(fd.get("description") || "").trim() || null,
      medium: String(fd.get("medium") || "hybrid"), phase: "management", status: "open", access_level: String(fd.get("access_level") || "internal"),
      start_date: String(fd.get("start_date") || new Date().toISOString().slice(0,10)), disposition: trdRow?.disposition || "pending", created_by: profile.id,
    });
    if (error) return notify("error", error.message);
    notify("ok", "Expediente creado y clasificado contra la TRD."); setShowNewExp(false); loadNav("expedientes");
  }

  async function viewExpediente(exp: Row) {
    setSelectedExpediente(exp); setDocuments([]); setControlSheet([]);
    const [d, c] = await Promise.all([
      supabase.from("documents").select("*,document_files(*)").eq("expediente_id", exp.id).order("sequence_no"),
      supabase.from("control_sheet_entries").select("*").eq("expediente_id", exp.id).order("sequence_no"),
    ]);
    setDocuments(d.data || []); setControlSheet(c.data || []);
  }

  async function uploadDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedExpediente || !profile) return;
    const form = e.currentTarget; const fd = new FormData(form); const file = fd.get("file") as File;
    if (!file?.size) return notify("error", "Selecciona un archivo.");
    if (file.size > 100 * 1024 * 1024) return notify("error", "El archivo supera 100 MB.");
    const seq = documents.length + 1;
    const { data: doc, error: docError } = await supabase.from("documents").insert({
      expediente_id: selectedExpediente.id, title: String(fd.get("title") || file.name), document_date: String(fd.get("document_date") || new Date().toISOString().slice(0,10)),
      subject: String(fd.get("subject") || "") || null, support_format: "digital", mime_type: file.type || null, status: "active", sequence_no: seq, created_by: profile.id,
    }).select().single();
    if (docError || !doc) return notify("error", docError?.message || "No se creó el documento.");
    const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${profile.id}/${selectedExpediente.id}/${doc.id}/${Date.now()}-${clean}`;
    const { error: storageError } = await supabase.storage.from("records").upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (storageError) { await supabase.from("documents").delete().eq("id", doc.id); return notify("error", storageError.message); }
    const { error: fileError } = await supabase.from("document_files").insert({ document_id: doc.id, version_no: 1, storage_bucket: "records", storage_path: path, original_filename: file.name, mime_type: file.type || null, size_bytes: file.size, created_by: profile.id, is_current: true });
    if (fileError) return notify("error", fileError.message);
    await supabase.from("control_sheet_entries").insert({ expediente_id: selectedExpediente.id, document_id: doc.id, entry_date: String(fd.get("document_date") || new Date().toISOString().slice(0,10)), document_type_name: String(fd.get("title") || file.name), sequence_no: seq });
    notify("ok", "Documento incorporado, versionado y registrado en la hoja de control."); form.reset(); viewExpediente(selectedExpediente);
  }

  async function downloadFile(doc: Row) {
    const f = (doc.document_files || []).find((x: Row) => x.is_current) || doc.document_files?.[0];
    if (!f) return notify("error", "Este documento no tiene archivo digital asociado.");
    const { data, error } = await supabase.storage.from("records").createSignedUrl(f.storage_path, 60);
    if (error || !data?.signedUrl) return notify("error", error?.message || "No fue posible generar el enlace.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function closeExpediente(exp: Row) {
    if (!confirm(`¿Cerrar el expediente ${exp.expediente_code}? Después del cierre quedará bloqueada la incorporación ordinaria de documentos.`)) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("expedientes").update({ status: "closed", closed_at: now, closed_by: profile?.id, end_date: exp.end_date || now.slice(0,10) }).eq("id", exp.id);
    if (error) return notify("error", error.message);
    notify("ok", "Expediente cerrado. Los vencimientos de retención fueron recalculados desde la TRD."); loadNav("expedientes");
  }

  async function reopenExpediente(exp: Row) {
    const reason = prompt("Motivo obligatorio de reapertura:"); if (!reason?.trim()) return;
    const { error } = await supabase.from("expedientes").update({ status: "open", reopened_at: new Date().toISOString(), reopen_reason: reason.trim() }).eq("id", exp.id);
    if (error) return notify("error", error.message);
    notify("ok", "Expediente reabierto con trazabilidad del motivo."); loadNav("expedientes");
  }

  async function createRadication(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!profile?.organization_id) return; const fd = new FormData(e.currentTarget);
    const number = `RAD-${new Date().getFullYear()}-${Date.now().toString().slice(-7)}`;
    const { error } = await supabase.from("radications").insert({ organization_id: profile.organization_id, office_id: String(fd.get("office_id") || profile.office_id || "") || null, radication_number: number, direction: String(fd.get("direction")), channel: String(fd.get("channel")), subject: String(fd.get("subject")), sender: String(fd.get("sender")) || null, recipient: String(fd.get("recipient")) || null, received_or_sent_at: new Date().toISOString(), status: "open", assigned_to: profile.id });
    if (error) return notify("error", error.message); notify("ok", `Radicado ${number} creado.`); setShowNewRad(false); loadNav("radicacion");
  }

  async function createTransfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!profile?.organization_id) return; const fd = new FormData(e.currentTarget);
    const type = String(fd.get("transfer_type")); const number = `TR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const { error } = await supabase.from("transfers").insert({ organization_id: profile.organization_id, transfer_number: number, transfer_type: type, from_phase: type === "secondary" ? "central" : "management", to_phase: type === "secondary" ? "historical" : "central", office_id: String(fd.get("office_id") || profile.office_id || "") || null, transfer_date: new Date().toISOString().slice(0,10), status: "draft", object: String(fd.get("object") || ""), delivered_by: profile.id });
    if (error) return notify("error", error.message); notify("ok", `Transferencia ${number} creada en borrador.`); setShowNewTransfer(false); loadNav("transferencias");
  }

  async function createBox(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!profile?.organization_id) return; const fd = new FormData(e.currentTarget);
    const number = String(fd.get("box_number") || "").trim();
    const { error } = await supabase.from("archive_boxes").insert({ organization_id: profile.organization_id, phase: String(fd.get("phase")), box_number: number, qr_code: `EI-BOX-${number}`, barcode: `EI${String(Date.now()).slice(-9)}`, status: "active" });
    if (error) return notify("error", error.message); notify("ok", "Caja registrada y lista para rotulación."); setShowNewBox(false); loadNav("archivo");
  }

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token; if (!token) return;
    const { data, error } = await supabase.functions.invoke("documental-user-admin", { body: { action: "create", email: String(fd.get("email")), password: String(fd.get("password")), full_name: String(fd.get("full_name")), role: String(fd.get("role")), office_id: String(fd.get("office_id")) || null }, headers: { Authorization: `Bearer ${token}` } });
    if (error || !data?.ok) return notify("error", data?.error || error?.message || "No fue posible crear el usuario.");
    notify("ok", "Usuario creado con rol y dependencia asignados."); setShowUser(false); loadNav("usuarios");
  }

  function printLabel(kind: "folder" | "box", entity: Row) {
    const w = window.open("", "label", "width=900,height=650"); if (!w) return;
    const title = kind === "folder" ? entity.title : `CAJA ${entity.box_number}`;
    const code = kind === "folder" ? entity.expediente_code : entity.qr_code;
    w.document.write(`<!doctype html><html><head><title>Rótulo</title><style>body{font-family:Arial;padding:28px;color:#111}.label{border:2px solid #111;padding:22px;width:720px}.top{display:flex;justify-content:space-between;border-bottom:1px solid #111;padding-bottom:10px}.brand{font-weight:800;font-size:22px}.tag{font-size:11px;text-transform:uppercase;letter-spacing:1px}.title{font-size:20px;font-weight:700;margin:18px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px}.code{font-family:monospace;font-size:24px;letter-spacing:2px;border:1px solid #111;padding:12px;margin-top:18px;text-align:center}@media print{button{display:none}}</style></head><body><div class="label"><div class="top"><div><div class="brand">ELECTROINGENIERÍA S.A.S.</div><div class="tag">Sistema de Gestión Documental</div></div><div class="tag">${kind === "folder" ? "RÓTULO DE CARPETA" : "RÓTULO DE CAJA"}</div></div><div class="title">${title}</div><div class="grid"><div><b>Código:</b> ${code}</div><div><b>Fase:</b> ${safeText(entity.phase)}</div><div><b>Estado:</b> ${safeText(entity.status)}</div><div><b>Fecha:</b> ${new Date().toLocaleDateString("es-CO")}</div></div><div class="code">${code}</div></div><br><button onclick="window.print()">Imprimir</button></body></html>`);
    w.document.close();
  }

  if (booting) return <main className="boot"><div className="brand-mark">GD</div><Loader/><p>Validando acceso y cargando el SGDEA…</p></main>;
  if (!profile) return null;

  const canAdmin = ["super_admin", "records_admin"].includes(profile.role);
  const canEdit = ["super_admin", "records_admin", "office_admin", "editor"].includes(profile.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="side-brand"><div className="brand-mark compact">GD</div><div><strong>SGDEA</strong><span>Electroingeniería</span></div></div>
        <nav>{NAV.filter((n) => (n.key !== "auditoria" || ["super_admin","records_admin","auditor"].includes(profile.role)) && (n.key !== "usuarios" || canAdmin)).map((n) => <button key={n.key} className={nav === n.key ? "active" : ""} onClick={() => setNav(n.key)}><i>{n.icon}</i><span>{n.label}</span></button>)}</nav>
        <div className="side-user"><div className="avatar">{(profile.full_name || profile.email || "U").slice(0,2).toUpperCase()}</div><div><strong>{profile.full_name || profile.email}</strong><span>{ROLE_NAMES[profile.role]}</span></div><button title="Cerrar sesión" onClick={logout}>↪</button></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">SISTEMA DE GESTIÓN DOCUMENTAL Y ARCHIVO</span><h1>{NAV.find((x) => x.key === nav)?.label}</h1></div>
          <div className="top-actions"><span className="live"><b/> Supabase conectado</span><button className="icon-button" onClick={() => loadNav(nav)}>↻</button></div>
        </header>

        {loading && <div className="progress-line" />}
        {toast && <div className={`toast ${toast.kind}`}>{toast.kind === "ok" ? "✓" : toast.kind === "error" ? "!" : "i"}<span>{toast.text}</span></div>}

        {nav === "dashboard" && <Dashboard counts={counts} recent={expedientes} loading={loading} go={setNav} />}
        {nav === "trd" && <TRDView rows={searchRows(trd)} query={query} setQuery={setQuery} exportRows={() => csvDownload("TRD-principal.csv", searchRows(trd), [["official_code","Código"],["name","Serie/Subserie/Tipo"],["level","Nivel"],["retention_management_raw","Retención gestión"],["retention_central_raw","Retención central"],["disposition","Disposición"],["review_state","Revisión"]])} />}
        {nav === "expedientes" && <ExpedientesView rows={searchRows(expedientes)} query={query} setQuery={setQuery} canEdit={canEdit} onNew={openNewExp} onView={viewExpediente} onClose={closeExpediente} onReopen={reopenExpediente} onPrint={(x) => printLabel("folder", x)} />}
        {nav === "fuid" && <FUIDView rows={searchRows(fuid)} query={query} setQuery={setQuery} exportRows={() => csvDownload("FUID.csv", searchRows(fuid), [["trd_code","Código TRD"],["series_subseries_or_matter","Serie/Subserie/Asunto"],["description","Descripción"],["extreme_initial","Inicial"],["extreme_final","Final"],["box_no","Caja"],["folder_no","Carpeta"],["folios_from","Folio inicial"],["folios_to","Folio final"],["support","Soporte"],["location_name","Ubicación"]])} />}
        {nav === "radicacion" && <RadicacionView rows={searchRows(radications)} query={query} setQuery={setQuery} canEdit={canEdit} onNew={() => setShowNewRad(true)} />}
        {nav === "transferencias" && <TransferView rows={searchRows(transfers)} query={query} setQuery={setQuery} canEdit={canEdit} onNew={() => setShowNewTransfer(true)} />}
        {nav === "archivo" && <ArchivoView rows={searchRows(boxes)} query={query} setQuery={setQuery} canEdit={canEdit} onNew={() => setShowNewBox(true)} onPrint={(x) => printLabel("box", x)} />}
        {nav === "retencion" && <RetencionView rows={searchRows(expedientes)} query={query} setQuery={setQuery} />}
        {nav === "aprobaciones" && <ApprovalView approvals={approvals} tasks={tasks} />}
        {nav === "auditoria" && <AuditView rows={searchRows(audits)} query={query} setQuery={setQuery} />}
        {nav === "usuarios" && <UsersView rows={searchRows(profiles)} query={query} setQuery={setQuery} onNew={() => setShowUser(true)} />}
      </main>

      {showNewExp && <Modal title="Nuevo expediente" close={() => setShowNewExp(false)}><form className="form-grid" onSubmit={createExpediente}><label>Código expediente<input name="expediente_code" placeholder="Ej. EI-2026-0001" required /></label><label>Título<input name="title" required /></label><label>Dependencia<select name="office_id" defaultValue={profile.office_id || ""} required>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>Serie / subserie TRD<select name="trd_entry_id" required><option value="">Seleccionar…</option>{trdForExpediente.map(r => <option key={r.id} value={r.id}>{r.official_code || r.system_code} · {r.name}</option>)}</select></label><label>Medio<select name="medium" defaultValue="hybrid"><option value="physical">Físico</option><option value="digital">Digital</option><option value="hybrid">Híbrido</option></select></label><label>Nivel de acceso<select name="access_level" defaultValue="internal"><option value="public">Público</option><option value="internal">Interno</option><option value="restricted">Restringido</option><option value="confidential">Confidencial</option></select></label><label>Fecha de apertura<input type="date" name="start_date" defaultValue={new Date().toISOString().slice(0,10)} /></label><label className="span-2">Descripción<textarea name="description" rows={3}/></label><div className="form-actions span-2"><button type="button" className="button" onClick={() => setShowNewExp(false)}>Cancelar</button><button className="button primary">Crear expediente</button></div></form></Modal>}
      {showNewRad && <Modal title="Nuevo radicado" close={() => setShowNewRad(false)}><form className="form-grid" onSubmit={createRadication}><label>Dirección<select name="direction"><option value="incoming">Entrada</option><option value="outgoing">Salida</option><option value="internal">Interna</option></select></label><label>Canal<select name="channel"><option>Correo electrónico</option><option>Ventanilla</option><option>Web</option><option>Mensajería</option><option>Interno</option></select></label><label>Dependencia<select name="office_id" defaultValue={profile.office_id || ""}>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label>Remitente<input name="sender" /></label><label>Destinatario<input name="recipient" /></label><label className="span-2">Asunto<input name="subject" required /></label><div className="form-actions span-2"><button type="button" className="button" onClick={() => setShowNewRad(false)}>Cancelar</button><button className="button primary">Radicar</button></div></form></Modal>}
      {showNewTransfer && <Modal title="Nueva transferencia" close={() => setShowNewTransfer(false)}><form className="form-grid" onSubmit={createTransfer}><label>Tipo<select name="transfer_type"><option value="primary">Primaria · Gestión → Central</option><option value="secondary">Secundaria · Central → Histórico</option></select></label><label>Dependencia<select name="office_id" defaultValue={profile.office_id || ""}>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label className="span-2">Objeto / descripción<textarea name="object" rows={4} required /></label><div className="form-actions span-2"><button type="button" className="button" onClick={() => setShowNewTransfer(false)}>Cancelar</button><button className="button primary">Crear borrador</button></div></form></Modal>}
      {showNewBox && <Modal title="Registrar caja de archivo" close={() => setShowNewBox(false)}><form className="form-grid" onSubmit={createBox}><label>Número de caja<input name="box_number" required /></label><label>Fase<select name="phase"><option value="management">Gestión</option><option value="central">Central</option><option value="historical">Histórico</option></select></label><div className="form-actions span-2"><button type="button" className="button" onClick={() => setShowNewBox(false)}>Cancelar</button><button className="button primary">Registrar caja</button></div></form></Modal>}
      {showUser && <Modal title="Crear usuario" close={() => setShowUser(false)}><form className="form-grid" onSubmit={createUser}><label>Nombre completo<input name="full_name" required /></label><label>Correo<input name="email" type="email" required /></label><label>Contraseña inicial<input name="password" type="password" minLength={10} required /></label><label>Rol<select name="role"><option value="viewer">Consulta</option><option value="editor">Editor</option><option value="office_admin">Admin. dependencia</option><option value="records_admin">Admin. documental</option>{profile.role === "super_admin" && <option value="super_admin">Super administrador</option>}<option value="auditor">Auditor</option></select></label><label className="span-2">Dependencia<select name="office_id"><option value="">Sin dependencia específica</option>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label><div className="form-actions span-2"><button type="button" className="button" onClick={() => setShowUser(false)}>Cancelar</button><button className="button primary">Crear usuario</button></div></form></Modal>}
      {selectedExpediente && <ExpedienteDrawer exp={selectedExpediente} documents={documents} controlSheet={controlSheet} canEdit={canEdit && selectedExpediente.status === "open"} close={() => setSelectedExpediente(null)} upload={uploadDocument} download={downloadFile} />}
    </div>
  );
}

function SearchBar({ value, set, action, actionText, exportFn }: { value: string; set: (v:string)=>void; action?:()=>void; actionText?:string; exportFn?:()=>void }) {
  return <div className="toolbar"><div className="search"><span>⌕</span><input value={value} onChange={e=>set(e.target.value)} placeholder="Buscar en este módulo…" /></div><div className="toolbar-actions">{exportFn && <button className="button" onClick={exportFn}>↓ Exportar CSV</button>}{action && <button className="button primary" onClick={action}>＋ {actionText}</button>}</div></div>;
}
function Modal({ title, close, children }: { title:string; close:()=>void; children:ReactNode }) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><section className="modal"><header><h2>{title}</h2><button onClick={close}>×</button></header><div className="modal-body">{children}</div></section></div>; }

function Dashboard({ counts, recent, loading, go }: { counts:Record<string,number>; recent:Row[]; loading:boolean; go:(k:NavKey)=>void }) {
  const cards = [
    ["Expedientes", counts.expedientes || 0, "expedientes", "▱"], ["Reglas TRD", counts.trd_entries || 0, "trd", "▤"], ["Inventario FUID", counts.fuid_items || 0, "fuid", "≡"], ["Retenciones vencidas", counts.retention_due || 0, "retencion", "◷"],
  ] as const;
  return <div className="content-stack"><section className="hero-card"><div><span className="eyebrow">CONTROL DOCUMENTAL INTEGRAL</span><h2>Un expediente. Una regla TRD. Una trazabilidad.</h2><p>El sistema conecta clasificación, archivos físicos y digitales, retención, transferencias y disposición final sin duplicar la información entre formatos.</p></div><div className="hero-seal"><b>SGDEA</b><span>TRD MAESTRA</span></div></section><section className="metric-grid">{cards.map(([l,n,k,i])=><button key={l} className="metric-card" onClick={()=>go(k as NavKey)}><span className="metric-icon">{i}</span><strong>{loading ? "…" : n.toLocaleString("es-CO")}</strong><span>{l}</span></button>)}</section><section className="two-col"><article className="panel"><div className="panel-title"><div><span className="eyebrow">ÚLTIMA ACTIVIDAD</span><h3>Expedientes recientes</h3></div><button className="link-button" onClick={()=>go("expedientes")}>Ver todos →</button></div>{recent.length ? <div className="compact-list">{recent.map(x=><div key={x.id}><div><strong>{x.expediente_code}</strong><span>{x.title}</span></div><StatusPill value={x.status}/></div>)}</div>:<Empty text="Los expedientes creados aparecerán aquí."/>}</article><article className="panel compliance"><span className="eyebrow">CONTROL ARCHIVÍSTICO</span><h3>Motor de cumplimiento</h3><ul><li><b>TRD versionada</b><span>La clasificación y retención se heredan de la fuente maestra.</span></li><li><b>Cierre controlado</b><span>Al cerrar, se calculan vencimientos y se bloquea la incorporación ordinaria.</span></li><li><b>Auditoría</b><span>Operaciones críticas dejan evidencia consultable.</span></li><li><b>Archivo híbrido</b><span>Ubicación física y archivos digitales viven en el mismo expediente.</span></li></ul></article></section></div>;
}

function TRDView({ rows, query, setQuery, exportRows }: any) { return <div className="content-stack"><SearchBar value={query} set={setQuery} exportFn={exportRows}/><div className="notice"><b>TRD PRINCIPAL es la fuente maestra.</b><span>Los registros con valoración pendiente se muestran, pero no deben habilitar disposición automática hasta aprobación documental.</span></div><div className="table-card"><table><thead><tr><th>Código</th><th>Dependencia</th><th>Nivel / denominación</th><th>Retención</th><th>Disposición</th><th>Control</th></tr></thead><tbody>{rows.map((r:Row)=><tr key={r.id}><td><code>{r.official_code || r.system_code}</code></td><td>{r.organizational_units?.name || "—"}</td><td><small>{r.level}</small><strong className="cell-title">{r.name}</strong></td><td><span>Gestión: {r.retention_management_raw || "—"}</span><br/><span>Central: {r.retention_central_raw || "—"}</span></td><td><span className="disposition">{r.disposition}</span></td><td>{r.requires_valuation ? <span className="pill warn">Requiere valoración</span> : <StatusPill value={r.review_state}/>}</td></tr>)}</tbody></table>{!rows.length&&<Empty text="No hay reglas TRD que coincidan con la búsqueda."/>}</div></div> }
function ExpedientesView({ rows,query,setQuery,canEdit,onNew,onView,onClose,onReopen,onPrint }:any){return <div className="content-stack"><SearchBar value={query} set={setQuery} action={canEdit?onNew:undefined} actionText="Nuevo expediente"/><div className="table-card"><table><thead><tr><th>Expediente</th><th>Dependencia</th><th>Clasificación TRD</th><th>Fase / medio</th><th>Estado</th><th>Retención gestión</th><th></th></tr></thead><tbody>{rows.map((r:Row)=><tr key={r.id}><td><button className="cell-link" onClick={()=>onView(r)}>{r.expediente_code}</button><span>{r.title}</span></td><td>{r.organizational_units?.name || "—"}</td><td><code>{r.trd_entries?.official_code || r.trd_entries?.system_code}</code><span>{r.trd_entries?.name}</span></td><td>{r.phase}<br/><small>{r.medium}</small></td><td><StatusPill value={r.status}/></td><td>{fmtDate(r.retention_management_due)}</td><td><div className="row-actions"><button onClick={()=>onView(r)}>Abrir</button><button onClick={()=>onPrint(r)}>Rótulo</button>{canEdit&&r.status==="open"&&<button onClick={()=>onClose(r)}>Cerrar</button>}{canEdit&&r.status==="closed"&&<button onClick={()=>onReopen(r)}>Reabrir</button>}</div></td></tr>)}</tbody></table>{!rows.length&&<Empty text="Crea el primer expediente o ajusta la búsqueda."/>}</div></div>}
function FUIDView({rows,query,setQuery,exportRows}:any){return <div className="content-stack"><SearchBar value={query} set={setQuery} exportFn={exportRows}/><div className="notice blue"><b>Inventario histórico conciliable.</b><span>El FUID conserva la información original; la regla de retención vigente siempre se toma de la TRD maestra.</span></div><div className="table-card"><table><thead><tr><th>Código</th><th>Serie / asunto</th><th>Fechas extremas</th><th>Unidad</th><th>Folios</th><th>Soporte</th><th>Conciliación</th></tr></thead><tbody>{rows.map((r:Row)=><tr key={r.id}><td><code>{r.trd_code || "—"}</code></td><td><strong className="cell-title">{r.series_subseries_or_matter}</strong><span>{r.description}</span></td><td>{fmtDate(r.extreme_initial)}<br/>{fmtDate(r.extreme_final)}</td><td>Caja {r.box_no||"—"}<br/>Carpeta {r.folder_no||"—"}</td><td>{r.folios_from||"—"}–{r.folios_to||"—"}</td><td>{r.support||"—"}</td><td><StatusPill value={r.mapping_status}/></td></tr>)}</tbody></table>{!rows.length&&<Empty text="El inventario importado aparecerá aquí."/>}</div></div>}
function RadicacionView({rows,query,setQuery,canEdit,onNew}:any){return <div className="content-stack"><SearchBar value={query} set={setQuery} action={canEdit?onNew:undefined} actionText="Nuevo radicado"/><div className="table-card"><table><thead><tr><th>Radicado</th><th>Dirección</th><th>Asunto</th><th>Remitente / destinatario</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{rows.map((r:Row)=><tr key={r.id}><td><code>{r.radication_number}</code></td><td>{r.direction}<br/><small>{r.channel}</small></td><td><strong className="cell-title">{r.subject}</strong></td><td>{r.sender||"—"}<br/><small>{r.recipient||"—"}</small></td><td>{fmtDateTime(r.received_or_sent_at)}</td><td><StatusPill value={r.status}/></td></tr>)}</tbody></table>{!rows.length&&<Empty text="No hay comunicaciones radicadas."/>}</div></div>}
function TransferView({rows,query,setQuery,canEdit,onNew}:any){return <div className="content-stack"><SearchBar value={query} set={setQuery} action={canEdit?onNew:undefined} actionText="Nueva transferencia"/><div className="table-card"><table><thead><tr><th>Número</th><th>Tipo</th><th>Dependencia</th><th>Movimiento</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>{rows.map((r:Row)=><tr key={r.id}><td><code>{r.transfer_number}</code></td><td>{r.transfer_type}</td><td>{r.organizational_units?.name||"—"}</td><td>{r.from_phase} → {r.to_phase}</td><td>{fmtDate(r.transfer_date)}</td><td><StatusPill value={r.status}/></td></tr>)}</tbody></table>{!rows.length&&<Empty text="No hay transferencias registradas."/>}</div></div>}
function ArchivoView({rows,query,setQuery,canEdit,onNew,onPrint}:any){return <div className="content-stack"><SearchBar value={query} set={setQuery} action={canEdit?onNew:undefined} actionText="Registrar caja"/><div className="archive-grid">{rows.map((r:Row)=><article className="box-card" key={r.id}><div className="box-visual"><span>{r.phase === "historical" ? "AH" : r.phase === "central" ? "AC" : "AG"}</span><b>{r.box_number}</b></div><div><span className="eyebrow">CAJA DE ARCHIVO</span><h3>Caja {r.box_number}</h3><p>{r.physical_locations?.name || "Ubicación pendiente"}</p><div className="box-meta"><StatusPill value={r.status}/><code>{r.qr_code}</code></div><button className="button small" onClick={()=>onPrint(r)}>Imprimir rótulo</button></div></article>)}{!rows.length&&<Empty text="Registra cajas para gestionar archivo de gestión, central e histórico."/>}</div></div>}
function RetencionView({rows,query,setQuery}:any){const ordered=[...rows].sort((a,b)=>(a.retention_management_due||"9999").localeCompare(b.retention_management_due||"9999"));return <div className="content-stack"><SearchBar value={query} set={setQuery}/><div className="retention-legend"><span><b className="dot due"/>Vencido</span><span><b className="dot soon"/>Próximo</span><span><b className="dot later"/>Vigente</span></div><div className="table-card"><table><thead><tr><th>Expediente</th><th>Estado</th><th>Cierre</th><th>Fin archivo de gestión</th><th>Fin archivo central</th><th>Disposición</th><th>Legal hold</th></tr></thead><tbody>{ordered.map((r:Row)=>{const days=r.retention_management_due?Math.ceil((new Date(r.retention_management_due).getTime()-Date.now())/86400000):null;return <tr key={r.id}><td><strong className="cell-title">{r.expediente_code}</strong><span>{r.title}</span></td><td><StatusPill value={r.status}/></td><td>{fmtDate(r.closed_at)}</td><td><span className={days!==null&&days<0?"date-due":days!==null&&days<90?"date-soon":""}>{fmtDate(r.retention_management_due)}</span></td><td>{fmtDate(r.retention_central_due)}</td><td><span className="disposition">{r.disposition}</span></td><td>{r.legal_hold?<span className="pill warn">Bloqueo jurídico</span>:"—"}</td></tr>})}</tbody></table>{!rows.length&&<Empty text="Los vencimientos se calculan al cerrar expedientes."/>}</div></div>}
function ApprovalView({approvals,tasks}:any){return <div className="content-stack"><div className="two-col"><section className="panel"><div className="panel-title"><div><span className="eyebrow">FLUJOS</span><h3>Solicitudes de aprobación</h3></div></div>{approvals.length?<div className="compact-list">{approvals.map((x:Row)=><div key={x.id}><div><strong>{x.title}</strong><span>{x.entity_type} · {fmtDateTime(x.created_at)}</span></div><StatusPill value={x.status}/></div>)}</div>:<Empty text="No hay aprobaciones pendientes."/>}</section><section className="panel"><div className="panel-title"><div><span className="eyebrow">BANDEJA</span><h3>Tareas</h3></div></div>{tasks.length?<div className="compact-list">{tasks.map((x:Row)=><div key={x.id}><div><strong>{x.title}</strong><span>{x.priority} · límite {fmtDateTime(x.due_at)}</span></div><StatusPill value={x.status}/></div>)}</div>:<Empty text="No hay tareas asignadas."/>}</section></div><div className="notice"><b>Flujos preparados para firma/aprobación.</b><span>La evidencia de cada decisión se conserva separada del documento; esto permite integrar posteriormente un proveedor certificado de firma electrónica/digital.</span></div></div>}
function AuditView({rows,query,setQuery}:any){return <div className="content-stack"><SearchBar value={query} set={setQuery}/><div className="table-card"><table><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>ID registro</th></tr></thead><tbody>{rows.map((r:Row)=><tr key={r.id}><td>{fmtDateTime(r.occurred_at)}</td><td>{r.actor_email||r.actor_id||"Sistema"}</td><td><code>{r.action}</code></td><td>{r.table_name}</td><td><small>{r.record_id||"—"}</small></td></tr>)}</tbody></table>{!rows.length&&<Empty text="Las operaciones auditables aparecerán aquí."/>}</div></div>}
function UsersView({rows,query,setQuery,onNew}:any){return <div className="content-stack"><SearchBar value={query} set={setQuery} action={onNew} actionText="Crear usuario"/><div className="table-card"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Dependencia</th><th>Estado</th></tr></thead><tbody>{rows.map((r:Row)=><tr key={r.id}><td><strong className="cell-title">{r.full_name||"Sin nombre"}</strong></td><td>{r.email}</td><td>{ROLE_NAMES[r.role]||r.role}</td><td>{r.organizational_units?.name||"Global"}</td><td><StatusPill value={r.active?"active":"inactive"}/></td></tr>)}</tbody></table></div></div>}

function ExpedienteDrawer({exp,documents,controlSheet,canEdit,close,upload,download}:any){return <div className="drawer-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)close()}}><aside className="drawer"><header><div><span className="eyebrow">EXPEDIENTE</span><h2>{exp.expediente_code}</h2><p>{exp.title}</p></div><button onClick={close}>×</button></header><div className="drawer-body"><section className="detail-grid"><div><span>Estado</span><StatusPill value={exp.status}/></div><div><span>Fase</span><strong>{exp.phase}</strong></div><div><span>Medio</span><strong>{exp.medium}</strong></div><div><span>Disposición</span><strong>{exp.disposition}</strong></div><div><span>Retención gestión</span><strong>{fmtDate(exp.retention_management_due)}</strong></div><div><span>Retención central</span><strong>{fmtDate(exp.retention_central_due)}</strong></div></section>{canEdit&&<section className="drawer-section"><div className="panel-title"><div><span className="eyebrow">INCORPORACIÓN</span><h3>Agregar documento</h3></div></div><form className="upload-form" onSubmit={upload}><input name="title" placeholder="Tipo/título documental" required/><input type="date" name="document_date" defaultValue={new Date().toISOString().slice(0,10)}/><input name="subject" placeholder="Asunto (opcional)"/><input type="file" name="file" required accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.txt"/><button className="button primary">Subir e incorporar</button></form></section>}<section className="drawer-section"><div className="panel-title"><div><span className="eyebrow">ÍNDICE</span><h3>Documentos del expediente</h3></div><span>{documents.length} documento(s)</span></div>{documents.length?<div className="doc-list">{documents.map((d:Row)=><div key={d.id}><span className="doc-icon">{d.mime_type?.includes("pdf")?"PDF":"DOC"}</span><div><strong>{d.title}</strong><span>{fmtDate(d.document_date)} · Secuencia {d.sequence_no||"—"}</span></div><button onClick={()=>download(d)}>Abrir</button></div>)}</div>:<Empty text="Este expediente todavía no contiene documentos."/>}</section><section className="drawer-section"><div className="panel-title"><div><span className="eyebrow">HOJA DE CONTROL</span><h3>Ingreso documental</h3></div></div>{controlSheet.length?<div className="control-list">{controlSheet.map((c:Row)=><div key={c.id}><b>{c.sequence_no}</b><span>{fmtDate(c.entry_date)}</span><strong>{c.document_type_name}</strong><span>Folios {c.folio_from||"—"}–{c.folio_to||"—"}</span></div>)}</div>:<Empty text="Se alimenta automáticamente al incorporar documentos."/>}</section></div></aside></div>}
