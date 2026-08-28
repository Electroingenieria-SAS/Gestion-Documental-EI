"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAIL = "j.perez@ei.com.co";

type Mode = "login" | "activate";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setSuccess("");
    setPassword("");
    setActivationCode("");
    if (next === "activate") setEmail(ADMIN_EMAIL);
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

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

  async function submitActivation(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (password.length < 10) {
      setLoading(false);
      return setError("La contraseña definitiva debe tener mínimo 10 caracteres.");
    }

    const { data, error: functionError } = await supabase.functions.invoke(
      "activate-documental-admin",
      {
        body: {
          activation_code: activationCode.trim(),
          password,
        },
      },
    );

    if (functionError || !data?.ok) {
      setLoading(false);
      return setError(
        data?.error || functionError?.message || "No fue posible activar la cuenta administradora.",
      );
    }

    const { error: signError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });

    setLoading(false);
    if (signError) {
      setSuccess("La cuenta fue activada correctamente. Ya puedes ingresar con tu contraseña definitiva.");
      setMode("login");
      setEmail(ADMIN_EMAIL);
      setPassword("");
      return;
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
        {mode === "login" ? (
          <form className="login-card" onSubmit={submitLogin}>
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
            {success && <div className="alert">{success}</div>}

            <button className="button primary full" disabled={loading}>
              {loading ? "Validando…" : "Ingresar"}
            </button>
            <button
              type="button"
              className="button full"
              onClick={() => switchMode("activate")}
              disabled={loading}
            >
              Primera activación del administrador
            </button>
            <small>Las acciones quedan registradas en la bitácora de auditoría.</small>
          </form>
        ) : (
          <form className="login-card" onSubmit={submitActivation}>
            <div className="brand-mark compact">GD</div>
            <h2>Activar administrador</h2>
            <p className="muted">
              Esta operación es de un solo uso y deja la cuenta principal confirmada como super administrador.
            </p>

            <label>
              Cuenta administradora
              <input type="email" value={ADMIN_EMAIL} readOnly />
            </label>
            <label>
              Contraseña definitiva
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            <label>
              Código de activación
              <input
                type="password"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                autoComplete="off"
                required
              />
            </label>

            {error && <div className="alert danger">{error}</div>}

            <button className="button primary full" disabled={loading}>
              {loading ? "Activando…" : "Activar cuenta administradora"}
            </button>
            <button
              type="button"
              className="button full"
              onClick={() => switchMode("login")}
              disabled={loading}
            >
              Volver al ingreso
            </button>
            <small>El código de activación se invalida después del primer uso correcto.</small>
          </form>
        )}
      </section>
    </main>
  );
}
