// ===== Auto-Modus: nur hören, ohne Bildschirm und Mikrofon =====
// Die Aufnahmen werden zu EINER Audiodatei zusammengesetzt (Frage → Pause → Antwort → Antwort).
// Eine durchgehende Datei läuft auf dem iPhone auch bei gesperrtem Bildschirm weiter und erscheint
// in CarPlay unter „Wird gespielt“. ⏭/⏮ (Lenkrad, Sperrbildschirm) springen zwischen Wörtern.

const CAR_KEY="clonelingo-car", CAR_RATE=22050;
const car={el:null,url:null,marks:[],cur:-1,building:false,
  opts:Object.assign({src:"learned",dir:"de",pause:4,count:20},(()=>{try{return JSON.parse(localStorage.getItem(CAR_KEY))||{}}catch(e){return{}}})())};
const saveCarOpts=()=>{try{localStorage.setItem(CAR_KEY,JSON.stringify(car.opts))}catch(e){}};

function carAudio(){
  if(!car.el){
    const a=car.el=new Audio();a.preload="auto";
    a.addEventListener("timeupdate",carTick);
    for(const ev of ["play","pause","ended"])a.addEventListener(ev,carButtons);
  }
  return car.el;
}

// ---- Auswahl der Wörter ----
function carSources(){
  const out=[];
  if(learnedItems().length>=4)out.push({id:"learned",label:"Gelernte Wörter (schwierige zuerst)"});
  UNITS.forEach((u,ui)=>{if(unitOpen(ui))out.push({id:u.ch,label:`Kapitel ${ui+1} · ${u.title}`})});
  return out;
}
function carItems(){
  const o=car.opts;
  const score=x=>{
    const cards=DECKS[x.ch].filter(c=>c.i===x.i).map(c=>state.c[c.id]);
    return cards.reduce((a,c)=>a+c.miss*3+(4-c.lv)*2,0)/cards.length+Math.random()*4;
  };
  let pool=o.src==="learned"?learnedItems():(CHAPTERS[o.src]?CHAPTERS[o.src].items.map((v,i)=>({ch:o.src,i})):[]);
  // Doppelte raus, schwierige zuerst, dann gemischt
  const seen=new Set();pool=pool.filter(x=>{const k=x.ch+":"+x.i;if(seen.has(k))return false;seen.add(k);return true});
  pool=pool.map(x=>Object.assign({},x,{s:score(x)})).sort((a,b)=>b.s-a.s).slice(0,o.count);
  return shuffle(pool);
}

// ---- Spur bauen ----
const AC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
function decode(ctx,ab){return new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)})}
function renderCtx(ctx){return new Promise(res=>{ctx.oncomplete=e=>res(e.renderedBuffer);const p=ctx.startRendering();if(p&&p.then)p.then(res)})}
function wavFromBuffer(buf){
  const data=buf.getChannelData(0), n=data.length, ab=new ArrayBuffer(44+n*2), d=new DataView(ab);
  const str=(o,t)=>{for(let i=0;i<t.length;i++)d.setUint8(o+i,t.charCodeAt(i))};
  str(0,"RIFF");d.setUint32(4,36+n*2,true);str(8,"WAVEfmt ");d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);
  d.setUint32(24,CAR_RATE,true);d.setUint32(28,CAR_RATE*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);str(36,"data");d.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)d.setInt16(44+i*2,Math.max(-1,Math.min(1,data[i]))*32767,true);
  return new Blob([ab],{type:"audio/wav"});
}
async function buildCarTrack(items){
  const o=car.opts, dec=new AC(1,CAR_RATE,CAR_RATE), cache={};
  const clip=async(lang,text)=>{
    const f=AUDIO[lang+"|"+String(text).trim()]; if(!f)return null;
    if(!(f in cache)){try{cache[f]=await decode(dec,await (await fetch("audio/"+f)).arrayBuffer())}catch(e){cache[f]=null}}
    return cache[f];
  };
  const parts=[],marks=[];let t=.6;
  for(let k=0;k<items.length;k++){
    const x=items[k], v=CHAPTERS[x.ch].items[x.i];
    const de=x.ch==="numbers"?v[0].replace(/\D/g,""):v[0], es=v[1];
    const toEs=o.dir==="de"||(o.dir==="mix"&&k%2===0);
    const q=toEs?["de",de]:["es",es], a=toEs?["es",es]:["de",de];
    const qb=await clip(...q), ab=await clip(...a);
    if(!qb||!ab)continue;
    const m={t,q:q[1],a:a[1],qLang:q[0]};
    parts.push([qb,t]);t+=qb.duration+o.pause;
    m.ta=t;parts.push([ab,t]);t+=ab.duration+.7;
    // Antwort wiederholen, damit sie hängen bleibt
    parts.push([ab,t]);t+=ab.duration+1.6;
    marks.push(m);
  }
  if(!marks.length)return null;
  const ctx=new AC(1,Math.ceil(t*CAR_RATE),CAR_RATE);
  for(const [b,at] of parts){const s=ctx.createBufferSource();s.buffer=b;s.connect(ctx.destination);s.start(at)}
  const out=await renderCtx(ctx);
  return {blob:wavFromBuffer(out),marks,dur:t};
}

