"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type Row = Record<string, any>;
type Counts = Record<string, number>;

const ROLE_NAMES: Record<string, string> = {
  super_admin: "Super administrador",
  records_admin: "Administrador documental",
  office_admin: "Administrador de dependencia",
  editor: "Editor",
  viewer: "Consulta",
  auditor: "Auditor",
};

const QUICK = [
  { step: "01", title: "Recibir o enviar un documento", desc: "Genera el radicado y deja trazabilidad de entrada, salida o comunicación interna.", href: "/gestion#radicacion", tag: "Radicación", icon: "↗" },
  { step: "02", title: "Crear y organizar un expediente", desc: "Clasifica con la TRD, incorpora documentos y controla la vida del expediente.", href: "/gestion#expedientes", tag: "Expedientes", icon: "▱" },
  { step: "03", title: "Registrar la hoja de control", desc: "Diligencia D-FT-19 en línea; los datos se vinculan al expediente y su clasificación.", href: "/formatos#control", tag: "D-FT-19", icon: "≣" },
  { step: "04", title: "Actualizar el inventario FUID", desc: "Diligencia D-FT-18 sin Excel y conserva el inventario histórico en la misma plataforma.", href: "/formatos#fuid", tag: "D-FT-18", icon: "≡" },
  { step: "05", title: "Crear carpeta, caja y sticker", desc: "Genera rótulos D-FT-20, D-FT-21 o D-FT-28 con los datos ya registrados.", href: "/formatos#cajas", tag: "Archivo físico", icon: "▣" },
  { step: "06", title: "Transferir o aplicar retención", desc: "Gestiona D-FT-27, archivo central/histórico y vencimientos derivados de la TRD.", href: "/formatos#transferencias", tag: "Transferencia", icon: "⇄" },
];

const GROUPS = [
  {
    title: "1 · Registro y clasificación",
    desc: "Aquí comienza la documentación.",
    items: [
      ["Radicación", "Entrada, salida e interna", "/gestion#radicacion"],
      ["TRD general", "Clasificación y reglas vigentes", "/gestion#trd"],
      ["Expedientes", "Apertura, documentos y cierre", "/gestion#expedientes"],
    ],
  },
  {
    title: "2 · Organización e inventario",
    desc: "El trabajo operativo de cada expediente.",
    items: [
      ["Hoja de control", "D-FT-19 rellenable", "/formatos#control"],
      ["Inventario FUID", "D-FT-18 rellenable", "/formatos#fuid"],
      ["Carpetas", "D-FT-20 y foliación", "/formatos#carpetas"],
    ],
  },
  {
    title: "3 · Archivo y conservación",
    desc: "Ubicación física, transferencia y tiempos.",
    items: [
      ["Cajas y stickers", "D-FT-21 / D-FT-28", "/formatos#cajas"],
      ["Transferencias", "D-FT-27", "/formatos#transferencias"],
      ["Retención", "Vencimientos y disposición", "/gestion#retencion"],
    ],
  },
  {
    title: "4 · Control institucional",
    desc: "Seguimiento, autorización y administración.",
    items: [
      ["Aprobaciones", "Solicitudes y tareas", "/gestion#aprobaciones"],
      ["Auditoría", "Quién hizo qué y cuándo", "/gestion#auditoria"],
      ["Usuarios", "Roles y dependencias", "/gestion#usuarios"],
    ],
  },
];

