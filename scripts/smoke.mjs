import http from 'node:http';
import { EventEmitter } from 'node:events';
const rows = [
  { id: 'a/one', display_name: 'Fancy One', context_window: 128000, max_output_tokens: 16384,
    supported_reasoning_levels: [{effort:'none'},{effort:'high'}], modalities: { input: ['text','video'], output:['text'] } },
  { id: 'b/two', display_name: 'Two', reasoning: false },
];
const gw = http.createServer((req,res)=>{ res.setHeader('content-type','application/json'); res.end(JSON.stringify({data:rows})); });
await new Promise(r=>gw.listen(3425,'127.0.0.1',r));
process.on('exit', () => gw.close());
const mod = await import(new URL('../index.js', import.meta.url).href);
console.log('name =', mod.name, '| inject =', JSON.stringify(mod.inject));
let written = null; let selfCfg = { gatewayUrl:'http://127.0.0.1:3425', routeName:'magpie', displayName:'X', credentialRef:'MAGPIE_GATEWAY_KEY', api:'openai-responses', modelOverrides:{}, exclude: [] };
const config = new Proxy({}, { get: (t,k) => selfCfg[k] });
const ctx = { routes: [],
  effect:(cb)=>{cb(); return ()=>{};},
  webServer:{ register:(r)=>{ctx.routes.push(r); return ()=>{};}},
  credentials:{ resolve:async()=>({value:'k'}), set:async()=>{} },
  configEditor:{ entries:()=>[{options:{id:'llm-pi-ai'}},{options:{id:'dsh-x-magpie'}}],
    configuration:()=>[{entry:{options:{id:'llm-pi-ai'}},inherited:{},override:{providers:{}}}],
    edit:async(e,change)=>{ if(e.options.id==='llm-pi-ai') written=change({},{}); else selfCfg={...selfCfg,...change(selfCfg,{})}; } } };
mod.apply(ctx, config);
const reqFor = (url, body) => { const e = new EventEmitter(); e.method='POST'; e.url='/dsh-x-magpie'+url; e.headers={}; process.nextTick(()=>{ if(body!==undefined) e.emit('data', Buffer.from(JSON.stringify(body))); e.emit('end'); }); return e; };
const resFor = () => { const r={status:0,body:null,writeHead(s){this.status=s;},end(b){this.body=JSON.parse(b);}}; return r; };
let res=resFor(); await ctx.routes[0].handler(reqFor('/plan',{}),res);
console.log('plan models =', res.body.models?.length, '| name==id =', res.body.models?.[0]?.id);
res=resFor(); await ctx.routes[0].handler(reqFor('/apply',{}),res);
console.log('apply =', res.body.ok, '| a/one =', JSON.stringify(written.providers.magpie.models[0]));
console.log('video filtered =', !JSON.stringify(written).includes('"video"'));
res=resFor(); await ctx.routes[0].handler(reqFor('/config',{exclude:['b/two']}),res);
res=resFor(); await ctx.routes[0].handler(reqFor('/apply',{}),res);
console.log('after exclude written =', res.body.written);
res=resFor(); await ctx.routes[0].handler(reqFor('/config',{exclude:['a/one','b/two']}),res);
res=resFor(); await ctx.routes[0].handler(reqFor('/apply',{}),res);
const guard = res.body.error ?? null;
console.log('empty-selection guard =', guard);
const checks = [
  [mod.name === 'dsh-x-magpie', 'name'],
  [written?.providers?.magpie?.models?.[0]?.name === 'a/one', 'id-as-name'],
  [guard === 'no models selected; refusing to write an empty route', 'empty guard'],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length > 0) {
  console.error('SMOKE FAILED:', failed.map(([, n]) => n).join(', '));
  process.exit(1);
}
console.log('SMOKE PASS');
gw.close();