// ---- Abspielen ----
async function carStart(){
  if(car.building)return;
  const a=carAudio();
  // iOS: Wiedergabe muss beim Tippen beginnen – kurz Stille starten, danach darf die fertige Spur spielen
  try{a.src=makeWav([],.2);a.play().catch(()=>{})}catch(e){}
  car.building=true;car.stale=false;carButtons();
  $("carNow").textContent="Wird vorbereitet …";$("carSub").textContent="";
  let res=null;
  try{res=await buildCarTrack(carItems())}catch(e){res=null}
  car.building=false;
  if(!res){$("carNow").textContent="Keine Wörter gefunden";carButtons();return}
  if(car.url)URL.revokeObjectURL(car.url);
  car.url=URL.createObjectURL(res.blob);car.marks=res.marks;car.cur=-1;car.key=null;
  $("carDl").href=car.url;$("carDl").hidden=false;
  a.src=car.url;a.currentTime=0;
  a.play().catch(()=>{$("carNow").textContent="Tippe auf ▶ zum Abspielen"});
  carMedia();carButtons();
}
function carToggle(){
  const a=carAudio();
  if(!car.url||car.stale)return carStart();
  if(a.paused)a.play().catch(()=>{});else a.pause();
}
function carSeek(d){
  const a=carAudio();if(!car.marks.length)return;
  let k=car.cur;
  if(d<0&&k>=0&&a.currentTime-car.marks[k].t>2)d=0; // erst zum Anfang des aktuellen Worts
  k=Math.max(0,Math.min(car.marks.length-1,k+d));
  a.currentTime=car.marks[k].t;carTick();
}
function carTick(){
  const a=car.el;if(!a||!car.marks.length)return;
  let k=-1;for(let i=0;i<car.marks.length;i++)if(a.currentTime>=car.marks[i].t-.05)k=i;
  if(k<0)k=0;
  const m=car.marks[k], showA=a.currentTime>=m.ta-.05;
  const key=k+(showA?"a":"q");
  if(key===car.key)return;car.key=key;car.cur=k;
  $("carNow").textContent=m.q;
  $("carNow").className="carnow"+(m.qLang==="es"?" es":"");
  $("carSub").textContent=showA?"→ "+m.a:"…";
  $("carCount").textContent=`Wort ${k+1} von ${car.marks.length}`;
  $("carBar").style.width=((k+1)/car.marks.length*100)+"%";
  // CarPlay / Sperrbildschirm: Wort anzeigen, Lösung erst wenn sie gesagt wird
  if("mediaSession" in navigator&&window.MediaMetadata){
    try{navigator.mediaSession.metadata=new MediaMetadata({title:showA?`${m.q} → ${m.a}`:m.q,artist:`Clonelingo · Wort ${k+1}/${car.marks.length}`,album:"Auto-Modus",
      artwork:[{src:"icons/icon-512.png",sizes:"512x512",type:"image/png"}]})}catch(e){}
  }
}
function carMedia(){
  if(!("mediaSession" in navigator))return;
  const ms=navigator.mediaSession, set=(k,f)=>{try{ms.setActionHandler(k,f)}catch(e){}};
  set("play",()=>carAudio().play());
  set("pause",()=>carAudio().pause());
  set("nexttrack",()=>carSeek(1));
  set("previoustrack",()=>carSeek(-1));
  set("seekforward",()=>carSeek(1));
  set("seekbackward",()=>carSeek(-1));
}
function carButtons(){
  const a=car.el, playing=a&&!a.paused&&!a.ended&&car.url&&!car.building;
  $("carPlay").textContent=car.building?"⏳":playing?"⏸":"▶";
  $("carPlay").setAttribute("aria-label",playing?"Pause":"Abspielen");
  if(a&&a.ended&&car.marks.length){$("carNow").textContent="Fertig! 🎉";$("carSub").textContent="Tippe auf ↻ für eine neue Runde";}
}

// ---- Ansicht ----
function seg(id,list,key){
  const el=$(id);el.textContent="";
  for(const [val,label] of list){
    const b=document.createElement("button");b.type="button";b.className="segbtn"+(car.opts[key]===val?" on":"");b.textContent=label;
    b.addEventListener("click",()=>{car.opts[key]=val;car.stale=true;saveCarOpts();renderCarOpts()});
    el.appendChild(b);
  }
}
function renderCarOpts(){
  const srcs=carSources();
  if(!srcs.some(s=>s.id===car.opts.src)&&srcs.length)car.opts.src=srcs[0].id;
  const sel=$("carSrc");sel.textContent="";
  for(const s of srcs){const op=document.createElement("option");op.value=s.id;op.textContent=s.label;sel.appendChild(op)}
  sel.value=car.opts.src;
  seg("carDir",[["de","Deutsch → Spanisch"],["es","Spanisch → Deutsch"],["mix","Gemischt"]],"dir");
  seg("carPause",[[3,"3 s"],[4,"4 s"],[6,"6 s"],[8,"8 s"]],"pause");
  seg("carNum",[[10,"10"],[20,"20"],[40,"40"]],"count");
}
function openCar(){
  renderCarOpts();carButtons();
  if(!car.url){$("carNow").textContent="Bereit";$("carSub").textContent="Handy weglegen, zuhören, laut antworten.";$("carCount").textContent="";$("carBar").style.width="0"}
  show("car");window.scrollTo(0,0);
}
function closeCar(){if(car.el)car.el.pause();show("home")}

$("carBack").addEventListener("click",closeCar);
$("carPlay").addEventListener("click",carToggle);
$("carNew").addEventListener("click",carStart);
$("carPrev").addEventListener("click",()=>carSeek(-1));
$("carNext").addEventListener("click",()=>carSeek(1));
$("carSrc").addEventListener("change",e=>{car.opts.src=e.target.value;car.stale=true;saveCarOpts()});
