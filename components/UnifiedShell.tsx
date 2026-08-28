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
  super_admin:"Super administrador",
  records_admin:"Administrador documental",
  office_admin:"Administrador de dependencia",
  editor:"Editor",
  viewer:"Consulta",
  auditor:"Auditor"
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

const CYCLE = [
  ["01","Registrar","Entrada y radicación"],
  ["02","Clasificar","Expediente + TRD"],
  ["03","Organizar","FUID, carpeta y caja"],
  ["04","Conservar","Transferencia y retención"],
] as const;

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
    setProfile(p as Profile);
    setOffice(p.organizational_units?.name||"Acceso institucional");
  })()},[router]);

  useEffect(()=>{setMenu(false)},[pathname]);

  async function logout(){await supabase.auth.signOut();router.replace("/login")}
  const initials=(profile?.full_name||profile?.email||"GD").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  const active=(href:string)=>href==="/"?pathname==="/":pathname.startsWith(href);

  if(!profile)return <main className="ui-loading"><div className="ui-loading-mark">GD</div><b>Preparando tu espacio documental…</b></main>;

  return <div className="sgx-root">
    {menu&&<button className="sgx-overlay" onClick={()=>setMenu(false)} aria-label="Cerrar menú"/>}

    <aside className={`sgx-sidebar ${menu?"is-open":""}`} aria-label="Navegación principal">
      <div className="sgx-sidebar-scroll">
        <Link className="sgx-brand" href="/" onClick={()=>setMenu(false)}>
          <span className="sgx-brand-mark">GD</span>
          <span className="sgx-brand-copy"><strong>SGDEA</strong><small>ELECTROINGENIERÍA S.A.S.</small></span>
        </Link>

        <section className="sgx-nav-block">
          <div className="sgx-nav-label">NAVEGACIÓN</div>
          <nav className="sgx-nav">
            {NAV.map(n=><Link key={n.href} className={`sgx-nav-link ${active(n.href)?"is-active":""}`} href={n.href} onClick={()=>setMenu(false)}>
              <span className="sgx-nav-icon"><Icon name={n.icon}/></span>
              <span className="sgx-nav-copy"><strong>{n.label}</strong><small>{n.desc}</small></span>
              <span className="sgx-nav-arrow">›</span>
            </Link>)}
          </nav>
        </section>

        <div className="sgx-sidebar-lower">
          <section className="sgx-cycle">
            <span>CICLO DOCUMENTAL</span>
            <div className="sgx-cycle-list">{CYCLE.map(([num,name,desc])=><div className="sgx-cycle-step" key={num}><b>{num}</b><div><strong>{name}</strong><small>{desc}</small></div></div>)}</div>
          </section>
          <section className="sgx-source-note"><span>FUENTE ÚNICA</span><p>La clasificación TRD se define una sola vez en el expediente. El resto del proceso la hereda y conserva su trazabilidad.</p></section>
        </div>
      </div>
    </aside>

    <section className="sgx-workspace">
      <header className="sgx-topbar">
        <div className="sgx-top-left">
          <button className="sgx-mobile-menu" onClick={()=>setMenu(true)} aria-label="Abrir menú"><Icon name="menu"/></button>
          <div className="sgx-title"><span>{eyebrow}</span><h1>{title}</h1></div>
        </div>
        <div className="sgx-top-right">
          <div className="sgx-quick"><Link href="/trabajo?accion=radicar" className="primary">＋ Radicar</Link><Link href="/trabajo/organizar">◎ Organizar</Link></div>
          {actions}
          <span className="sgx-system"><i/> Sistema operativo</span>
          <div className="sgx-user"><span className="sgx-avatar">{initials}</span><div className="sgx-user-copy"><strong>{profile.full_name||profile.email}</strong><small>{ROLE[profile.role]||profile.role} · {office}</small></div></div>
          <button className="sgx-logout" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="logout"/></button>
        </div>
      </header>
      <main className="sgx-content">{children}</main>
    </section>
  </div>
}
