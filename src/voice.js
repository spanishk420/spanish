// ===== Sprachmodus: App liest vor, hört durchgehend zu und bewertet =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let deVoice = null;
function deScore(v){
  const n=(v.name+" "+v.voiceURI).toLowerCase(); let s=voiceTier(v)*60;
  if(/google/.test(n))s+=35;
  if(/anna|petra|helena|markus|yannick|viktor|katja|conrad/.test(n))s+=20;
  if(/eloquence|espeak|compact|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/.test(n))s-=40;
  if(/^de[-_]DE/i.test(v.lang))s+=15;
  return s;
}
function findDeVoice(){
  if(!tts)return;
  deVoice=voicesNow().filter(v=>/^de/i.test(v.lang)).sort((a,b)=>deScore(b)-deScore(a))[0]||null;
}
// Stimme jedes Mal frisch aus der aktuellen Liste holen. Ohne ausdrücklich gesetzte Stimme
// nimmt iOS oft die Systemstimme (Deutsch) – auch für spanischen Text.
function voiceFor(lang){
  const es=lang==="es";
  if(es&&!esVoice)findVoice();
  if(!es&&!deVoice)findDeVoice();
  return freshVoice(es?esVoice:deVoice);
}

// Spricht einen Text und wartet, bis er fertig ist
async function say(text, lang){
  if(text&&await playClip(text,lang))return wait(120);
  return sayTTS(text,lang);
}
function sayTTS(text, lang){
  return new Promise(res=>{
    if(!tts||!text)return res();
    const es=lang==="es";
    const u=new SpeechSynthesisUtterance(ttsText(text,lang));
    const v=voiceFor(lang);
    u.lang=v?v.lang.replace("_","-"):(es?"es-ES":"de-DE"); if(v)u.voice=v;
    u.rate=es?.9:1; u.volume=1;
    let done=false;
    const fin=()=>{if(done)return;done=true;clearTimeout(t);setTimeout(res,150)};
    const t=setTimeout(fin,2500+text.length*160);
    u.onend=fin; u.onerror=fin;
    try{tts.speak(u)}catch(e){fin()}
  });
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// iOS spielt Sprache nur ab, wenn das erste speak() direkt beim Tippen passiert
function unlockTTS(){
  if(!tts)return;
  try{tts.cancel();const u=new SpeechSynthesisUtterance(" ");u.volume=0;tts.speak(u)}catch(e){}
}

// ---- Sounds für richtig/falsch ----
// Als WAV im Speicher erzeugt und über <audio> abgespielt: das läuft auf dem iPhone auch,
// wenn der Stummschalter an ist (Web Audio wäre dann still).
function makeWav(notes,dur){
  const rate=22050,n=Math.floor(rate*dur),buf=new ArrayBuffer(44+n*2),d=new DataView(buf);
  const str=(o,t)=>{for(let i=0;i<t.length;i++)d.setUint8(o+i,t.charCodeAt(i))};
  str(0,"RIFF");d.setUint32(4,36+n*2,true);str(8,"WAVEfmt ");d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);
  d.setUint32(24,rate,true);d.setUint32(28,rate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);str(36,"data");d.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){
    const t=i/rate;let v=0;
    for(const[f,start,len,vol,harm]of notes){
      const x=t-start;if(x<0||x>len)continue;
      const env=Math.min(1,x/.008)*Math.exp(-x*(4.5/len));
      v+=vol*env*(Math.sin(2*Math.PI*f*x)+harm*Math.sin(4*Math.PI*f*x)+harm*.4*Math.sin(6*Math.PI*f*x));
    }
    d.setInt16(44+i*2,Math.max(-1,Math.min(1,v))*32767*.9,true);
  }
  return URL.createObjectURL(new Blob([buf],{type:"audio/wav"}));
}
const sfx={};
function sfxInit(){
  if(sfx.ok)return;
  // Richtig: helles „Pling-pling“ nach oben. Falsch: zwei tiefe, weiche Töne nach unten.
  sfx.ok=new Audio(makeWav([[784,0,.35,.35,.15],[1175,.11,.55,.35,.15]],.7));
  sfx.no=new Audio(makeWav([[247,0,.3,.42,.5],[185,.18,.45,.42,.5]],.65));
}
// iOS: jedes <audio> muss einmal beim Tippen gestartet werden, danach darf es von selbst spielen
function unlockSfx(){
  sfxInit();
  for(const a of[sfx.ok,sfx.no]){try{a.muted=true;const p=a.play();const re=()=>{a.pause();a.currentTime=0;a.muted=false};p&&p.then?p.then(re,re):re()}catch(e){}}
}
function playSfx(name){
  return new Promise(res=>{
    sfxInit();const a=sfx[name];let done=false;
    const fin=()=>{if(done)return;done=true;clearTimeout(t);a.onended=null;res()};
    const t=setTimeout(fin,1200);
    try{a.muted=false;a.currentTime=0;a.onended=fin;const p=a.play();p&&p.catch&&p.catch(fin)}catch(e){fin()}
  });
}

