"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (signError) {
      return setError(
        signError.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : signError.message,
      );
    }

    router.replace("/");
  }

  return (
    <main className="login-shell">
      <section className="login-brand">
        <div className="brand-mark">GD</div>
        <div>
          <span className="eyebrow">ELECTROINGENIERÍA S.A.S.</span>
          <h1>Gestión documental con trazabilidad de principio a fin.</h1>
          <p>
            TRD, expedientes, archivo físico y digital, FUID, transferencias,
            retención, aprobaciones, radicación y auditoría en un único SGDEA.
          </p>
        </div>
        <div className="login-points">
          <span>01 · TRD como motor de reglas</span>
          <span>02 · Expediente híbrido</span>
          <span>03 · Auditoría y retención automática</span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="brand-mark compact">GD</div>
          <h2>Ingresar al sistema</h2>
          <p className="muted">Acceso exclusivo para usuarios autorizados.</p>

          <label>
            Correo electrónico
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <div className="alert danger">{error}</div>}

          <button className="button primary full" disabled={loading}>
            {loading ? "Validando…" : "Ingresar"}
          </button>

          <small>Las acciones quedan registradas en la bitácora de auditoría.</small>
        </form>
      </section>
    </main>
  );
}
