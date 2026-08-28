"use client";

import { useEffect, useState } from "react";
import UnifiedShell from "@/components/UnifiedShell";
import { supabase } from "@/lib/supabase";

type Row=Record<string,any>; type View="tasks"|"approvals"|"audit";
const dt=(v:any)=>v?new Intl.DateTimeFormat("es-CO",{dateStyle:"short",timeStyle:"short"}).format(new Date(v)):"—";

export default function ControlCenter(){
 const [view,setView]=useState<View>("tasks");const [tasks,setTasks]=useState<Row[]>([]);const [approvals,setApprovals]=useState<Row[]>([]);const [audit,setAudit]=useState<Row[]>([]);
 useEffect(()=>{(async()=>{const [t,a,l]=await Promise.all([supabase.from("workflow_tasks").select("*").order("created_at",{ascending:false}).limit(400),supabase.from("approval_requests").select("*").order("created_at",{ascending:false}).limit(400),supabase.from("audit_logs").select("*").order("occurred_at",{ascending:false}).limit(500)]);setTasks(t.data||[]);setApprovals(a.data||[]);setAudit(l.data||[])})()},[]);
 const open=tasks.filter(x=>x.status!=="completed").length;const pending=approvals.filter(x=>["pending","draft"].includes(x.status)).length;
 return <UnifiedShell eyebrow="CONTROL" title="Seguimiento y trazabilidad">
  <div className="ui-page-head"><div><span>CONTROL</span><h2>Lo que necesita atención</h2><p>Pendientes, aprobaciones y evidencia de auditoría en un solo lugar. Esta pantalla es para supervisar, no para ejecutar procesos documentales.</p></div></div>
  <div className="ui-grid cols-3"><div className="ui-card ui-metric"><small>Tareas abiertas</small><b>{open}</b><span>requieren gestión</span></div><div className="ui-card ui-metric"><small>Aprobaciones pendientes</small><b>{pending}</b><span>por revisar</span></div><div className="ui-card ui-metric"><small>Eventos auditados</small><b>{audit.length}</b><span>últimos registros cargados</span></div></div>
  <section className="ui-section"><div className="ui-section-head"><div className="ui-tabs"><button className={view==="tasks"?"active":""} onClick={()=>setView("tasks")}>Pendientes</button><button className={view==="approvals"?"active":""} onClick={()=>setView("approvals")}>Aprobaciones</button><button className={view==="audit"?"active":""} onClick={()=>setView("audit")}>Auditoría</button></div></div><div className="ui-card" style={{overflow:"hidden"}}>
  {view==="tasks"&&<div className="ui-list">{tasks.length?tasks.map(x=><div className="ui-list-row" key={x.id}><span className="ui-list-main"><b>{x.title}</b><small>{x.description||x.entity_type}</small></span><span className="ui-list-meta"><span className={`ui-pill ${x.status==="completed"?"green":"yellow"}`}>{x.status}</span><small>{x.due_at?`Vence ${dt(x.due_at)}`:`Prioridad ${x.priority}`}</small></span></div>):<div className="ui-empty"><b>Sin tareas</b><span>No hay pendientes registrados.</span></div>}</div>}
  {view==="approvals"&&<div className="ui-list">{approvals.length?approvals.map(x=><div className="ui-list-row" key={x.id}><span className="ui-list-main"><b>{x.title}</b><small>{x.entity_type} · creado {dt(x.created_at)}</small></span><span className="ui-list-meta"><span className={`ui-pill ${x.status==="approved"?"green":"yellow"}`}>{x.status}</span><small>{x.due_at?`Vence ${dt(x.due_at)}`:"Sin fecha límite"}</small></span></div>):<div className="ui-empty"><b>Sin aprobaciones</b><span>No hay solicitudes registradas.</span></div>}</div>}
  {view==="audit"&&<table className="ui-table"><thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Usuario</th></tr></thead><tbody>{audit.map(x=><tr key={x.id}><td>{dt(x.occurred_at)}</td><td><b>{x.action}</b></td><td>{x.entity_type}<br/><small>{x.entity_id}</small></td><td>{x.actor_email||x.actor_id||"Sistema"}</td></tr>)}</tbody></table>}
  </div></section>
 </UnifiedShell>
}
