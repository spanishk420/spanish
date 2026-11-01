// ===== Lernpfad & Lektionen (spielerisch, ähnlich Duolingo) =====
// Aufbau und Ablauf angelehnt an sanidhyy/duolingo-clone (MIT-Lizenz, © 2024 Sanidhya Kumar Verma):
// Zickzack-Pfad (lesson-button.tsx), Lektion mit Herzen/Fortschritt/Prüfen-Leiste (quiz.tsx, footer.tsx, card.tsx).
// Hier ohne Server: alles in localStorage, Inhalte aus CHAPTERS.

const GAME_KEY="espanol-game-v1", GOAL_XP=30, MAX_HEARTS=5, XP_PER=1;
let game=loadGame();
function loadGame(){
  let g=null;try{g=JSON.parse(localStorage.getItem(GAME_KEY))}catch(e){}
  return Object.assign({xp:0,done:{},streak:0,last:"",today:"",todayXp:0},g||{});
}
function saveGame(){try{localStorage.setItem(GAME_KEY,JSON.stringify(game))}catch(e){}}
function resetGame(){game={xp:0,done:{},streak:0,last:"",today:"",todayXp:0};saveGame();renderHome()}
const dayStr=(d=new Date())=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
function streakNow(){
  const t=dayStr(), y=dayStr(new Date(Date.now()-864e5));
  return game.last===t||game.last===y?game.streak:0;
}
function addXp(n){
  const t=dayStr(), y=dayStr(new Date(Date.now()-864e5));
  if(game.today!==t){game.today=t;game.todayXp=0}
  game.todayXp+=n;game.xp+=n;
  if(game.last!==t){game.streak=game.last===y?game.streak+1:1;game.last=t}
  saveGame();
}

// ---- Einheiten und Lektionen ----
const UNITS=[
  {ch:"verbs",title:"Einheit 1 · Verben",desc:"Die 30 wichtigsten Verben",color:"azul",size:5},
  {ch:"colors",title:"Einheit 2 · Farben",desc:"Die Grundfarben",color:"sol",size:5},
  {ch:"colors2",title:"Einheit 3 · Weitere Farben",desc:"Lila, golden, hell und dunkel",color:"lila",size:5},
  {ch:"numbers",title:"Einheit 4 · Zahlen",desc:"Von cero bis mil",color:"ok",
   groups:[[0,10],[11,15],[16,20],[21,29],[30,39],[40,59],[60,79],[80,99],[100,1000]]},
];
const SOON=[{title:"Einheit 5 · Konjugation",desc:"yo, tú, él … im Präsens"},{title:"Einheit 6 · Alltagssätze",desc:"¿Qué haces?, No sé …"}];
function unitLessons(u){
  const items=CHAPTERS[u.ch].items, out=[];
  if(u.groups){
    for(const [a,b] of u.groups){
      const idx=items.map((v,i)=>i).filter(i=>{const n=+items[i][0].replace(/\D/g,"");return n>=a&&n<=b});
      out.push({id:`${u.ch}:${a}-${b}`,idx,label:a===b?String(a):`${a}–${b}`});
    }
  }else{
    for(let k=0;k<items.length;k+=u.size){
      const idx=[];for(let i=k;i<Math.min(items.length,k+u.size);i++)idx.push(i);
      out.push({id:`${u.ch}:${k}`,idx,label:idx.map(i=>items[i][1]).slice(0,2).join(", ")+"…"});
    }
  }
  // Abschluss: Wiederholung der ganzen Einheit
  out.push({id:`${u.ch}:review`,idx:items.map((v,i)=>i),review:true,label:"Wiederholung"});
  return out;
}
// Anteil der Karten einer Lektion, die schon „sitzen“
function lessonKnown(u,l){
  const cards=DECKS[u.ch].filter(c=>l.idx.includes(c.i));
  return cards.filter(c=>state.c[c.id].lv>=3).length/cards.length;
}

