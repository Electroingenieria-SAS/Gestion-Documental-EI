"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type Props = { children: ReactNode; eyebrow: string; title: string; actions?: ReactNode };

const NAV = [
  { href: "/", label: "Inicio", desc: "Resumen y pendientes", icon: "⌂" },
  { href: "/trabajo", label: "Trabajo", desc: "Radicar y organizar", icon: "▱" },
  { href: "/archivo", label: "Archivo", desc: "Carpetas, cajas y transferencias", icon: "▣" },
  { href: "/control", label: "Control", desc: "Pendientes y trazabilidad", icon: "◎" },
  { href: "/configuracion", label: "Configuración", desc: "TRD, usuarios y parámetros", icon: "⚙" },
];

const ROLE: Record<string,string> = {
  super_admin:"Super administrador", records_admin:"Administrador documental", office_admin:"Administrador de dependencia", editor:"Editor", viewer:"Consulta", auditor:"Auditor"
};

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
    {menu&&<div className="ui-overlay" onClick={()=>setMenu(false)}/>} 
    <aside className={`ui-sidebar ${menu?"open":""}`}>
      <Link className="ui-brand" href="/" onClick={()=>setMenu(false)}><span className="ui-brand-mark">GD</span><div><b>SGDEA</b><small>ELECTROINGENIERÍA S.A.S.</small></div></Link>
      <div className="ui-nav-section"><div className="ui-nav-label">NAVEGACIÓN</div><nav className="ui-nav">{NAV.map(n=><Link key={n.href} className={active(n.href)?"active":""} href={n.href} onClick={()=>setMenu(false)}><span className="ui-nav-icon">{n.icon}</span><span className="ui-nav-copy"><b>{n.label}</b><small>{n.desc}</small></span><span className="ui-nav-arrow">›</span></Link>)}</nav></div>
      <div className="ui-sidebar-spacer"/>
      <div className="ui-sidebar-note"><span>REGLA DEL SISTEMA</span><p>La TRD clasifica una sola vez. Los formatos se generan dentro del proceso y reutilizan la misma información.</p></div>
    </aside>
    <section className="ui-shell">
      <header className="ui-topbar"><button className="ui-mobile-menu" onClick={()=>setMenu(true)}>☰</button><div className="ui-top-title"><span>{eyebrow}</span><h1>{title}</h1></div><div className="ui-top-right">{actions}<div className="ui-user"><span className="ui-avatar">{initials}</span><div><b>{profile.full_name||profile.email}</b><small>{ROLE[profile.role]||profile.role} · {office}</small></div></div><button className="ui-logout" onClick={logout} title="Cerrar sesión">↗</button></div></header>
      <main className="ui-content">{children}</main>
    </section>
  </div>
}
