"use client";

import { useEffect, useMemo, useState } from "react";
import UnifiedShell from "@/components/UnifiedShell";
import { supabase } from "@/lib/supabase";

type Row=Record<string,any>;
const ROLE:Record<string,string>={super_admin:"Super administrador",records_admin:"Administrador documental",office_admin:"Administrador de dependencia",editor:"Editor",viewer:"Consulta",auditor:"Auditor"};
const initials=(x:Row)=>(x.full_name||x.email||"U").split(/\s+/).slice(0,2).map((v:string)=>v[0]).join("").toUpperCase();

export default function UsersCenter(){
 const [users,setUsers]=useState<Row[]>([]);const [q,setQ]=useState("");
 useEffect(()=>{(async()=>{const {data}=await supabase.from("profiles").select("id,full_name,email,role,active,organizational_units(name)").order("full_name").limit(500);setUsers(data||[])})()},[]);
 const rows=useMemo(()=>users.filter(x=>!q.trim()||`${x.full_name} ${x.email} ${x.role} ${x.organizational_units?.name}`.toLowerCase().includes(q.toLowerCase())),[users,q]);
 const stats=useMemo(()=>({active:users.filter(x=>x.active).length,admins:users.filter(x=>["super_admin","records_admin","office_admin"].includes(x.role)).length,readers:users.filter(x=>["viewer","auditor"].includes(x.role)).length}),[users]);
 return <UnifiedShell eyebrow="CONFIGURACIÓN · USUARIOS" title="Usuarios y permisos">
  <div className="module-stack">
   <section className="module-hero"><div className="module-hero-copy"><span>ACCESOS · IDENTIDAD</span><h2>Personas, roles y responsabilidades en una sola vista.</h2><p>Consulta quién tiene acceso al SGDEA, qué nivel de permiso posee y a qué dependencia está asociado.</p></div><div className="module-hero-visual"><div className="module-orbit"><b>USR</b><small>ACCESOS</small></div></div></section>
   <div className="module-kpis"><article className="module-kpi"><div className="module-kpi-head"><small>Usuarios</small><span className="module-kpi-icon">USR</span></div><strong>{users.length}</strong><p>perfiles registrados en el SGDEA</p></article><article className="module-kpi accent"><div className="module-kpi-head"><small>Activos</small><span className="module-kpi-icon">ON</span></div><strong>{stats.active}</strong><p>usuarios con acceso actualmente habilitado</p></article><article className="module-kpi"><div className="module-kpi-head"><small>Administradores</small><span className="module-kpi-icon">ADM</span></div><strong>{stats.admins}</strong><p>perfiles con responsabilidades administrativas</p></article><article className="module-kpi"><div className="module-kpi-head"><small>Consulta / auditoría</small><span className="module-kpi-icon">RD</span></div><strong>{stats.readers}</strong><p>roles principalmente orientados a lectura y control</p></article></div>
   <div className="users-role-grid"><div className="users-role"><b>{users.filter(x=>x.role==="super_admin").length}</b><span>Super administradores</span></div><div className="users-role"><b>{users.filter(x=>x.role==="records_admin").length}</b><span>Administradores documentales</span></div><div className="users-role"><b>{users.filter(x=>x.role==="office_admin").length}</b><span>Administradores de dependencia</span></div></div>
   <div className="module-toolbar"><div><span style={{display:"block",fontSize:8,fontWeight:900,letterSpacing:".12em",color:"#7c8fa0"}}>DIRECTORIO</span><b style={{display:"block",marginTop:4,fontSize:16,color:"#071b33"}}>Perfiles del sistema</b></div><input className="module-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar nombre, correo, rol o dependencia…"/></div>
   <section className="module-panel"><div className="module-panel-head"><div><span>USUARIOS</span><h3>{rows.length} perfiles encontrados</h3><p>El estado y el rol permiten entender rápidamente el nivel de acceso.</p></div></div>{rows.length?<div className="module-table-wrap"><table className="ui-table"><thead><tr><th>Usuario</th><th>Dependencia</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><div className="user-cell"><span className="user-avatar-mini">{initials(x)}</span><span><b>{x.full_name||"Sin nombre"}</b><small>{x.email}</small></span></div></td><td>{x.organizational_units?.name||"Acceso institucional"}</td><td>{ROLE[x.role]||x.role}</td><td><span className={`ui-pill ${x.active?"green":""}`}>{x.active?"Activo":"Inactivo"}</span></td></tr>)}</tbody></table></div>:<div className="module-empty"><div><span className="module-empty-icon">USR</span><b>No hay usuarios que coincidan</b><span>Prueba con otro nombre, correo, rol o dependencia.</span></div></div>}</section>
  </div>
 </UnifiedShell>
}
