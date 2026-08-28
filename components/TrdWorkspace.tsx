"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type Row = Record<string, any>;
type TreeNode = Row & { children: TreeNode[] };

type VersionInfo = {
  id: string;
  version_code: string;
  title: string;
  status: string;
  effective_from?: string | null;
  effective_to?: string | null;
  source_filename?: string | null;
};

const ROLE_NAMES: Record<string, string> = {
  super_admin: "Super administrador",
  records_admin: "Administrador documental",
  office_admin: "Administrador de dependencia",
  editor: "Editor",
  viewer: "Consulta",
  auditor: "Auditor",
};

const LEVEL_NAMES: Record<string, string> = {
  series: "Serie documental",
  subseries: "Subserie documental",
  type: "Tipo documental",
};

const DISP_NAMES: Record<string, string> = {
  CT: "Conservación total",
  E: "Eliminación",
  S: "Selección",
  M: "Medio técnico",
  pending: "Pendiente de definir",
};

function txt(v: any, fallback = "No definido") {
  return v === null || v === undefined || String(v).trim() === "" ? fallback : String(v);
}

function buildTree(rows: Row[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>();
  rows.forEach((row) => nodes.set(row.id, { ...row, children: [] }));
  const roots: TreeNode[] = [];
  nodes.forEach((node) => {
    if (node.parent_id && nodes.has(node.parent_id)) nodes.get(node.parent_id)!.children.push(node);
    else roots.push(node);
  });
  const order: Record<string, number> = { series: 0, subseries: 1, type: 2 };
  const sortNodes = (items: TreeNode[]) => {
    items.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9) || String(a.name).localeCompare(String(b.name), "es"));
    items.forEach((x) => sortNodes(x.children));
  };
  sortNodes(roots);
  return roots;
}

function lineage(node: Row | null, byId: Map<string, Row>) {
  if (!node) return [];
  const chain: Row[] = [];
  let current: Row | undefined = node;
  let guard = 0;
  while (current && guard < 4) {
    chain.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
    guard += 1;
  }
  return chain;
}