// ---- Spracherkennung: pro Antwort frisch gestartet ----
// Das Mikrofon läuft nur, während auf die Antwort gewartet wird, nie während die App spricht.
// (Auf dem iPhone bringt gleichzeitiges Sprechen die Aufnahme durcheinander, danach hört sie nichts mehr.)
// Zwischenergebnisse werden sofort ausgewertet, auf ein „fertiges“ Ergebnis wird nicht gewartet.
const rec={r:null,denied:false,silentRun:0,everHeard:false};
const standalone=window.navigator.standalone===true||matchMedia("(display-mode: standalone)").matches;
rec.ui={heard:"vHeard",diag:"vDiag"};
function diag(t){$(rec.ui.diag).textContent=t||""}
function recAbort(){const r=rec.r;rec.r=null;if(r){try{r.abort()}catch(e){}}}
function listen(lang,c,alive,maxWait){
  return new Promise(res=>{
    let done=false,r=null,heard=[],changed=0,restarts=0,started=false,iv=null;
    const t0=Date.now();
    const fin=x=>{if(done)return;done=true;clearInterval(iv);const mine=r;r=null;if(mine){if(rec.r===mine)rec.r=null;try{mine.abort()}catch(e){}}res(x)};
    const evalNow=()=>{
      $(rec.ui.heard).textContent=heard[0]?`Gehört: „${heard[0]}“`:"";
      if(!heard.length||!c)return;
      if(matches(heard,c))return fin({ok:true,heard});
      const cmd=command(heard); if(cmd)return fin({cmd,heard});
    };
    const begin=()=>{
      if(done)return;
      const x=new SR(); r=x; rec.r=x;
      x.lang=lang==="es"?"es-ES":"de-DE";
      x.continuous=true; x.interimResults=true; x.maxAlternatives=3;
      x.onstart=()=>{if(r===x){started=true;diag("")}};
      x.onresult=e=>{
        if(r!==x)return;
        const parts=[];
        for(let i=0;i<e.results.length;i++){const R=e.results[i];if(R[0])parts.push(R[0].transcript)}
        const L=e.results[e.results.length-1];
        const out=[parts.join(" ").replace(/\s+/g," ").trim()];
        if(L)for(let k=1;k<L.length;k++)out.push(L[k].transcript);
        heard=out.map(h=>h.trim()).filter(Boolean);
        if(heard.length){changed=Date.now();rec.everHeard=true;rec.silentRun=0}
        evalNow();
      };
      x.onerror=e=>{
        if(r!==x)return;
        if(e.error==="not-allowed"||e.error==="service-not-allowed")return fin({denied:true,err:e.error});
        if(e.error!=="no-speech"&&e.error!=="aborted")diag("⚠️ Mikro-Fehler: "+e.error);
      };
      x.onend=()=>{
        if(r!==x||done)return;
        r=null;if(rec.r===x)rec.r=null;
        if(heard.length){evalNow();if(!done)fin({ok:false,heard});return}
        // Ohne Ergebnis beendet (passiert auf dem iPhone öfter): neu starten, solange Zeit ist
        if(Date.now()-t0<maxWait-800&&restarts<5){restarts++;setTimeout(begin,250)}
        else fin({ok:false,heard,silent:true});
      };
      try{x.start()}catch(err){diag("⚠️ Mikro startet nicht: "+(err.message||err));fin({ok:false,heard,silent:true})}
    };
    iv=setInterval(()=>{
      if(done)return;
      if(!alive())return fin({stopped:true});
      const now=Date.now();
      if(heard.length&&now-changed>1800)return fin({ok:false,heard});
      if(heard.length&&now-t0>maxWait+8000)return fin({ok:false,heard});
      if(!heard.length&&now-t0>maxWait)return fin({ok:false,heard,silent:true});
      if(!started&&now-t0>3000)diag("⚠️ Mikro startet nicht.");
    },200);
    begin();
  });
}
// Beim ersten Tippen kurz starten, damit iOS nach der Mikrofon-Erlaubnis fragt
function warmupMic(){
  if(!SR||rec.warm)return;
  try{const x=new SR();x.lang="de-DE";x.onstart=()=>{rec.warm=true;try{x.abort()}catch(e){}};
    x.onerror=e=>{if(e.error==="not-allowed"||e.error==="service-not-allowed")rec.denied=true};x.start()}catch(e){}
}
function noMicHint(){
  return standalone
    ? "Ich höre nichts. Vom Home-Bildschirm aus blockiert iOS das Mikro manchmal. Öffne die Seite testweise direkt in Safari und probier „Mikro testen“."
    : "Ich höre nichts. Prüfe in Einstellungen › Safari › Mikrofon und ob Siri & Diktieren eingeschaltet sind (Einstellungen › Allgemein › Tastatur › Diktierfunktion).";
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
  const my=vm.token, alive=()=>vm.on&&my===vm.token;
  if(cur>=0){recent.push(cur);if(recent.length>3)recent.shift()}
  cur=pickVoiceCard();
  const c=deck()[cur], v=item(c), es=c.dir==="es";
  const ansLang=es?"de":"es", ans=es?v[0]:v[1];
  const qText=es?v[1]:c.dir==="num"?v[0].replace(/\D/g,""):v[0];
  const qLang=es?"es":"de";
  const useMic=vm.mic&&SR&&!rec.denied;
  vmPrompt(c);

  let tries=0, result;
  for(;;){
    vmSet("🔊 Hör zu …");
    await say(qText,qLang); if(!alive())return;
    if(!useMic){
      vmSet("🤔 Antworte laut …","listen");
      await wait(4500); if(!alive())return;
      result=null;break;
    }
    await wait(250); if(!alive())return; // iOS braucht einen Moment, bis das Mikro nach der Ausgabe frei ist
    vmSet("🎙️ Ich höre zu …","listen");
    result=await listen(ansLang,c,alive,8000); if(!alive())return;
    if(result.stopped)return;
    if(result.denied){
      rec.denied=true;vm.mic=false;vmButtons();
      vmSet(result.err==="service-not-allowed"
        ?"Spracherkennung ist hier gesperrt. Schalte Siri & Diktieren ein oder öffne die Seite direkt in Safari. Bis dahin ohne Mikrofon."
        :"Mikrofon nicht erlaubt. Erlaube es in den Einstellungen, bis dahin läuft der Modus ohne Mikrofon.","bad");
      await wait(2500); if(!alive())return;
      result=null;break;
    }
    if(result.silent&&!rec.everHeard&&++rec.silentRun>=2)diag(noMicHint());
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
    await playSfx("ok");
  }else{
    applyGrade(false);vm.no++;vmStats();
    vmSet("✗ Falsch","bad");
    await playSfx("no"); if(!alive())return;
    await wait(150); if(!alive())return;
    await say(ans,ansLang);
  }
  if(!alive())return;
  await wait(500);
  if(alive())voiceTurn();
}
function voiceInfo(){
  findVoice();findDeVoice();
  const e=freshVoice(esVoice), d=freshVoice(deVoice);
  const n=Object.keys(AUDIO).length;
  if(n)return `🎧 KI-Stimmen: Alex 🇪🇸 · Thorsten 🇩🇪 (${n} Aufnahmen). Für alles andere: ${e?e.name:"–"} · ${d?d.name:"Standard"}`;
  if(!e)return "⚠️ Keine spanische Stimme gefunden.";
  const lvl=v=>["einfach","Erweitert","Premium"][voiceTier(v)]||"";
  let t=`Stimmen: 🇪🇸 ${e.name} (${lvl(e)}) · 🇩🇪 ${d?`${d.name} (${lvl(d)})`:"Standard"}`;
  return t;
}
function startVoice(){
  if(!tts){vmSet("Dein Gerät kann nicht vorlesen.","bad");return}
  // Alles, was iOS „beim Tippen“ verlangt, passiert hier synchron
  unlockTTS();unlockSfx();unlockVox();
  if(vm.mic&&SR)warmupMic();
  rec.denied=false;rec.silentRun=0;
  vm.on=true;vm.token++;vm.block=0;vm.blockDir=null;vmButtons();
  diag(voiceInfo());
  try{navigator.wakeLock?.request("screen").then(l=>{vm.lock=l}).catch(()=>{})}catch(e){}
  setTimeout(()=>{if(vm.on){recAbort();voiceTurn()}},300);
}
function stopVoice(){
  vm.on=false;vm.token++;
  recAbort();
  try{tts&&tts.cancel()}catch(e){}
  try{vox&&vox.pause()}catch(e){}
  try{vm.lock&&vm.lock.release()}catch(e){};vm.lock=null;
  vmButtons();vmSet("Pausiert. Tippe auf Start, um weiterzumachen.");
}
// Mikro-Test (in den Einstellungen): hört 6 Sekunden auf Deutsch zu und zeigt an, was ankommt
function setTest(t,cls){$("sStatus").textContent=t;$("sStatus").className="vstatus "+(cls||"")}
async function micTest(){
  if(!SR){setTest("Dieses Gerät hat keine Spracherkennung.","bad");return}
  if(vm.on)stopVoice();
  try{tts&&tts.cancel()}catch(e){}
  const my=++vm.token, alive=()=>my===vm.token&&!$("settings").hidden;
  rec.ui={heard:"sHeard",diag:"sDiag"};
  setTest("🎙️ Sag etwas auf Deutsch …","listen");diag("");$("sHeard").textContent="";
  $("sTest").disabled=true;
  const r=await listen("de",null,alive,6000);
  $("sTest").disabled=false;
  if(alive()){
    if(r.denied)setTest(r.err==="service-not-allowed"?"Spracherkennung gesperrt (Siri & Diktieren aus oder Home-Bildschirm-App).":"Mikrofon nicht erlaubt.","bad");
    else if(r.heard&&r.heard.length){rec.denied=false;setTest("✓ Mikro funktioniert","good")}
    else{setTest("✗ Nichts gehört","bad");diag(noMicHint())}
  }
  rec.ui={heard:"vHeard",diag:"vDiag"};
}
function openSettings(){
  setTest(SR?"Tippe auf „Mikro testen“ und sag etwas.":"Dieses Gerät hat keine Spracherkennung.");
  $("sHeard").textContent="";$("sDiag").textContent=tts?voiceInfo():"";
  show("settings");
}
function closeSettings(){vm.token++;$("sTest").disabled=false;rec.ui={heard:"vHeard",diag:"vDiag"};show("home")}

