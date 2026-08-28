"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

type Row = Record<string, any>;
type StepKey = "expediente" | "control" | "fuid" | "carpeta" | "caja" | "sticker" | "revision";

const STEPS: { key: StepKey; no: string; title: string; help: string; form?: string }[] = [
  { key: "expediente", no: "01", title: "Expediente", help: "Selecciona la unidad documental que gobernará todo el proceso." },
  { key: "control", no: "02", title: "Registrar documentos", help: "Incorpora documentos y folios. Genera D-FT-19.", form: "D-FT-19" },
  { key: "fuid", no: "03", title: "Actualizar inventario", help: "Consolida el inventario desde los datos ya registrados.", form: "D-FT-18" },
  { key: "carpeta", no: "04", title: "Preparar carpeta", help: "Define tomo, folios y ubicación física.", form: "D-FT-20" },
  { key: "caja", no: "05", title: "Asignar caja", help: "Agrupa la carpeta en archivo de gestión, central o histórico.", form: "D-FT-21 / 28" },
  { key: "sticker", no: "06", title: "Generar rótulo", help: "Produce el rótulo con información heredada y deja evidencia." },
  { key: "revision", no: "07", title: "Revisión final", help: "Comprueba que el expediente quedó organizado y trazable." },
];

const today = () => new Date().toISOString().slice(0, 10);
const safe = (v: any) => (v === null || v === undefined || v === "" ? "—" : String(v));
const codePart = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();