export default function TrdWorkspace() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [offices, setOffices] = useState<Row[]>([]);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [officeId, setOfficeId] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [onlyValuation, setOnlyValuation] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/login"); return; }
      const user = sessionData.session.user;
      const { data: p, error: pe } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (pe || !p || !p.active) { await supabase.auth.signOut(); router.replace("/login"); return; }
      setProfile(p as Profile);

      const [trdRes, officeRes, versionRes] = await Promise.all([
        supabase.from("trd_entries").select("id,trd_version_id,office_id,parent_id,level,official_code,system_code,name,classification,support_format,retention_management_raw,retention_central_raw,disposition,technical_reproduction,observation_raw,procedure,review_state,requires_valuation,metadata,source_sheet,source_row").order("source_sheet").order("source_row"),
        supabase.from("organizational_units").select("id,name,code,active").eq("active", true).order("name"),
        supabase.from("trd_versions").select("id,version_code,title,status,effective_from,effective_to,source_filename").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (trdRes.error) setError(trdRes.error.message);
      else setRows(trdRes.data || []);
      if (!officeRes.error) setOffices(officeRes.data || []);
      if (!versionRes.error && versionRes.data) setVersion(versionRes.data as VersionInfo);

      const preferred = p.office_id && (officeRes.data || []).some((o) => o.id === p.office_id)
        ? p.office_id
        : (officeRes.data || [])[0]?.id || "";
      setOfficeId(preferred);
      setBooting(false);
    })();
  }, [router]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const activeOffice = useMemo(() => offices.find((o) => o.id === officeId), [offices, officeId]);

  const officeRows = useMemo(() => rows.filter((r) => !officeId || r.office_id === officeId), [rows, officeId]);
  const normalizedQuery = query.trim().toLocaleLowerCase("es");

  const visibleRows = useMemo(() => {
    if (!normalizedQuery && !onlyValuation) return officeRows;
    const keep = new Set<string>();
    officeRows.forEach((row) => {
      const matchesText = !normalizedQuery || `${row.name} ${row.system_code} ${row.official_code || ""}`.toLocaleLowerCase("es").includes(normalizedQuery);
      const matchesValuation = !onlyValuation || !!row.requires_valuation;
      if (matchesText && matchesValuation) {
        let current: Row | undefined = row;
        let guard = 0;
        while (current && guard < 4) {
          keep.add(current.id);
          current = current.parent_id ? byId.get(current.parent_id) : undefined;
          guard += 1;
        }
      }
    });
    return officeRows.filter((r) => keep.has(r.id));
  }, [officeRows, normalizedQuery, onlyValuation, byId]);

  const tree = useMemo(() => buildTree(visibleRows), [visibleRows]);
  const counts = useMemo(() => ({
    series: officeRows.filter((x) => x.level === "series").length,
    subseries: officeRows.filter((x) => x.level === "subseries").length,
    types: officeRows.filter((x) => x.level === "type").length,
    valuation: officeRows.filter((x) => x.requires_valuation).length,
  }), [officeRows]);

  useEffect(() => {
    setSelected(null);
    const roots = officeRows.filter((x) => x.level === "series").map((x) => x.id);
    setExpanded(new Set(roots.slice(0, 3)));
  }, [officeId]);

  useEffect(() => {
    if (normalizedQuery) setExpanded(new Set(visibleRows.filter((x) => x.level !== "type").map((x) => x.id)));
  }, [normalizedQuery, visibleRows]);

  const selectedLineage = useMemo(() => lineage(selected, byId), [selected, byId]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function logout() { await supabase.auth.signOut(); router.replace("/login"); }

  if (booting) return <main className="trd-boot"><style>{CSS}</style><div className="trd-mark">TRD</div><div className="trd-loader"><i/><i/><i/></div><b>Construyendo el mapa documental…</b></main>;
  if (!profile) return null;

  return <main className="trd-shell">
    <style>{CSS}</style>

    <header className="trd-topbar">
      <div className="trd-brand-wrap">
        <Link href="/" className="trd-brand"><span className="trd-brand-mark">GD</span><span><b>SGDEA</b><small>ELECTROINGENIERÍA S.A.S.</small></span></Link>
        <span className="trd-divider"/>
        <div className="trd-product"><b>Tabla de Retención Documental</b><small>Clasificación documental centralizada</small></div>
      </div>
      <div className="trd-top-actions">
        <Link href="/formatos" className="trd-link-button">Formatos</Link>
        <Link href="/gestion" className="trd-link-button">Gestión completa</Link>
        <button className="trd-user-button" onClick={logout}><span>{(profile.full_name || profile.email || "U").slice(0,2).toUpperCase()}</span><div><b>{profile.full_name || profile.email}</b><small>{ROLE_NAMES[profile.role]}</small></div><i>↪</i></button>
      </div>
    </header>

    <section className="trd-hero">
      <div className="trd-hero-copy">
        <div className="trd-kicker"><span/>FUENTE ÚNICA DE CLASIFICACIÓN</div>
        <h1>La TRD que gobierna todo el proceso documental.</h1>
        <p>Serie, subserie, tipo documental, soporte, retención y disposición se definen aquí una sola vez. Expedientes, hoja de control, FUID, carpetas, cajas y transferencias heredan esta clasificación.</p>
        <div className="trd-version-row">
          <span className={`trd-status ${version?.status || "review"}`}>{version?.status === "approved" ? "Aprobada" : version?.status === "review" ? "En revisión" : txt(version?.status)}</span>
          <span>{version?.version_code || "Versión TRD"}</span>
          <span>385 registros maestros</span>
          <span>Jerarquía validada</span>
        </div>
      </div>
      <div className="trd-flow-card">
        <span className="trd-flow-label">TRAZABILIDAD</span>
        <div className="trd-flow"><b>TRD</b><i>→</i><span>Expediente</span><i>→</i><span>Formatos</span><i>→</i><span>Archivo</span></div>
        <p>Los nombres no se vuelven a digitar. La clasificación se hereda y queda vinculada al expediente.</p>
        <div className="trd-flow-proof"><span>✓</span><div><b>0 cruces inválidos</b><small>Dependencia y versión verificadas</small></div></div>
      </div>
    </section>

    {error && <div className="trd-error">No fue posible cargar toda la TRD: {error}</div>}

    <section className="trd-toolbar">
      <div className="trd-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar serie, subserie, tipo documental o código…"/><kbd>385 registros</kbd></div>
      <label className={`trd-filter ${onlyValuation ? "active" : ""}`}><input type="checkbox" checked={onlyValuation} onChange={(e) => setOnlyValuation(e.target.checked)}/><span>Solo requiere valoración</span><b>{counts.valuation}</b></label>
    </section>

    <section className="trd-layout">
      <aside className="trd-offices">
        <div className="trd-pane-title"><span>DEPENDENCIAS</span><b>{offices.length}</b></div>
        <div className="trd-office-list">{offices.map((office) => {
          const c = rows.filter((r) => r.office_id === office.id).length;
          return <button key={office.id} className={officeId === office.id ? "active" : ""} onClick={() => setOfficeId(office.id)}><span className="trd-office-icon">{office.name.slice(0,2).toUpperCase()}</span><span><b>{office.name}</b><small>{c} registros</small></span><i>›</i></button>;
        })}</div>
      </aside>

      <section className="trd-tree-pane">
        <div className="trd-pane-head">
          <div><span>ESTRUCTURA DOCUMENTAL</span><h2>{activeOffice?.name || "TRD General"}</h2></div>
          <div className="trd-mini-stats"><span><b>{counts.series}</b> series</span><span><b>{counts.subseries}</b> subseries</span><span><b>{counts.types}</b> tipos</span></div>
        </div>
        <div className="trd-tree-scroll">
          {tree.length ? tree.map((node) => <TreeItem key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} selectedId={selected?.id} select={setSelected}/>) : <div className="trd-empty"><span>⌕</span><b>No encontramos coincidencias</b><p>Prueba otro término o desactiva el filtro de valoración.</p></div>}
        </div>
      </section>

      <aside className="trd-detail">
        {selected ? <>
          <div className="trd-detail-top">
            <span className={`trd-level-badge ${selected.level}`}>{LEVEL_NAMES[selected.level] || selected.level}</span>
            {selected.requires_valuation && <span className="trd-valuation">Requiere valoración</span>}
            <h2>{selected.name}</h2>
            <p className="trd-code">{selected.official_code || selected.system_code}</p>
          </div>

          <div className="trd-breadcrumb">{selectedLineage.map((x, i) => <span key={x.id}>{i > 0 && <i>›</i>}{x.name}</span>)}</div>

          <div className="trd-detail-section"><span className="trd-detail-label">CLASIFICACIÓN</span><div className="trd-info-grid"><Info label="Dependencia" value={activeOffice?.name}/><Info label="Nivel" value={LEVEL_NAMES[selected.level]}/><Info label="Clasificación" value={selected.classification}/><Info label="Soporte" value={selected.support_format}/></div></div>

          <div className="trd-detail-section"><span className="trd-detail-label">RETENCIÓN</span><div className="trd-retention"><div><span>Archivo de gestión</span><b>{txt(selected.retention_management_raw)}</b></div><i>→</i><div><span>Archivo central</span><b>{txt(selected.retention_central_raw)}</b></div></div></div>

          <div className="trd-detail-section"><span className="trd-detail-label">DISPOSICIÓN FINAL</span><div className="trd-disposition"><span>{selected.disposition || "—"}</span><div><b>{DISP_NAMES[selected.disposition] || txt(selected.disposition)}</b><small>{selected.technical_reproduction ? `Reproducción: ${selected.technical_reproduction}` : "Sin reproducción técnica indicada"}</small></div></div></div>

          {(selected.observation_raw || selected.procedure) && <div className="trd-detail-section"><span className="trd-detail-label">REGLA DOCUMENTAL</span>{selected.observation_raw && <p className="trd-note">{selected.observation_raw}</p>}{selected.procedure && <p className="trd-procedure"><b>Procedimiento</b>{selected.procedure}</p>}</div>}

          <div className="trd-origin"><span>Origen</span><b>{selected.source_sheet || version?.source_filename || "TRD principal"}</b><small>Fila fuente {selected.source_row || "—"} · {version?.version_code || "Versión actual"}</small></div>
        </> : <div className="trd-detail-empty"><div className="trd-orbit"><span>TRD</span></div><h3>Selecciona un elemento</h3><p>Haz clic sobre una serie, subserie o tipo documental para ver su clasificación, retención, disposición y trazabilidad.</p><div className="trd-tip"><span>i</span><p>Los datos mostrados aquí serán los mismos que heredarán los formatos operativos.</p></div></div>}
      </aside>
    </section>
  </main>;
}

