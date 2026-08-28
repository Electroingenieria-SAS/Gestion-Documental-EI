import Link from "next/link";
import DocumentManagementApp from "@/components/DocumentManagementApp";

export default function Home() {
  return <>
    <Link href="/formatos" style={{position:"fixed",right:22,top:18,zIndex:80,background:"#176b55",color:"white",textDecoration:"none",fontFamily:"Arial,sans-serif",fontSize:11,fontWeight:800,padding:"10px 14px",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.18)"}}>▦ Formatos operativos</Link>
    <DocumentManagementApp />
  </>;
}