export default function DocumentOrganizationWorkspace() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgId, setOrgId] = useState("");
  const [expedientes, setExpedientes] = useState<Row[]>([]);
  const [trd, setTrd] = useState<Row[]>([]);
  const [boxes, setBoxes] = useState<Row[]>([]);
  const [selectedExpId, setSelectedExpId] = useState("");
  const [step, setStep] = useState<StepKey>("expediente");
  const [control, setControl] = useState<Row[]>([]);
  const [fuid, setFuid] = useState<Row[]>([]);
  const [folders, setFolders] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const notify = (text: string) => { setError(""); setMessage(text); window.setTimeout(() => setMessage(""), 4200); };
  const fail = (text: string) => { setMessage(""); setError(text); window.setTimeout(() => setError(""), 6500); };

  useEffect(() => {
    (async () => {
      const { data: sd } = await supabase.auth.getSession();
      if (!sd.session) { router.replace("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("*").eq("id", sd.session.user.id).maybeSingle();
      if (!p || !p.active) { await supabase.auth.signOut(); router.replace("/login"); return; }
      setProfile(p as Profile);
      let oid = p.organization_id as string | null;
      if (!oid) {
        const { data: o } = await supabase.from("organizations").select("id").eq("code", "EI").maybeSingle();
        oid = o?.id || null;
      }
      if (!oid) { fail("No fue posible identificar la organización EI."); setLoading(false); return; }
      setOrgId(oid);
      const [e, t, b] = await Promise.all([
        supabase.from("expedientes").select("*, organizational_units(name,code), trd_entries(id,parent_id,trd_version_id,level,official_code,system_code,name,classification,support_format,retention_management_raw,retention_central_raw,disposition,requires_valuation,metadata)").eq("organization_id", oid).order("updated_at", { ascending: false }).limit(600),
        supabase.from("trd_entries").select("id,parent_id,trd_version_id,office_id,level,official_code,system_code,name,classification,support_format,retention_management_raw,retention_central_raw,disposition,requires_valuation,metadata").order("source_sheet").order("source_definitive_row").limit(1000),
        supabase.from("archive_boxes").select("*").eq("organization_id", oid).order("created_at", { ascending: false }).limit(400),
      ]);
      const firstError = [e.error, t.error, b.error].find(Boolean);
      if (firstError) fail(firstError.message);
      setExpedientes(e.data || []); setTrd(t.data || []); setBoxes(b.data || []);
      const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("expediente") : null;
      if (requested && (e.data || []).some(x => x.id === requested)) setSelectedExpId(requested);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!selectedExpId || !orgId) { setControl([]); setFuid([]); setFolders([]); setLabels([]); return; }
    loadSelected(selectedExpId);
  }, [selectedExpId, orgId]);

  async function loadSelected(expId = selectedExpId) {
    if (!expId || !orgId) return;
    const [c, f, fo, l] = await Promise.all([
      supabase.from("control_sheet_entries").select("*").eq("expediente_id", expId).order("sequence_no"),
      supabase.from("fuid_items").select("*").eq("organization_id", orgId).eq("legacy", false).eq("expediente_id", expId).order("created_at", { ascending: false }),
      supabase.from("archive_folders").select("*, archive_boxes(*)").eq("expediente_id", expId).order("created_at", { ascending: false }),
      supabase.from("printed_labels").select("*").eq("organization_id", orgId).order("printed_at", { ascending: false }).limit(400),
    ]);
    const firstError = [c.error, f.error, fo.error, l.error].find(Boolean);
    if (firstError) fail(firstError.message);
    setControl(c.data || []); setFuid(f.data || []); setFolders(fo.data || []); setLabels(l.data || []);
  }

  const selectedExp = useMemo(() => expedientes.find(x => x.id === selectedExpId) || null, [expedientes, selectedExpId]);
  const trdById = useMemo(() => new Map(trd.map(x => [x.id, x])), [trd]);
  const selectedTrd = useMemo(() => selectedExp ? trdById.get(selectedExp.trd_entry_id) || selectedExp.trd_entries || null : null, [selectedExp, trdById]);

  const lineage = useMemo(() => {
    if (!selectedTrd) return [] as Row[];
    const path: Row[] = []; let cur: Row | undefined | null = selectedTrd; let guard = 0;
    while (cur && guard < 5) { path.unshift(cur); cur = cur.parent_id ? trdById.get(cur.parent_id) : null; guard += 1; }
    return path;
  }, [selectedTrd, trdById]);

  const allowedTypes = useMemo(() => {
    if (!selectedTrd) return [] as Row[];
    if (selectedTrd.level === "type") return [selectedTrd];
    return trd.filter(x => {
      if (x.level !== "type" || x.office_id !== selectedExp?.office_id) return false;
      let cur: Row | undefined = x; let guard = 0;
      while (cur?.parent_id && guard < 5) { if (cur.parent_id === selectedTrd.id) return true; cur = trdById.get(cur.parent_id); guard += 1; }
      return false;
    });
  }, [selectedTrd, selectedExp, trd, trdById]);

  const currentFolder = folders[0] || null;
  const currentBox = currentFolder?.archive_boxes || (currentFolder?.box_id ? boxes.find(x => x.id === currentFolder.box_id) : null) || null;
  const relevantLabels = useMemo(() => labels.filter(x => (currentFolder && x.entity_id === currentFolder.id) || (currentBox && x.entity_id === currentBox.id)), [labels, currentFolder, currentBox]);

  const dateRange = useMemo(() => {
    const ds = control.map(x => x.entry_date).filter(Boolean).sort();
    return { initial: ds[0] || selectedExp?.start_date || today(), final: ds[ds.length - 1] || today() };
  }, [control, selectedExp]);
  const folioRange = useMemo(() => {
    const from = control.map(x => Number(x.folio_from)).filter(x => x > 0);
    const to = control.map(x => Number(x.folio_to)).filter(x => x > 0);
    return { from: from.length ? Math.min(...from) : null, to: to.length ? Math.max(...to) : null };
  }, [control]);

  const status = useMemo<Record<StepKey, boolean>>(() => ({
    expediente: !!selectedExp,
    control: control.length > 0,
    fuid: fuid.length > 0,
    carpeta: !!currentFolder,
    caja: !!currentBox,
    sticker: relevantLabels.length > 0,
    revision: !!selectedExp && control.length > 0 && fuid.length > 0 && !!currentFolder && !!currentBox && relevantLabels.length > 0,
  }), [selectedExp, control, fuid, currentFolder, currentBox, relevantLabels]);

  const progress = useMemo(() => Math.round((Object.values(status).filter(Boolean).length / STEPS.length) * 100), [status]);
  const expVisible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return expedientes.slice(0, 40);
    return expedientes.filter(x => [x.expediente_code, x.title, x.organizational_units?.name, x.trd_entries?.name].some(v => String(v || "").toLowerCase().includes(q))).slice(0, 80);
  }, [expedientes, query]);

  const seriesName = lineage.find(x => x.level === "series")?.name || (selectedTrd?.level === "series" ? selectedTrd.name : "—");
  const subseriesName = lineage.find(x => x.level === "subseries")?.name || (selectedTrd?.level === "subseries" ? selectedTrd.name : "—");
  const canonicalCode = selectedTrd?.official_code || selectedTrd?.system_code || "—";

  function nextStep() {
    const i = STEPS.findIndex(x => x.key === step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1].key);
  }

  async function saveControl(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedExp) return fail("Selecciona un expediente.");
    setSaving(true); const fd = new FormData(e.currentTarget); const typeId = String(fd.get("trd_document_type_id") || ""); const type = allowedTypes.find(x => x.id === typeId);
    if (!type) { setSaving(false); return fail("Selecciona un tipo documental permitido por la TRD del expediente."); }
    const max = control.reduce((m, x) => Math.max(m, Number(x.sequence_no) || 0), 0);
    const { error: er } = await supabase.from("control_sheet_entries").insert({ expediente_id: selectedExp.id, entry_date: fd.get("entry_date") || today(), document_type_name: type.name, trd_document_type_id: type.id, folio_from: Number(fd.get("folio_from")) || null, folio_to: Number(fd.get("folio_to")) || null, observations: fd.get("observations") || null, sequence_no: max + 1 });
    setSaving(false); if (er) return fail(er.message); e.currentTarget.reset(); notify("Documento registrado en la hoja de control con vínculo TRD."); await loadSelected();
  }

  async function saveFuid(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedExp || !selectedTrd || !orgId) return fail("Primero selecciona un expediente clasificado.");
    setSaving(true); const fd = new FormData(e.currentTarget);
    const classificationName = subseriesName !== "—" ? `${seriesName} / ${subseriesName}` : seriesName;
    const payload = {
      organization_id: orgId, expediente_id: selectedExp.id, office_id: selectedExp.office_id, inventory_date: today(), phase: selectedExp.phase || "management",
      trd_entry_id: selectedExp.trd_entry_id, trd_code: canonicalCode, series_subseries_or_matter: classificationName,
      business_unit: selectedExp.organizational_units?.name || null, macroprocess: selectedTrd.metadata?.macroprocess || null, process_name: selectedTrd.metadata?.process || null,
      description: fd.get("description") || selectedExp.title, extreme_initial: dateRange.initial, extreme_final: dateRange.final,
      box_no: currentBox?.box_number || null, folder_no: currentFolder?.folder_number || null, tomo: currentFolder?.tomo || null,
      folios_from: folioRange.from, folios_to: folioRange.to, support: selectedTrd.support_format || null,
      consultation_frequency: fd.get("consultation_frequency") || null, responsible_name: profile?.full_name || profile?.email || null,
      notes: fd.get("notes") || null, location_code: currentFolder?.location_code || null, location_name: fd.get("location_name") || null,
      source_file: "SGDEA · proceso organización documental", legacy: false, mapping_status: "operational"
    };
    const { error: er } = await supabase.from("fuid_items").insert(payload); setSaving(false);
    if (er) return fail(er.message); e.currentTarget.reset(); notify("Inventario FUID generado desde el expediente y la TRD."); await loadSelected();
  }

  async function saveFolder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!selectedExp) return fail("Selecciona un expediente."); setSaving(true); const fd = new FormData(e.currentTarget);
    const folderNumber = String(fd.get("folder_number") || currentFolder?.folder_number || "1");
    const inventoryCode = currentFolder?.inventory_code || `INV-${new Date().getFullYear()}-${codePart(selectedExp.expediente_code)}-${codePart(folderNumber)}`;
    const payload = { expediente_id: selectedExp.id, folder_number: folderNumber, tomo: fd.get("tomo") || null, inventory_code: inventoryCode, initial_folio: Number(fd.get("initial_folio")) || folioRange.from, final_folio: Number(fd.get("final_folio")) || folioRange.to, location_code: fd.get("location_code") || null, qr_code: `EI-FOLDER-${inventoryCode}`, barcode: inventoryCode, physical_condition: fd.get("physical_condition") || "Bueno" };
    const result = currentFolder ? await supabase.from("archive_folders").update(payload).eq("id", currentFolder.id) : await supabase.from("archive_folders").insert(payload);
    setSaving(false); if (result.error) return fail(result.error.message); notify(currentFolder ? "Carpeta actualizada." : "Carpeta creada y vinculada al expediente."); await loadSelected();
  }

  async function saveBox(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!currentFolder || !orgId) return fail("Primero crea la carpeta del expediente."); setSaving(true); const fd = new FormData(e.currentTarget);
    const phase = String(fd.get("phase") || "central"); const number = String(fd.get("box_number") || "").trim();
    if (!number) { setSaving(false); return fail("Indica el número de caja."); }
    let box = boxes.find(x => x.phase === phase && String(x.box_number) === number);
    if (!box) {
      const ins = await supabase.from("archive_boxes").insert({ organization_id: orgId, phase, box_number: number, qr_code: `EI-BOX-${phase.toUpperCase()}-${codePart(number)}`, barcode: `EI-${phase.slice(0,1).toUpperCase()}-${codePart(number)}`, status: "active" }).select("*").single();
      if (ins.error) { setSaving(false); return fail(ins.error.message); } box = ins.data; setBoxes(v => [box, ...v]);
    }
    const up = await supabase.from("archive_folders").update({ box_id: box.id }).eq("id", currentFolder.id); setSaving(false);
    if (up.error) return fail(up.error.message); notify(`Carpeta asignada a la caja ${number}.`); await loadSelected();
  }

  async function recordLabel(labelType: string, entityType: string, entityId: string, payload: Row) {
    if (!orgId || !profile) return;
    const { error: er } = await supabase.from("printed_labels").insert({ organization_id: orgId, label_type: labelType, entity_type: entityType, entity_id: entityId, serial: `${labelType}-${Date.now()}`, payload, printed_by: profile.id });
    if (er) throw er;
  }

  async function printLabel(kind: "folder" | "box") {
    if (!selectedExp || !selectedTrd) return fail("Selecciona un expediente.");
    const entity = kind === "folder" ? currentFolder : currentBox;
    if (!entity) return fail(kind === "folder" ? "Primero crea la carpeta." : "Primero asigna una caja.");
    const title = kind === "folder" ? `CARPETA ${safe(currentFolder.folder_number)}` : `CAJA ${safe(currentBox.box_number)}`;
    const code = kind === "folder" ? currentFolder.inventory_code : currentBox.qr_code;
    const form = kind === "folder" ? "D-FT-20" : currentBox.phase === "historical" ? "D-FT-28" : "D-FT-21";
    const payload = { expediente: selectedExp.expediente_code, title: selectedExp.title, office: selectedExp.organizational_units?.name, series: seriesName, subseries: subseriesName, trd_code: canonicalCode, folder: currentFolder?.folder_number, box: currentBox?.box_number, folios_from: folioRange.from, folios_to: folioRange.to, phase: currentBox?.phase || selectedExp.phase, code };
    try { await recordLabel(form, kind === "folder" ? "archive_folder" : "archive_box", entity.id, payload); } catch (e: any) { return fail(e.message || "No fue posible registrar la impresión."); }
    const w = window.open("", "_blank", "width=940,height=760");
    if (!w) return fail("El navegador bloqueó la ventana de impresión.");
    w.document.write(`<!doctype html><html><head><title>${form} · ${title}</title><style>body{font-family:Arial,sans-serif;background:#f4f6f9;padding:28px;color:#071b33}.label{width:760px;margin:auto;background:#fff;border:2px solid #071b33;border-radius:18px;overflow:hidden}.head{background:#071b33;color:white;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}.head b{font-size:20px}.head span{color:#f5c518;font-weight:900}.body{padding:24px}.title{font-size:22px;font-weight:900;margin-bottom:4px}.sub{font-size:12px;color:#607086;margin-bottom:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cell{border:1px solid #e4e9ef;border-radius:10px;padding:10px}.cell small{display:block;color:#7b899b;font-size:9px}.cell b{display:block;margin-top:3px;font-size:12px}.code{margin-top:18px;background:#fff7cf;border:1px solid #efd25b;border-radius:12px;padding:14px;text-align:center;font-family:monospace;font-size:20px;font-weight:900;letter-spacing:1px}@media print{body{background:#fff;padding:0}.label{width:100%;box-shadow:none}button{display:none}}</style></head><body><div class="label"><div class="head"><div><b>ELECTROINGENIERÍA S.A.S.</b><div>Sistema de Gestión Documental</div></div><span>${form}</span></div><div class="body"><div class="title">${title}</div><div class="sub">${safe(selectedExp.expediente_code)} · ${safe(selectedExp.title)}</div><div class="grid"><div class="cell"><small>DEPENDENCIA</small><b>${safe(selectedExp.organizational_units?.name)}</b></div><div class="cell"><small>CÓDIGO TRD</small><b>${safe(canonicalCode)}</b></div><div class="cell"><small>SERIE</small><b>${safe(seriesName)}</b></div><div class="cell"><small>SUBSERIE</small><b>${safe(subseriesName)}</b></div><div class="cell"><small>FOLIOS</small><b>${safe(folioRange.from)} – ${safe(folioRange.to)}</b></div><div class="cell"><small>FASE</small><b>${safe(currentBox?.phase || selectedExp.phase)}</b></div></div><div class="code">${safe(code)}</div></div></div><br><div style="text-align:center"><button onclick="window.print()">Imprimir rótulo</button></div></body></html>`);
    w.document.close(); notify("Rótulo generado y registrado en auditoría."); await loadSelected();
  }

  if (loading) return <main className="dw-boot"><style>{CSS}</style><div>GD</div><span/><b>Preparando el proceso documental…</b></main>;
  if (!profile) return null;

  return <main className="dw-shell">
    <style>{CSS}</style>
    <header className="dw-top">
      <Link href="/" className="dw-brand"><span>GD</span><div><b>SGDEA</b><small>ELECTROINGENIERÍA S.A.S.</small></div></Link>
      <nav><Link href="/procesos">Procesos</Link><Link href="/trd">TRD</Link><Link href="/gestion">Gestión</Link></nav>
      <div className="dw-profile"><span>{(profile.full_name || profile.email || "US").slice(0,2).toUpperCase()}</span><div><b>{profile.full_name || profile.email}</b><small>Proceso · Organización documental</small></div></div>
    </header>

    <section className="dw-head">
      <div><span className="dw-eyebrow">PROCESO DOCUMENTAL · FLUJO GUIADO</span><h1>Organización documental</h1><p>Un solo recorrido para clasificar, registrar, inventariar, organizar físicamente y rotular. Los formatos se generan como parte del proceso, no como archivos independientes.</p></div>
      <div className="dw-progress-card"><div><span>Avance del expediente</span><b>{progress}%</b></div><div className="dw-progress"><i style={{width:`${progress}%`}}/></div><small>{Object.values(status).filter(Boolean).length} de {STEPS.length} controles completados</small></div>
    </section>

    {message && <div className="dw-toast ok">✓ {message}</div>}{error && <div className="dw-toast err">! {error}</div>}

    <section className="dw-stepper">{STEPS.map((s, i) => <button key={s.key} onClick={() => setStep(s.key)} className={`${step === s.key ? "active" : ""} ${status[s.key] ? "done" : ""}`}><span>{status[s.key] ? "✓" : s.no}</span><div><b>{s.title}</b><small>{s.form || (i === 0 ? "Punto de partida" : i === STEPS.length-1 ? "Control" : "Proceso")}</small></div><i>→</i></button>)}</section>

    <section className="dw-layout">
      <aside className="dw-left">
        <div className="dw-panel-title"><span>EXPEDIENTE ACTIVO</span>{selectedExp && <button onClick={() => {setSelectedExpId("");setStep("expediente")}}>Cambiar</button>}</div>
        {!selectedExp ? <div className="dw-exp-picker"><div className="dw-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar código, título o dependencia…" /></div><div className="dw-exp-list">{expVisible.map(x => <button key={x.id} onClick={()=>{setSelectedExpId(x.id);setStep("control")}}><span>{x.expediente_code}</span><b>{x.title}</b><small>{x.organizational_units?.name || "Sin dependencia"}</small><i>→</i></button>)}</div></div> : <>
          <div className="dw-exp-card"><span className="dw-chip">{selectedExp.status}</span><b>{selectedExp.expediente_code}</b><h3>{selectedExp.title}</h3><p>{selectedExp.organizational_units?.name}</p><div><small>Fase</small><strong>{selectedExp.phase}</strong></div></div>
          <div className="dw-mini-nav">{STEPS.slice(1).map(s => <button key={s.key} onClick={()=>setStep(s.key)} className={step===s.key?"active":""}><span>{status[s.key]?"✓":s.no}</span><div><b>{s.title}</b><small>{status[s.key]?"Completado":"Pendiente"}</small></div></button>)}</div>
        </>}
      </aside>

      <section className="dw-work">
        {step === "expediente" && <WelcomeStep selected={selectedExp} onContinue={()=>selectedExp?setStep("control"):null} />}
        {step === "control" && <ControlStep selected={selectedExp} allowedTypes={allowedTypes} rows={control} saving={saving} onSubmit={saveControl} onNext={nextStep} />}
        {step === "fuid" && <FuidStep selected={selectedExp} trd={selectedTrd} lineage={{seriesName,subseriesName,canonicalCode}} rows={fuid} dates={dateRange} folios={folioRange} saving={saving} onSubmit={saveFuid} onNext={nextStep} />}
        {step === "carpeta" && <FolderStep selected={selectedExp} folder={currentFolder} folios={folioRange} saving={saving} onSubmit={saveFolder} onNext={nextStep} />}
        {step === "caja" && <BoxStep selected={selectedExp} folder={currentFolder} box={currentBox} saving={saving} onSubmit={saveBox} onNext={nextStep} />}
        {step === "sticker" && <StickerStep selected={selectedExp} folder={currentFolder} box={currentBox} labels={relevantLabels} onPrint={printLabel} onNext={nextStep} />}
        {step === "revision" && <ReviewStep selected={selectedExp} status={status} control={control} fuid={fuid} folder={currentFolder} box={currentBox} labels={relevantLabels} />}
      </section>

      <aside className="dw-context">
        <div className="dw-context-head"><span>CONTEXTO HEREDADO</span><b>TRD</b></div>
        {selectedExp && selectedTrd ? <>
          <div className="dw-context-ok"><span>✓</span><div><b>Clasificación bloqueada</b><small>Los pasos siguientes reutilizan esta información.</small></div></div>
          <Context label="Dependencia" value={selectedExp.organizational_units?.name}/><Context label="Serie" value={seriesName}/><Context label="Subserie" value={subseriesName}/><Context label="Código" value={canonicalCode} mono/><Context label="Soporte" value={selectedTrd.support_format}/>
          <div className="dw-ret"><div><small>Archivo de gestión</small><b>{safe(selectedTrd.retention_management_raw)}</b></div><span>→</span><div><small>Archivo central</small><b>{safe(selectedTrd.retention_central_raw)}</b></div></div>
          <div className="dw-disposition"><span>{safe(selectedTrd.disposition)}</span><div><small>Disposición final</small><b>{dispositionName(selectedTrd.disposition)}</b></div></div>
          {selectedTrd.requires_valuation && <div className="dw-warning">⚠ Esta clasificación requiere valoración/revisión según la TRD cargada.</div>}
        </> : <div className="dw-context-empty"><span>TRD</span><p>Selecciona un expediente para ver la clasificación que gobernará todo el flujo.</p></div>}
        <div className="dw-audit-note"><b>Principio de trazabilidad</b><p>El usuario no vuelve a escribir dependencia, serie, subserie o código TRD en cada formato. El sistema los hereda del expediente.</p></div>
      </aside>
    </section>
  </main>;
}

