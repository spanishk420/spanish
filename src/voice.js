// ===== Sprachmodus: App liest vor, hört durchgehend zu und bewertet =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let deVoice = null;
function deScore(v){
  const n=(v.name+" "+v.voiceURI).toLowerCase(); let s=0;
  if(/natural|neural|online/.test(n))s+=60;
  if(/premium|enhanced|erweitert/.test(n))s+=50;
  if(/google/.test(n))s+=35;
  if(/anna|petra|helena|markus|yannick|viktor|katja|conrad/.test(n))s+=20;
  if(/eloquence|espeak|compact|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/.test(n))s-=40;
  if(/^de[-_]DE/i.test(v.lang))s+=15;
  return s;
}
function findDeVoice(){
  if(!tts)return;
  deVoice=tts.getVoices().filter(v=>/^de/i.test(v.lang)).sort((a,b)=>deScore(b)-deScore(a))[0]||null;
}

// Spricht einen Text und wartet, bis er fertig ist
function say(text, lang){
  return new Promise(res=>{
    if(!tts||!text)return res();
    const es=lang==="es";
    const u=new SpeechSynthesisUtterance(es?text.replace(/\s*\/\s*/g,", ")+".":text);
    const v=es?esVoice:deVoice;
    u.lang=v?v.lang:(es?"es-ES":"de-DE"); if(v)u.voice=v;
    u.rate=es?.85:1;
    let done=false;
    const fin=()=>{if(done)return;done=true;clearTimeout(t);setTimeout(res,120)};
    const t=setTimeout(fin,2000+text.length*160);
    u.onend=fin; u.onerror=fin;
    try{tts.speak(u)}catch(e){fin()}
  });
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// ---- Durchgehende Spracherkennung ----
// Das Mikrofon wird einmal gestartet und läuft weiter. Neu gestartet wird nur, wenn sich die
// Antwortsprache ändert (Deutsch ↔ Spanisch) oder das Handy die Aufnahme von sich aus beendet.
const rec={r:null,lang:null,want:false,epoch:0,list:[],changedAt:0,denied:false,onChange:null};
function recText(){return rec.list.map(x=>x.alts[0]||"").join(" ").replace(/\s+/g," ").trim()}
function recStart(lang){
  if(!SR)return;
  if(rec.r&&rec.lang===lang)return;
  recStop(true);
  rec.lang=lang;rec.want=true;rec.epoch++;rec.list=[];
  const r=new SR();
  r.lang=lang==="es"?"es-ES":"de-DE";
  r.continuous=true;r.interimResults=true;r.maxAlternatives=3;
  r.onresult=e=>{
    if(rec.r!==r)return;
    const list=[];
    for(let i=0;i<e.results.length;i++){const x=e.results[i];list.push({final:x.isFinal,alts:Array.from(x).map(a=>a.transcript)})}
    rec.list=list;rec.changedAt=Date.now();
    rec.onChange&&rec.onChange();
  };
  r.onerror=e=>{
    if(e.error==="not-allowed"||e.error==="service-not-allowed"){rec.denied=true;rec.want=false;rec.onChange&&rec.onChange()}
  };
  r.onend=()=>{
    if(rec.r!==r)return;
    rec.r=null;
    // Das Handy hat die Aufnahme beendet: still neu starten, solange der Modus läuft
    if(rec.want&&vm.on)setTimeout(()=>{if(rec.want&&vm.on&&!rec.r){const l=rec.lang;rec.lang=null;recStart(l)}},200);
  };
  rec.r=r;
  try{r.start()}catch(e){rec.r=null}
}
function recStop(keepWant){
  if(!keepWant)rec.want=false;
  const r=rec.r;rec.r=null;
  if(r){try{r.abort()}catch(e){}}
}
// Merkt sich, was vor der Frage schon gehört wurde, damit nur die neue Antwort zählt
function recMark(){return{epoch:rec.epoch,len:recText().length}}
function recSince(m){
  const t=recText();
  const fresh=m.epoch===rec.epoch?t.slice(Math.min(m.len,t.length)):t;
  const out=[fresh.trim()];
  const last=rec.list[rec.list.length-1];
  if(last)for(const a of last.alts.slice(1))out.push(a);
  return out.filter(Boolean);
}

// ---- Antwort prüfen (tolerant bei Aussprache und Schreibweise) ----
const deacc=s=>s.toLowerCase().replace(/ß/g,"ss").normalize("NFD").replace(/[̀-ͯ]/g,"")
  .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const ART_ES=/\b(el|la|los|las|un|una)\b/g, ART_DE=/\b(der|die|das|ein|eine)\b/g;
function phon(w,lang){
  if(lang==="es") return w.replace(/ch/g,"X").replace(/qu/g,"k").replace(/c(?=[ei])/g,"s").replace(/c/g,"k")
    .replace(/z/g,"s").replace(/v/g,"b").replace(/ll/g,"y").replace(/h/g,"").replace(/X/g,"ch").replace(/rr/g,"r");
  return w.replace(/h/g,"").replace(/v/g,"f").replace(/(.)\1/g,"$1");
}
function lev(a,b){
  const m=a.length,n=b.length; if(!m)return n; if(!n)return m;
  let p=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){const q=[i];for(let j=1;j<=n;j++)q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=q}
  return p[n];
}
function cands(v,lang){
  const raw=lang==="es"?v[1]:v[0];
  return raw.split("/").map(s=>deacc(s).replace(lang==="es"?ART_ES:ART_DE,"").replace(/\s+/g," ").trim()).filter(Boolean);
}
// Kleinster Abstand zwischen dem Gehörten und einem Kandidaten (über Wortfenster)
function bestDist(heard,cand,lang){
  const cp=phon(cand.replace(/ /g,""),lang), n=cand.split(" ").length;
  let best=99;
  for(const h of heard){
    const t=deacc(h).replace(lang==="es"?ART_ES:ART_DE,"").replace(/\s+/g," ").trim();
    const ws=t.split(" ").filter(Boolean);
    const wins=ws.length<=3?[t.replace(/ /g,"")]:[];
    for(let k=0;k+n<=ws.length;k++)wins.push(ws.slice(k,k+n).join(""));
    for(const w of wins)best=Math.min(best,lev(phon(w,lang),cp));
  }
  return best;
}
function matches(heard,c){
  const v=item(c), lang=c.dir==="es"?"de":"es";
  // Zahlen: „47“ oder „cuarenta y siete“
  if(c.dir==="num"){
    const want=v[0].replace(/\D/g,"");
    if(heard.some(h=>(h.replace(/\./g,"").match(/\d+/g)||[]).includes(want)))return true;
  }
  const mine=cands(v,lang);
  for(const cand of mine){
    const cp=phon(cand.replace(/ /g,""),lang);
    const d=bestDist(heard,cand,lang);
    if(d===0)return true;
    // Spanische Verben: auch konjugierte Formen wie „habla“, „compra“, „necesita“
    if(lang==="es"&&chap==="verbs"){
      for(const h of heard)for(const w of deacc(h).split(" ")){
        const pw=phon(w,lang);
        if(cp.length>=5&&/(ar|er|ir)$/.test(cp)&&pw.startsWith(cp.slice(0,-2))&&pw.length<=cp.length+2)return true;
        if(cp.length===3&&cp!=="ir"&&pw===cp.slice(0,-1))return true; // „da“ für dar, „se“ für ser
      }
    }
    const tol=cp.length<=4?0:cp.length<=7?1:2;
    if(d<=tol){
      // Nur akzeptieren, wenn kein anderes Wort im Kapitel genauso gut passt (z. B. comer vs. correr)
      const rival=CHAPTERS[chap].items.some((o,k)=>k!==c.i&&cands(o,lang).some(oc=>bestDist(heard,oc,lang)<=d));
      if(!rival)return true;
    }
  }
  return false;
}
function command(heard){
  const t=heard.map(deacc).join(" | ");
  if(/\b(stopp?|basta|beenden)\b/.test(t))return "stop";
  if(/(nochmal|noch mal|wiederhol|otra vez|repite|repetir)/.test(t))return "repeat";
  if(/(nicht|keine ahnung|ni idea|no lo se|weiter|siguiente)/.test(t))return "skip";
  return null;
}

