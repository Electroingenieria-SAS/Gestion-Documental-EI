import Link from "next/link";
import DocumentManagementApp from "@/components/DocumentManagementApp";
import NavigationBridge from "@/components/NavigationBridge";

export default function GestionPage() {
  return <>
    <NavigationBridge />
    <DocumentManagementApp />
    <div style={{position:"fixed",right:18,bottom:18,zIndex:120,display:"flex",gap:8,fontFamily:"Arial,sans-serif"}}>
      <Link href="/" style={{background:"#fff",border:"1px solid #dce5e1",color:"#0b2d52",textDecoration:"none",fontSize:9,fontWeight:800,padding:"9px 12px",borderRadius:10,boxShadow:"0 8px 24px rgba(7,27,51,.12)"}}>⌂ Inicio guiado</Link>
      <Link href="/trd" style={{background:"#071b33",border:"1px solid #123e6b",color:"#f5c518",textDecoration:"none",fontSize:9,fontWeight:900,padding:"9px 12px",borderRadius:10,boxShadow:"0 8px 24px rgba(7,27,51,.18)"}}>TRD jerárquica</Link>
      <Link href="/formatos" style={{background:"#0b2d52",color:"#fff",textDecoration:"none",fontSize:9,fontWeight:800,padding:"9px 12px",borderRadius:10,boxShadow:"0 8px 24px rgba(7,27,51,.14)"}}>▦ Formatos</Link>
    </div>
  </>;
}
