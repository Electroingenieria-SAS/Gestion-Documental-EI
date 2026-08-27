# Despliegue rápido — SGDEA Electroingeniería

## 1. GitHub

1. Cree un repositorio nuevo, por ejemplo `Gestion-Documental-EI`.
2. Descomprima este ZIP.
3. Suba **el contenido de la carpeta** `gestion-documental-ei` a la raíz del repositorio.
4. Confirme que `package.json`, `app/`, `components/`, `lib/` y `vercel.json` queden en la raíz.

## 2. Vercel

1. En Vercel seleccione **Add New → Project**.
2. Importe el repositorio de GitHub recién creado.
3. Framework Preset: **Next.js**.
4. Root Directory: `./`.
5. Build Command: `npm run build`.
6. Install Command: `npm install --no-audit --no-fund`.
7. Deploy.

La aplicación ya tiene como fallback la URL y la publishable key del proyecto Supabase de Gestión Documental. La publishable key es pública por diseño y la autorización real se controla con RLS. No se incluye ninguna `service_role`.

## 3. Variables recomendadas en Vercel

Aunque el preview puede conectarse usando el fallback incluido, es recomendable crear estas variables en **Settings → Environment Variables**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://mzsymskdnuvkgnoekphd.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_LruFMAHSDCI58AQVRvB-_Q_GtcYYLML
```

Aplíquelas a Production, Preview y Development.

## 4. Después del deploy

Comparta la URL `*.vercel.app` en el chat. A partir de esa URL se pueden hacer las pruebas de producción y continuar con ajustes visuales y funcionales sin tocar el dominio definitivo.

## Importante

- No agregue claves `service_role` al frontend.
- No suba archivos `.env.local` con secretos.
- El proyecto usa Node.js 22+.
- La rama/repo puede mantenerse privado si lo prefiere.
