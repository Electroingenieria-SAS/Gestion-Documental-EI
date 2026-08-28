"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UnifiedShell from "@/components/UnifiedShell";
import { supabase } from "@/lib/supabase";

type Row=Record<string,any>;

export default function SettingsCenter(){
 const [version,setVersion]=useState<Row|null>(null);const [offices,setOffices]=useState<Row[]>([]);const [users,setUsers]=useState<Row[]>([]);
 useEffect(()=>{(async()=>{const [v,o,u]=await Promise.all([supabase.from("trd_versions").select("*").order("created_at",{ascending:false}).limit(1).maybeSingle(),supabase.from("organizational_units").select("id,name,code,active").order("name"),supabase.from("profiles").select("id,full_name,email,role,active,organizational_units(name)").order("full_name").limit(300)]);setVersion(v.data||null);setOffices(o.data||[]);setUsers(u.data||[])})()},[]);
 return <UnifiedShell eyebrow="CONFIGURACIÓN" title="Normativa y administración">
  <div className="ui-page-head"><div><span>CONFIGURACIÓN</span><h2>Lo que gobierna el sistema</h2><p>La configuración no forma parte del trabajo diario. Aquí se administran la TRD, las dependencias y los accesos.</p></div></div>
  <div className="ui-grid cols-3">
   <Link href="/trd" className="ui-card ui-action-card interactive"><div className="ui-action-icon">TRD</div><h3>Tabla de Retención Documental</h3><p>Consulta la estructura oficial que clasifica expedientes y documentos.</p><footer><span>{version?.version_code||"TRD"}</span><b>Abrir →</b></footer></Link>
   <div className="ui-card ui-action-card"><div className="ui-action-icon">ORG</div><h3>Dependencias</h3><p>{offices.filter(x=>x.active).length} unidades activas alimentan la clasificación y asignación documental.</p><footer><span>Estructura organizacional</span><b>{offices.length} registradas</b></footer></div>
   <Link href="/configuracion/usuarios" className="ui-card ui-action-card interactive"><div className="ui-action-icon">USR</div><h3>Usuarios y permisos</h3><p>Consulta perfiles, roles y dependencia asignada.</p><footer><span>Acceso al SGDEA</span><b>{users.length} usuarios →</b></footer></Link>
  </div>
  <section className="ui-section"><div className="ui-grid cols-2"><div className="ui-card pad"><div className="ui-section-head"><div><span>TRD ACTUAL</span><h3>{version?.title||"Sin versión"}</h3></div><span className="ui-pill yellow">{version?.status||"—"}</span></div><div className="ui-divider"/><div className="ui-context"><span>Código de versión</span><b>{version?.version_code||"—"}</b></div><div style={{height:8}}/><div className="ui-callout info">La TRD es la fuente de verdad. Los formatos no deben permitir clasificaciones diferentes a la seleccionada en el expediente.</div></div><div className="ui-card pad"><div className="ui-section-head"><div><span>DEPENDENCIAS</span><h3>Estructura activa</h3></div></div><div className="ui-list" style={{margin:"0 -18px -18px"}}>{offices.slice(0,8).map(x=><div className="ui-list-row" key={x.id}><span className="ui-list-main"><b>{x.name}</b><small>{x.code||"Sin código"}</small></span><span className="ui-list-meta"><span className={`ui-pill ${x.active?"green":""}`}>{x.active?"Activa":"Inactiva"}</span></span></div>)}</div></div></div></section>
 </UnifiedShell>
}