// ---- Startseite: Pfad ----
function renderPath(){
  const st=streakNow();
  $("gStreak").textContent="🔥 "+st;$("gStreak").classList.toggle("on",st>0);
  $("gXp").textContent="⚡ "+game.xp;
  const tx=game.today===dayStr()?game.todayXp:0;
  $("gGoalTxt").textContent=tx>=GOAL_XP?`Tagesziel geschafft! ${tx} XP heute 🎉`:`Tagesziel: ${tx} / ${GOAL_XP} XP`;
  $("gGoalBar").style.width=Math.min(100,tx/GOAL_XP*100)+"%";
  const path=$("path");path.textContent="";
  UNITS.forEach(u=>{
    const ls=unitLessons(u), sec=document.createElement("section");sec.className="unit "+u.color;
    const ban=document.createElement("div");ban.className="ubanner";
    ban.innerHTML=`<div><h3></h3><p></p></div><button class="ubtn" type="button">📇 Üben</button>`;
    ban.querySelector("h3").textContent=u.title;ban.querySelector("p").textContent=u.desc;
    ban.querySelector(".ubtn").addEventListener("click",()=>openChapter(u.ch));
    sec.appendChild(ban);
    const list=document.createElement("div");list.className="lessons";
    const firstOpen=ls.findIndex(l=>!game.done[l.id]);
    ls.forEach((l,index)=>{
      // Zickzack wie im Original: Einrückung läuft in Achterzyklen hin und her
      const cyc=index%8; let ind;
      if(cyc<=2)ind=cyc; else if(cyc<=6)ind=4-cyc; else ind=cyc-8;
      const done=!!game.done[l.id], current=index===firstOpen, locked=!done&&!current;
      const wrap=document.createElement("div");wrap.className="lwrap"+(current?" cur":"");wrap.style.transform=`translateX(${ind*-42}px)`;
      const b=document.createElement("button");b.type="button";
      b.className="lnode"+(done?" done":"")+(current?" current":"")+(locked?" locked":"")+(l.review?" crown":"");
      b.innerHTML=`<span class="licon">${l.review?"👑":done?"✓":"★"}</span>`;
      b.setAttribute("aria-label",`${l.review?"Wiederholung":"Lektion "+(index+1)}: ${l.label}${done?" (geschafft)":locked?" (gesperrt)":""}`);
      if(locked)b.disabled=true;
      b.addEventListener("click",()=>startLesson(u,l));
      if(current){
        const ring=document.createElement("div");ring.className="ring";
        ring.style.setProperty("--p",Math.round(lessonKnown(u,l)*100));
        const tip=document.createElement("div");tip.className="ltip";tip.textContent=index===0&&!Object.keys(game.done).some(k=>k.startsWith(u.ch+":"))?"Start":"Weiter";
        wrap.append(tip,ring);ring.appendChild(b);
      }else wrap.appendChild(b);
      const cap=document.createElement("div");cap.className="lcap";cap.textContent=l.label;wrap.appendChild(cap);
      list.appendChild(wrap);
    });
    sec.appendChild(list);path.appendChild(sec);
  });
  for(const s of SOON){
    const sec=document.createElement("section");sec.className="unit soonunit";
    sec.innerHTML=`<div class="ubanner"><div><h3></h3><p></p></div><span class="soon">bald</span></div>`;
    sec.querySelector("h3").textContent=s.title;sec.querySelector("p").textContent=s.desc;
    path.appendChild(sec);
  }
}