function Context({label,value,mono}:{label:string;value:any;mono?:boolean}) { return <div className="dw-context-row"><small>{label}</small><b className={mono?"mono":""}>{safe(value)}</b></div> }
function dispositionName(v:any){return ({CT:"Conservación total",E:"Eliminación",S:"Selección",M:"Reproducción técnica",pending:"Pendiente"} as Record<string,string>)[String(v)]||safe(v)}

function StepHead({kicker,title,desc,form}:{kicker:string;title:string;desc:string;form?:string}){return <div className="dw-step-head"><div><span>{kicker}</span><h2>{title}</h2><p>{desc}</p></div>{form&&<b>{form}</b>}</div>}
function Bottom({onNext,label="Guardar y continuar",disabled=false}:{onNext?:()=>void;label?:string;disabled?:boolean}){return <div className="dw-bottom"><span>Los cambios quedan vinculados al expediente y registrados en Supabase.</span>{onNext&&<button type="button" onClick={onNext} disabled={disabled}>{label} →</button>}</div>}

function WelcomeStep({selected,onContinue}:{selected:Row|null;onContinue:()=>void|null}){return <div className="dw-step-card"><StepHead kicker="PASO 01" title="Define el expediente de trabajo" desc="El expediente es la raíz del proceso. De él se heredan dependencia, TRD, serie/subserie, retención y disposición."/><div className="dw-welcome-grid"><article><span>01</span><b>Selecciona</b><p>Busca por código, título o dependencia desde el panel izquierdo.</p></article><article><span>02</span><b>Verifica</b><p>Comprueba a la derecha la clasificación TRD heredada.</p></article><article><span>03</span><b>Continúa</b><p>Desde aquí los formatos se alimentan del mismo expediente.</p></article></div>{selected?<Bottom onNext={onContinue as ()=>void} label="Comenzar organización"/>:<div className="dw-callout">Selecciona un expediente en la columna izquierda para comenzar.</div>}</div>}

