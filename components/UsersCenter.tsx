"use client";

import { useEffect, useState } from "react";
import UnifiedShell from "@/components/UnifiedShell";
import { supabase } from "@/lib/supabase";

type Row=Record<string,any>;
const ROLE:Record<string,string>={super_admin:"Super administrador",records_admin:"Administrador documental",office_admin:"Administrador de dependencia",editor:"Editor",viewer:"Consulta",auditor:"Auditor"};

export default function UsersCenter(){
 const [users,setUsers]=useState<Row[]>([]);const [q,setQ]=useState("");
 useEffect(()=>{(async()=>{const {data}=await supabase.from("profiles").select("id,full_name,email,role,active,organizational_units(name)").order("full_name").limit(500);setUsers(data||[])})()},[]);
 const rows=users.filter(x=>!q.trim()||`${x.full_name} ${x.email} ${x.role} ${x.organizational_units?.name}`.toLowerCase().includes(q.toLowerCase()));
 return <UnifiedShell eyebrow="CONFIGURACIÓN · USUARIOS" title="Usuarios y permisos">
  <div className="ui-page-head"><div><span>ACCESOS</span><h2>Quién puede entrar y qué rol tiene</h2><p>Vista limpia de usuarios, rol y dependencia. La administración avanzada queda reservada a perfiles autorizados.</p></div></div>
  <div className="ui-grid cols-3"><div className="ui-card ui-metric"><small>Usuarios</small><b>{users.length}</b><span>perfiles registrados</span></div><div className="ui-card ui-metric"><small>Activos</small><b>{users.filter(x=>x.active).length}</b><span>con acceso habilitado</span></div><div className="ui-card ui-metric"><small>Administradores</small><b>{users.filter(x=>["super_admin","records_admin","office_admin"].includes(x.role)).length}</b><span>roles administrativos</span></div></div>
  <section className="ui-section"><div className="ui-section-head"><div><span>DIRECTORIO</span><h3>Perfiles</h3></div><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar usuario…" style={{height:38,border:"1px solid var(--ui-line)",borderRadius:11,padding:"0 11px",font:"inherit",fontSize:8.5,minWidth:230}}/></div><div className="ui-card" style={{overflow:"hidden"}}><table className="ui-table"><thead><tr><th>Usuario</th><th>Dependencia</th><th>Rol</th><th>Estado</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><b>{x.full_name||"Sin nombre"}</b><br/><small>{x.email}</small></td><td>{x.organizational_units?.name||"Acceso institucional"}</td><td>{ROLE[x.role]||x.role}</td><td><span className={`ui-pill ${x.active?"green":""}`}>{x.active?"Activo":"Inactivo"}</span></td></tr>)}</tbody></table></div></section>
 </UnifiedShell>
}