export default function SGDEAHome() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [officeName, setOfficeName] = useState("Acceso institucional");
  const [counts, setCounts] = useState<Counts>({});
  const [recent, setRecent] = useState<Row[]>([]);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.replace("/login"); return; }
      const user = sessionData.session.user;
      const { data: p, error: pe } = await supabase.from("profiles").select("*,organizational_units(name)").eq("id", user.id).maybeSingle();
      if (pe || !p || !p.active) { await supabase.auth.signOut(); router.replace("/login"); return; }
      setProfile(p as Profile);
      setOfficeName(p.organizational_units?.name || "Acceso institucional");

      const tables = ["trd_entries","fuid_items","expedientes","control_sheet_entries","archive_folders","archive_boxes","transfers","audit_logs","radications","approval_requests","printed_labels"];
      const results = await Promise.all(tables.map((t) => supabase.from(t).select("*", { count: "exact", head: true })));
      const next: Counts = {};
      tables.forEach((t, i) => { next[t] = results[i].count || 0; });

      const [retention, openRad, pendingApprovals, recentExp] = await Promise.all([
        supabase.from("expedientes").select("*", { count: "exact", head: true }).not("retention_management_due", "is", null).lte("retention_management_due", new Date().toISOString().slice(0,10)),
        supabase.from("radications").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("approval_requests").select("*", { count: "exact", head: true }).in("status", ["pending","draft"]),
        supabase.from("expedientes").select("id,expediente_code,title,status,phase,updated_at,organizational_units(name)").order("updated_at", { ascending: false }).limit(5),
      ]);
      next.retention_due = retention.count || 0;
      next.radications_open = openRad.count || 0;
      next.approvals_pending = pendingApprovals.count || 0;
      setCounts(next);
      setRecent(recentExp.data || []);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) setError(firstError.message);
      setBooting(false);
    })();
  }, [router]);

  const completeness = useMemo(() => {
    const ready = [counts.trd_entries > 0, counts.fuid_items > 0, counts.audit_logs > 0].filter(Boolean).length;
    return Math.round((ready / 3) * 100);
  }, [counts]);

  async function logout() { await supabase.auth.signOut(); router.replace("/login"); }

  if (booting) return <main className="ph-boot"><div className="ph-logo">GD</div><div className="ph-loader"><i/><i/><i/></div><b>Preparando tu espacio de gestión documental…</b></main>;
  if (!profile) return null;

  return <main className="ph-shell">
    <style>{CSS}</style>
    <header className="ph-top">
      <Link href="/" className="ph-brand"><span>GD</span><div><b>SGDEA</b><small>ELECTROINGENIERÍA S.A.S.</small></div></Link>
      <div className="ph-topright"><div className="ph-user"><span>{profile.full_name || profile.email}</span><small>{ROLE_NAMES[profile.role]} · {officeName}</small></div><button onClick={logout}>Cerrar sesión</button></div>
    </header>

    <section className="ph-wrap">
      <div className="ph-hero">
        <div className="ph-hero-copy"><span className="ph-kicker">GESTIÓN DOCUMENTAL · PUNTO DE INICIO</span><h1>¿Qué necesitas hacer hoy?</h1><p>Trabaja directamente en el SGDEA. Los formatos, la TRD, el inventario, las carpetas, las cajas y las transferencias se relacionan entre sí para evitar volver a diligenciar la misma información.</p><div className="ph-hero-actions"><Link href="/gestion">Abrir gestión documental</Link><Link className="ghost" href="/formatos">Abrir formatos operativos</Link></div></div>
        <div className="ph-system"><div className="ph-system-head"><span>Estado del sistema</span><b>{completeness}% operativo</b></div><div className="ph-system-row"><i className="ok"/><span>TRD general disponible</span><b>{counts.trd_entries || 0}</b></div><div className="ph-system-row"><i className="ok"/><span>FUID histórico disponible</span><b>{counts.fuid_items || 0}</b></div><div className="ph-system-row"><i className="ok"/><span>Eventos de auditoría</span><b>{counts.audit_logs || 0}</b></div><small>La información se guarda en Supabase y cada operación documental relevante queda trazada.</small></div>
      </div>

      {error && <div className="ph-warning">Hay información que no pudo cargarse en el tablero: {error}</div>}

      <section className="ph-section"><div className="ph-section-title"><div><span>RUTA RÁPIDA</span><h2>Empieza por la acción, no por el nombre del formato</h2></div><p>El sistema te lleva al módulo correcto.</p></div><div className="ph-quick">{QUICK.map(q => <Link href={q.href} key={q.step}><div className="ph-quick-top"><span className="ph-step">{q.step}</span><i>{q.icon}</i></div><h3>{q.title}</h3><p>{q.desc}</p><b>{q.tag} →</b></Link>)}</div></section>

      <section className="ph-metrics"><div><span>Expedientes</span><b>{counts.expedientes || 0}</b><small>gestión integral</small></div><div><span>Hojas de control</span><b>{counts.control_sheet_entries || 0}</b><small>D-FT-19</small></div><div><span>Carpetas</span><b>{counts.archive_folders || 0}</b><small>D-FT-20</small></div><div><span>Cajas</span><b>{counts.archive_boxes || 0}</b><small>central / histórico</small></div><div><span>Transferencias</span><b>{counts.transfers || 0}</b><small>D-FT-27</small></div><div><span>Stickers generados</span><b>{counts.printed_labels || 0}</b><small>registro de impresión</small></div></section>

      <section className="ph-grid2">
        <div className="ph-panel"><div className="ph-section-title compact"><div><span>MAPA DEL SOFTWARE</span><h2>Módulos organizados por proceso</h2></div></div><div className="ph-groups">{GROUPS.map(g => <article key={g.title}><div className="ph-group-head"><h3>{g.title}</h3><p>{g.desc}</p></div>{g.items.map(([name, desc, href]) => <Link href={href} key={name}><span><b>{name}</b><small>{desc}</small></span><i>→</i></Link>)}</article>)}</div></div>
        <div className="ph-sidecol">
          <div className="ph-panel"><div className="ph-section-title compact"><div><span>PENDIENTES</span><h2>Control del día</h2></div></div><div className="ph-alerts"><Link href="/gestion#radicacion"><b>{counts.radications_open || 0}</b><span>Radicados abiertos</span><i>Revisar →</i></Link><Link href="/gestion#aprobaciones"><b>{counts.approvals_pending || 0}</b><span>Aprobaciones pendientes</span><i>Revisar →</i></Link><Link href="/gestion#retencion"><b>{counts.retention_due || 0}</b><span>Vencimientos de retención</span><i>Revisar →</i></Link></div></div>
          <div className="ph-panel"><div className="ph-section-title compact"><div><span>GUÍA RÁPIDA</span><h2>Qué significa cada cosa</h2></div></div><div className="ph-help"><p><b>TRD</b><span>Es la regla que define cómo se clasifica y cuánto tiempo se conserva cada documento.</span></p><p><b>Expediente</b><span>Es la unidad principal donde se agrupan los documentos de un mismo asunto o trámite.</span></p><p><b>Hoja de control</b><span>Registra qué documentos entran al expediente y sus folios.</span></p><p><b>FUID</b><span>Es el inventario documental. El sistema conserva el histórico y permite crear nuevos registros.</span></p><p><b>Sticker / rótulo</b><span>Se genera desde los datos de carpeta o caja; no debe volver a digitarlos.</span></p></div></div>
        </div>
      </section>

      <section className="ph-grid2 bottom">
        <div className="ph-panel"><div className="ph-section-title compact"><div><span>ACTIVIDAD RECIENTE</span><h2>Últimos expedientes</h2></div><Link href="/gestion#expedientes">Ver todos</Link></div>{recent.length ? <div className="ph-recent">{recent.map(x => <Link href="/gestion#expedientes" key={x.id}><span className="ph-rec-code">{x.expediente_code}</span><span className="ph-rec-main"><b>{x.title}</b><small>{x.organizational_units?.name || "Sin dependencia"}</small></span><span className="ph-rec-status">{x.status} · {x.phase}</span></Link>)}</div> : <div className="ph-empty">Todavía no hay expedientes operativos. Puedes crear el primero desde Gestión documental.</div>}</div>
        <div className="ph-noexcel"><span>OPERACIÓN DIGITAL</span><h2>Los formatos ya no son archivos separados.</h2><p>La meta operativa es registrar una sola vez. La TRD clasifica; el expediente centraliza; los formatos reutilizan; la caja agrupa; el sticker identifica; la transferencia mueve; y la auditoría deja evidencia.</p><Link href="/formatos">Ir al Centro de Formatos →</Link></div>
      </section>
    </section>
  </main>;
}

