"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type Props = { children: ReactNode; eyebrow: string; title: string; actions?: ReactNode };
type IconName = "home" | "work" | "archive" | "control" | "settings" | "logout" | "menu";

const NAV: { href:string; label:string; desc:string; icon:IconName }[] = [
  { href: "/", label: "Inicio", desc: "Resumen y pendientes", icon: "home" },
  { href: "/trabajo", label: "Trabajo", desc: "Radicar y organizar", icon: "work" },
  { href: "/archivo", label: "Archivo", desc: "Carpetas, cajas y transferencias", icon: "archive" },
  { href: "/control", label: "Control", desc: "Pendientes y trazabilidad", icon: "control" },
  { href: "/configuracion", label: "Configuración", desc: "TRD, usuarios y parámetros", icon: "settings" },
];

const ROLE: Record<string,string> = {
  super_admin:"Super administrador", records_admin:"Administrador documental", office_admin:"Administrador de dependencia", editor:"Editor", viewer:"Consulta", auditor:"Auditor"
};

function Icon({name}:{name:IconName}){
  const common={width:18,height:18,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round" as const,strokeLinejoin:"round" as const,"aria-hidden":true};
  if(name==="home")return <svg {...common}><path d="M3.8 10.7 12 4l8.2 6.7"/><path d="M5.7 9.8V20h12.6V9.8"/><path d="M9.5 20v-6h5v6"/></svg>;
  if(name==="work")return <svg {...common}><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M8 3.8v3M16 3.8v3M8 11h8M8 15h5"/></svg>;
  if(name==="archive")return <svg {...common}><path d="M4.5 7.5h15v12h-15z"/><path d="M3.5 4.5h17v3h-17zM9 12h6"/></svg>;
  if(name==="control")return <svg {...common}><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>;
  if(name==="settings")return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19 13.8a1.7 1.7 0 0 0 .35 1.87l.05.05-2.7 2.7-.05-.05a1.7 1.7 0 0 0-1.87-.35 1.7 1.7 0 0 0-1.03 1.56V20h-3.8v-.42A1.7 1.7 0 0 0 8.9 18a1.7 1.7 0 0 0-1.87.35l-.05.05-2.7-2.7.05-.05A1.7 1.7 0 0 0 4.68 13.8 1.7 1.7 0 0 0 3.12 12.8H2.7V9h.42a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.35-1.87l-.05-.05 2.7-2.7.05.05A1.7 1.7 0 0 0 8.9 3.75 1.7 1.7 0 0 0 9.95 2.2h3.8v.42a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.35l.05-.05 2.7 2.7-.05.05a1.7 1.7 0 0 0-.35 1.87A1.7 1.7 0 0 0 20.56 9h.42v3.8h-.42A1.7 1.7 0 0 0 19 13.8Z"/></svg>;
  if(name==="menu")return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
  return <svg {...common}><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/></svg>;
}

export default function UnifiedShell({ children, eyebrow, title, actions }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile,setProfile] = useState<Profile|null>(null);
  const [office,setOffice] = useState("Acceso institucional");
  const [menu,setMenu] = useState(false);

  useEffect(()=>{(async()=>{
    const {data:s}=await supabase.auth.getSession();
    if(!s.session){router.replace("/login");return}
    const {data:p}=await supabase.from("profiles").select("*,organizational_units(name)").eq("id",s.session.user.id).maybeSingle();
    if(!p||!p.active){await supabase.auth.signOut();router.replace("/login");return}
    setProfile(p as Profile); setOffice(p.organizational_units?.name||"Acceso institucional");
  })()},[router]);

  async function logout(){await supabase.auth.signOut();router.replace("/login")}
  const initials=(profile?.full_name||profile?.email||"GD").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  const active=(href:string)=>href==="/"?pathname==="/":pathname.startsWith(href);

  if(!profile)return <main className="ui-loading"><div className="ui-loading-mark">GD</div><b>Preparando tu espacio documental…</b></main>;

  return <div className="ui-app">
    <div className="ui-ambient-scene" aria-hidden="true"><span className="a1"/><span className="a2"/><span className="a3"/></div>
    {menu&&<div className="ui-overlay" onClick={()=>setMenu(false)}/>} 
    <aside className={`ui-sidebar ${menu?"open":""}`}>
      <Link className="ui-brand" href="/" onClick={()=>setMenu(false)}><span className="ui-brand-mark">GD</span><div><b>SGDEA</b><small>ELECTROINGENIERÍA S.A.S.</small></div></Link>
      <div className="ui-nav-section"><div className="ui-nav-label">NAVEGACIÓN</div><nav className="ui-nav">{NAV.map(n=><Link key={n.href} className={active(n.href)?"active":""} href={n.href} onClick={()=>setMenu(false)}><span className="ui-nav-icon"><Icon name={n.icon}/></span><span className="ui-nav-copy"><b>{n.label}</b><small>{n.desc}</small></span><span className="ui-nav-arrow">›</span></Link>)}</nav></div>
      <div className="ui-sidebar-spacer"/>
      <div className="ui-lifecycle-mini"><span>CICLO DOCUMENTAL</span><div className="ui-lifecycle-track"><div className="ui-life-step"><b>01</b><div><strong>Registrar</strong><small>Entrada y radicación</small></div></div><div className="ui-life-step"><b>02</b><div><strong>Clasificar</strong><small>Expediente + TRD</small></div></div><div className="ui-life-step"><b>03</b><div><strong>Organizar</strong><small>FUID, carpeta y caja</small></div></div><div className="ui-life-step"><b>04</b><div><strong>Conservar</strong><small>Transferencia y retención</small></div></div></div></div>
      <div className="ui-sidebar-note"><span>FUENTE ÚNICA</span><p>La clasificación TRD se define una sola vez en el expediente. El resto del proceso la hereda y conserva su trazabilidad.</p></div>
    </aside>
    <section className="ui-shell">
      <header className="ui-topbar"><button className="ui-mobile-menu" onClick={()=>setMenu(true)} aria-label="Abrir menú"><Icon name="menu"/></button><div className="ui-top-title"><span>{eyebrow}</span><h1>{title}</h1></div><div className="ui-top-right"><div className="ui-global-quick"><Link href="/trabajo?accion=radicar" className="primary"><i>＋</i> Radicar</Link><Link href="/trabajo/organizar"><i>◎</i> Organizar</Link></div>{actions}<span className="ui-system-state"><i/> Sistema operativo</span><div className="ui-user"><span className="ui-avatar">{initials}</span><div><b>{profile.full_name||profile.email}</b><small>{ROLE[profile.role]||profile.role} · {office}</small></div></div><button className="ui-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="logout"/></button></div></header>
      <main className="ui-content">{children}</main>
    </section>
  </div>
}
