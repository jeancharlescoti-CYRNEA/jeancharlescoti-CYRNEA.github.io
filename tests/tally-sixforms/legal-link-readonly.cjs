const urls={
relais:'https://cyrnea-contrats-tally.pages.dev/relais-cgv-v16-2026-10-05.pdf',
presence:'https://cyrnea-contrats-tally.pages.dev/presence-proprietaires-cgv-v8-2026-10-02.pdf',
b2b:'https://cyrnea-contrats-tally.pages.dev/entreprises-cgs-v9-2026-10-02.pdf',
laposte:'https://www.laposte.fr/envoyer/envoyer-cles'
};const out=[];for(const [name,url] of Object.entries(urls)){
 try{let ctrl=new AbortController();let timer=setTimeout(()=>ctrl.abort(),14000);try{
  let r=await fetch(url,{redirect:'follow',signal:ctrl.signal,headers:{'User-Agent':'CYRNEA-ReadOnly-QA/1.0'}});let buf=Buffer.from(await r.arrayBuffer());let pdf=buf.subarray(0,4).toString()==='%PDF';
  out.push({name,status:r.status,ok:r.ok,contentType:r.headers.get('content-type'),bytes:buf.length,pdfExpected:name!=='laposte',pdfSignature:pdf,url:r.url});
 }finally{clearTimeout(timer)}}catch(e){out.push({name,error:String(e).slice(0,250)})}
}out.forEach(x=>console.log('LEGAL_LINK '+JSON.stringify(x)));console.log('LEGAL_LINK_FINAL '+JSON.stringify({total:out.length,success:out.filter(x=>x.ok&&(x.name==='laposte'||x.pdfSignature)).length}));