const CSS = `
:root{--ph-green:#176b55;--ph-dark:#122721;--ph-ink:#17211e;--ph-muted:#69756f;--ph-line:#dce5e1;--ph-bg:#f2f6f4;--ph-soft:#e9f4f0}.ph-shell{min-height:100vh;background:var(--ph-bg);color:var(--ph-ink);font-family:Arial,Helvetica,sans-serif}.ph-top{height:72px;background:#fff;border-bottom:1px solid var(--ph-line);display:flex;align-items:center;justify-content:space-between;padding:0 34px;position:sticky;top:0;z-index:50}.ph-brand{display:flex;gap:11px;align-items:center;text-decoration:none;color:var(--ph-ink)}.ph-brand>span,.ph-logo{width:40px;height:40px;background:var(--ph-green);color:#fff;border-radius:11px;display:grid;place-items:center;font-weight:900}.ph-brand b,.ph-brand small{display:block}.ph-brand b{font-size:13px;letter-spacing:.12em}.ph-brand small{font-size:8px;color:#76817c;margin-top:3px;letter-spacing:.08em}.ph-topright{display:flex;align-items:center;gap:16px}.ph-user{text-align:right}.ph-user span,.ph-user small{display:block}.ph-user span{font-size:10px;font-weight:800}.ph-user small{font-size:8px;color:var(--ph-muted);margin-top:3px}.ph-topright button{border:1px solid var(--ph-line);background:#fff;border-radius:8px;padding:8px 10px;font-size:9px;cursor:pointer}.ph-wrap{max-width:1480px;margin:0 auto;padding:28px 30px 55px}.ph-hero{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(310px,.7fr);gap:18px}.ph-hero-copy{background:linear-gradient(125deg,#13352c,#176b55);border-radius:20px;padding:34px;color:#fff;min-height:280px;display:flex;flex-direction:column;justify-content:center}.ph-kicker,.ph-section-title span{font-size:8px;font-weight:900;letter-spacing:.16em;color:#79bba5}.ph-hero h1{font-size:38px;line-height:1.02;margin:10px 0 13px;max-width:760px}.ph-hero p{font-size:12px;line-height:1.65;color:#c8ddd6;max-width:780px;margin:0}.ph-hero-actions{display:flex;gap:9px;margin-top:22px}.ph-hero-actions a{background:#fff;color:#124c3e;text-decoration:none;border-radius:9px;padding:10px 14px;font-size:9px;font-weight:900}.ph-hero-actions a.ghost{background:transparent;color:#fff;border:1px solid #ffffff48}.ph-system{background:#fff;border:1px solid var(--ph-line);border-radius:20px;padding:24px;display:flex;flex-direction:column;justify-content:center}.ph-system-head{display:flex;justify-content:space-between;align-items:end;padding-bottom:14px;border-bottom:1px solid var(--ph-line);margin-bottom:10px}.ph-system-head span{font-size:9px;color:var(--ph-muted)}.ph-system-head b{font-size:15px}.ph-system-row{display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:7px;padding:9px 0;border-bottom:1px solid #eef2f0;font-size:9px}.ph-system-row i{width:7px;height:7px;border-radius:50%;background:#2aa878}.ph-system-row b{font-size:11px}.ph-system>small{font-size:8px;line-height:1.5;color:var(--ph-muted);margin-top:12px}.ph-warning{margin-top:14px;background:#fff1d7;border:1px solid #ead3a7;border-radius:10px;padding:11px 13px;font-size:9px}.ph-section{margin-top:27px}.ph-section-title{display:flex;justify-content:space-between;align-items:end;margin-bottom:14px}.ph-section-title h2{font-size:20px;margin:4px 0 0}.ph-section-title>p{font-size:9px;color:var(--ph-muted)}.ph-section-title.compact{margin-bottom:13px}.ph-section-title.compact h2{font-size:15px}.ph-section-title.compact>a{font-size:9px;color:var(--ph-green);text-decoration:none;font-weight:800}.ph-quick{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.ph-quick>a{background:#fff;border:1px solid var(--ph-line);border-radius:15px;padding:18px;text-decoration:none;color:var(--ph-ink);transition:.18s ease}.ph-quick>a:hover{transform:translateY(-2px);border-color:#9dcbbc;box-shadow:0 12px 28px #173d3120}.ph-quick-top{display:flex;justify-content:space-between}.ph-step{font-size:8px;font-weight:900;color:#8a9690}.ph-quick-top i{font-style:normal;color:var(--ph-green);font-size:20px}.ph-quick h3{font-size:14px;margin:14px 0 7px}.ph-quick p{font-size:9px;line-height:1.5;color:var(--ph-muted);min-height:42px}.ph-quick>a>b{font-size:8px;color:var(--ph-green);text-transform:uppercase;letter-spacing:.08em}.ph-metrics{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:24px 0}.ph-metrics div{background:#fff;border:1px solid var(--ph-line);border-radius:12px;padding:14px}.ph-metrics span,.ph-metrics small,.ph-metrics b{display:block}.ph-metrics span{font-size:8px;color:var(--ph-muted)}.ph-metrics b{font-size:22px;margin:5px 0}.ph-metrics small{font-size:7px;color:#87928d}.ph-grid2{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(310px,.75fr);gap:14px}.ph-grid2.bottom{margin-top:14px}.ph-panel{background:#fff;border:1px solid var(--ph-line);border-radius:15px;padding:19px}.ph-sidecol{display:flex;flex-direction:column;gap:14px}.ph-groups{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.ph-groups article{border:1px solid #e7ecea;border-radius:11px;overflow:hidden}.ph-group-head{padding:12px;background:#f7faf9;border-bottom:1px solid #e7ecea}.ph-group-head h3{font-size:10px;margin:0}.ph-group-head p{font-size:8px;color:var(--ph-muted);margin:4px 0 0}.ph-groups article>a{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 12px;text-decoration:none;color:var(--ph-ink);border-bottom:1px solid #eef2f0}.ph-groups article>a:last-child{border:0}.ph-groups article>a:hover{background:#f2f8f5}.ph-groups article>a span b,.ph-groups article>a span small{display:block}.ph-groups article>a span b{font-size:9px}.ph-groups article>a span small{font-size:7px;color:var(--ph-muted);margin-top:3px}.ph-groups article>a i{font-style:normal;color:var(--ph-green)}.ph-alerts{display:grid;gap:8px}.ph-alerts a{display:grid;grid-template-columns:44px 1fr auto;align-items:center;gap:8px;border:1px solid #e9eeeb;border-radius:10px;padding:10px;text-decoration:none;color:var(--ph-ink)}.ph-alerts a>b{font-size:20px;color:var(--ph-green)}.ph-alerts a>span{font-size:9px}.ph-alerts a>i{font-style:normal;font-size:7px;color:var(--ph-muted)}.ph-help{display:grid;gap:9px}.ph-help p{margin:0;border-bottom:1px solid #edf1ef;padding-bottom:8px}.ph-help p:last-child{border:0;padding:0}.ph-help b,.ph-help span{display:block}.ph-help b{font-size:9px;color:var(--ph-green)}.ph-help span{font-size:8px;line-height:1.45;color:var(--ph-muted);margin-top:3px}.ph-recent{display:grid}.ph-recent>a{display:grid;grid-template-columns:110px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #edf1ef;color:var(--ph-ink);text-decoration:none}.ph-recent>a:last-child{border:0}.ph-rec-code{font-size:8px;font-family:monospace;color:var(--ph-green)}.ph-rec-main b,.ph-rec-main small{display:block}.ph-rec-main b{font-size:9px}.ph-rec-main small{font-size:7px;color:var(--ph-muted);margin-top:3px}.ph-rec-status{font-size:7px;background:var(--ph-soft);color:var(--ph-green);padding:5px 7px;border-radius:999px}.ph-empty{padding:24px;text-align:center;color:var(--ph-muted);font-size:9px}.ph-noexcel{background:#152c26;color:#fff;border-radius:15px;padding:23px;display:flex;flex-direction:column;justify-content:center}.ph-noexcel>span{font-size:8px;color:#83bba9;letter-spacing:.14em;font-weight:900}.ph-noexcel h2{font-size:22px;margin:7px 0 9px}.ph-noexcel p{font-size:9px;color:#b7cdc6;line-height:1.55;margin:0}.ph-noexcel a{color:#8ed4bc;text-decoration:none;font-size:9px;font-weight:800;margin-top:15px}.ph-boot{min-height:100vh;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:#f4f7f6;font-family:Arial;color:#46534f}.ph-loader{display:flex;gap:4px}.ph-loader i{width:6px;height:6px;border-radius:50%;background:#176b55;animation:phb 1s infinite}.ph-loader i:nth-child(2){animation-delay:.15s}.ph-loader i:nth-child(3){animation-delay:.3s}.ph-boot>b{font-size:10px}@keyframes phb{50%{opacity:.2;transform:translateY(-3px)}}@media(max-width:1100px){.ph-metrics{grid-template-columns:repeat(3,1fr)}.ph-quick{grid-template-columns:repeat(2,1fr)}.ph-grid2{grid-template-columns:1fr}.ph-sidecol{display:grid;grid-template-columns:1fr 1fr}}@media(max-width:760px){.ph-top{padding:0 14px}.ph-user{display:none}.ph-wrap{padding:16px 12px 35px}.ph-hero{grid-template-columns:1fr}.ph-hero-copy{padding:24px;min-height:auto}.ph-hero h1{font-size:30px}.ph-quick,.ph-groups,.ph-sidecol{grid-template-columns:1fr}.ph-metrics{grid-template-columns:repeat(2,1fr)}.ph-recent>a{grid-template-columns:90px 1fr}.ph-rec-status{display:none}.ph-section-title>p{display:none}}
`;
