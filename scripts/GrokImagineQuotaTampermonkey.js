// ==UserScript==
// @name         Grok Imagine Quota Overlay
// @namespace    https://grok.com/
// @version      1.3.0
// @description  Auto-display your Grok Imagine quota info as an on-page overlay
// @match        https://grok.com/imagine
// @match        https://grok.com/imagine/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  const ID='giq-panel', POS='giq-pos', REFRESH=60000;
  const LABELS={image:'Speed Mode',imagePro:'Quality Mode',imageEdit:'Image Edit',video:'480p Video',video720p:'720p Video'};
  const ORDER=['image','imagePro','imageEdit','video','video720p'];
  const CSS=`
#${ID}{position:fixed;top:16px;right:16px;z-index:2147483647;width:300px;font:12px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e5e7eb;background:linear-gradient(180deg,rgba(22,22,26,.95),rgba(14,14,18,.95));border:1px solid rgba(255,255,255,.1);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.45);backdrop-filter:blur(8px);user-select:none;overflow:hidden}
#${ID} .h{display:flex;align-items:center;gap:6px;padding:9px 11px;cursor:move;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.02)}
#${ID} .t{flex:1;font-weight:600;font-size:12.5px}
#${ID} .u{font-size:10px;color:#9ca3af;margin-right:4px}
#${ID} .b{background:rgba(255,255,255,.04);color:#d1d5db;border:1px solid rgba(255,255,255,.12);border-radius:6px;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;padding:0}
#${ID} .b:hover{background:rgba(255,255,255,.1)}
#${ID} .body{padding:8px 10px 10px;max-height:70vh;overflow:auto}
#${ID}.col .body{display:none}
#${ID} .card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:8px 10px;margin-bottom:6px}
#${ID} .card:last-child{margin-bottom:0}
#${ID} .ct{font-weight:600;font-size:12.5px;color:#f3f4f6;display:flex;align-items:center;gap:6px;margin-bottom:4px}
#${ID} .d{width:8px;height:8px;border-radius:50%;background:#34d399;box-shadow:0 0 6px rgba(52,211,153,.6);flex:none}
#${ID} .d.w{background:#fbbf24;box-shadow:0 0 6px rgba(251,191,36,.6)}
#${ID} .d.x{background:#f87171;box-shadow:0 0 6px rgba(248,113,113,.6)}
#${ID} .r{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;padding:2px 0}
#${ID} .l{color:#9ca3af}
#${ID} .v{color:#e5e7eb;font-variant-numeric:tabular-nums;text-align:right;user-select:text}
#${ID} .v.zero{color:#f87171;font-weight:600}
#${ID} .v.good{color:#34d399;font-weight:600}
#${ID} .reset{margin-top:4px;padding-top:6px;border-top:1px dashed rgba(255,255,255,.08)}
#${ID} .when{font-size:11px;color:#d1d5db;text-align:right;user-select:text}
#${ID} .cd{font-size:11px;color:#93c5fd;font-variant-numeric:tabular-nums;text-align:right;user-select:text}
#${ID} .s,#${ID} .e{padding:6px 4px;white-space:pre-wrap;word-break:break-word;user-select:text}
#${ID} .s{opacity:.75;font-style:italic}
#${ID} .e{color:#fca5a5}
#${ID} .e .ec{display:block;font-weight:600;margin-bottom:2px;color:#f87171}
#${ID} .e .em{display:block;color:#fecaca;font-style:normal}`;

  let counts=[];
  const fmtDate=iso=>{const d=new Date(iso);return isNaN(d)?iso:d.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
  const fmtCD=iso=>{let s=Math.floor((new Date(iso)-Date.now())/1000);if(!Number.isFinite(s))return'';if(s<=0)return'available now';const d=Math.floor(s/86400);s%=86400;const h=Math.floor(s/3600);s%=3600;const m=Math.floor(s/60);s%=60;const p=n=>String(n).padStart(2,'0');if(d)return `in ${d}d ${p(h)}h ${p(m)}m`;if(h)return `in ${h}h ${p(m)}m ${p(s)}s`;if(m)return `in ${m}m ${p(s)}s`;return `in ${s}s`};

  function extractMsg(txt){
    if(!txt)return '';
    try{
      const o=JSON.parse(txt);
      const m=o.message||o.error||o.detail||o.error_description||(o.error&&o.error.message);
      if(m)return String(m);
      return JSON.stringify(o,null,2);
    }catch{return txt.trim().slice(0,500);}
  }

  function panel(){
    let el=document.getElementById(ID);
    if(el)return el;
    const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    el=document.createElement('div');el.id=ID;
    el.innerHTML=`<div class="h"><span class="t">Imagine Quota</span><span class="u" data-r="u"></span><button class="b" data-a="r" title="Refresh">↻</button><button class="b" data-a="t" title="Collapse">–</button><button class="b" data-a="x" title="Close">×</button></div><div class="body" data-r="body"><div class="s">Loading…</div></div>`;
    document.body.appendChild(el);
    try{const p=JSON.parse(localStorage.getItem(POS)||'null');if(p&&Number.isFinite(p.left)&&Number.isFinite(p.top)){el.style.left=p.left+'px';el.style.top=p.top+'px';el.style.right='auto'}}catch{}
    el.querySelector('.h').addEventListener('mousedown',drag);
    el.addEventListener('click',e=>{const a=e.target?.dataset?.a;if(!a)return;if(a==='r')load();else if(a==='t')el.classList.toggle('col');else if(a==='x')el.remove()});
    return el;
  }

  function drag(e){
    if(e.target.closest('.b'))return;
    const el=document.getElementById(ID);if(!el)return;
    const r=el.getBoundingClientRect(),ox=e.clientX-r.left,oy=e.clientY-r.top;
    el.style.right='auto';
    const mv=ev=>{el.style.left=Math.max(0,Math.min(innerWidth-r.width,ev.clientX-ox))+'px';el.style.top=Math.max(0,Math.min(innerHeight-r.height,ev.clientY-oy))+'px'};
    const up=()=>{removeEventListener('mousemove',mv);removeEventListener('mouseup',up);try{localStorage.setItem(POS,JSON.stringify({left:parseFloat(el.style.left)||0,top:parseFloat(el.style.top)||0}))}catch{}};
    addEventListener('mousemove',mv);addEventListener('mouseup',up);e.preventDefault();
  }

  function status(text){
    const body=panel().querySelector('[data-r="body"]');
    body.innerHTML='';const d=document.createElement('div');d.className='s';d.textContent=text;body.appendChild(d);counts=[];
  }
  function showError(code,msg){
    const body=panel().querySelector('[data-r="body"]');
    body.innerHTML='';
    const w=document.createElement('div');w.className='e';
    const c=document.createElement('span');c.className='ec';c.textContent=code;
    const m=document.createElement('span');m.className='em';m.textContent=msg||'(no details provided)';
    w.appendChild(c);w.appendChild(m);body.appendChild(w);counts=[];
  }

  function render(j){
    const el=panel(),body=el.querySelector('[data-r="body"]');
    body.innerHTML='';counts=[];
    const keys=[...ORDER.filter(k=>k in j),...Object.keys(j).filter(k=>!ORDER.includes(k))];
    for(const k of keys){
      const v=j[k];if(!v||typeof v!=='object')continue;
      const card=document.createElement('div');card.className='card';
      const rem=Number(v.remainingQueries),hasRem=Number.isFinite(rem);
      const dc=!hasRem?'':rem===0?'x':rem<=3?'w':'';
      const title=document.createElement('div');title.className='ct';
      title.innerHTML=`<span class="d ${dc}"></span><span></span>`;
      title.lastElementChild.textContent=LABELS[k]||k;
      card.appendChild(title);
      if(hasRem){
        const row=document.createElement('div');row.className='r';
        row.innerHTML=`<span class="l">Remaining Generation Attempts</span><span class="v ${rem===0?'zero':'good'}"></span>`;
        row.lastElementChild.textContent=String(rem);
        card.appendChild(row);
      }
      if(v.nextAvailableAt){
        const w=document.createElement('div');w.className='reset';
        w.innerHTML=`<div class="r"><span class="l">Next Quota Reset</span><span class="when"></span></div><div class="r"><span class="l"></span><span class="cd"></span></div>`;
        w.querySelector('.when').textContent=fmtDate(v.nextAvailableAt);
        const cd=w.querySelector('.cd');cd.textContent=fmtCD(v.nextAvailableAt);
        counts.push({iso:v.nextAvailableAt,el:cd});
        card.appendChild(w);
      }
      body.appendChild(card);
    }
    const u=el.querySelector('[data-r="u"]');
    if(u)u.textContent='updated '+new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
  }

  async function load(){
    panel();
    const body=document.querySelector(`#${ID} [data-r="body"]`);
    if(body&&!body.querySelector('.card'))status('Loading…');
    try{
      const res=await fetch('https://grok.com/rest/media/imagine/quota_info',{method:'POST',mode:'cors',credentials:'include',referrer:'https://grok.com/',headers:{'accept':'*/*','accept-language':'en-US,en;q=0.9','content-type':'application/json'},body:'{}'});
      if(!res.ok){
        const txt=await res.text().catch(()=>'');
        const msg=extractMsg(txt);
        console.error('[Grok Imagine Quota]',res.status,res.statusText,txt);
        showError(`HTTP ${res.status} ${res.statusText||''}`.trim(),msg);
        return;
      }
      const j=await res.json();render(j);console.log('[Grok Imagine Quota]',j);
    }catch(e){
      console.error('[Grok Imagine Quota]',e);
      showError('Request failed',e?.message||String(e));
    }
  }

  function init(){
    panel();
    setInterval(()=>{
      let reload=false;
      for(const {iso,el} of counts){
        if(!el.isConnected)continue;
        const t=fmtCD(iso);el.textContent=t;
        if(t==='available now')reload=true;
      }
      if(reload){counts=[];load();}
    },1000);
    load();
    setInterval(load,REFRESH);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();