// ---- Aufgaben erzeugen ----
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const sample=(arr,n)=>shuffle(arr.slice()).slice(0,n);
const isColor=ch=>ch==="colors"||ch==="colors2";
const numStr=v=>v[0].replace(/\D/g,"");
// Ablenker: andere Wörter aus derselben Einheit, möglichst aus der Lektion
function distractors(ch,i,pool,n){
  const items=CHAPTERS[ch].items, own=items[i];
  let cand=pool.filter(k=>k!==i&&items[k][1]!==own[1]&&items[k][0]!==own[0]);
  if(cand.length<n)cand=cand.concat(items.map((v,k)=>k).filter(k=>k!==i&&!cand.includes(k)&&items[k][1]!==own[1]));
  return sample(cand,n);
}
function makeTask(ch,i,type,pool){
  const v=CHAPTERS[ch].items[i], num=ch==="numbers";
  const opts=k=>shuffle([i,...distractors(ch,i,pool,k)]);
  const pre=CHAPTERS[ch].prefix;
  const card=dir=>num?pre+v[0]:pre+v[1]+"|"+dir;
  switch(type){
    case "pickEs": return {type,ch,i,card:card("de"),title:num?"Wie heißt diese Zahl auf Spanisch?":"Wie heißt das auf Spanisch?",
      prompt:num?numStr(v):v[0],promptLang:"de",swatch:isColor(ch)?v[5]:null,options:opts(3).map(k=>({k,text:CHAPTERS[ch].items[k][1],lang:"es"}))};
    case "pickDe": return {type,ch,i,card:card("es"),title:num?"Welche Zahl ist das?":"Was bedeutet das?",
      prompt:v[1],promptLang:"es",bubble:true,options:opts(3).map(k=>({k,text:num?numStr(CHAPTERS[ch].items[k]):CHAPTERS[ch].items[k][0],lang:"de"}))};
    case "listen": return {type,ch,i,card:card("es"),title:"Was hörst du?",listen:v[1],
      options:opts(3).map(k=>({k,text:CHAPTERS[ch].items[k][1],lang:"es",silent:true}))};
    case "color": return {type,ch,i,card:card("es"),title:"Welche Farbe ist das?",prompt:v[1],promptLang:"es",bubble:true,
      options:opts(3).map(k=>({k,swatch:CHAPTERS[ch].items[k][5],text:CHAPTERS[ch].items[k][0]}))};
    case "type": return {type,ch,i,card:card("de"),title:num?"Schreib die Zahl auf Spanisch":"Schreib auf Spanisch",
      prompt:num?numStr(v):v[0],promptLang:"de",swatch:isColor(ch)?v[5]:null,answer:v[1]};
  }
}
function buildLesson(u,l){
  const ch=u.ch, tasks=[];
  if(l.review){
    // Wiederholung: Wörter mit niedrigem Level bevorzugt, gemischte Aufgaben
    const items=CHAPTERS[ch].items;
    const lvl=i=>DECKS[ch].filter(c=>c.i===i).reduce((a,c)=>a+state.c[c.id].lv,0);
    const pick=l.idx.slice().sort((a,b)=>lvl(a)-lvl(b)+(Math.random()-.5)*3).slice(0,Math.min(10,items.length));
    const types=ch==="numbers"?["pickEs","listen","type","pickDe"]:isColor(ch)?["pickEs","color","listen","type","pickDe"]:["pickEs","pickDe","listen","type"];
    pick.forEach((i,n)=>tasks.push(makeTask(ch,i,types[n%types.length],l.idx)));
    return shuffle(tasks);
  }
  // Normale Lektion: jedes Wort erst erkennen, dann hören, dann selbst schreiben
  const first=[],second=[],third=[];
  for(const i of l.idx){
    if(ch==="numbers"){first.push(makeTask(ch,i,"pickEs",l.idx));second.push(makeTask(ch,i,Math.random()<.5?"listen":"pickDe",l.idx));third.push(makeTask(ch,i,"type",l.idx))}
    else{
      first.push(makeTask(ch,i,isColor(ch)&&CHAPTERS[ch].items[i][5]&&!/gradient/.test(CHAPTERS[ch].items[i][5])?"color":"pickDe",l.idx));
      second.push(makeTask(ch,i,Math.random()<.5?"listen":"pickEs",l.idx));
      third.push(makeTask(ch,i,"type",l.idx));
    }
  }
  // Große Zahlen-Lektionen kürzen, damit eine Lektion ~10–15 Aufgaben hat
  let all=shuffle(first).concat(shuffle(second),shuffle(third));
  if(all.length>15){const keep=new Set(sample(l.idx,Math.ceil(15/3)));all=all.filter(t=>keep.has(t.i))}
  return all;
}

