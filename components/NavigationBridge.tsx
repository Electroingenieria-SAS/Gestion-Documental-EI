"use client";

import { useEffect } from "react";

const TARGETS: Record<string, string[]> = {
  dashboard: ["Tablero"],
  expedientes: ["Expedientes"],
  fuid: ["FUID / Inventario", "Inventario FUID"],
  radicacion: ["Radicación"],
  transferencias: ["Transferencias", "Transferencia documental"],
  archivo: ["Archivo físico"],
  retencion: ["Retención"],
  aprobaciones: ["Aprobaciones"],
  auditoria: ["Auditoría"],
  usuarios: ["Usuarios"],
  control: ["Hoja de control"],
  carpetas: ["Rótulo de carpetas"],
  cajas: ["Rótulos de cajas"],
  inicio: ["Centro de formatos"],
};

export default function NavigationBridge() {
  useEffect(() => {
    const target = window.location.hash.replace("#", "").trim().toLowerCase();
    if (target === "trd") {
      window.location.replace("/trd");
      return;
    }
    if (!target || !TARGETS[target]) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const buttons = Array.from(document.querySelectorAll(".sidebar nav button, .fw-side button")) as HTMLButtonElement[];
      const labels = TARGETS[target];
      const match = buttons.find((button) => labels.some((label) => (button.textContent || "").toLowerCase().includes(label.toLowerCase())));
      if (match) {
        match.click();
        window.clearInterval(timer);
        window.setTimeout(() => match.scrollIntoView({ block: "nearest", behavior: "smooth" }), 120);
      }
      if (tries > 60) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}