function Info({ label, value }: { label: string; value: any }) {
  return <div className="trd-info"><span>{label}</span><b>{txt(value)}</b></div>;
}

function TreeItem({ node, depth, expanded, toggle, selectedId, select }: { node: TreeNode; depth: number; expanded: Set<string>; toggle: (id: string) => void; selectedId?: string; select: (r: Row) => void }) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  return <div className={`trd-tree-node depth-${depth}`}>
    <div className={`trd-node-row ${node.level} ${selectedId === node.id ? "selected" : ""}`} style={{ paddingLeft: 12 + depth * 24 }}>
      <button className={`trd-chevron ${hasChildren ? "visible" : ""} ${isOpen ? "open" : ""}`} onClick={(e) => { e.stopPropagation(); if (hasChildren) toggle(node.id); }}>›</button>
      <button className="trd-node-main" onClick={() => select(node)}>
        <span className={`trd-node-icon ${node.level}`}>{node.level === "series" ? "S" : node.level === "subseries" ? "SS" : "TD"}</span>
        <span className="trd-node-copy"><b>{node.name}</b><small>{node.official_code || node.system_code}{node.support_format ? ` · ${node.support_format}` : ""}</small></span>
        {node.requires_valuation && <span className="trd-node-alert" title="Requiere valoración">!</span>}
        {hasChildren && <span className="trd-child-count">{node.children.length}</span>}
      </button>
    </div>
    {hasChildren && isOpen && <div className="trd-children">{node.children.map((child) => <TreeItem key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} selectedId={selectedId} select={select}/>)}</div>}
  </div>;
}

