import { Hotspot, MetricResult, RuleViolation, Seam, Snapshot } from '../types/config.interface'
import { DICTIONARY, LANGUAGES } from './i18n'

export interface DashboardMetric {
  name: string
  warning: number
  critical: number
  entries: MetricResult[]
}

export interface DashboardModel {
  generatedAt: string
  live: boolean
  failed: boolean
  kpis: { criticals: number; warnings: number; violations: number; hotspots: number; metrics: number }
  metrics: DashboardMetric[]
  violations: RuleViolation[]
  hotspots: Hotspot[]
  seams: Seam[]
  history: Snapshot[]
  cycles: { size: number; path: string[] }[]
  cohesion: { value: string; groups: { methods: string[]; variables: string[] }[] }[]
}

// Anything embedded in a <script> tag could close it early with a stray `<`, so escape it to a
// unicode escape. Valid for both the model and the i18n dictionary.
const embed = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c')

const LIGHT_TOKENS =
  '--bg:#eef1f5;--panel:#fbfcfe;--panel-2:#f3f5f8;--raise:#fff;' +
  '--line:#dde2ea;--line-2:#c9d2de;--fg:#131922;--dim:#4a5666;--muted:#7b8798;' +
  '--accent:#0a6ebd;--accent-dim:#a9d2ec;--ok:#1f8a5b;--warn:#a9721a;--crit:#c93338;'

