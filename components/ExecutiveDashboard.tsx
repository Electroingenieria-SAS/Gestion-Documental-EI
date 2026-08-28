"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import UnifiedShell from "@/components/UnifiedShell";
import { supabase } from "@/lib/supabase";

type Row = Record<string, any>;
type OfficeMetric = { office: string; records: number };
type PhaseMetric = { phase: string; records: number };
type YearMetric = { year: number; records: number };
type LevelMetric = { level: string; records: number };
type Metrics = {
  totals: Record<string, number>;
  by_office: OfficeMetric[];
  by_phase: PhaseMetric[];
  by_year: YearMetric[];
  trd_levels: LevelMetric[];
};

const emptyMetrics: Metrics = { totals: {}, by_office: [], by_phase: [], by_year: [], trd_levels: [] };
const number = new Intl.NumberFormat("es-CO");

function Icon({ name, size = 22 }: { name: "inbox" | "folder" | "archive" | "chart" | "alert" | "trd" | "transfer" | "spark"; size?: number }) {
  const paths: Record<string, ReactNode> = {
    inbox: <><path d="M4 5.5h16v13H4z"/><path d="M4 13h4l2 3h4l2-3h4"/></>,
    folder: <><path d="M3.5 7.5h6l2-2h9v13h-17z"/><path d="M3.5 9h17"/></>,
    archive: <><path d="M4 7h16v13H4z"/><path d="M3 4h18v4H3zM9 12h6"/></>,
    chart: <><path d="M5 20V10M10 20V5M15 20v-7M20 20V8"/></>,
    alert: <><path d="M12 4 3.8 19h16.4L12 4Z"/><path d="M12 9v4M12 16h.01"/></>,
    trd: <><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    transfer: <><path d="M5 8h13M15 5l3 3-3 3M19 16H6M9 13l-3 3 3 3"/></>,
    spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function EChart({ option, gl = false, className = "" }: { option: Record<string, any>; gl?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let chart: any;
    let observer: ResizeObserver | undefined;
    let cancelled = false;
    (async () => {
      const echarts = await import("echarts");
      if (gl) await import("echarts-gl");
      if (!ref.current || cancelled) return;
      chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
      chart.setOption(option, true);
      observer = new ResizeObserver(() => chart?.resize());
      observer.observe(ref.current);
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
      chart?.dispose();
    };
  }, [option, gl]);
  return <div ref={ref} className={`exec-chart ${className}`} />;
}

function MetricCard({ icon, label, value, note, tone = "blue" }: { icon: Parameters<typeof Icon>[0]["name"]; label: string; value: number; note: string; tone?: "blue" | "yellow" | "navy" | "soft" }) {
  return <article className={`exec-kpi tone-${tone}`}>
    <span className="exec-kpi-icon"><Icon name={icon} /></span>
    <div><small>{label}</small><b>{number.format(value || 0)}</b><p>{note}</p></div>
  </article>;
}

export default function ExecutiveDashboard() {
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [recent, setRecent] = useState<Row[]>([]);
  const [pending, setPending] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: summary }, recentRes, tasksRes] = await Promise.all([
        supabase.rpc("get_executive_dashboard_metrics"),
        supabase.from("expedientes").select("id,expediente_code,title,status,phase,updated_at,organizational_units(name)").order("updated_at", { ascending: false }).limit(5),
        supabase.from("workflow_tasks").select("id,title,priority,status,due_at,entity_type,entity_id").neq("status", "completed").order("due_at", { ascending: true, nullsFirst: false }).limit(5)
      ]);
      if (summary) setMetrics(summary as Metrics);
      setRecent(recentRes.data || []);
      setPending(tasksRes.data || []);
      setLoading(false);
    })();
  }, []);

  const office3D = useMemo(() => {
    const rows = metrics.by_office.slice(0, 6);
    const labels = rows.map(x => x.office.length > 16 ? `${x.office.slice(0, 15)}…` : x.office);
    return {
      animation: true,
      tooltip: { formatter: (p: any) => `<b>${rows[p.value?.[0]]?.office || "Dependencia"}</b><br/>${number.format(p.value?.[2] || 0)} registros FUID` },
      visualMap: { show: false, min: 0, max: Math.max(...rows.map(x => x.records), 1), inRange: { color: ["#235d91", "#1e79b7", "#f5c518"] } },
      xAxis3D: { type: "category", data: labels, axisLabel: { color: "#c9d8e7", fontSize: 10, interval: 0 }, axisLine: { lineStyle: { color: "rgba(201,216,231,.35)" } }, axisTick: { show: false } },
      yAxis3D: { type: "category", data: ["Inventario"], axisLabel: { show: false }, axisLine: { lineStyle: { color: "rgba(201,216,231,.2)" } }, axisTick: { show: false } },
      zAxis3D: { type: "value", axisLabel: { color: "#8fa9bf", fontSize: 9 }, axisLine: { lineStyle: { color: "rgba(201,216,231,.22)" } }, splitLine: { lineStyle: { color: "rgba(201,216,231,.09)" } } },
      grid3D: {
        boxWidth: 138,
        boxDepth: 34,
        boxHeight: 74,
        environment: "#06182b",
        light: { main: { intensity: 1.35, shadow: true, alpha: 28, beta: 38 }, ambient: { intensity: .55 } },
        viewControl: { alpha: 19, beta: 27, distance: 172, minDistance: 120, maxDistance: 240, autoRotate: true, autoRotateSpeed: 2.4, damping: .85 },
        postEffect: { enable: true, SSAO: { enable: true, radius: 2, intensity: 1.2 } }
      },
      series: [{ type: "bar3D", shading: "lambert", bevelSize: .2, bevelSmoothness: 4, data: rows.map((x, i) => [i, 0, x.records]), emphasis: { label: { show: true, color: "#fff", fontSize: 12, formatter: (p: any) => number.format(p.value?.[2] || 0) }, itemStyle: { color: "#ffd84d" } } }]
    };
  }, [metrics.by_office]);

  const phase3D = useMemo(() => {
    const rows = metrics.by_phase;
    const names: Record<string, string> = { central: "Archivo Central", historical: "Histórico", management: "Gestión" };
    return {
      tooltip: { formatter: (p: any) => `<b>${names[rows[p.value?.[0]]?.phase] || rows[p.value?.[0]]?.phase || "Fase"}</b><br/>${number.format(p.value?.[2] || 0)} registros` },
      xAxis3D: { type: "category", data: rows.map(x => names[x.phase] || x.phase), axisLabel: { color: "#d8e5f0", fontSize: 11 }, axisLine: { lineStyle: { color: "rgba(255,255,255,.2)" } } },
      yAxis3D: { type: "category", data: ["FUID"], axisLabel: { show: false }, axisLine: { show: false } },
      zAxis3D: { type: "value", axisLabel: { color: "#8ea7bc", fontSize: 9 }, splitLine: { lineStyle: { color: "rgba(255,255,255,.08)" } } },
      grid3D: { boxWidth: 96, boxDepth: 38, boxHeight: 68, environment: "#071c33", light: { main: { intensity: 1.45, shadow: true }, ambient: { intensity: .5 } }, viewControl: { alpha: 18, beta: -28, distance: 150, autoRotate: true, autoRotateSpeed: 2 } },
      series: [{ type: "bar3D", shading: "realistic", realisticMaterial: { roughness: .45, metalness: .05 }, data: rows.map((x, i) => ({ value: [i, 0, x.records], itemStyle: { color: i === 0 ? "#f5c518" : "#2e75b6" } })), emphasis: { label: { show: true, color: "#fff", formatter: (p: any) => number.format(p.value?.[2] || 0) } } }]
    };
  }, [metrics.by_phase]);

  const historyOption = useMemo(() => ({
    animationDuration: 1100,
    tooltip: { trigger: "axis", backgroundColor: "#071b33", borderColor: "#234d72", textStyle: { color: "#fff" }, formatter: (items: any[]) => `<b>${items?.[0]?.axisValue}</b><br/>${number.format(items?.[0]?.value || 0)} registros inventariados` },
    grid: { left: 42, right: 18, top: 26, bottom: 36 },
    xAxis: { type: "category", boundaryGap: false, data: metrics.by_year.map(x => String(x.year)), axisLine: { lineStyle: { color: "#d9e4ee" } }, axisTick: { show: false }, axisLabel: { color: "#73869b", fontSize: 11, fontWeight: 600 } },
    yAxis: { type: "value", splitNumber: 4, axisLabel: { color: "#91a0b1", fontSize: 10 }, splitLine: { lineStyle: { color: "#edf1f5" } } },
    series: [{ type: "line", smooth: .42, symbol: "circle", symbolSize: 8, data: metrics.by_year.map(x => x.records), lineStyle: { width: 4, color: "#0b4f87" }, itemStyle: { color: "#f5c518", borderColor: "#fff", borderWidth: 3 }, areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(23,96,151,.28)" }, { offset: 1, color: "rgba(23,96,151,.015)" }] } } }]
  }), [metrics.by_year]);

  const trdOption = useMemo(() => {
    const labels: Record<string, string> = { series: "Series", subseries: "Subseries", type: "Tipos documentales" };
    const colors: Record<string, string> = { series: "#0c355e", subseries: "#2e75b6", type: "#f5c518" };
    return {
      animationDuration: 900,
      tooltip: { trigger: "item", formatter: (p: any) => `<b>${p.name}</b><br/>${number.format(p.value)} registros` },
      series: [{ type: "pie", radius: ["55%", "78%"], center: ["50%", "51%"], padAngle: 4, itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 3 }, label: { show: false }, emphasis: { scaleSize: 8, label: { show: true, position: "center", fontSize: 15, fontWeight: 800, formatter: "{b}\n{c}" } }, data: metrics.trd_levels.map(x => ({ name: labels[x.level] || x.level, value: x.records, itemStyle: { color: colors[x.level] || "#5c82a5" } })) }]
    };
  }, [metrics.trd_levels]);

  const totals = metrics.totals || {};

  return <UnifiedShell eyebrow="INICIO" title="Panel ejecutivo">
    <div className={`exec-dashboard ${loading ? "is-loading" : ""}`}>
      <section className="exec-hero">
        <div className="exec-hero-copy">
          <span className="exec-eyebrow"><Icon name="spark" size={15}/> INTELIGENCIA DOCUMENTAL</span>
          <h1>El estado del archivo, <em>de un vistazo.</em></h1>
          <p>Operación en vivo, inventario histórico y estructura TRD reunidos en una sola vista interactiva. Gira las gráficas 3D, explora los datos y entra directamente al proceso que necesita atención.</p>
          <div className="exec-hero-actions"><Link href="/trabajo" className="exec-btn primary">Ir a Trabajo <span>→</span></Link><Link href="/trabajo/organizar" className="exec-btn glass">Organizar expediente</Link></div>
        </div>
        <div className="exec-hero-orbit" aria-hidden="true"><div className="orbit-ring r1"/><div className="orbit-ring r2"/><div className="orbit-core"><Icon name="chart" size={38}/><b>SGDEA</b><small>Datos en vivo</small></div><span className="orbit-dot d1"/><span className="orbit-dot d2"/><span className="orbit-dot d3"/></div>
      </section>

      <section className="exec-section">
        <div className="exec-section-head"><div><span>OPERACIÓN EN VIVO</span><h2>Lo que está ocurriendo ahora</h2><p>Indicadores operativos del SGDEA. Se actualizan directamente desde Supabase.</p></div><span className="exec-live"><i/> En vivo</span></div>
        <div className="exec-kpis">
          <MetricCard icon="folder" label="Expedientes" value={totals.expedientes} note="expedientes activos en el sistema" tone="navy" />
          <MetricCard icon="inbox" label="Radicaciones" value={totals.radications} note="comunicaciones registradas" tone="yellow" />
          <MetricCard icon="transfer" label="Transferencias" value={totals.transfers} note="procesos de transferencia" tone="blue" />
          <MetricCard icon="alert" label="Pendientes" value={(totals.tasks || 0) + (totals.approvals || 0)} note="tareas y aprobaciones por resolver" tone="soft" />
        </div>
      </section>

      <section className="exec-section">
        <div className="exec-section-head"><div><span>BASE DOCUMENTAL</span><h2>Inventario histórico en 3D</h2><p>Los gráficos representan los 5.484 registros FUID importados y su distribución archivística real.</p></div><div className="exec-badges"><span>{number.format(totals.fuid || 0)} FUID</span><span>{number.format(totals.trd || 0)} TRD</span></div></div>
        <div className="exec-visual-grid">
          <article className="exec-panel exec-panel-main dark">
            <header><div><small>VOLUMEN DOCUMENTAL</small><h3>Registros por dependencia</h3><p>Arrastra para rotar · rueda para acercar</p></div><span className="exec-chip">3D interactivo</span></header>
            <EChart option={office3D} gl className="chart-3d-main" />
          </article>
          <article className="exec-panel dark phase-panel">
            <header><div><small>FASE DE ARCHIVO</small><h3>Central vs. Histórico</h3></div><span className="exec-chip yellow">WebGL</span></header>
            <EChart option={phase3D} gl className="chart-3d-phase" />
          </article>
        </div>
      </section>

      <section className="exec-section">
        <div className="exec-analytics-grid">
          <article className="exec-panel light history-panel"><header><div><small>EVOLUCIÓN DEL INVENTARIO</small><h3>Registros por año de inventario</h3></div></header><EChart option={historyOption} className="chart-history" /></article>
          <article className="exec-panel light trd-panel"><header><div><small>ESTRUCTURA TRD</small><h3>Jerarquía documental</h3></div><span className="exec-chip warning">{number.format(totals.valuation_pending || 0)} por valorar</span></header><EChart option={trdOption} className="chart-trd" /><div className="exec-trd-legend">{metrics.trd_levels.map(x => <div key={x.level}><b>{number.format(x.records)}</b><span>{x.level === "series" ? "Series" : x.level === "subseries" ? "Subseries" : "Tipos documentales"}</span></div>)}</div></article>
        </div>
      </section>

      <section className="exec-section">
        <div className="exec-section-head compact"><div><span>ACCESOS RÁPIDOS</span><h2>Continúa el proceso documental</h2></div></div>
        <div className="exec-action-grid">
          <Link href="/trabajo?accion=radicar" className="exec-action"><span><Icon name="inbox" /></span><div><small>RECEPCIÓN</small><h3>Radicar documento</h3><p>Entrada, salida o comunicación interna.</p></div><b>→</b></Link>
          <Link href="/trabajo?accion=expediente" className="exec-action"><span><Icon name="folder" /></span><div><small>CLASIFICACIÓN</small><h3>Abrir expediente</h3><p>Vinculado desde el inicio a la TRD.</p></div><b>→</b></Link>
          <Link href="/trabajo/organizar" className="exec-action featured"><span><Icon name="archive" /></span><div><small>PROCESO GUIADO</small><h3>Organizar expediente</h3><p>Documentos, FUID, carpeta, caja y rótulo.</p></div><b>→</b></Link>
          <Link href="/trd" className="exec-action"><span><Icon name="trd" /></span><div><small>NORMA DOCUMENTAL</small><h3>Consultar TRD</h3><p>Serie, subserie, tipos y retención.</p></div><b>→</b></Link>
        </div>
      </section>

      <section className="exec-section exec-bottom-grid">
        <div><div className="exec-section-head compact"><div><span>CONTINUAR</span><h2>Expedientes recientes</h2></div></div><div className="exec-list">{recent.length ? recent.map(x => <Link key={x.id} href={`/trabajo/organizar?exp=${x.id}`} className="exec-list-row"><span className="exec-list-mark"><Icon name="folder" size={17}/></span><div><b>{x.title}</b><small>{x.expediente_code} · {x.organizational_units?.name || "Sin dependencia"}</small></div><em>{x.phase} · {x.status}</em><strong>→</strong></Link>) : <div className="exec-empty"><span><Icon name="folder"/></span><b>La operación comienza aquí</b><p>Aún no hay expedientes operativos. El inventario histórico ya está cargado y disponible en el dashboard.</p><Link href="/trabajo?accion=expediente">Abrir primer expediente →</Link></div>}</div></div>
        <div><div className="exec-section-head compact"><div><span>ATENCIÓN</span><h2>Acciones pendientes</h2></div></div><div className="exec-list">{pending.length ? pending.map(x => <Link key={x.id} href="/control" className="exec-list-row"><span className="exec-list-mark warning"><Icon name="alert" size={17}/></span><div><b>{x.title}</b><small>{x.entity_type} · prioridad {x.priority}</small></div><em>{x.due_at ? new Date(x.due_at).toLocaleDateString("es-CO") : "Sin fecha"}</em><strong>→</strong></Link>) : <div className="exec-empty ok"><span><Icon name="spark"/></span><b>Sin pendientes operativos</b><p>Cuando existan tareas, aprobaciones o vencimientos aparecerán aquí automáticamente.</p><Link href="/control">Abrir Control →</Link></div>}</div></div>
      </section>
    </div>
  </UnifiedShell>;
}
