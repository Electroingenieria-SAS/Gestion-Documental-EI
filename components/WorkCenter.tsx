"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import UnifiedShell from "@/components/UnifiedShell";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type Row=Record<string,any>; type Mode="inicio"|"radicar"|"expediente";
const today=()=>new Date().toISOString().slice(0,10);

function Icon({name,size=22}:{name:"inbox"|"folder"|"organize"|"transfer"|"check"|"route"|"calendar"|"building";size?:number}){
  const p:Record<string,ReactNode>={
    inbox:<><path d="M4 5.5h16v13H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>,
    folder:<><path d="M3.5 7.5h6l2-2h9v13h-17z"/><path d="M3.5 9h17"/></>,
    organize:<><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    transfer:<><path d="M5 8h13M15 5l3 3-3 3M19 16H6M9 13l-3 3 3 3"/></>,
    check:<><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
    route:<><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h4a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3H9a3 3 0 0 0-3 3"/></>,
    calendar:<><rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 9.5h16"/></>,
    building:<><path d="M5 20V5l7-2 7 2v15M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>
}

export default function WorkCenter(){
  const [profile,setProfile]=useState<Profile|null>(null); const [offices,setOffices]=useState<Row[]>([]); const [trd,setTrd]=useState<Row[]>([]); const [recent,setRecent]=useState<Row[]>([]); const [mode,setMode]=useState<Mode>("inicio"); const [officeId,setOfficeId]=useState(""); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState("");
  useEffect(()=>{(async()=>{const {data:s}=await supabase.auth.getSession(); if(!s.session)return; const {data:p}=await supabase.from("profiles").select("*").eq("id",s.session.user.id).maybeSingle(); setProfile(p as Profile); const [u,t,e]=await Promise.all([supabase.from("organizational_units").select("id,name,code").eq("active",true).order("name"),supabase.from("trd_entries").select("id,office_id,name,level,system_code,official_code,disposition").in("level",["series","subseries"]).neq("review_state","rejected").order("name"),supabase.from("expedientes").select("id,expediente_code,title,status,phase,updated_at,organizational_units(name)").order("updated_at",{ascending:false}).limit(8)]); setOffices(u.data||[]);setTrd(t.data||[]);setRecent(e.data||[]);setOfficeId(p?.office_id||""); const q=new URLSearchParams(window.location.search).get("accion"); if(q==="radicar")setMode("radicar"); if(q==="expediente")setMode("expediente");})()},[]);
  const trdOptions=useMemo(()=>trd.filter(x=>!officeId||x.office_id===officeId),[trd,officeId]);
  function flash(x:string){setNotice(x);setTimeout(()=>setNotice(""),4200)}
  async function saveRad(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!profile?.organization_id)return;setSaving(true);const f=new FormData(e.currentTarget);const num=`RAD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;const {error}=await supabase.from("radications").insert({organization_id:profile.organization_id,office_id:f.get("office_id")||profile.office_id||null,radication_number:num,direction:f.get("direction"),channel:f.get("channel")||null,subject:String(f.get("subject")||"").trim(),sender:f.get("sender")||null,recipient:f.get("recipient")||null,received_or_sent_at:new Date(String(f.get("date")||today())+"T12:00:00").toISOString(),status:"open",metadata:{created_from:"work_center"}});setSaving(false);if(error)return flash(error.message);e.currentTarget.reset();flash(`Radicado ${num} creado correctamente.`);}
  async function saveExp(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!profile?.organization_id)return;setSaving(true);const f=new FormData(e.currentTarget);const oid=String(f.get("office_id")||profile.office_id||"");const office=offices.find(x=>x.id===oid);const tid=String(f.get("trd_entry_id")||"");const rule=trd.find(x=>x.id===tid);const code=`EI-${new Date().getFullYear()}-${office?.code||"EXP"}-${String(Date.now()).slice(-5)}`;const {data,error}=await supabase.from("expedientes").insert({organization_id:profile.organization_id,office_id:oid,trd_entry_id:tid,expediente_code:code,title:String(f.get("title")||"").trim(),description:f.get("description")||null,medium:f.get("medium")||"hybrid",phase:"management",status:"open",access_level:"internal",start_date:f.get("start_date")||today(),disposition:rule?.disposition||"pending",created_by:profile.id}).select("id").single();setSaving(false);if(error)return flash(error.message);flash(`Expediente ${code} creado.`);setTimeout(()=>{if(data?.id)window.location.href=`/trabajo/organizar?exp=${data.id}`},700);}

  return <UnifiedShell eyebrow="TRABAJO" title={mode==="inicio"?"Qué vas a hacer":mode==="radicar"?"Radicar documento":"Abrir expediente"}>
    <div className={`ui-work-stage ${mode!=="inicio"?"task-mode":""}`}>
      <div className="ui-work-heading">
        <div><span>{mode==="inicio"?"CENTRO DE TRABAJO":mode==="radicar"?"RECEPCIÓN Y SALIDA":"CLASIFICACIÓN DOCUMENTAL"}</span><h2>{mode==="inicio"?"Empieza por la tarea":mode==="radicar"?"Registrar un documento":"Crear un expediente"}</h2><p>{mode==="inicio"?"Elige lo que necesitas hacer y el sistema abre únicamente el proceso correspondiente.":mode==="radicar"?"Registra la comunicación una sola vez. El número de radicación se genera automáticamente al guardar.":"Define la dependencia y la TRD una sola vez. El resto del proceso heredará esta clasificación."}</p></div>
        {mode!=="inicio"&&<button className="ui-btn secondary ui-work-back" onClick={()=>setMode("inicio")}>← Volver a tareas</button>}
      </div>

      {notice&&<div className="ui-callout ok ui-work-notice">{notice}</div>}

      {mode==="inicio"&&<>
        <div className="ui-work-actions">
          <button className="ui-work-action primary" onClick={()=>setMode("radicar")}><span className="ui-work-action-icon"><Icon name="inbox"/></span><div><small>RECEPCIÓN Y SALIDA</small><h3>Radicar documento</h3><p>Registra entradas, salidas o comunicaciones internas.</p></div><b>Empezar <span>→</span></b></button>
          <button className="ui-work-action" onClick={()=>setMode("expediente")}><span className="ui-work-action-icon"><Icon name="folder"/></span><div><small>CLASIFICACIÓN</small><h3>Abrir expediente</h3><p>Crea el expediente y vincúlalo con su Serie o Subserie TRD.</p></div><b>Crear <span>→</span></b></button>
          <Link href="/trabajo/organizar" className="ui-work-action"><span className="ui-work-action-icon"><Icon name="organize"/></span><div><small>ORGANIZACIÓN</small><h3>Organizar expediente</h3><p>Documentos, inventario, carpeta, caja y rótulo en un solo flujo.</p></div><b>Continuar <span>→</span></b></Link>
          <Link href="/archivo?vista=transferencias" className="ui-work-action"><span className="ui-work-action-icon"><Icon name="transfer"/></span><div><small>ARCHIVO</small><h3>Transferir documentación</h3><p>Prepara el paso a archivo central o histórico con trazabilidad.</p></div><b>Preparar <span>→</span></b></Link>
        </div>
        <section className="ui-work-recent"><div className="ui-section-head"><div><span>CONTINUAR</span><h3>Expedientes recientes</h3><p>Retoma el trabajo exactamente donde quedó.</p></div></div><div className="ui-card ui-list">{recent.length?recent.map(x=><Link key={x.id} href={`/trabajo/organizar?exp=${x.id}`} className="ui-list-row"><span className="ui-list-main"><b>{x.title}</b><small>{x.expediente_code} · {x.organizational_units?.name||"Sin dependencia"}</small></span><span className="ui-list-meta"><b>Continuar →</b><small>{x.status} · {x.phase}</small></span></Link>):<div className="ui-empty"><b>Aún no hay expedientes</b><span>Puedes crear el primero desde “Abrir expediente”.</span></div>}</div></section>
      </>}

      {mode==="radicar"&&<div className="ui-work-task-grid">
        <section className="ui-card ui-task-card">
          <header className="ui-task-card-head"><div className="ui-task-title"><span className="ui-task-icon"><Icon name="inbox"/></span><div><small>RADICACIÓN</small><h3>Datos del documento</h3><p>Completa solo la información necesaria para dejar el registro trazable.</p></div></div><span className="ui-pill yellow">Número automático</span></header>
          <form className="ui-form ui-task-form" onSubmit={saveRad}>
            <div className="ui-form-section span-2"><span>01</span><div><b>Clasificación inicial</b><small>Indica cómo entra o sale el documento y quién lo gestiona.</small></div></div>
            <label className="ui-field"><span>Tipo de movimiento</span><select name="direction" required><option value="incoming">Entrada</option><option value="outgoing">Salida</option><option value="internal">Interna</option></select></label>
            <label className="ui-field"><span>Dependencia responsable</span><select name="office_id" defaultValue={profile?.office_id||""} required><option value="">Selecciona</option>{offices.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
            <div className="ui-form-section span-2"><span>02</span><div><b>Información del documento</b><small>Estos datos permiten localizar y entender la comunicación después.</small></div></div>
            <label className="ui-field span-2"><span>Asunto</span><input name="subject" required placeholder="Describe claramente el asunto del documento"/></label>
            <label className="ui-field"><span>Remitente</span><input name="sender" placeholder="Persona o entidad que envía"/></label>
            <label className="ui-field"><span>Destinatario</span><input name="recipient" placeholder="Persona, área o entidad destino"/></label>
            <div className="ui-form-section span-2"><span>03</span><div><b>Canal y fecha</b><small>Completa cómo se recibió o envió y la fecha del movimiento.</small></div></div>
            <label className="ui-field"><span>Canal</span><select name="channel"><option value="email">Correo electrónico</option><option value="physical">Físico</option><option value="web">Web</option><option value="internal">Interno</option></select></label>
            <label className="ui-field"><span>Fecha</span><input type="date" name="date" defaultValue={today()} required/></label>
            <div className="ui-task-actions span-2"><button type="button" className="ui-btn secondary" onClick={()=>setMode("inicio")}>Cancelar</button><button className="ui-btn yellow" disabled={saving}>{saving?"Guardando…":"Crear radicado"}</button></div>
          </form>
        </section>
        <aside className="ui-card ui-task-aside">
          <div className="ui-aside-visual"><span><Icon name="route" size={26}/></span><small>FLUJO DE RADICACIÓN</small><h4>Un registro, una sola trazabilidad</h4><p>Al guardar, el sistema crea el número y deja el movimiento listo para seguimiento.</p></div>
          <div className="ui-aside-checklist"><div><span>1</span><p><b>Clasifica el movimiento</b><small>Entrada, salida o comunicación interna.</small></p></div><div><span>2</span><p><b>Identifica responsables</b><small>Dependencia, remitente y destinatario.</small></p></div><div><span>3</span><p><b>Registra canal y fecha</b><small>Queda disponible para control y auditoría.</small></p></div></div>
          <div className="ui-aside-note"><Icon name="check" size={18}/><div><b>No necesitas definir TRD aquí</b><span>La clasificación documental se aplica cuando el trámite se convierte en expediente.</span></div></div>
        </aside>
      </div>}

      {mode==="expediente"&&<div className="ui-work-task-grid">
        <section className="ui-card ui-task-card">
          <header className="ui-task-card-head"><div className="ui-task-title"><span className="ui-task-icon"><Icon name="folder"/></span><div><small>NUEVO EXPEDIENTE</small><h3>Clasificar y abrir</h3><p>La clasificación que selecciones gobernará todo el expediente.</p></div></div><span className="ui-pill green">TRD obligatoria</span></header>
          <form className="ui-form ui-task-form" onSubmit={saveExp}>
            <div className="ui-form-section span-2"><span>01</span><div><b>Dependencia y clasificación</b><small>Primero selecciona la oficina productora y después su Serie o Subserie.</small></div></div>
            <label className="ui-field"><span>Dependencia</span><select name="office_id" value={officeId} onChange={e=>setOfficeId(e.target.value)} required><option value="">Selecciona</option>{offices.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <label className="ui-field"><span>Clasificación TRD</span><select name="trd_entry_id" required disabled={!officeId}><option value="">Selecciona Serie/Subserie</option>{trdOptions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
            <div className="ui-form-section span-2"><span>02</span><div><b>Identificación del expediente</b><small>Usa un nombre claro que permita reconocer el asunto sin abrirlo.</small></div></div>
            <label className="ui-field span-2"><span>Nombre del expediente</span><input name="title" required placeholder="Ej. Contrato de mantenimiento sede principal 2026"/></label>
            <label className="ui-field span-2"><span>Descripción</span><textarea name="description" placeholder="Descripción breve del asunto o trámite"/></label>
            <div className="ui-form-section span-2"><span>03</span><div><b>Apertura</b><small>Define el soporte predominante y la fecha de inicio.</small></div></div>
            <label className="ui-field"><span>Medio</span><select name="medium"><option value="hybrid">Híbrido</option><option value="digital">Digital</option><option value="physical">Físico</option></select></label>
            <label className="ui-field"><span>Fecha de apertura</span><input type="date" name="start_date" defaultValue={today()}/></label>
            <div className="ui-task-actions span-2"><button type="button" className="ui-btn secondary" onClick={()=>setMode("inicio")}>Cancelar</button><button className="ui-btn yellow" disabled={saving}>{saving?"Creando…":"Crear y empezar a organizar"}</button></div>
          </form>
        </section>
        <aside className="ui-card ui-task-aside">
          <div className="ui-aside-visual"><span><Icon name="building" size={26}/></span><small>REGLA DOCUMENTAL</small><h4>La TRD se define una sola vez</h4><p>Después, Hoja de Control, FUID, carpeta, caja y transferencia reutilizan exactamente la misma clasificación.</p></div>
          <div className="ui-aside-flow"><div><b>Dependencia</b><span>01</span></div><i>↓</i><div><b>Serie / Subserie TRD</b><span>02</span></div><i>↓</i><div><b>Expediente</b><span>03</span></div><i>↓</i><div className="done"><b>Proceso documental</b><span>✓</span></div></div>
          <div className="ui-aside-note"><Icon name="check" size={18}/><div><b>Información heredada</b><span>No volverás a escribir dependencia, Serie/Subserie o código TRD en los formatos posteriores.</span></div></div>
        </aside>
      </div>}
    </div>
  </UnifiedShell>
}