// ---- Lektion abspielen ----
const L={u:null,l:null,tasks:[],pos:0,total:0,correct:0,hearts:MAX_HEARTS,sel:null,status:"none",mistakes:0,firstTry:new Set(),wrongOnce:new Set()};
function startLesson(u,l){
  try{tts&&tts.cancel()}catch(e){}
  if(typeof unlockSfx==="function")unlockSfx();
  Object.assign(L,{u,l,tasks:buildLesson(u,l),pos:0,correct:0,hearts:MAX_HEARTS,sel:null,status:"none",mistakes:0,wrongOnce:new Set()});
  L.total=L.tasks.length;
  show("lesson");$("lsFinish").hidden=true;$("lsMain").hidden=false;
  renderTask();
}
function gradeCardId(ch,id,knew){
  const s=state.c[id], st=state.st[ch]; if(!s)return;
  if(knew){s.lv=Math.min(4,s.lv+1);st.ok++}else{s.lv=0;s.miss++;st.no++}
  save();
}
function renderHeader(){
  $("lsBar").style.width=Math.min(100,L.correct/L.tasks.length*100)+"%";
  $("lsHearts").textContent="❤️ "+L.hearts;
}
function renderTask(){
  const t=L.tasks[L.pos];
  if(!t)return finishLesson();
  L.sel=null;L.status="none";
  renderHeader();
  $("lsTitle").textContent=t.title;
  const q=$("lsQ");q.textContent="";q.className="lsq";
  if(t.listen){
    const b=document.createElement("button");b.type="button";b.className="bigspeak";b.textContent="🔊";b.setAttribute("aria-label","Nochmal anhören");
    const slow=document.createElement("button");slow.type="button";slow.className="bigspeak small";slow.textContent="🐢";slow.setAttribute("aria-label","Langsam anhören");
    b.addEventListener("click",()=>sayWord(t.listen,"es"));
    slow.addEventListener("click",()=>sayWord(t.listen,"es",true));
    q.append(b,slow);q.classList.add("listen");
    sayWord(t.listen,"es");
  }else if(t.prompt!=null){
    if(t.swatch){const sw=document.createElement("div");sw.className="swatch";sw.style.background=t.swatch;q.appendChild(sw)}
    const bub=document.createElement("button");bub.type="button";bub.className="bubble"+(t.promptLang==="es"?" es":"");
    bub.innerHTML=`<span class="spk">🔊</span><span class="w"></span>`;bub.querySelector(".w").textContent=t.prompt;
    bub.addEventListener("click",()=>sayWord(t.prompt,t.promptLang));
    q.appendChild(bub);
    if(t.promptLang==="es"||L.pos===0)sayWord(t.prompt,t.promptLang);
  }
  const o=$("lsOpts");o.textContent="";o.className="lsopts"+(t.options&&t.options[0].swatch?" swatches":"");
  $("lsType").hidden=t.type!=="type";
  if(t.type==="type"){
    const inp=$("lsInp");inp.value="";inp.disabled=false;inp.className="";
    setTimeout(()=>inp.focus(),50);
  }else{
    t.options.forEach((op,n)=>{
      const c=document.createElement("button");c.type="button";c.className="opt";c.dataset.n=n;
      if(op.swatch){const sw=document.createElement("div");sw.className="swatch";sw.style.background=op.swatch;c.appendChild(sw)}
      const tx=document.createElement("span");tx.className="otext"+(op.lang==="es"?" es":"");tx.textContent=op.swatch?"":op.text;c.appendChild(tx);
      const key=document.createElement("span");key.className="okey";key.textContent=n+1;c.appendChild(key);
      c.addEventListener("click",()=>selectOpt(n));
      o.appendChild(c);
    });
  }
  setFooter();
}
function sayWord(text,lang,slow){
  try{tts&&tts.cancel()}catch(e){}
  // Langsam: Aufnahme mit 70 % Tempo (Tonhöhe bleibt)
  if(vox){vox.defaultPlaybackRate=slow?.7:1;vox.playbackRate=slow?.7:1}
  if(typeof say==="function")say(text,lang);
}
function selectOpt(n){
  if(L.status!=="none")return;
  const t=L.tasks[L.pos];L.sel=n;
  document.querySelectorAll("#lsOpts .opt").forEach(b=>b.classList.toggle("sel",+b.dataset.n===n));
  const op=t.options[n];
  // Wie im Original: Antippen einer Karte spielt ihr Audio
  if(op.lang==="es"&&!op.silent)sayWord(op.text,"es");
  setFooter();
}
function normAns(s){return plain(s).replace(/[¡!¿?.,]/g,"").replace(/^(el|la|los|las|un|una) /,"").trim()}
function check(){
  const t=L.tasks[L.pos];
  let ok, given="";
  if(t.type==="type"){
    given=$("lsInp").value; if(!given.trim())return;
    ok=normAns(given)===normAns(t.answer);
    $("lsInp").disabled=true;$("lsInp").className=ok?"good":"bad";
  }else{
    if(L.sel==null)return;
    ok=t.options[L.sel].k===t.i;
    document.querySelectorAll("#lsOpts .opt").forEach(b=>{
      const n=+b.dataset.n;
      if(n===L.sel)b.classList.add(ok?"good":"bad");
      if(!ok&&t.options[n].k===t.i)b.classList.add("right");
      b.disabled=true;
    });
  }
  const key=t.type+":"+t.i;
  if(ok){
    L.status="correct";L.correct++;
    if(!L.wrongOnce.has(key))gradeCardId(t.ch,t.card,true);
    if(typeof playSfx==="function")playSfx("ok");
    // Nach dem Schreiben das Wort einmal vorlesen
    if(t.type==="type")setTimeout(()=>sayWord(t.answer,"es"),350);
  }else{
    L.status="wrong";L.mistakes++;L.hearts--;
    if(!L.wrongOnce.has(key)){L.wrongOnce.add(key);gradeCardId(t.ch,t.card,false)}
    // Falsche Aufgabe kommt am Ende nochmal dran
    L.tasks.push(Object.assign({},t,{options:t.options?shuffle(t.options.slice()):undefined}));
    if(typeof playSfx==="function")playSfx("no");
    setTimeout(()=>sayWord(CHAPTERS[t.ch].items[t.i][1],"es"),450);
  }
  renderHeader();
  setFooter();
}
function cont(){
  if(L.status==="none")return check();
  if(L.hearts<=0)return outOfHearts();
  L.pos++;renderTask();
}
function setFooter(){
  const t=L.tasks[L.pos], f=$("lsFoot"), btn=$("lsBtn"), msg=$("lsMsg");
  f.className="lsfoot "+L.status;
  msg.textContent="";
  if(L.status==="none"){
    btn.textContent="Prüfen";
    btn.disabled=t.type==="type"?false:L.sel==null;
  }else if(L.status==="correct"){
    msg.innerHTML=`<b>✓ ${["Super!","Richtig!","Genau!","¡Muy bien!","Perfekt!"][Math.floor(Math.random()*5)]}</b>`;
    btn.textContent="Weiter";btn.disabled=false;
  }else{
    const v=CHAPTERS[t.ch].items[t.i];
    const sol=t.type==="pickDe"?(t.ch==="numbers"?numStr(v):v[0]):t.type==="color"?v[0]:v[1];
    msg.innerHTML=`<b>✗ Richtige Lösung:</b><span></span>`;msg.querySelector("span").textContent=sol;
    btn.textContent=L.hearts<=0?"Weiter":"Verstanden";btn.disabled=false;
  }
}
function outOfHearts(){
  $("lsMain").hidden=true;$("lsFinish").hidden=false;
  $("lfEmoji").textContent="💔";
  $("lfTitle").textContent="Keine Herzen mehr";
  $("lfText").textContent="Kein Problem, das gehört dazu. Die schwierigen Wörter kommen jetzt öfter dran. Nochmal?";
  $("lfXp").textContent="0";$("lfAcc").textContent=Math.round((L.total-L.mistakes)/L.total*100)+" %";
  $("lfAgain").hidden=false;$("lfBtn").textContent="Zum Lernpfad";
}
function finishLesson(){
  const xp=L.total*XP_PER+(L.mistakes===0?5:0);
  addXp(xp);
  game.done[L.l.id]=(game.done[L.l.id]||0)+1;saveGame();
  $("lsMain").hidden=true;$("lsFinish").hidden=false;
  $("lfEmoji").textContent=L.mistakes===0?"🏆":"🎉";
  $("lfTitle").textContent=L.mistakes===0?"Perfekt, ohne Fehler!":"Lektion geschafft!";
  $("lfText").textContent=L.l.review?"Die ganze Einheit wiederholt. ¡Fantástico!":"¡Muy bien! Weiter so.";
  $("lfXp").textContent="+"+xp;
  $("lfAcc").textContent=Math.round((L.total-Math.min(L.mistakes,L.total))/L.total*100)+" %";
  $("lfAgain").hidden=false;$("lfBtn").textContent="Weiter";
  playFanfare();confetti();
}
function closeLesson(){try{vox&&vox.pause()}catch(e){};document.querySelectorAll(".confetti").forEach(c=>c.remove());show("home")}