const STYLE = `
:root{
  --bg:#0a0d13;--panel:#0f141d;--panel-2:#0c111a;--raise:#141b26;
  --line:#1b2432;--line-2:#28323f;--fg:#d9e1ec;--dim:#95a1b3;--muted:#5f6b7d;
  --accent:#57c6ff;--accent-dim:#2b566f;--ok:#3fb37f;--warn:#e0a53a;--crit:#f0555a;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media(prefers-color-scheme:light){:root:not([data-theme]){${LIGHT_TOKENS}}}
:root[data-theme="light"]{${LIGHT_TOKENS}}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--bg);color:var(--fg);font-family:var(--mono);font-size:13px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
.bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:14px;padding:10px 18px;background:linear-gradient(var(--panel),var(--panel-2));border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:baseline;gap:8px;font-weight:600;letter-spacing:.04em}
.brand b{color:var(--accent)}
.brand .v{color:var(--muted);font-weight:400;font-size:11px}
.pill{font-size:11px;font-weight:600;letter-spacing:.08em;padding:3px 9px;border:1px solid;border-radius:3px;text-transform:uppercase}
.pill.pass{color:var(--ok);border-color:var(--ok)}
.pill.fail{color:var(--crit);border-color:var(--crit)}
.meta{margin-left:auto;display:flex;align-items:center;gap:10px;color:var(--muted);font-size:11px}
.live{display:inline-flex;align-items:center;gap:6px;color:var(--ok)}
.live i{width:7px;height:12px;background:var(--ok);display:inline-block;animation:blink 1.1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.ctl{background:var(--bg);border:1px solid var(--line-2);color:var(--dim);font:inherit;font-size:11px;padding:4px 7px;border-radius:4px;cursor:pointer}
.ctl:hover{color:var(--fg);border-color:var(--accent-dim)}
.iconbtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:26px;padding:0}
.iconbtn svg{width:14px;height:14px}
.tabs{display:flex;gap:2px;padding:0 18px;background:var(--panel-2);border-bottom:1px solid var(--line);overflow-x:auto}
.tab{appearance:none;background:none;border:0;border-bottom:2px solid transparent;color:var(--dim);font:inherit;padding:10px 14px;cursor:pointer;white-space:nowrap;letter-spacing:.03em}
.tab:hover{color:var(--fg)}
.tab.on{color:var(--fg);border-color:var(--accent)}
.tab .c{color:var(--muted);margin-left:6px;font-size:11px}
.wrap{max-width:1200px;margin:0 auto;padding:20px 18px 60px}
.grid{display:grid;gap:12px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:6px}
.panel>h2{margin:0;padding:11px 14px;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:8px}
.panel>h2 .sub{color:var(--muted);font-weight:400;letter-spacing:.02em;text-transform:none}
.panel .body{padding:14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;position:relative;overflow:hidden}
.kpi .lab{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.kpi .val{font-size:30px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:4px}
.kpi.crit .val{color:var(--crit)}.kpi.warn .val{color:var(--warn)}.kpi.acc .val{color:var(--accent)}.kpi.ok .val{color:var(--ok)}
.kpi .spark{position:absolute;inset-inline-end:10px;bottom:8px;opacity:.85}
.scroll{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{position:sticky;top:0;text-align:start;color:var(--muted);font-weight:600;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:8px 10px;border-bottom:1px solid var(--line-2);white-space:nowrap;background:var(--panel);cursor:pointer;user-select:none}
th.plain{cursor:default}
th .ar{opacity:.4;margin-inline-start:4px}
th.sorted .ar{opacity:1;color:var(--accent)}
td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}
tbody tr{cursor:default}
tbody tr[data-file]{cursor:pointer}
tbody tr[data-file]:hover{background:var(--raise)}
.num{text-align:end;font-variant-numeric:tabular-nums}
.path{color:var(--dim);max-width:360px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.mut{color:var(--muted)}
.tick{display:inline-block;width:8px;height:8px;border-radius:2px;margin-inline-end:7px;vertical-align:middle}
.tick.CRITICAL{background:var(--crit)}.tick.WARNING{background:var(--warn)}.tick.OK{background:var(--ok)}
.sev{font-size:10px;font-weight:700;letter-spacing:.06em}
.sev.CRITICAL{color:var(--crit)}.sev.WARNING{color:var(--warn)}.sev.OK{color:var(--ok)}
tr[data-sev=CRITICAL] td:first-child{box-shadow:inset 2px 0 var(--crit)}
tr[data-sev=WARNING] td:first-child{box-shadow:inset 2px 0 var(--warn)}
.toolbar{display:flex;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.search{flex:1;min-width:160px;background:var(--bg);border:1px solid var(--line-2);color:var(--fg);font:inherit;font-size:12px;padding:6px 9px;border-radius:4px}
.search:focus{outline:none;border-color:var(--accent-dim)}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{background:var(--bg);border:1px solid var(--line-2);color:var(--dim);font:inherit;font-size:11px;padding:5px 10px;border-radius:4px;cursor:pointer;letter-spacing:.03em}
.chip.on{border-color:var(--accent);color:var(--fg)}
.chip b{color:var(--muted);margin-inline-start:5px}
.chip.on b{color:var(--accent)}
.barrow{display:grid;grid-template-columns:64px 1fr 132px;align-items:center;gap:12px;padding:5px 0}
.barrow .lb{font-size:11px;letter-spacing:.06em;color:var(--dim)}
.track{height:12px;background:var(--bg);border-radius:3px;display:flex;overflow:hidden}
.track .s{height:100%}.track .s.CRITICAL{background:var(--crit)}.track .s.WARNING{background:var(--warn)}
.track .s+.s{margin-inline-start:2px}
.barrow .ct{font-size:11px;color:var(--muted);text-align:end;white-space:nowrap}
.hist{display:flex;align-items:flex-end;gap:3px;height:120px;padding-top:8px}
.hist .col{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:5px;min-width:0}
.hist .col .fill{width:100%;background:var(--accent-dim);border-radius:3px 3px 0 0;min-height:2px}
.hist .col .fill.hot{background:var(--crit)}
.hist .col .fill.warm{background:var(--warn)}
.hist .col small{color:var(--muted);font-size:10px;white-space:nowrap}
.hist .col .n{color:var(--dim);font-size:10px;font-variant-numeric:tabular-nums}
.tree{display:flex;flex-wrap:wrap;gap:2px}
.cell{position:relative;border-radius:3px;overflow:hidden;padding:6px 8px;color:#06090d;min-width:44px}
.cell.OK{background:var(--ok)}.cell.WARNING{background:var(--warn)}.cell.CRITICAL{background:var(--crit)}
.cell .nm{font-size:10px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cell .sc{font-size:10px;opacity:.85}
.viol{list-style:none;margin:0;padding:0}
.viol li{padding:9px 14px;border-bottom:1px solid var(--line);display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.viol code{color:var(--fg);background:var(--bg);padding:2px 6px;border-radius:3px;font-size:11.5px}
.viol .ar{color:var(--crit)}
.viol .m{color:var(--muted);font-size:11.5px}
.empty{padding:26px 14px;color:var(--muted);text-align:center;font-size:12px}
.empty b{color:var(--ok);display:block;font-size:14px;margin-bottom:4px}
footer{color:var(--muted);font-size:11px;text-align:center;padding:24px}
.flash{animation:fl 1.4s ease-out}
@keyframes fl{0%{background:var(--accent-dim)}100%{background:transparent}}
.delta{font-size:10px;font-weight:700;margin-inline-start:6px;padding:1px 5px;border-radius:3px}
.delta.up{color:var(--crit);background:color-mix(in srgb,var(--crit) 16%,transparent)}
.delta.down{color:var(--ok);background:color-mix(in srgb,var(--ok) 16%,transparent)}
.drawer{position:fixed;inset:0 0 0 auto;width:min(440px,92vw);background:var(--panel);border-inline-start:1px solid var(--line-2);transform:translateX(100%);transition:transform .18s ease;z-index:40;display:flex;flex-direction:column;box-shadow:-20px 0 40px rgba(0,0,0,.35)}
[dir=rtl] .drawer{inset:0 auto 0 0;transform:translateX(-100%)}
.drawer.on{transform:none}
.drawer header{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--line)}
.drawer header .x{margin-inline-start:auto;background:none;border:1px solid var(--line-2);color:var(--dim);cursor:pointer;border-radius:4px;width:26px;height:26px;font-size:14px}
.drawer .dbody{overflow:auto;padding:14px 16px}
.drawer h3{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:16px 0 8px}
.drawer h3:first-child{margin-top:0}
.drawer .fp{font-size:11px;color:var(--dim);word-break:break-all}
.kv{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)}
.kv .k{color:var(--dim)}
.kv .v{font-variant-numeric:tabular-nums}
.grp{background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:8px 10px;margin-bottom:6px}
.grp .t{color:var(--muted);font-size:10px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .18s;z-index:39}
.scrim.on{opacity:1;pointer-events:auto}
@media(max-width:640px){.path{max-width:150px}.barrow{grid-template-columns:56px 1fr}.barrow .ct{grid-column:1/-1;text-align:start}}
`