function openVoice(){
  vm.ok=0;vm.no=0;vmStats();
  $("vmName").textContent=CHAPTERS[chap].name;
  $("vQ").textContent="Bereit?";$("vQ").className="q";$("vTag").textContent="";setSwatch($("vSw"),null);
  $("vHeard").textContent="";$("vAns").hidden=true;diag(tts?voiceInfo():"");
  vmSet(SR?"Tippe auf Start. Ich sage ein Wort, du antwortest laut in der anderen Sprache.":"Dieses Gerät hat keine Spracherkennung. Ich sage das Wort, warte kurz und sage dann die Lösung.");
  vmButtons();
  $("home").hidden=true;$("train").hidden=true;$("voice").hidden=false;
}
function closeVoice(){stopVoice();$("voice").hidden=true;openChapter(chap)}

$("voiceBtn").addEventListener("click",openVoice);
$("vStart").addEventListener("click",startVoice);
$("vPause").addEventListener("click",stopVoice);
$("vBack").addEventListener("click",closeVoice);
$("sTest").addEventListener("click",micTest);
$("settingsBtn").addEventListener("click",openSettings);
$("sBack").addEventListener("click",closeSettings);
$("vMic").addEventListener("click",()=>{
  if(!SR){vmSet("Dieses Gerät hat keine Spracherkennung.","bad");return}
  vm.mic=!vm.mic;try{localStorage.setItem("verbos-mic",vm.mic?"1":"0")}catch(e){}
  if(vm.mic)rec.denied=false;
  vmButtons();
});
if(tts){findDeVoice();const prev=tts.onvoiceschanged;tts.onvoiceschanged=()=>{prev&&prev();findDeVoice()}}
document.addEventListener("visibilitychange",()=>{if(document.hidden&&vm.on)stopVoice()});
