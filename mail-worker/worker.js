/*
 * CYRNEA - passerelle SMTP Wmaker.
 * PRÉPARATION SEULE : ce fichier ne déploie pas de Worker.
 * Jamais de mot de passe SMTP dans la PWA, GitHub ou les logs.
 * Secrets Cloudflare : MAIL_SEND_KEY (identique à la clé de synchro PWA),
 * SMTP_PASSWORD_PRESENCE, SMTP_PASSWORD_RELAIS.
 */
import { connect } from "cloudflare:sockets";

const ALLOWED_ORIGINS = new Set([
  "https://jeancharlescoti-cyrnea.github.io"
]);
const FORM_IDS = {
  "RELAIS": new Set(["b5oz46","xXOqpk"]),
  "PRÉSENCE PROPRIÉTAIRES": new Set(["GxZbE2","7R6AZa"]),
  "PRÉSENCE ENTREPRISES": new Set(["RGp0PQ","2EQWLD"])
};
const IDENTITIES = {
  "RELAIS": { from:"contact@relaisproprietaire.fr", label:"CYRNEA RELAIS", secret:"SMTP_PASSWORD_RELAIS" },
  "PRÉSENCE PROPRIÉTAIRES": { from:"contact@cyrneapresence.fr", label:"CYRNEA PRÉSENCE", secret:"SMTP_PASSWORD_PRESENCE" },
  "PRÉSENCE ENTREPRISES": { from:"contact@cyrneapresence.fr", label:"CYRNEA PRÉSENCE", secret:"SMTP_PASSWORD_PRESENCE" }
};
const REFERENCE = /^D-\d{14}-[A-F0-9]{32}$/;
const EMAIL = /^[^\s@<>\r\n]{1,120}@[^\s@<>\r\n]{1,180}\.[A-Za-z]{2,30}$/;
const h = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const utf8 = s => new TextEncoder().encode(s);
const b64 = s => { const a = utf8(s); let raw=""; for (const n of a) raw+=String.fromCharCode(n); return btoa(raw); };
const mimeText = s => "=?UTF-8?B?"+b64(s)+"?=";
const response = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    ...(ALLOWED_ORIGINS.has(origin) ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    } : {})
  }
});
function checkPayload(d){
  if (!d || typeof d !== "object") throw Error("invalid_payload");
  const contract=String(d.contract||"");
  const id=IDENTITIES[contract];
  if(!id) throw Error("invalid_contract");
  const to=String(d.to||"").trim();
  if(to.length>254 || !EMAIL.test(to)) throw Error("invalid_recipient");
  const reference=String(d.reference||"");
  if(!REFERENCE.test(reference)) throw Error("invalid_reference");
  const url=new URL(String(d.url||""));
  if(url.protocol!=="https:" || url.hostname!=="tally.so"
    || url.username || url.password || url.port || url.hash) throw Error("invalid_link");
  const m=/^\/r\/([A-Za-z0-9]+)$/.exec(url.pathname);
  if(!m || !FORM_IDS[contract].has(m[1])) throw Error("invalid_form");
  if(url.searchParams.get("reference_temporaire")!==reference) throw Error("reference_mismatch");
  return { contract, id, to, reference, url: url.toString() };
}
function makeMessage({id,to,reference,url}){
  const boundary="=_CYRNEA_"+crypto.randomUUID().replace(/-/g,"");
  const subject=id.label+" — votre demande";
  const intro="Bonjour,";
  const detail="Voici votre lien pour compléter personnellement votre demande, vérifier les informations et consulter les conditions de service.";
  const note="Votre demande et le créneau restent soumis à confirmation de disponibilité par CYRNEA, même en cas de règlement.";
  const html='<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#222"><p>'+h(intro)+'</p><p>'+h(detail)+'</p><p><a href="'+h(url)+'" style="font-weight:bold;color:#145e79">Compléter votre demande CYRNEA</a></p><p>'+h(note)+'</p><p>'+h(id.label)+'</p></div>';
  const plain=[intro,detail,"Compléter votre demande CYRNEA : "+url,note,id.label].join("\r\n\r\n");
  const head=[
    "From: "+mimeText(id.label)+" <"+id.from+">",
    "To: <"+to+">",
    "Subject: "+mimeText(subject),
    "Date: "+new Date().toUTCString(),
    "Message-ID: <"+crypto.randomUUID()+"@cyrneapresence.fr>",
    "X-CYRNEA-Reference: "+reference,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="'+boundary+'"'
  ].join("\r\n");
  return head+"\r\n\r\n"+
    "--"+boundary+"\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"+b64(plain)+"\r\n"+
    "--"+boundary+"\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"+b64(html)+"\r\n"+
    "--"+boundary+"--\r\n";
}
function smtpStream(socket){
  let reader=socket.readable.getReader(), writer=socket.writable.getWriter(), buffer="";
  const decoder=new TextDecoder();
  return {
    async write(text){await writer.write(utf8(text));},
    async code(){
      let firstCode=null;
      for(let lineCount=0;lineCount<40;lineCount++){
        while(!buffer.includes("\r\n")){
          const chunk=await reader.read();
          if(chunk.done)throw Error("smtp_connection_closed");
          buffer+=decoder.decode(chunk.value,{stream:true});
          if(buffer.length>16384)throw Error("smtp_response_too_large");
        }
        const at=buffer.indexOf("\r\n");
        const line=buffer.slice(0,at);buffer=buffer.slice(at+2);
        if(!/^\d{3}[ -]/.test(line))throw Error("smtp_bad_response");
        const code=Number(line.slice(0,3));
        if(firstCode===null)firstCode=code;
        if(code!==firstCode)throw Error("smtp_inconsistent_reply");
        if(line[3]===" ")return code;
      }
      throw Error("smtp_reply_too_long");
    },
    release(){try{reader.releaseLock()}catch(_){} try{writer.releaseLock()}catch(_){}}
  };
}
async function sendSmtp(env, data){
  const username=data.id.from, password=String(env[data.id.secret]||"");
  if(!password)throw Error("smtp_password_missing");
  const raw=makeMessage(data);
  let socket=connect({hostname:"mail.wmaker.net",port:587},{secureTransport:"starttls"});
  let channel=smtpStream(socket), stage="connect";
  const expect=async(cmd, codes)=>{
    if(cmd!==null)await channel.write(cmd+"\r\n");
    const result=await channel.code();
    if(!codes.includes(result))throw Error("smtp_"+stage+"_rejected_"+result);
  };
  try{
    await expect(null,[220]);
    stage="ehlo";await expect("EHLO cyrnea-mailer.workers.dev",[250]);
    stage="starttls";await expect("STARTTLS",[220]);
    channel.release();
    socket=socket.startTls();
    channel=smtpStream(socket);
    stage="ehlo_tls";await expect("EHLO cyrnea-mailer.workers.dev",[250]);
    stage="auth";await expect("AUTH LOGIN",[334]);
    await expect(b64(username),[334]);
    await expect(b64(password),[235]);
    stage="mail_from";await expect("MAIL FROM:<"+username+">",[250]);
    stage="rcpt_to";await expect("RCPT TO:<"+data.to+">",[250,251]);
    stage="data";await expect("DATA",[354]);
    stage="data_accept";
    const dotSafe=raw.replace(/\r\n\./g,"\r\n..");
    await channel.write(dotSafe+"\r\n.\r\n");
    await expect(null,[250]);
    stage="quit";await expect("QUIT",[221]);
    return { ok:true };
  }catch(err){
    // Ne jamais enregistrer ni renvoyer le mot de passe, l'adresse client ou le contenu.
    throw new Error("smtp_failure_"+stage);
  }finally{
    channel.release();
    try{await socket.close()}catch(_){}
  }
}
export default {
  async fetch(request, env){
    const origin=request.headers.get("Origin")||"";
    if(request.method==="OPTIONS"){
      return response({ok:ALLOWED_ORIGINS.has(origin)},ALLOWED_ORIGINS.has(origin)?204:403,origin);
    }
    if(request.method==="GET" && new URL(request.url).pathname==="/health")
      return response({ok:true, ready:!!(env.MAIL_SEND_KEY&&env.SMTP_PASSWORD_PRESENCE&&env.SMTP_PASSWORD_RELAIS)},200,origin);
    if(request.method!=="POST" || new URL(request.url).pathname!=="/send")
      return response({error:"not_found"},404,origin);
    if(!ALLOWED_ORIGINS.has(origin))return response({error:"origin_not_allowed"},403,origin);
    const auth=request.headers.get("Authorization")||"";
    const token=String(env.MAIL_SEND_KEY||"");
    if(token.length<24 || auth!=="Bearer "+token)return response({error:"unauthorized"},401,origin);
    if(Number(request.headers.get("Content-Length")||0)>12000)return response({error:"payload_too_large"},413,origin);
    let data;
    try{data=checkPayload(await request.json())}
    catch(_){return response({error:"invalid_payload"},400,origin)}
    if(!env.SMTP_PASSWORD_PRESENCE || !env.SMTP_PASSWORD_RELAIS)
      return response({error:"server_not_configured"},503,origin);
    try{await sendSmtp(env,data);return response({ok:true,reference:data.reference},200,origin)}
    catch(_){return response({error:"delivery_not_confirmed"},502,origin)}
  }
};
