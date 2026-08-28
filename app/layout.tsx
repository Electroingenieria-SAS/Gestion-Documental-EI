import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./product.css";
import "./premium.css";
import "./premium-extras.css";
import "./work-premium.css";
import "./work-wow.css";
import "./dashboard-premium.css";
import "./system-wow.css";
import "./signature-25d.css";
import "./modules-refined.css";
import "./navigation-typography.css";

export const metadata: Metadata = {
  title: "SGDEA · Electroingeniería",
  description: "Sistema de Gestión Documental y Archivo de Electroingeniería S.A.S.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