// ---- Abschluss: Fanfare (selbst erzeugt) und Konfetti ----
let fanfare=null;
function playFanfare(){
  try{
    if(!fanfare&&typeof makeWav==="function")fanfare=new Audio(makeWav([[523,0,.25,.3,.2],[659,.12,.25,.3,.2],[784,.24,.3,.3,.2],[1047,.38,.7,.35,.2]],1.15));
    if(fanfare){fanfare.currentTime=0;fanfare.play().catch(()=>{})}
  }catch(e){}
}
function confetti(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const c=document.createElement("canvas");c.className="confetti";document.body.appendChild(c);
  const W=c.width=innerWidth*devicePixelRatio, H=c.height=innerHeight*devicePixelRatio, x=c.getContext("2d");
  const cols=["#1F4C9A","#E3A21A","#1E8A5A","#C2412D","#7B3FA0","#8DB0F0"];
  const ps=Array.from({length:140},()=>({x:W/2+(Math.random()-.5)*W*.3,y:H*.35,vx:(Math.random()-.5)*W*.018,vy:-Math.random()*H*.02-H*.006,
    r:Math.random()*Math.PI,vr:(Math.random()-.5)*.3,s:(6+Math.random()*7)*devicePixelRatio,c:cols[Math.floor(Math.random()*cols.length)]}));
  const t0=performance.now();
  (function frame(t){
    x.clearRect(0,0,W,H);
    for(const p of ps){p.vy+=H*.0006;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;
      x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()}
    if(t-t0<3500)requestAnimationFrame(frame);else c.remove();
  })(t0);
}

$("lsClose").addEventListener("click",closeLesson);
$("lsBtn").addEventListener("click",cont);
$("lsType").addEventListener("submit",e=>{e.preventDefault();cont()});
$("lfBtn").addEventListener("click",closeLesson);
$("lfAgain").addEventListener("click",()=>startLesson(L.u,L.l));
document.addEventListener("keydown",e=>{
  if($("lesson").hidden||!$("lsFinish").hidden)return;
  if(e.target&&e.target.id==="lsInp")return;
  if(/^[1-4]$/.test(e.key)){const t=L.tasks[L.pos];if(t&&t.options&&t.options[+e.key-1])selectOpt(+e.key-1)}
  else if(e.key==="Enter"&&!$("lsBtn").disabled){e.preventDefault();cont()}
});
