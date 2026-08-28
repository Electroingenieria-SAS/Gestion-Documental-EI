"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UnifiedShell from "@/components/UnifiedShell";
import { supabase } from "@/lib/supabase";

type Row=Record<string,any>;

export default function CleanDashboard(){
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [recent,setRecent]=useState<Row[]>([]);
  const [pending,setPending]=useState<Row[]>([]);

  useEffect(()=>{(async()=>{
    const [e,r,t,b,a,w,rec,wt]=await Promise.all([
      supabase.from("expedientes").select("*",{count:"exact",head:true}),
      supabase.from("radications").select("*",{count:"exact",head:true}).eq("status","open"),
      supabase.from("transfers").select("*",{count:"exact",head:true}).in("status",["draft","pending"]),
      supabase.from("archive_boxes").select("*",{count:"exact",head:true}),
      supabase.from("approval_requests").select("*",{count:"exact",head:true}).in("status",["pending","draft"]),
      supabase.from("workflow_tasks").select("*",{count:"exact",head:true}).neq("status","completed"),
      supabase.from("expedientes").select("id,expediente_code,title,status,phase,updated_at,organizational_units(name)").order("updated_at",{ascending:false}).limit(6),
      supabase.from("workflow_tasks").select("id,title,priority,status,due_at,entity_type,entity_id").neq("status","completed").order("due_at",{ascending:true,nullsFirst:false}).limit(5)
    ]);
    setCounts({exp:e.count||0,rad:r.count||0,trans:t.count||0,boxes:b.count||0,approvals:a.count||0,tasks:w.count||0});
    setRecent(rec.data||[]); setPending(wt.data||[]);
  })()},[]);

  return <UnifiedShell eyebrow="INICIO" title="Gestión documental">
    <section className="ui-welcome-panel">
      <div className="ui-welcome-copy"><span>ESPACIO DE TRABAJO</span><h2>Todo el proceso, <em>sin perder el orden.</em></h2><p>Empieza por lo que necesitas hacer. El expediente conserva la clasificación TRD y el sistema reutiliza esa información en cada etapa.</p></div>
      <aside className="ui-welcome-flow"><small>FLUJO DOCUMENTAL</small><div className="ui-process-mini"><div><span>01</span><b>Registrar</b></div><i>→</i><div><span>02</span><b>Organizar</b></div><i>→</i><div><span>03</span><b>Archivar</b></div></div></aside>
    </section>

    <div className="ui-page-head"><div><span>ACCIONES PRINCIPALES</span><h2>¿Qué necesitas hacer?</h2><p>Tres caminos claros para empezar. Los formularios y formatos aparecen únicamente cuando el proceso los necesita.</p></div></div>

    <div className="ui-grid cols-3">
      <Link href="/trabajo?accion=radicar" className="ui-hero-action"><span className="ui-card-kicker dark">ENTRADA · SALIDA · INTERNA</span><div className="ui-action-icon">↗</div><h3>Radicar un documento</h3><p>Registra una entrada, salida o comunicación interna y deja el documento listo para su trámite.</p><footer><span>Recepción documental</span><b>Empezar →</b></footer></Link>
      <Link href="/trabajo/organizar" className="ui-card ui-action-card interactive"><span className="ui-card-kicker">PROCESO GUIADO</span><div className="ui-action-icon">▱</div><h3>Organizar un expediente</h3><p>Documentos, inventario, carpeta, caja y rótulo, siguiendo una sola clasificación TRD.</p><footer><span>Organización documental</span><b>Abrir →</b></footer></Link>
      <Link href="/archivo?vista=transferencias" className="ui-card ui-action-card interactive"><span className="ui-card-kicker">ARCHIVO</span><div className="ui-action-icon">⇄</div><h3>Transferir documentación</h3><p>Prepara la transferencia desde expedientes organizados y conserva toda la trazabilidad archivística.</p><footer><span>Central / Histórico</span><b>Gestionar →</b></footer></Link>
    </div>

    <section className="ui-section"><div className="ui-grid cols-4"><div className="ui-card ui-metric"><small>Expedientes</small><b>{counts.exp||0}</b><span>registrados</span></div><div className="ui-card ui-metric"><small>Radicados abiertos</small><b>{counts.rad||0}</b><span>por atender</span></div><div className="ui-card ui-metric"><small>Tareas pendientes</small><b>{counts.tasks||0}</b><span>asignadas</span></div><div className="ui-card ui-metric"><small>Cajas</small><b>{counts.boxes||0}</b><span>en archivo</span></div></div></section>

    <section className="ui-section"><div className="ui-grid cols-2">
      <div><div className="ui-section-head"><div><span>CONTINUAR</span><h3>Expedientes recientes</h3></div><Link className="ui-btn secondary" href="/trabajo">Ver trabajo</Link></div><div className="ui-card ui-list">{recent.length?recent.map(x=><Link key={x.id} href={`/trabajo/organizar?exp=${x.id}`} className="ui-list-row"><span className="ui-list-main"><b>{x.title}</b><small>{x.expediente_code} · {x.organizational_units?.name||"Sin dependencia"}</small></span><span className="ui-list-meta"><b>Continuar →</b><small>{x.phase} · {x.status}</small></span></Link>):<div className="ui-empty"><b>No hay expedientes</b><span>Crea el primero desde Trabajo.</span></div>}</div></div>
      <div><div className="ui-section-head"><div><span>ATENCIÓN</span><h3>Lo que requiere acción</h3></div><Link className="ui-btn secondary" href="/control">Ver control</Link></div><div className="ui-card ui-list">{pending.length?pending.map(x=><Link key={x.id} href="/control" className="ui-list-row"><span className="ui-list-main"><b>{x.title}</b><small>{x.entity_type} · prioridad {x.priority}</small></span><span className="ui-list-meta"><span className="ui-pill yellow">{x.status}</span><small>{x.due_at?new Date(x.due_at).toLocaleDateString("es-CO"):"Sin fecha límite"}</small></span></Link>):<div className="ui-empty"><b>Todo al día</b><span>No hay tareas operativas pendientes.</span></div>}</div></div>
    </div></section>
  </UnifiedShell>
}
