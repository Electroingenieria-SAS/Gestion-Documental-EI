# SGDEA — Gestión Documental Electroingeniería

Aplicación de gestión documental para ELECTROINGENIERÍA S.A.S. basada en **TRD PRINCIPAL.xlsm** como fuente maestra.

## Arquitectura

- Next.js 16.3.3 + React 19
- Supabase Auth, Postgres, RLS, Storage y Edge Functions
- Vercel para preview/producción
- GitHub para control de versiones

## Módulos

- TRD versionada: serie, subserie y tipo documental
- Expedientes físicos, digitales e híbridos
- Documentos, versiones e índice/hoja de control
- FUID e inventario documental
- Radicación de entrada, salida e interna
- Transferencias primarias y secundarias
- Archivo físico: cajas, carpetas, ubicación y rótulos
- Retención automática al cierre de expedientes
- Disposición final, legal hold, aprobaciones y tareas
- Usuarios, roles y acceso por dependencia
- Auditoría de operaciones

## Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Nunca coloque `service_role` o una secret key en variables `NEXT_PUBLIC_*`.

## Desarrollo

```bash
npm install
npm run dev
```

## Validación

```bash
npm run lint
npm run build
```

## Despliegue

El proyecto es compatible con Vercel y con hosting Node.js estándar. En Vercel, las variables anteriores pueden configurarse por entorno; la aplicación solo utiliza la publishable key en el cliente y toda autorización real se controla mediante RLS.

## Regla de negocio principal

La TRD es el motor normativo. FUID, hoja de control, rótulos, transferencias y vencimientos son salidas o controles derivados. Los registros marcados como `requires_valuation` no deben utilizarse para ejecutar una disposición final automática hasta su revisión y aprobación documental.
