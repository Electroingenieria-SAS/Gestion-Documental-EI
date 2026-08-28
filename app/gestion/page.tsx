import Link from "next/link";
import DocumentManagementApp from "@/components/DocumentManagementApp";
import NavigationBridge from "@/components/NavigationBridge";

export default function GestionPage() {
  return <>
    <NavigationBridge />
    <DocumentManagementApp />
    <div style={{position:"fixed",right:18,bottom:18,zIndex:120,display:"flex",gap:8,fontFamily:"Arial,sans-serif"}}>
      <Link href="/" style={{background:"#fff",border:"1px solid #dce5e1",color:"#174d3f",textDecoration:"none",fontSize:9,fontWeight:800,padding:"9px 12px",borderRadius:9,boxShadow:"0 8px 24px rgba(0,0,0,.12)"}}>⌂ Inicio guiado</Link>
      <Link href="/formatos" style={{background:"#176b55",color:"#fff",textDecoration:"none",fontSize:9,fontWeight:800,padding:"9px 12px",borderRadius:9,boxShadow:"0 8px 24px rgba(0,0,0,.12)"}}>▦ Formatos</Link>
    </div>
  </>;
}