// The client app is inert data until this runs. It reads window.__ARTIE__ (the model) and
// window.__I18N__ (the string catalog), renders every tab, and exposes window.__artieApply so
// the live channel can push a new model and have the view diff-and-repaint in place.
const APP = String.raw`
(function(){
var M=window.__ARTIE__;var prev=null;var changed={};
var app=document.getElementById('app');
var I18N=window.__I18N__||{dict:{en:{}},langs:[{code:'en',name:'English'}]};
var DICT=I18N.dict;var LANGS=I18N.langs;
var SEVW={CRITICAL:3,WARNING:2,OK:1};
var state={tab:'overview',metric:null,sort:{},drawer:null};
var MOON='<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" fill="currentColor"/></svg>';
var SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>';

function shortLang(l){return l?String(l).slice(0,2):'';}
var lang=localStorage.getItem('artie-lang')||shortLang(navigator.language)||'en';if(!DICT[lang])lang='en';
var theme=localStorage.getItem('artie-theme')||((window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark');

function t(key,vars){
  var s=(DICT[lang]&&DICT[lang][key])||(DICT.en&&DICT.en[key])||key;
  if(vars)s=s.replace(/\{(\w+)\}/g,function(_,k){return vars[k]!=null?vars[k]:'';});
  return s;
}
function isRtl(){var m=LANGS.filter(function(x){return x.code===lang;})[0];return !!(m&&m.rtl);}
function applyChrome(){var d=document.documentElement;d.setAttribute('data-theme',theme);d.setAttribute('lang',lang);d.setAttribute('dir',isRtl()?'rtl':'ltr');}

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function keyOf(metric,value){return metric+'::'+value;}
function fileOf(e){return e.file||'';}
function baseName(p){var s=p.split('/');return s[s.length-1];}
function metricName(name){return t('m_'+name);}
function localDate(iso){return new Date(iso).toLocaleString(lang);}

var fileIndex={};var cohesionByValue={};
function reindex(){
  fileIndex={};M.metrics.forEach(function(mt){mt.entries.forEach(function(e){if(!e.file)return;(fileIndex[e.file]=fileIndex[e.file]||[]).push({metric:mt.name,total:e.total,label:e.label,value:e.value});});});
  cohesionByValue={};M.cohesion.forEach(function(c){cohesionByValue[c.value]=c;});
}
reindex();

/* ---- small charts ---- */
function sparkline(series,w,h){
  if(!series||series.length<2)return '';
  var max=Math.max.apply(null,series.concat([1]));var min=Math.min.apply(null,series);
  var span=max-min||1;var step=w/(series.length-1);
  var pts=series.map(function(v,i){var x=(i*step).toFixed(1);var y=(h-((v-min)/span)*(h-3)-1.5).toFixed(1);return x+','+y;}).join(' ');
  var last=series[series.length-1],first=series[0];var col=last>first?'var(--crit)':last<first?'var(--ok)':'var(--accent)';
  return '<svg class="spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"><polyline fill="none" stroke="'+col+'" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="'+pts+'"/></svg>';
}

function bars(){
  var rows=M.metrics.filter(function(m){return m.warning+m.critical>0;}).sort(function(a,b){return (b.warning+b.critical)-(a.warning+a.critical);});
  if(!rows.length)return '<div class="empty"><b>'+esc(t('no_issues_title'))+'</b>'+esc(t('no_issues_sub'))+'</div>';
  var max=Math.max.apply(null,rows.map(function(m){return m.warning+m.critical;}));
  return '<div class="body">'+rows.map(function(m){
    var cw=(m.critical/max*100).toFixed(1),ww=(m.warning/max*100).toFixed(1);
    return '<div class="barrow"><span class="lb">'+esc(m.name.toUpperCase())+'</span>'+
      '<span class="track">'+(m.critical?'<span class="s CRITICAL" style="width:'+cw+'%"></span>':'')+(m.warning?'<span class="s WARNING" style="width:'+ww+'%"></span>':'')+'</span>'+
      '<span class="ct">'+m.critical+' '+esc(t('col_crit'))+' · '+m.warning+' '+esc(t('col_warn'))+'</span></div>';
  }).join('')+'</div>';
}

function treemap(){
  var hs=M.hotspots.filter(function(h){return h.churn>0;}).slice(0,48);
  if(!hs.length)return '<div class="empty"><b>'+esc(t('nothing_on_fire'))+'</b>'+esc(t('no_churn_sub'))+'</div>';
  var max=Math.max.apply(null,hs.map(function(h){return h.churn;}));
  var sev=function(h){return h.badness>=3?'CRITICAL':h.badness>=1?'WARNING':'OK';};
  return '<div class="body"><div class="tree">'+hs.map(function(h){
    var scale=0.5+h.churn/max;var basis=(44*scale).toFixed(0);
    return '<div class="cell '+sev(h)+'" data-file="'+esc(h.file)+'" style="flex:'+h.churn.toFixed(2)+' 1 '+basis+'px;height:'+(30+scale*34).toFixed(0)+'px" title="'+esc(h.file)+' · '+h.churn+'× '+esc(t('col_churn'))+' · '+esc(t('col_score'))+' '+h.score+'">'+
      '<div class="nm">'+esc(baseName(h.file))+'</div><div class="sc">'+h.churn+'× · '+h.score+'</div></div>';
  }).join('')+'</div></div>';
}

function histogram(metric){
  var mt=M.metrics.filter(function(m){return m.name===metric;})[0];
  if(!mt||!mt.entries.length)return '<div class="empty">'+esc(t('no_data_metric'))+'</div>';
  var vals=mt.entries.map(function(e){return e.total;});
  var max=Math.max.apply(null,vals);var BUCKETS=10;var size=Math.max(1,Math.ceil((max+1)/BUCKETS));
  var buckets=[];for(var i=0;i<BUCKETS;i++)buckets.push({lo:i*size,hi:(i+1)*size-1,n:0,sev:0});
  mt.entries.forEach(function(e){var idx=Math.min(BUCKETS-1,Math.floor(e.total/size));buckets[idx].n++;buckets[idx].sev=Math.max(buckets[idx].sev,SEVW[e.label]||0);});
  var top=Math.max.apply(null,buckets.map(function(b){return b.n;}))||1;
  return '<div class="body"><div class="hist">'+buckets.map(function(b){
    var cls=b.sev>=3?'hot':b.sev>=2?'warm':'';
    return '<div class="col" title="'+b.lo+'-'+b.hi+': '+b.n+'"><span class="n">'+(b.n||'')+'</span><span class="fill '+cls+'" style="height:'+(b.n/top*92).toFixed(1)+'%"></span><small>'+b.lo+'</small></div>';
  }).join('')+'</div></div>';
}

/* ---- sortable + filterable table ---- */
function table(id,cols,rows){
  var s=state.sort[id]||{key:cols[0].key,dir:1};
  var sorted=rows.slice().sort(function(a,b){
    var col=cols.filter(function(c){return c.key===s.key;})[0]||cols[0];
    var av=col.sortVal?col.sortVal(a):a[s.key],bv=col.sortVal?col.sortVal(b):b[s.key];
    if(av<bv)return -1*s.dir;if(av>bv)return 1*s.dir;return 0;
  });
  var head=cols.map(function(c){
    var on=c.key===s.key;var ar=c.sortable===false?'':'<span class="ar">'+(on?(s.dir>0?'▲':'▼'):'↕')+'</span>';
    return '<th class="'+(c.num?'num ':'')+(c.sortable===false?'plain ':'')+(on?'sorted':'')+'" '+(c.sortable===false?'':'data-sort="'+id+'|'+c.key+'"')+'>'+esc(c.label)+ar+'</th>';
  }).join('');
  var body=sorted.map(function(r){
    var attrs=(r._file?' data-file="'+esc(r._file)+'"':'')+(r._sev?' data-sev="'+r._sev+'"':'')+(r._key?' data-key="'+esc(r._key)+'"':'');
    return '<tr'+attrs+'>'+cols.map(function(c){return '<td class="'+(c.cls||'')+'">'+c.cell(r)+'</td>';}).join('')+'</tr>';
  }).join('');
  return '<div class="scroll"><table id="'+id+'" data-filter><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table></div>';
}

function toolbar(id){return '<div class="toolbar"><input class="search" placeholder="'+esc(t('filter_ph'))+'" data-search="'+id+'"></div>';}

/* ---- rows ---- */
function offenderRows(){
  var out=[];M.metrics.forEach(function(m){m.entries.forEach(function(e){if(e.label==='OK')return;out.push({metric:m.name,value:e.value,total:e.total,label:e.label,_file:fileOf(e),_sev:e.label,_key:keyOf(m.name,e.value)});});});
  return out.sort(function(a,b){return (SEVW[b.label]-SEVW[a.label])||b.total-a.total;});
}
function rollupRows(){
  var g={};
  M.metrics.forEach(function(m){m.entries.forEach(function(e){if(!e.file)return;var mod=e.file.split('/').slice(0,2).join('/');var r=g[mod]=g[mod]||{module:mod,warning:0,critical:0,files:{}};r.files[e.file]=1;if(e.label==='CRITICAL')r.critical++;if(e.label==='WARNING')r.warning++;});});
  return Object.keys(g).map(function(k){var r=g[k];return {module:k,files:Object.keys(r.files).length,warning:r.warning,critical:r.critical,score:r.critical*3+r.warning};}).sort(function(a,b){return b.score-a.score;});
}

/* ---- tabs ---- */
function overview(){
  var k=M.kpis;var h=M.history;var col=function(f){return h.map(f);};
  var kpi=function(cls,val,lab,series){return '<div class="kpi '+cls+'"><div class="lab">'+esc(lab)+'</div><div class="val">'+val+'</div>'+sparkline(series,64,26)+'</div>';};
  var kpis='<div class="kpis">'+
    kpi('crit',k.criticals,t('kpi_criticals'),col(function(s){return s.criticals;}))+
    kpi('warn',k.warnings,t('kpi_warnings'),col(function(s){return s.warnings;}))+
    kpi(k.violations?'crit':'',k.violations,t('kpi_violations'),col(function(s){return s.violations;}))+
    kpi('acc',k.hotspots,t('kpi_hotspots'),null)+
    kpi('ok',k.metrics,t('kpi_metrics'),null)+'</div>';
  var off=offenderRows().slice(0,12);
  var offTable=off.length?table('ov-off',[
    {key:'label',label:'',sortable:false,cell:function(r){return '<span class="tick '+r.label+'"></span><span class="sev '+r.label+'">'+r.label+'</span>';}},
    {key:'metric',label:t('col_metric'),cell:function(r){return '<span class="mut">'+esc(r.metric.toUpperCase())+'</span>';}},
    {key:'value',label:t('col_class'),cell:function(r){return esc(r.value);}},
    {key:'total',label:t('col_value'),num:true,cls:'num',cell:function(r){return r.total;}}
  ],off):'<div class="empty"><b>'+esc(t('clean'))+'</b>'+esc(t('nothing_above'))+'</div>';
  return kpis+
    '<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));margin-top:12px">'+
      '<div class="panel"><h2>'+esc(t('issues_by_metric'))+'</h2>'+bars()+'</div>'+
      '<div class="panel"><h2>'+esc(t('hotspot_map'))+' <span class="sub">'+esc(t('churn_severity'))+'</span></h2>'+treemap()+'</div>'+
    '</div>'+
    '<div class="panel" style="margin-top:12px"><h2>'+esc(t('worst_offenders'))+'</h2>'+offTable+'</div>';
}

function metricsTab(){
  var active=state.metric||(M.metrics[0]&&M.metrics[0].name);
  var chips='<div class="chips">'+M.metrics.map(function(m){var n=m.warning+m.critical;return '<button class="chip '+(m.name===active?'on':'')+'" data-metric="'+m.name+'">'+esc(m.name.toUpperCase())+(n?'<b>'+n+'</b>':'')+'</button>';}).join('')+'</div>';
  var mt=M.metrics.filter(function(m){return m.name===active;})[0];
  var rows=(mt?mt.entries:[]).map(function(e){return {value:e.value,total:e.total,label:e.label,_file:fileOf(e),_sev:e.label!=='OK'?e.label:'',_key:keyOf(active,e.value)};});
  var tbl=rows.length?table('m-'+active,[
    {key:'label',label:'',sortable:true,sortVal:function(r){return SEVW[r.label];},cell:function(r){return '<span class="tick '+r.label+'"></span>';}},
    {key:'value',label:t('col_class'),cell:function(r){return esc(r.value);}},
    {key:'_file',label:t('col_file'),cell:function(r){return '<span class="path" dir="rtl" title="'+esc(r._file)+'">'+esc(r._file)+'</span>';}},
    {key:'total',label:active.toUpperCase(),num:true,cls:'num',cell:function(r){return '<span class="sev '+r.label+'">'+r.total+'</span>';}}
  ],rows):'<div class="empty">'+esc(t('no_classes_metric'))+'</div>';
  return '<div class="panel"><div class="toolbar">'+chips+'</div></div>'+
    '<div class="grid" style="grid-template-columns:1fr;margin-top:12px">'+
      '<div class="panel"><h2>'+esc(metricName(active))+' <span class="sub">'+esc(t('dist_across',{n:(mt?mt.entries.length:0)}))+'</span></h2>'+histogram(active)+'</div>'+
      '<div class="panel"><h2>'+esc(active.toUpperCase())+' · '+esc(t('all_classes'))+'</h2>'+toolbar('m-'+active)+tbl+'</div>'+
    '</div>';
}

function hotspotsTab(){
  var rows=M.hotspots.map(function(h){return {score:h.score,file:h.file,churn:h.churn,findings:h.findings,_file:h.file};});
  if(!rows.length)return '<div class="panel"><div class="empty">'+esc(t('no_hotspots'))+'</div></div>';
  var tbl=table('hs',[
    {key:'score',label:t('col_score'),num:true,cls:'num',cell:function(r){return '<b>'+r.score+'</b>';}},
    {key:'file',label:t('col_file'),cell:function(r){return '<span class="path" dir="rtl" title="'+esc(r.file)+'">'+esc(r.file)+'</span>';}},
    {key:'churn',label:t('col_churn'),num:true,cls:'num mut',cell:function(r){return r.churn+'×';}},
    {key:'findings',label:t('col_findings'),sortable:false,cell:function(r){return '<span class="mut">'+r.findings.map(esc).join('<br>')+'</span>';}}
  ],rows);
  return '<div class="panel"><h2>'+esc(t('tab_hotspots'))+' <span class="sub">'+esc(t('hotspots_sub'))+'</span></h2>'+toolbar('hs')+tbl+'</div>';
}

function modulesTab(){
  var rows=rollupRows();
  if(!rows.length)return '<div class="panel"><div class="empty"><b>'+esc(t('clean'))+'</b>'+esc(t('no_rollup'))+'</div></div>';
  var tbl=table('mod',[
    {key:'module',label:t('col_module'),cell:function(r){return '<span class="mut">'+esc(r.module)+'</span>';}},
    {key:'files',label:t('col_files'),num:true,cls:'num mut',cell:function(r){return r.files;}},
    {key:'critical',label:t('col_crit'),num:true,cls:'num',cell:function(r){return r.critical?'<span class="sev CRITICAL">'+r.critical+'</span>':'0';}},
    {key:'warning',label:t('col_warn'),num:true,cls:'num',cell:function(r){return r.warning?'<span class="sev WARNING">'+r.warning+'</span>':'0';}},
    {key:'score',label:t('col_score'),num:true,cls:'num',cell:function(r){return '<b>'+r.score+'</b>';}}
  ],rows);
  return '<div class="panel"><h2>'+esc(t('tab_modules'))+' <span class="sub">'+esc(t('modules_sub'))+'</span></h2>'+toolbar('mod')+tbl+'</div>';
}

function seamsTab(){
  var rows=M.seams.map(function(s){return {modules:s.modules,size:s.modules.length,internal:s.internal,crossing:s.crossing,ratio:(s.internal/(s.crossing+1))};});
  if(!rows.length)return '<div class="panel"><div class="empty">'+esc(t('no_seams'))+'</div></div>';
  var tbl=table('seam',[
    {key:'size',label:t('col_modules'),num:true,cls:'num',cell:function(r){return '<b>'+r.size+'</b>';}},
    {key:'internal',label:t('col_internal'),num:true,cls:'num mut',cell:function(r){return r.internal;}},
    {key:'crossing',label:t('col_crossing'),num:true,cls:'num mut',cell:function(r){return r.crossing;}},
    {key:'ratio',label:t('col_cohesion'),num:true,cls:'num',cell:function(r){return '<span class="sev '+(r.ratio>=3?'OK':'WARNING')+'">'+r.ratio.toFixed(1)+'</span>';}},
    {key:'modules',label:t('col_files'),sortable:false,cell:function(r){return '<span class="mut">'+r.modules.slice(0,4).map(function(m){return esc(baseName(m));}).join(', ')+(r.modules.length>4?' +'+(r.modules.length-4):'')+'</span>';}}
  ],rows);
  return '<div class="panel"><h2>'+esc(t('tab_seams'))+' <span class="sub">'+esc(t('seams_sub'))+'</span></h2>'+tbl+'</div>';
}

function violationsTab(){
  if(!M.violations.length&&!M.cycles.length)return '<div class="panel"><div class="empty"><b>'+esc(t('no_violations_title'))+'</b>'+esc(t('no_violations_sub'))+'</div></div>';
  var out='';
  if(M.violations.length)out+='<div class="panel"><h2>'+esc(t('arch_violations'))+'</h2><ul class="viol">'+M.violations.map(function(v){return '<li><code>'+esc(v.from)+'</code><span class="ar">→</span><code>'+esc(v.to)+'</code><span class="m">'+esc(v.message)+'</span></li>';}).join('')+'</ul></div>';
  if(M.cycles.length)out+='<div class="panel" style="margin-top:12px"><h2>'+esc(t('dep_cycles'))+' <span class="sub">'+esc(t('n_found',{n:M.cycles.length}))+'</span></h2><ul class="viol">'+M.cycles.map(function(c){return '<li><span class="sev WARNING">'+c.size+'</span><span class="m">'+c.path.map(esc).join(' <span class="ar">→</span> ')+'</span></li>';}).join('')+'</ul></div>';
  return out;
}

var TABS=[
  {id:'overview',view:overview,count:function(){return null;}},
  {id:'metrics',view:metricsTab,count:function(){return M.metrics.length;}},
  {id:'hotspots',view:hotspotsTab,count:function(){return M.hotspots.length;}},
  {id:'modules',view:modulesTab,count:function(){return rollupRows().length;}},
  {id:'seams',view:seamsTab,count:function(){return M.seams.length;}},
  {id:'violations',view:violationsTab,count:function(){return M.violations.length+M.cycles.length;}}
];

/* ---- drawer ---- */
function openDrawer(file){
  var rows=fileIndex[file]||[];
  var name=rows[0]?rows[0].value:baseName(file);
  var metrics='<div>'+rows.map(function(r){return '<div class="kv"><span class="k"><span class="tick '+r.label+'"></span>'+esc(r.metric.toUpperCase())+'</span><span class="v sev '+r.label+'">'+r.total+'</span></div>';}).join('')+'</div>';
  var findings=rows.filter(function(r){return r.label!=='OK';});
  var advice=findings.length?'<h3>'+esc(t('findings'))+'</h3>'+findings.map(function(r){return '<div class="grp"><div class="t">'+esc(r.metric.toUpperCase())+' · '+r.label+'</div>'+esc(t('scores',{v:name,n:r.total}))+'</div>';}).join(''):'';
  var coh='';rows.forEach(function(r){var c=cohesionByValue[r.value];if(c&&!coh){coh='<h3>'+esc(t('cohesion_groups'))+'</h3>'+c.groups.map(function(g,i){return '<div class="grp"><div class="t">'+esc(t('group',{n:i+1}))+'</div>'+esc(t('methods'))+': '+g.methods.map(esc).join(', ')+'<br><span class="mut">'+esc(t('fields'))+': '+g.variables.map(esc).join(', ')+'</span></div>';}).join('');}});
  document.getElementById('dwName').textContent=name;
  document.getElementById('dwBody').innerHTML='<div class="fp">'+esc(file)+'</div><h3>'+esc(t('metric_profile'))+'</h3>'+metrics+advice+coh;
  document.getElementById('drawer').classList.add('on');document.getElementById('scrim').classList.add('on');
}
function closeDrawer(){document.getElementById('drawer').classList.remove('on');document.getElementById('scrim').classList.remove('on');}

/* ---- render ---- */
function renderTabs(){
  return '<div class="tabs">'+TABS.map(function(tab){var c=tab.count();return '<button class="tab '+(tab.id===state.tab?'on':'')+'" data-tab="'+tab.id+'">'+esc(t('tab_'+tab.id))+(c!=null?'<span class="c">'+c+'</span>':'')+'</button>';}).join('')+'</div>';
}
function renderControls(){
  var opts=LANGS.map(function(l){return '<option value="'+l.code+'"'+(l.code===lang?' selected':'')+'>'+esc(l.name)+'</option>';}).join('');
  return '<select class="ctl" data-lang aria-label="'+esc(t('language_label'))+'">'+opts+'</select>'+
    '<button class="ctl iconbtn" data-theme-toggle aria-label="'+esc(t('theme_label'))+'" title="'+esc(t('theme_label'))+'">'+(theme==='dark'?MOON:SUN)+'</button>';
}
function renderHeader(){
  return '<div class="bar"><div class="brand"><b>artie</b>-lens<span class="v">'+esc(t('subtitle'))+'</span></div>'+
    '<span class="pill '+(M.failed?'fail':'pass')+'">'+esc(t(M.failed?'fail':'pass'))+'</span>'+
    (M.live?'<span class="live"><i></i>'+esc(t('live'))+'</span>':'')+
    '<div class="meta"><span id="stamp">'+esc(localDate(M.generatedAt))+'</span>'+renderControls()+'</div></div>';
}
function render(){
  var body=(TABS.filter(function(tab){return tab.id===state.tab;})[0]||TABS[0]).view();
  app.innerHTML=renderHeader()+renderTabs()+'<div class="wrap">'+body+'</div>'+
    '<footer>artie-lens · '+esc(t('footer',{n:M.metrics.length,at:localDate(M.generatedAt)}))+'</footer>'+
    '<div class="scrim" id="scrim"></div>'+
    '<div class="drawer" id="drawer"><header><span class="tick"></span><b id="dwName"></b><button class="x" data-close>×</button></header><div class="dbody" id="dwBody"></div></div>';
  flashChanged();
}
function flashChanged(){
  Object.keys(changed).forEach(function(key){
    var tr=app.querySelector('tr[data-key="'+cssEscape(key)+'"]');
    if(!tr)return;tr.classList.add('flash');
    var d=changed[key];if(d){var cell=tr.querySelector('td:last-child');if(cell){var s=document.createElement('span');s.className='delta '+(d>0?'up':'down');s.textContent=(d>0?'+':'')+d;cell.appendChild(s);}}
  });
}
function cssEscape(s){return s.replace(/(["\\\]])/g,'\\$1');}

/* ---- live diff ---- */
function diff(oldM,newM){
  var out={};if(!oldM)return out;
  var prevMap={};oldM.metrics.forEach(function(m){m.entries.forEach(function(e){prevMap[keyOf(m.name,e.value)]=e.total;});});
  newM.metrics.forEach(function(m){m.entries.forEach(function(e){var k=keyOf(m.name,e.value);if(!(k in prevMap)){out[k]=e.total;return;}if(prevMap[k]!==e.total)out[k]=e.total-prevMap[k];});});
  return out;
}

/* ---- events ---- */
app.addEventListener('click',function(ev){
  var el=ev.target.closest('[data-tab],[data-metric],[data-sort],[data-file],[data-close],[data-theme-toggle]');
  if(!el)return;
  if(el.hasAttribute('data-close')){closeDrawer();return;}
  if(el.hasAttribute('data-theme-toggle')){theme=theme==='dark'?'light':'dark';localStorage.setItem('artie-theme',theme);applyChrome();render();return;}
  if(el.hasAttribute('data-tab')){state.tab=el.getAttribute('data-tab');changed={};render();return;}
  if(el.hasAttribute('data-metric')){state.metric=el.getAttribute('data-metric');render();return;}
  if(el.hasAttribute('data-file')){openDrawer(el.getAttribute('data-file'));return;}
  if(el.hasAttribute('data-sort')){var p=el.getAttribute('data-sort').split('|');var id=p[0],key=p[1];var cur=state.sort[id];state.sort[id]=cur&&cur.key===key?{key:key,dir:-cur.dir}:{key:key,dir:key==='value'||key==='module'||key==='file'||key==='_file'?1:-1};render();return;}
});
app.addEventListener('change',function(ev){
  var s=ev.target.closest('[data-lang]');if(!s)return;
  lang=s.value;localStorage.setItem('artie-lang',lang);applyChrome();render();
});
app.addEventListener('input',function(ev){
  var inp=ev.target.closest('[data-search]');if(!inp)return;
  var id=inp.getAttribute('data-search');var q=inp.value.toLowerCase();
  var tbl=document.getElementById(id);if(!tbl)return;
  [].forEach.call(tbl.tBodies[0].rows,function(r){r.style.display=r.textContent.toLowerCase().indexOf(q)>=0?'':'none';});
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDrawer();});
document.addEventListener('click',function(e){if(e.target.id==='scrim')closeDrawer();});

window.__artieApply=function(next){changed=diff(M,next);prev=M;M=next;reindex();render();};
applyChrome();
render();
})();
`

const LIVE_SCRIPT =
  '<script>(function(){var s=new EventSource("/events");s.onmessage=function(e){try{window.__artieApply(JSON.parse(e.data))}catch(_){location.reload()}};})();</script>'

// Set the theme attribute before the app boots so a light-preferring viewer never flashes dark.
const BOOT_SCRIPT =
  '<script>try{document.documentElement.setAttribute("data-theme",localStorage.getItem("artie-theme")||((window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark"))}catch(e){}</script>'

const I18N_JSON = embed({ dict: DICTIONARY, langs: LANGUAGES })

export const renderDashboard = (model: DashboardModel): string => {
  const head =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>artie-lens</title>' +
    BOOT_SCRIPT +
    '<style>' +
    STYLE +
    '</style></head><body><div id="app"></div>'
  const data = `<script>window.__ARTIE__=${embed(model)};window.__I18N__=${I18N_JSON}</script>`
  const scripts = `<script>${APP}</script>${model.live ? LIVE_SCRIPT : ''}`

  return `${head}${data}${scripts}</body></html>`
}