// Wartet auf die Antwort: sofort „richtig“, sobald das Wort fällt.
// „Falsch“, wenn nach dem Sprechen 2 Sekunden Ruhe ist oder nach 8 Sekunden gar nichts kam.
function waitAnswer(c,mark,promptEnd){
  return new Promise(res=>{
    let done=false,timer=null;
    const fin=r=>{if(done)return;done=true;clearInterval(timer);rec.onChange=null;res(r)};
    const check=()=>{
      if(done)return;
      if(!vm.on)return fin({stopped:true});
      if(rec.denied)return fin({denied:true});
      const heard=recSince(mark);
      $("vHeard").textContent=heard[0]?`Gehört: „${heard[0]}“`:"";
      if(heard.length){
        if(matches(heard,c))return fin({ok:true,heard});
        const cmd=command(heard);
        if(cmd)return fin({cmd,heard});
      }
      const now=Date.now();
      const spokeAfter=rec.changedAt>promptEnd+700&&heard.length;
      if(spokeAfter&&now-rec.changedAt>2000)return fin({ok:false,heard});
      if(now-promptEnd>8000)return fin({ok:false,heard,silent:!spokeAfter});
    };
    rec.onChange=check;
    timer=setInterval(check,250);
    check();
  });
}

// ---- Ablauf ----
const vm={on:false,token:0,mic:true,ok:0,no:0,lock:null,block:0,blockDir:null};
try{vm.mic=localStorage.getItem("verbos-mic")!=="0"}catch(e){}
function vmSet(status,cls){$("vStatus").textContent=status;$("vStatus").className="vstatus "+(cls||"")}
function vmPrompt(c){
  const v=item(c), es=c.dir==="es";
  $("vTag").textContent=c.dir==="num"?"Zahl → Español":es?"Español → Deutsch":"Deutsch → Español";
  $("vTag").className="tag"+(es?" rev":"");
  $("vQ").textContent=es?v[1]:v[0];
  $("vQ").className="q"+(es?" es":"");
  setSwatch($("vSw"),es?null:v[5]);
  $("vHeard").textContent=""; $("vAns").hidden=true;
}
function vmStats(){$("vOk").textContent=vm.ok;$("vNo").textContent=vm.no}
function vmButtons(){
  $("vStart").hidden=vm.on; $("vPause").hidden=!vm.on;
  $("vMic").textContent=vm.mic&&SR?"🎙️ Mikrofon an":"🔇 Ohne Mikrofon";
  $("vMic").setAttribute("aria-pressed",vm.mic&&SR?"true":"false");
}
// Karten in Blöcken von 5 pro Richtung, damit das Mikrofon selten die Sprache wechseln muss
function pickVoiceCard(){
  const d=deck();
  const hasBoth=d.some(c=>c.dir==="es")&&d.some(c=>c.dir!=="es");
  if(hasBoth&&(vm.block<=0||!vm.blockDir)){
    vm.blockDir=vm.blockDir==="toES"?"toDE":vm.blockDir==="toDE"?"toES":(Math.random()<.5?"toES":"toDE");
    vm.block=5;
  }
  vm.block--;
  for(let n=0;n<40;n++){
    const k=pick(), c=d[k];
    if(!hasBoth||(vm.blockDir==="toDE")===(c.dir==="es"))return k;
  }
  return pick();
}
async function voiceTurn(){
  const my=vm.token;
  if(cur>=0){recent.push(cur);if(recent.length>3)recent.shift()}
  cur=pickVoiceCard();
  const c=deck()[cur], v=item(c), es=c.dir==="es";
  const ansLang=es?"de":"es", ans=es?v[0]:v[1];
  const qText=es?v[1]:c.dir==="num"?v[0].replace(/\D/g,""):v[0].replace(/\s*\/\s*/g," oder ");
  const qLang=es?"es":"de";
  const useMic=vm.mic&&SR&&!rec.denied;
  if(useMic)recStart(ansLang);
  vmPrompt(c);

  let tries=0, result;
  for(;;){
    vmSet("🔊 Hör zu …");
    const mark=useMic?recMark():null;
    await say(qText,qLang); if(my!==vm.token)return;
    if(!useMic){
      vmSet("🤔 Antworte laut …","listen");
      await wait(4500); if(my!==vm.token)return;
      result=null;break;
    }
    vmSet("🎙️ Ich höre zu …","listen");
    result=await waitAnswer(c,mark,Date.now()); if(my!==vm.token)return;
    if(result.stopped)return;
    if(result.denied){
      vm.mic=false;vmButtons();recStop();
      vmSet("Mikrofon nicht erlaubt. Erlaube es in den Einstellungen, bis dahin läuft der Modus ohne Mikrofon.","bad");
      result=null;break;
    }
    if(result.cmd==="stop"){stopVoice();return}
    if(result.cmd==="repeat"&&tries<2){tries++;continue}
    if(result.cmd==="skip")result={ok:false};
    break;
  }

  $("vA").textContent=ans; $("vA").className="a"+(es?"":" es"); $("vAns").hidden=false;
  if(!result){
    // Ohne Mikrofon: einfach die Lösung sagen
    vmSet("Lösung");
    await say(ans,ansLang);
  }else if(result.ok){
    applyGrade(true);vm.ok++;vmStats();
    vmSet("✓ Richtig","good");
    await say("Richtig","de");
  }else{
    applyGrade(false);vm.no++;vmStats();
    vmSet("✗ Falsch","bad");
    await say("Falsch.","de"); if(my!==vm.token)return;
    await say(ans,ansLang);
  }
  if(my!==vm.token)return;
  await wait(500);
  if(my===vm.token&&vm.on)voiceTurn();
}
async function startVoice(){
  if(!tts){vmSet("Dein Gerät kann nicht vorlesen.","bad");return}
  findVoice();findDeVoice();
  rec.denied=false;
  vm.on=true;vm.token++;vm.block=0;vm.blockDir=null;vmButtons();
  try{vm.lock=await navigator.wakeLock?.request("screen")}catch(e){}
  voiceTurn();
}
function stopVoice(){
  vm.on=false;vm.token++;
  recStop();rec.onChange=null;
  try{tts&&tts.cancel()}catch(e){}
  try{vm.lock&&vm.lock.release()}catch(e){};vm.lock=null;
  vmButtons();vmSet("Pausiert. Tippe auf Start, um weiterzumachen.");
}
function openVoice(){
  vm.ok=0;vm.no=0;vmStats();
  $("vmName").textContent=CHAPTERS[chap].name;
  $("vQ").textContent="Bereit?";$("vQ").className="q";$("vTag").textContent="";setSwatch($("vSw"),null);
  $("vHeard").textContent="";$("vAns").hidden=true;
  vmSet(SR?"Tippe auf Start. Ich sage ein Wort, du antwortest laut in der anderen Sprache.":"Dieses Gerät hat keine Spracherkennung. Ich sage das Wort, warte kurz und sage dann die Lösung.");
  vmButtons();
  $("home").hidden=true;$("train").hidden=true;$("voice").hidden=false;
}
function closeVoice(){stopVoice();$("voice").hidden=true;openChapter(chap)}

$("voiceBtn").addEventListener("click",openVoice);
$("vStart").addEventListener("click",startVoice);
$("vPause").addEventListener("click",stopVoice);
$("vBack").addEventListener("click",closeVoice);
$("vMic").addEventListener("click",()=>{
  if(!SR){vmSet("Dieses Gerät hat keine Spracherkennung.","bad");return}
  vm.mic=!vm.mic;try{localStorage.setItem("verbos-mic",vm.mic?"1":"0")}catch(e){}
  if(!vm.mic)recStop();
  vmButtons();
});
if(tts){findDeVoice();const prev=tts.onvoiceschanged;tts.onvoiceschanged=()=>{prev&&prev();findDeVoice()}}
document.addEventListener("visibilitychange",()=>{if(document.hidden&&vm.on)stopVoice()});