function ControlStep({selected,allowedTypes,rows,saving,onSubmit,onNext}:{selected:Row|null;allowedTypes:Row[];rows:Row[];saving:boolean;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;onNext:()=>void}){return <div className="dw-step-card"><StepHead kicker="PASO 02 · REGISTRO" title="Incorpora los documentos al expediente" desc="Solo aparecen tipos documentales permitidos por la TRD del expediente. Cada registro alimenta la Hoja de control." form="D-FT-19"/>{!selected?<NeedExp/>:<><form className="dw-form" onSubmit={onSubmit}><label className="span2"><span>Tipo documental permitido</span><select name="trd_document_type_id" required defaultValue=""><option value="">Seleccionar tipo documental…</option>{allowedTypes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><small>La lista está filtrada por la Serie/Subserie del expediente.</small></label><label><span>Fecha de ingreso</span><input type="date" name="entry_date" defaultValue={today()} required/></label><label><span>Folio inicial</span><input type="number" min="1" name="folio_from"/></label><label><span>Folio final</span><input type="number" min="1" name="folio_to"/></label><label className="span2"><span>Observaciones</span><textarea name="observations" rows={3} placeholder="Solo si existe una novedad documental…"/></label><div className="dw-form-actions span2"><button disabled={saving} className="primary">{saving?"Guardando…":"+ Incorporar documento"}</button></div></form><div className="dw-records"><div className="dw-records-head"><span>Hoja de control actual</span><b>{rows.length} registro(s)</b></div>{rows.length?rows.map((x,i)=><div className="dw-record" key={x.id}><span>{String(i+1).padStart(2,"0")}</span><div><b>{x.document_type_name}</b><small>{safe(x.entry_date)} · Folios {safe(x.folio_from)}–{safe(x.folio_to)}</small></div><i>✓ TRD</i></div>):<div className="dw-empty-row">Todavía no has incorporado documentos.</div>}</div><Bottom onNext={onNext} label="Continuar al inventario" disabled={!rows.length}/></>}</div>}

function FuidStep({selected,trd,lineage,rows,dates,folios,saving,onSubmit,onNext}:{selected:Row|null;trd:Row|null;lineage:any;rows:Row[];dates:any;folios:any;saving:boolean;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;onNext:()=>void}){return <div className="dw-step-card"><StepHead kicker="PASO 03 · INVENTARIO" title="Consolida el inventario documental" desc="El sistema propone fechas extremas, folios y clasificación desde el expediente y su Hoja de control. Tú completas únicamente el contexto operativo." form="D-FT-18"/>{!selected?<NeedExp/>:<><div className="dw-derived"><div><small>Clasificación</small><b>{lineage.seriesName}{lineage.subseriesName!=="—"?` / ${lineage.subseriesName}`:""}</b></div><div><small>Fechas extremas</small><b>{dates.initial} → {dates.final}</b></div><div><small>Folios detectados</small><b>{safe(folios.from)} → {safe(folios.to)}</b></div><div><small>Soporte TRD</small><b>{safe(trd?.support_format)}</b></div></div><form className="dw-form" onSubmit={onSubmit}><label className="span2"><span>Descripción / asunto del inventario</span><textarea name="description" rows={3} defaultValue={selected.title}/></label><label><span>Frecuencia de consulta</span><select name="consultation_frequency" defaultValue="Media"><option>Baja</option><option>Media</option><option>Alta</option><option>Permanente</option></select></label><label><span>Ubicación / referencia</span><input name="location_name" placeholder="Ej. Archivo de gestión · módulo 2"/></label><label className="span2"><span>Notas</span><textarea name="notes" rows={2} placeholder="Observaciones complementarias…"/></label><div className="dw-form-actions span2"><button className="primary" disabled={saving}>{saving?"Generando…":"Generar registro de inventario"}</button></div></form>{rows[0]&&<div className="dw-success-card"><span>✓</span><div><b>Inventario operativo generado</b><small>{rows[0].series_subseries_or_matter} · {rows[0].trd_code}</small></div></div>}<Bottom onNext={onNext} label="Continuar a carpeta" disabled={!rows.length}/></>}</div>}

function FolderStep({selected,folder,folios,saving,onSubmit,onNext}:{selected:Row|null;folder:Row|null;folios:any;saving:boolean;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;onNext:()=>void}){return <div className="dw-step-card"><StepHead kicker="PASO 04 · ORGANIZACIÓN FÍSICA" title="Prepara la carpeta documental" desc="Define únicamente los datos físicos que no existen todavía. El rótulo reutilizará el expediente y la TRD." form="D-FT-20"/>{!selected?<NeedExp/>:<><form className="dw-form" onSubmit={onSubmit}><label><span>Número de carpeta</span><input name="folder_number" required defaultValue={folder?.folder_number||"1"}/></label><label><span>Tomo</span><input name="tomo" defaultValue={folder?.tomo||"1"}/></label><label><span>Folio inicial</span><input type="number" name="initial_folio" defaultValue={folder?.initial_folio||folios.from||""}/></label><label><span>Folio final</span><input type="number" name="final_folio" defaultValue={folder?.final_folio||folios.to||""}/></label><label><span>Ubicación física</span><input name="location_code" defaultValue={folder?.location_code||""} placeholder="Ej. EST-02-BAL-03"/></label><label><span>Estado físico</span><select name="physical_condition" defaultValue={folder?.physical_condition||"Bueno"}><option>Bueno</option><option>Regular</option><option>Requiere intervención</option></select></label><div className="dw-form-actions span2"><button className="primary" disabled={saving}>{saving?"Guardando…":folder?"Actualizar carpeta":"Crear carpeta"}</button></div></form>{folder&&<div className="dw-success-card"><span>✓</span><div><b>{folder.inventory_code}</b><small>Carpeta {safe(folder.folder_number)} · Tomo {safe(folder.tomo)} · Folios {safe(folder.initial_folio)}–{safe(folder.final_folio)}</small></div></div>}<Bottom onNext={onNext} label="Continuar a caja" disabled={!folder}/></>}</div>}

function BoxStep({selected,folder,box,saving,onSubmit,onNext}:{selected:Row|null;folder:Row|null;box:Row|null;saving:boolean;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;onNext:()=>void}){return <div className="dw-step-card"><StepHead kicker="PASO 05 · UBICACIÓN" title="Asigna la carpeta a una caja" desc="Puedes reutilizar una caja existente indicando su número y fase o crear una nueva automáticamente." form="D-FT-21 / D-FT-28"/>{!selected?<NeedExp/>:!folder?<div className="dw-callout">Primero debes completar el paso de carpeta.</div>:<><form className="dw-form" onSubmit={onSubmit}><label><span>Fase de archivo</span><select name="phase" defaultValue={box?.phase||"central"}><option value="management">Archivo de gestión</option><option value="central">Archivo central</option><option value="historical">Archivo histórico</option></select></label><label><span>Número de caja</span><input name="box_number" required defaultValue={box?.box_number||""} placeholder="Ej. 014"/></label><div className="dw-form-actions span2"><button className="primary" disabled={saving}>{saving?"Asignando…":box?"Actualizar asignación":"Asignar caja"}</button></div></form>{box&&<div className="dw-box-visual"><div><span>CAJA</span><b>{box.box_number}</b></div><section><small>Fase</small><strong>{box.phase}</strong><small>Identificador</small><strong>{box.qr_code}</strong></section></div>}<Bottom onNext={onNext} label="Continuar a rótulo" disabled={!box}/></>}</div>}

function StickerStep({selected,folder,box,labels,onPrint,onNext}:{selected:Row|null;folder:Row|null;box:Row|null;labels:Row[];onPrint:(k:"folder"|"box")=>void;onNext:()=>void}){return <div className="dw-step-card"><StepHead kicker="PASO 06 · IDENTIFICACIÓN" title="Genera los rótulos desde lo ya registrado" desc="No vuelves a digitar dependencia, serie, subserie, expediente o folios. El sistema los toma del proceso."/>{!selected?<NeedExp/>:<><div className="dw-label-choice"><button disabled={!folder} onClick={()=>onPrint("folder")}><span>D-FT-20</span><b>Rótulo de carpeta</b><small>{folder?`Carpeta ${folder.folder_number} · ${folder.inventory_code}`:"Completa primero la carpeta"}</small><i>Generar e imprimir →</i></button><button disabled={!box} onClick={()=>onPrint("box")}><span>{box?.phase==="historical"?"D-FT-28":"D-FT-21"}</span><b>Rótulo de caja</b><small>{box?`Caja ${box.box_number} · ${box.phase}`:"Completa primero la caja"}</small><i>Generar e imprimir →</i></button></div><div className="dw-evidence"><span>Historial de rótulos</span><b>{labels.length}</b>{labels.slice(0,4).map(x=><p key={x.id}><strong>{x.label_type}</strong><small>{new Date(x.printed_at).toLocaleString("es-CO")}</small></p>)}</div><Bottom onNext={onNext} label="Ir a revisión final" disabled={!labels.length}/></>}</div>}

function ReviewStep({selected,status,control,fuid,folder,box,labels}:{selected:Row|null;status:Record<StepKey,boolean>;control:Row[];fuid:Row[];folder:Row|null;box:Row|null;labels:Row[]}){return <div className="dw-step-card"><StepHead kicker="PASO 07 · CONTROL" title="Revisión de organización documental" desc="Comprueba que el expediente tiene una cadena de trazabilidad completa antes de continuar a transferencia o retención."/>{!selected?<NeedExp/>:<><div className="dw-review"><Review ok={status.expediente} title="Expediente clasificado" detail={selected.expediente_code}/><Review ok={status.control} title="Hoja de control" detail={`${control.length} documento(s) registrados`}/><Review ok={status.fuid} title="Inventario FUID" detail={`${fuid.length} registro(s) operativo(s)`}/><Review ok={status.carpeta} title="Carpeta" detail={folder?folder.inventory_code:"Pendiente"}/><Review ok={status.caja} title="Caja" detail={box?`Caja ${box.box_number} · ${box.phase}`:"Pendiente"}/><Review ok={status.sticker} title="Rótulos" detail={`${labels.length} impresión(es) registrada(s)`}/></div>{status.revision?<div className="dw-finish"><span>✓</span><div><b>Expediente organizado</b><p>La clasificación y los registros operativos están conectados. Ya puede continuar a transferencia documental cuando corresponda.</p><Link href="/procesos">Volver a procesos →</Link></div></div>:<div className="dw-callout">Completa los pasos pendientes antes de finalizar la organización.</div>}</>}</div>}
function Review({ok,title,detail}:{ok:boolean;title:string;detail:string}){return <div className={ok?"ok":"pending"}><span>{ok?"✓":"·"}</span><div><b>{title}</b><small>{detail}</small></div><i>{ok?"Listo":"Pendiente"}</i></div>}
function NeedExp(){return <div className="dw-callout">Selecciona primero un expediente desde el panel izquierdo.</div>}

const CSS = `
:root{--n:#071b33;--n2:#0b2d52;--n3:#124472;--y:#f5c518;--ys:#fff5c7;--ink:#142033;--mut:#6e7b8d;--line:#e3e8ef;--bg:#f3f6fa;--white:#fff;--shadow:0 14px 45px rgba(7,27,51,.08)}*{box-sizing:border-box}.dw-shell{min-height:100vh;background:radial-gradient(circle at 92% 4%,rgba(245,197,24,.11),transparent 24%),var(--bg);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink)}.dw-top{height:74px;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);border-bottom:1px solid var(--line);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 28px;position:sticky;top:0;z-index:80}.dw-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--n)}.dw-brand>span{width:38px;height:38px;border-radius:12px;background:var(--n);color:var(--y);display:grid;place-items:center;font-weight:950;box-shadow:0 9px 22px rgba(7,27,51,.19)}.dw-brand b{display:block;font-size:12px}.dw-brand small{display:block;font-size:8px;color:var(--mut);letter-spacing:.08em;margin-top:2px}.dw-top nav{display:flex;background:#eef2f6;border-radius:12px;padding:4px;gap:2px}.dw-top nav a{font-size:9px;font-weight:850;text-decoration:none;color:#657488;padding:8px 12px;border-radius:9px}.dw-top nav a:first-child{background:#fff;color:var(--n);box-shadow:0 2px 8px rgba(7,27,51,.06)}.dw-profile{justify-self:end;display:flex;align-items:center;gap:9px}.dw-profile>span{width:34px;height:34px;border-radius:10px;background:var(--y);color:var(--n);display:grid;place-items:center;font-size:9px;font-weight:950}.dw-profile b{display:block;font-size:9px}.dw-profile small{display:block;color:var(--mut);font-size:7.5px;margin-top:2px}.dw-head{margin:24px 28px 14px;background:linear-gradient(135deg,var(--n),var(--n2) 68%,#164f84);border-radius:22px;padding:31px 34px;color:#fff;display:grid;grid-template-columns:1fr 320px;gap:28px;box-shadow:0 22px 60px rgba(7,27,51,.16);position:relative;overflow:hidden}.dw-head:after{content:"";position:absolute;width:330px;height:330px;border-radius:50%;border:1px solid rgba(245,197,24,.17);right:-150px;top:-170px;box-shadow:0 0 0 55px rgba(245,197,24,.035),0 0 0 105px rgba(245,197,24,.02)}.dw-head>div{position:relative;z-index:2}.dw-eyebrow{font-size:8px;letter-spacing:.17em;color:#abc0d4;font-weight:900}.dw-head h1{font-size:31px;letter-spacing:-.035em;margin:8px 0}.dw-head p{font-size:11px;line-height:1.6;color:#c7d4e1;max-width:790px;margin:0}.dw-progress-card{align-self:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:15px;padding:17px;backdrop-filter:blur(8px)}.dw-progress-card>div:first-child{display:flex;justify-content:space-between;align-items:end}.dw-progress-card span{font-size:8px;color:#aebfd0;font-weight:800}.dw-progress-card b{font-size:22px;color:var(--y)}.dw-progress{height:7px;background:rgba(255,255,255,.11);border-radius:10px;margin:10px 0 8px;overflow:hidden}.dw-progress i{display:block;height:100%;background:var(--y);border-radius:10px;transition:width .35s cubic-bezier(.22,1,.36,1)}.dw-progress-card small{font-size:7.5px;color:#9fb3c6}.dw-toast{margin:0 28px 10px;border-radius:11px;padding:10px 13px;font-size:9px;font-weight:750}.dw-toast.ok{background:#eaf8f1;color:#17694b;border:1px solid #bfe6d2}.dw-toast.err{background:#fff0ee;color:#9a392f;border:1px solid #efc6c1}.dw-stepper{margin:0 28px 12px;background:#fff;border:1px solid var(--line);border-radius:17px;padding:7px;display:grid;grid-template-columns:repeat(7,1fr);gap:4px;box-shadow:0 10px 30px rgba(7,27,51,.04)}.dw-stepper button{border:0;background:transparent;border-radius:11px;padding:9px;display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:7px;text-align:left;color:var(--ink);cursor:pointer;transition:.18s ease}.dw-stepper button:hover{background:#f6f8fb;transform:translateY(-1px)}.dw-stepper button.active{background:var(--n);color:#fff;box-shadow:0 9px 24px rgba(7,27,51,.16)}.dw-stepper button>span{width:25px;height:25px;border-radius:8px;background:#edf1f5;color:#718095;display:grid;place-items:center;font-size:7.5px;font-weight:950}.dw-stepper button.done>span{background:var(--ys);color:#806100}.dw-stepper button.active>span{background:var(--y);color:var(--n)}.dw-stepper b{display:block;font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dw-stepper small{display:block;font-size:6.5px;color:#8a97a6;margin-top:2px;white-space:nowrap}.dw-stepper button.active small{color:#99aec2}.dw-stepper i{font-style:normal;color:#b5c0cb;font-size:10px}.dw-stepper button.active i{color:var(--y)}.dw-layout{margin:0 28px 30px;display:grid;grid-template-columns:245px minmax(480px,1fr) 290px;gap:12px;align-items:start}.dw-left,.dw-work,.dw-context{background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);overflow:hidden}.dw-left,.dw-context{position:sticky;top:98px;max-height:calc(100vh - 118px);overflow:auto}.dw-panel-title,.dw-context-head{height:48px;padding:0 14px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.dw-panel-title>span,.dw-context-head>span{font-size:7px;letter-spacing:.14em;color:#8996a6;font-weight:950}.dw-panel-title button{border:0;background:#f0f3f6;color:#657486;border-radius:8px;padding:6px 8px;font-size:7px;font-weight:850;cursor:pointer}.dw-context-head>b{width:30px;height:25px;border-radius:8px;background:var(--n);color:var(--y);display:grid;place-items:center;font-size:7px}.dw-exp-picker{padding:9px}.dw-search{height:40px;border:1px solid var(--line);border-radius:11px;display:flex;align-items:center;padding:0 10px}.dw-search:focus-within{border-color:#a9bbca;box-shadow:0 0 0 4px rgba(11,45,82,.05)}.dw-search span{color:#8291a2}.dw-search input{width:100%;border:0;outline:0;padding:0 7px;font-size:8px}.dw-exp-list{margin-top:7px;max-height:570px;overflow:auto}.dw-exp-list button{width:100%;border:0;background:transparent;text-align:left;padding:10px;border-radius:11px;position:relative;cursor:pointer;transition:.15s ease}.dw-exp-list button:hover{background:#f5f7fa;transform:translateX(2px)}.dw-exp-list span{display:block;font-size:7px;color:#78879a;font-family:ui-monospace,monospace}.dw-exp-list b{display:block;font-size:8.5px;margin-top:3px;padding-right:16px}.dw-exp-list small{display:block;font-size:7px;color:#8d99a8;margin-top:3px}.dw-exp-list i{position:absolute;right:9px;top:21px;font-style:normal;color:#aeb8c3}.dw-exp-card{margin:10px;background:linear-gradient(145deg,var(--n),var(--n2));border-radius:14px;padding:15px;color:#fff}.dw-chip{display:inline-block;background:rgba(245,197,24,.18);color:#ffe273;border:1px solid rgba(245,197,24,.28);border-radius:999px;padding:5px 7px;font-size:6.5px;text-transform:uppercase;font-weight:900}.dw-exp-card>b{display:block;font-size:8px;color:#a9bdcf;margin-top:12px;font-family:ui-monospace,monospace}.dw-exp-card h3{font-size:13px;line-height:1.25;margin:5px 0 4px}.dw-exp-card p{font-size:7.5px;color:#9eb2c5;margin:0 0 14px}.dw-exp-card>div{border-top:1px solid rgba(255,255,255,.1);padding-top:10px}.dw-exp-card small{display:block;font-size:6.5px;color:#87a1b8}.dw-exp-card strong{font-size:8px}.dw-mini-nav{padding:0 8px 8px}.dw-mini-nav button{width:100%;border:0;background:transparent;border-radius:10px;padding:8px;display:flex;align-items:center;gap:8px;text-align:left;cursor:pointer}.dw-mini-nav button:hover,.dw-mini-nav button.active{background:#f4f7fa}.dw-mini-nav button>span{width:24px;height:24px;border-radius:8px;background:#eef2f5;color:#6f7d8e;display:grid;place-items:center;font-size:7px;font-weight:900}.dw-mini-nav button.active>span{background:var(--y);color:var(--n)}.dw-mini-nav b{display:block;font-size:8px}.dw-mini-nav small{display:block;font-size:6.5px;color:#8e9aa8}.dw-work{min-height:650px}.dw-step-card{min-height:650px;display:flex;flex-direction:column}.dw-step-head{padding:22px 24px 18px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:20px}.dw-step-head span{font-size:7px;letter-spacing:.14em;color:#8190a1;font-weight:950}.dw-step-head h2{font-size:20px;color:var(--n);letter-spacing:-.025em;margin:6px 0}.dw-step-head p{font-size:9px;line-height:1.55;color:#718094;max-width:680px;margin:0}.dw-step-head>b{align-self:flex-start;background:var(--ys);color:#755b00;border:1px solid #f0db7c;padding:7px 9px;border-radius:9px;font-size:7px}.dw-form{padding:20px 24px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.dw-form label{display:block}.dw-form label>span{display:block;font-size:7.5px;font-weight:850;color:#4c5b6d;margin-bottom:6px}.dw-form input,.dw-form select,.dw-form textarea{width:100%;border:1px solid var(--line);border-radius:11px;background:#fbfcfd;color:var(--ink);font:inherit;font-size:9px;padding:10px 11px;outline:0;transition:.16s ease}.dw-form input,.dw-form select{height:39px}.dw-form textarea{resize:vertical}.dw-form input:focus,.dw-form select:focus,.dw-form textarea:focus{border-color:#a9baca;background:#fff;box-shadow:0 0 0 4px rgba(11,45,82,.05)}.dw-form label>small{display:block;color:#8b98a8;font-size:6.5px;margin-top:5px}.span2{grid-column:span 2}.dw-form-actions{display:flex;justify-content:flex-end}.dw-form-actions button,.dw-bottom button{border:0;background:var(--n);color:#fff;border-radius:10px;padding:10px 14px;font-size:8px;font-weight:900;cursor:pointer;box-shadow:0 8px 20px rgba(7,27,51,.16);transition:.16s ease}.dw-form-actions button:hover,.dw-bottom button:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(7,27,51,.2)}.dw-form-actions button:disabled,.dw-bottom button:disabled{opacity:.45;cursor:not-allowed;transform:none}.dw-records{margin:0 24px 18px;border:1px solid var(--line);border-radius:13px;overflow:hidden}.dw-records-head{padding:10px 12px;background:#f7f9fb;display:flex;justify-content:space-between}.dw-records-head span,.dw-records-head b{font-size:7px;color:#718095}.dw-record{display:grid;grid-template-columns:27px 1fr auto;align-items:center;gap:9px;padding:9px 11px;border-top:1px solid #edf0f3}.dw-record>span{width:25px;height:25px;border-radius:8px;background:#eef3f8;color:var(--n2);display:grid;place-items:center;font-size:7px;font-weight:900}.dw-record b{display:block;font-size:8px}.dw-record small{display:block;font-size:6.5px;color:#8b98a7;margin-top:2px}.dw-record i{font-style:normal;font-size:6.5px;color:#317a5c;background:#eaf8f1;border-radius:999px;padding:5px 7px}.dw-empty-row{padding:18px;text-align:center;color:#8d99a7;font-size:8px}.dw-bottom{margin-top:auto;border-top:1px solid var(--line);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:#fbfcfd}.dw-bottom>span{font-size:7px;color:#8c99a8}.dw-derived{margin:18px 24px 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.dw-derived>div{background:#f6f8fa;border:1px solid #ebeff3;border-radius:11px;padding:10px}.dw-derived small{display:block;font-size:6.5px;color:#8996a5}.dw-derived b{display:block;font-size:8px;color:#344357;margin-top:4px;line-height:1.35}.dw-success-card{margin:0 24px 18px;background:#eef9f4;border:1px solid #c9ead8;border-radius:12px;padding:11px;display:flex;gap:10px;align-items:center}.dw-success-card>span{width:28px;height:28px;border-radius:9px;background:#2f8a64;color:#fff;display:grid;place-items:center;font-weight:900}.dw-success-card b{display:block;font-size:8px}.dw-success-card small{display:block;color:#668276;font-size:6.5px;margin-top:3px}.dw-box-visual{margin:0 24px 18px;border:1px solid #d9e2ea;border-radius:14px;display:grid;grid-template-columns:140px 1fr;overflow:hidden}.dw-box-visual>div{background:var(--n);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px}.dw-box-visual span{font-size:7px;color:#a7bbcd}.dw-box-visual>div b{font-size:30px;color:var(--y)}.dw-box-visual section{padding:15px}.dw-box-visual small{display:block;font-size:6.5px;color:#8b98a7;margin-top:5px}.dw-box-visual strong{display:block;font-size:8px;margin-top:2px}.dw-label-choice{padding:22px 24px;display:grid;grid-template-columns:1fr 1fr;gap:12px}.dw-label-choice button{border:1px solid var(--line);background:#fff;border-radius:15px;padding:18px;text-align:left;cursor:pointer;transition:.18s ease;box-shadow:0 8px 22px rgba(7,27,51,.04)}.dw-label-choice button:hover:not(:disabled){transform:translateY(-3px);box-shadow:0 16px 34px rgba(7,27,51,.09);border-color:#cdd8e3}.dw-label-choice button:disabled{opacity:.42;cursor:not-allowed}.dw-label-choice span{display:inline-block;background:var(--ys);color:#775d00;border-radius:7px;padding:5px 7px;font-size:6.5px;font-weight:900}.dw-label-choice b{display:block;font-size:13px;color:var(--n);margin:13px 0 4px}.dw-label-choice small{display:block;color:#7d8b9b;font-size:7px;min-height:28px}.dw-label-choice i{display:block;font-style:normal;color:var(--n2);font-size:7.5px;font-weight:900;margin-top:14px}.dw-evidence{margin:0 24px 18px;border:1px solid var(--line);border-radius:12px;padding:12px}.dw-evidence>span{font-size:7px;color:#7e8c9c}.dw-evidence>b{float:right;font-size:9px}.dw-evidence p{margin:8px 0 0;padding-top:8px;border-top:1px solid #edf0f3;display:flex;justify-content:space-between}.dw-evidence strong,.dw-evidence small{font-size:7px}.dw-evidence small{color:#8c99a8}.dw-review{padding:20px 24px;display:grid;grid-template-columns:1fr 1fr;gap:9px}.dw-review>div{border:1px solid var(--line);border-radius:12px;padding:11px;display:grid;grid-template-columns:28px 1fr auto;gap:9px;align-items:center}.dw-review>div.ok{background:#f1faf6;border-color:#d1ebde}.dw-review>div>span{width:27px;height:27px;border-radius:9px;background:#edf1f5;color:#7f8d9c;display:grid;place-items:center;font-weight:900}.dw-review>div.ok>span{background:#2f8a64;color:#fff}.dw-review b{display:block;font-size:8px}.dw-review small{display:block;font-size:6.5px;color:#8996a5;margin-top:2px}.dw-review i{font-style:normal;font-size:6.5px;color:#8592a0}.dw-review .ok i{color:#2f805f}.dw-finish{margin:0 24px 22px;background:linear-gradient(135deg,var(--n),var(--n2));color:#fff;border-radius:16px;padding:20px;display:flex;gap:14px}.dw-finish>span{width:42px;height:42px;border-radius:13px;background:var(--y);color:var(--n);display:grid;place-items:center;font-size:19px;font-weight:950;flex:0 0 auto}.dw-finish b{font-size:14px}.dw-finish p{font-size:8px;line-height:1.5;color:#b6c8d8}.dw-finish a{font-size:8px;color:var(--y);font-weight:900;text-decoration:none}.dw-callout{margin:22px 24px;background:#fff8dc;border:1px solid #f0dc86;color:#725a08;border-radius:12px;padding:13px;font-size:8px}.dw-welcome-grid{padding:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.dw-welcome-grid article{border:1px solid var(--line);border-radius:14px;padding:16px}.dw-welcome-grid article>span{width:30px;height:30px;border-radius:9px;background:var(--n);color:var(--y);display:grid;place-items:center;font-size:7px;font-weight:950}.dw-welcome-grid b{display:block;margin-top:12px;font-size:10px;color:var(--n)}.dw-welcome-grid p{font-size:7.5px;color:#7c8998;line-height:1.5}.dw-context{padding-bottom:12px}.dw-context-ok{margin:10px;background:#eef9f4;border:1px solid #caead9;border-radius:11px;padding:10px;display:flex;gap:8px}.dw-context-ok>span{width:25px;height:25px;border-radius:8px;background:#2f8a64;color:#fff;display:grid;place-items:center;font-weight:900}.dw-context-ok b{display:block;font-size:7.5px}.dw-context-ok small{display:block;font-size:6.5px;color:#678275;margin-top:2px}.dw-context-row{padding:9px 12px;border-bottom:1px solid #edf0f3}.dw-context-row small{display:block;font-size:6.5px;color:#8c99a7}.dw-context-row b{display:block;font-size:8px;line-height:1.35;margin-top:3px}.dw-context-row b.mono{font-family:ui-monospace,monospace;color:var(--n2);font-size:7px}.dw-ret{margin:10px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:5px}.dw-ret>div{background:#f6f8fa;border-radius:9px;padding:8px}.dw-ret small{display:block;font-size:6px;color:#8b98a7}.dw-ret b{display:block;font-size:7.5px;margin-top:3px}.dw-ret>span{color:#9da9b5}.dw-disposition{margin:10px;display:flex;gap:9px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:9px}.dw-disposition>span{width:32px;height:32px;border-radius:9px;background:var(--n);color:var(--y);display:grid;place-items:center;font-size:7px;font-weight:950}.dw-disposition small{display:block;font-size:6px;color:#8c99a8}.dw-disposition b{display:block;font-size:7.5px;margin-top:2px}.dw-warning{margin:10px;background:#fff3df;border:1px solid #efcf96;border-radius:10px;padding:9px;font-size:7px;color:#8d5b13}.dw-context-empty{text-align:center;padding:35px 18px}.dw-context-empty>span{width:55px;height:55px;margin:auto;border-radius:16px;background:var(--n);color:var(--y);display:grid;place-items:center;font-size:9px;font-weight:950}.dw-context-empty p{font-size:7.5px;line-height:1.5;color:#8290a0}.dw-audit-note{margin:10px;background:var(--n);color:#fff;border-radius:11px;padding:11px}.dw-audit-note b{font-size:7.5px;color:var(--y)}.dw-audit-note p{font-size:6.8px;line-height:1.5;color:#afc2d3;margin:5px 0 0}.dw-boot{min-height:100vh;background:var(--n);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;font-family:system-ui}.dw-boot>div{width:66px;height:66px;border-radius:19px;background:var(--y);color:var(--n);display:grid;place-items:center;font-weight:950}.dw-boot>span{width:70px;height:3px;background:linear-gradient(90deg,transparent,var(--y),transparent);animation:load 1.1s infinite}.dw-boot b{font-size:9px;color:#b8c9d9}@keyframes load{0%{transform:translateX(-20px);opacity:.3}50%{opacity:1}100%{transform:translateX(20px);opacity:.3}}@media(max-width:1200px){.dw-layout{grid-template-columns:220px minmax(450px,1fr)}.dw-context{display:none}.dw-stepper{grid-template-columns:repeat(4,1fr)}}@media(max-width:850px){.dw-top{grid-template-columns:1fr auto;padding:0 14px}.dw-top nav{display:none}.dw-profile div{display:none}.dw-head{margin:14px;grid-template-columns:1fr;padding:24px}.dw-progress-card{display:none}.dw-stepper{margin:0 14px 10px;display:flex;overflow:auto}.dw-stepper button{min-width:150px}.dw-layout{margin:0 14px 20px;display:block}.dw-left{position:relative;top:auto;max-height:none;margin-bottom:10px}.dw-work{min-height:0}.dw-step-card{min-height:600px}.dw-derived{grid-template-columns:1fr 1fr}.dw-review{grid-template-columns:1fr}.dw-label-choice{grid-template-columns:1fr}.dw-welcome-grid{grid-template-columns:1fr}.dw-form{grid-template-columns:1fr}.span2{grid-column:span 1}}
`;