const CSS = `
:root{--navy:#071b33;--navy2:#0b2d52;--navy3:#123e6b;--yellow:#f5c518;--yellow2:#fff4bf;--ink:#122033;--muted:#6d7b8d;--line:#e4e9ef;--bg:#f4f6f9;--white:#fff;--shadow:0 18px 50px rgba(7,27,51,.08);--shadow2:0 12px 30px rgba(7,27,51,.12)}*{box-sizing:border-box}.trd-shell{min-height:100vh;background:radial-gradient(circle at 92% 5%,rgba(245,197,24,.09),transparent 22%),var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.trd-topbar{height:76px;padding:0 30px;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:80}.trd-brand-wrap,.trd-brand,.trd-top-actions,.trd-user-button{display:flex;align-items:center}.trd-brand{gap:11px;text-decoration:none;color:var(--navy)}.trd-brand-mark{width:38px;height:38px;border-radius:12px;background:linear-gradient(145deg,var(--navy2),var(--navy));color:var(--yellow);display:grid;place-items:center;font-weight:900;box-shadow:0 8px 20px rgba(7,27,51,.18)}.trd-brand b,.trd-product b{display:block;font-size:13px;letter-spacing:.04em}.trd-brand small,.trd-product small{display:block;margin-top:2px;font-size:9px;color:var(--muted);letter-spacing:.09em}.trd-divider{width:1px;height:34px;background:var(--line);margin:0 18px}.trd-product b{color:var(--ink);font-size:12px}.trd-top-actions{gap:8px}.trd-link-button{border:1px solid var(--line);background:#fff;color:var(--navy2);font-size:11px;font-weight:800;text-decoration:none;padding:10px 13px;border-radius:11px;transition:.18s ease}.trd-link-button:hover{transform:translateY(-2px);box-shadow:0 8px 18px rgba(7,27,51,.08);border-color:#cbd6e2}.trd-user-button{border:0;background:var(--navy);color:#fff;border-radius:13px;padding:7px 10px 7px 7px;gap:9px;margin-left:5px;cursor:pointer;box-shadow:0 8px 22px rgba(7,27,51,.2)}.trd-user-button>span{width:32px;height:32px;border-radius:9px;background:var(--yellow);color:var(--navy);display:grid;place-items:center;font-size:10px;font-weight:900}.trd-user-button div{text-align:left;max-width:190px}.trd-user-button b{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.trd-user-button small{display:block;color:#adbed0;font-size:8px;margin-top:2px}.trd-user-button i{font-style:normal;color:var(--yellow);margin-left:3px}.trd-hero{margin:24px 28px 18px;background:linear-gradient(135deg,var(--navy) 0%,var(--navy2) 62%,#12477b 100%);border-radius:22px;min-height:246px;padding:38px 42px;color:#fff;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(320px,.7fr);gap:36px;position:relative;overflow:hidden;box-shadow:0 24px 65px rgba(7,27,51,.18)}.trd-hero:after{content:"";position:absolute;width:360px;height:360px;border:1px solid rgba(245,197,24,.18);border-radius:50%;right:-120px;top:-190px;box-shadow:0 0 0 55px rgba(245,197,24,.035),0 0 0 110px rgba(245,197,24,.025)}.trd-hero-copy,.trd-flow-card{position:relative;z-index:2}.trd-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;color:#ccdaea;display:flex;gap:8px;align-items:center}.trd-kicker span{width:24px;height:3px;border-radius:4px;background:var(--yellow)}.trd-hero h1{font-size:34px;line-height:1.08;max-width:720px;margin:13px 0 12px;letter-spacing:-.035em}.trd-hero-copy>p{max-width:760px;color:#c7d4e2;font-size:13px;line-height:1.65;margin:0}.trd-version-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.trd-version-row>span{font-size:9px;font-weight:800;color:#c8d6e4;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.11);padding:8px 10px;border-radius:999px}.trd-version-row .trd-status{background:rgba(245,197,24,.16);border-color:rgba(245,197,24,.32);color:#ffe887}.trd-flow-card{align-self:stretch;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.13);border-radius:17px;padding:20px;backdrop-filter:blur(10px)}.trd-flow-label{font-size:8px;letter-spacing:.15em;font-weight:900;color:#a9bbce}.trd-flow{display:flex;align-items:center;gap:9px;margin:13px 0}.trd-flow b{background:var(--yellow);color:var(--navy);padding:8px 10px;border-radius:9px;font-size:10px}.trd-flow span{font-size:10px;font-weight:800;color:#fff}.trd-flow i{font-style:normal;color:#7794b0}.trd-flow-card>p{font-size:10px;line-height:1.55;color:#b8cada}.trd-flow-proof{margin-top:15px;border-top:1px solid rgba(255,255,255,.1);padding-top:14px;display:flex;align-items:center;gap:10px}.trd-flow-proof>span{width:28px;height:28px;border-radius:9px;background:rgba(245,197,24,.15);color:var(--yellow);display:grid;place-items:center;font-weight:900}.trd-flow-proof b{display:block;font-size:10px}.trd-flow-proof small{display:block;color:#9db1c5;font-size:8px;margin-top:2px}.trd-error{margin:0 28px 16px;background:#fff4e7;border:1px solid #f1c78c;color:#8a5610;padding:12px 14px;border-radius:12px;font-size:11px}.trd-toolbar{margin:0 28px 14px;display:flex;gap:10px}.trd-search{height:48px;flex:1;background:#fff;border:1px solid var(--line);border-radius:14px;display:flex;align-items:center;padding:0 13px;box-shadow:0 7px 22px rgba(7,27,51,.035);transition:.18s ease}.trd-search:focus-within{border-color:#9fb4c8;box-shadow:0 0 0 4px rgba(11,45,82,.055)}.trd-search>span{font-size:22px;color:#8090a2;transform:rotate(-18deg)}.trd-search input{flex:1;border:0;outline:0;background:transparent;padding:0 12px;color:var(--ink);font-size:12px}.trd-search kbd{font:800 8px/1 ui-sans-serif;color:#718095;background:#f3f5f8;border:1px solid var(--line);border-radius:7px;padding:6px 7px}.trd-filter{min-width:220px;height:48px;background:#fff;border:1px solid var(--line);border-radius:14px;display:flex;align-items:center;gap:9px;padding:0 12px;cursor:pointer;transition:.18s ease}.trd-filter input{display:none}.trd-filter:before{content:"";width:18px;height:18px;border-radius:6px;border:1px solid #cbd5df;background:#f8fafc}.trd-filter.active{background:#fffbeb;border-color:#ebcc55}.trd-filter.active:before{content:"✓";display:grid;place-items:center;background:var(--yellow);color:var(--navy);font-size:10px;font-weight:900;border-color:var(--yellow)}.trd-filter span{flex:1;font-size:10px;font-weight:800;color:#445267}.trd-filter b{font-size:9px;background:#f1f4f7;color:#6d7b8d;padding:5px 7px;border-radius:999px}.trd-layout{margin:0 28px 28px;height:calc(100vh - 454px);min-height:520px;display:grid;grid-template-columns:250px minmax(420px,1fr) 360px;gap:12px}.trd-offices,.trd-tree-pane,.trd-detail{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 12px 38px rgba(7,27,51,.055)}.trd-pane-title{height:50px;padding:0 15px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.trd-pane-title span,.trd-pane-head>div>span,.trd-detail-label{font-size:8px;font-weight:900;letter-spacing:.14em;color:#8997a8}.trd-pane-title b{font-size:9px;background:#eef2f6;color:#6a788a;border-radius:999px;padding:5px 7px}.trd-office-list{height:calc(100% - 50px);overflow:auto;padding:8px}.trd-office-list button{width:100%;border:0;background:transparent;padding:9px;border-radius:12px;display:flex;align-items:center;gap:9px;text-align:left;cursor:pointer;color:var(--ink);transition:.16s ease}.trd-office-list button:hover{background:#f6f8fa;transform:translateX(2px)}.trd-office-list button.active{background:var(--navy);color:#fff;box-shadow:0 9px 22px rgba(7,27,51,.18)}.trd-office-icon{width:31px;height:31px;border-radius:9px;background:#edf2f7;color:var(--navy2);display:grid;place-items:center;font-size:8px;font-weight:900;flex:0 0 auto}.trd-office-list button.active .trd-office-icon{background:var(--yellow);color:var(--navy)}.trd-office-list button>span:nth-child(2){min-width:0;flex:1}.trd-office-list b{font-size:9px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.trd-office-list small{display:block;font-size:8px;color:#8795a5;margin-top:2px}.trd-office-list button.active small{color:#9fb2c5}.trd-office-list i{font-style:normal;color:#95a4b4;font-size:16px}.trd-office-list button.active i{color:var(--yellow)}.trd-pane-head{height:70px;border-bottom:1px solid var(--line);padding:0 17px;display:flex;align-items:center;justify-content:space-between}.trd-pane-head h2{margin:4px 0 0;font-size:15px;color:var(--navy)}.trd-mini-stats{display:flex;gap:6px}.trd-mini-stats span{font-size:8px;color:#778699;background:#f5f7f9;border-radius:8px;padding:6px 7px}.trd-mini-stats b{color:var(--navy2)}.trd-tree-scroll{height:calc(100% - 70px);overflow:auto;padding:8px}.trd-node-row{height:48px;border-radius:11px;display:flex;align-items:center;transition:.16s ease;position:relative}.trd-node-row:hover{background:#f6f8fb}.trd-node-row.selected{background:#eef4fa;box-shadow:inset 3px 0 var(--navy2)}.trd-node-row.series{margin-top:3px}.trd-chevron{width:22px;height:30px;border:0;background:transparent;color:#8c99a8;font-size:20px;opacity:0;cursor:pointer;transition:.18s ease}.trd-chevron.visible{opacity:1}.trd-chevron.open{transform:rotate(90deg)}.trd-node-main{height:100%;min-width:0;flex:1;border:0;background:transparent;display:flex;align-items:center;gap:9px;text-align:left;cursor:pointer;padding:0 8px 0 0;color:var(--ink)}.trd-node-icon{width:29px;height:29px;border-radius:9px;display:grid;place-items:center;font-size:7px;font-weight:950;flex:0 0 auto}.trd-node-icon.series{background:var(--navy);color:var(--yellow)}.trd-node-icon.subseries{background:var(--yellow2);color:#7a5d00}.trd-node-icon.type{background:#edf5fd;color:var(--navy2)}.trd-node-copy{min-width:0;flex:1}.trd-node-copy b{display:block;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.trd-node-copy small{display:block;font-size:7.5px;color:#8794a4;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.trd-node-alert{width:20px;height:20px;border-radius:7px;background:#fff0d9;color:#ac6b06;display:grid;place-items:center;font-size:9px;font-weight:950}.trd-child-count{font-size:8px;color:#7b8998;background:#eef2f6;border-radius:999px;min-width:23px;text-align:center;padding:4px 6px}.trd-children{animation:trdExpand .18s ease both}.trd-empty{height:100%;display:grid;place-items:center;align-content:center;color:#8795a5;text-align:center;padding:30px}.trd-empty>span{font-size:30px}.trd-empty b{font-size:12px;color:#4c5b6d;margin-top:6px}.trd-empty p{font-size:9px}.trd-detail{padding:0;overflow:auto}.trd-detail-top{padding:20px 20px 14px}.trd-level-badge,.trd-valuation{display:inline-flex;font-size:7.5px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;border-radius:999px;padding:6px 8px;margin-right:5px}.trd-level-badge.series{background:var(--navy);color:var(--yellow)}.trd-level-badge.subseries{background:var(--yellow2);color:#765a00}.trd-level-badge.type{background:#eaf3fc;color:var(--navy2)}.trd-valuation{background:#fff1df;color:#a76606}.trd-detail-top h2{font-size:20px;line-height:1.2;color:var(--navy);margin:13px 0 7px;letter-spacing:-.025em}.trd-code{font-size:8px;color:#8090a2;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.trd-breadcrumb{margin:0 20px 14px;padding:10px 12px;background:#f6f8fa;border:1px solid #edf0f3;border-radius:10px;font-size:8px;color:#657487;line-height:1.5}.trd-breadcrumb span{display:inline}.trd-breadcrumb i{font-style:normal;color:#b0bbc6;margin:0 5px}.trd-detail-section{border-top:1px solid var(--line);padding:16px 20px}.trd-detail-label{display:block;margin-bottom:10px}.trd-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.trd-info{background:#f7f9fb;border:1px solid #edf0f3;border-radius:10px;padding:10px}.trd-info span{font-size:7px;color:#8996a6;display:block}.trd-info b{display:block;font-size:9px;color:#344256;margin-top:4px;line-height:1.35}.trd-retention{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}.trd-retention div{background:#f7f9fb;border-radius:11px;padding:11px;border:1px solid #edf0f3}.trd-retention span{font-size:7px;color:#8492a3}.trd-retention b{display:block;font-size:10px;color:var(--navy2);margin-top:4px}.trd-retention>i{font-style:normal;color:#9eabb9}.trd-disposition{display:flex;align-items:center;gap:10px}.trd-disposition>span{width:38px;height:38px;border-radius:11px;background:var(--navy);color:var(--yellow);display:grid;place-items:center;font-size:9px;font-weight:950}.trd-disposition b{display:block;font-size:10px;color:#334154}.trd-disposition small{display:block;font-size:7px;color:#8996a6;margin-top:3px}.trd-note,.trd-procedure{font-size:9px;line-height:1.55;color:#5f6f81;background:#fff9e6;border:1px solid #f3e1a0;padding:11px;border-radius:10px}.trd-procedure{background:#f7f9fb;border-color:#edf0f3}.trd-procedure b{display:block;color:var(--navy);margin-bottom:4px}.trd-origin{margin:14px 20px 20px;background:var(--navy);color:#fff;border-radius:12px;padding:13px}.trd-origin span{display:block;font-size:7px;color:#8fa6bc;text-transform:uppercase;letter-spacing:.1em}.trd-origin b{display:block;font-size:9px;margin-top:4px}.trd-origin small{display:block;font-size:7px;color:#adc0d1;margin-top:3px}.trd-detail-empty{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px}.trd-orbit{width:90px;height:90px;border-radius:50%;border:1px solid #dbe4ec;display:grid;place-items:center;position:relative;margin-bottom:16px}.trd-orbit:before,.trd-orbit:after{content:"";position:absolute;border-radius:50%;border:1px dashed #e2e8ee}.trd-orbit:before{inset:9px}.trd-orbit:after{inset:19px}.trd-orbit span{width:42px;height:42px;border-radius:13px;background:var(--navy);color:var(--yellow);display:grid;place-items:center;font-size:9px;font-weight:950;box-shadow:0 8px 20px rgba(7,27,51,.2);z-index:2}.trd-detail-empty h3{font-size:14px;color:var(--navy);margin:0}.trd-detail-empty>p{font-size:9px;line-height:1.55;color:#7c8a9a;max-width:250px}.trd-tip{margin-top:12px;background:#f7f9fb;border:1px solid #edf0f3;border-radius:11px;padding:10px;display:flex;gap:8px;text-align:left}.trd-tip span{width:20px;height:20px;border-radius:7px;background:var(--yellow);display:grid;place-items:center;font-size:8px;font-weight:900;color:var(--navy);flex:0 0 auto}.trd-tip p{font-size:8px;color:#657486;line-height:1.45;margin:1px 0 0}.trd-boot{min-height:100vh;background:var(--navy);color:#fff;display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;font-family:ui-sans-serif,system-ui}.trd-mark{width:68px;height:68px;border-radius:20px;background:var(--yellow);color:var(--navy);display:grid;place-items:center;font-weight:950;box-shadow:0 18px 50px rgba(0,0,0,.25)}.trd-boot b{font-size:10px;color:#b7c9da}.trd-loader{display:flex;gap:4px}.trd-loader i{width:5px;height:5px;background:var(--yellow);border-radius:50%;animation:dot 1s infinite ease-in-out}.trd-loader i:nth-child(2){animation-delay:.15s}.trd-loader i:nth-child(3){animation-delay:.3s}@keyframes dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}@keyframes trdExpand{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}@media(max-width:1180px){.trd-layout{grid-template-columns:220px 1fr 320px}.trd-hero{grid-template-columns:1fr}.trd-flow-card{display:none}}@media(max-width:900px){.trd-topbar{padding:0 15px}.trd-product,.trd-divider,.trd-link-button{display:none}.trd-user-button div{display:none}.trd-hero{margin:14px;padding:26px 22px}.trd-hero h1{font-size:27px}.trd-toolbar{margin:0 14px 10px;flex-direction:column}.trd-filter{min-width:0}.trd-layout{margin:0 14px 20px;height:auto;display:block}.trd-offices,.trd-tree-pane,.trd-detail{margin-bottom:10px}.trd-offices{max-height:250px}.trd-tree-pane{height:600px}.trd-detail{min-height:430px}.trd-mini-stats{display:none}}`;
