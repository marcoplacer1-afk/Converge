// Wikipedia article search for the multiplayer host. Returns real articles, not a preset pool.
const HEADERS = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' };
const userAgent='ConvergeWikiPuzzle/3.0 (browser Wikipedia race; https://github.com)';
export default async function(request){
  const q=(new URL(request.url).searchParams.get('q')||'').trim();
  if(q.length<2 || q.length>100) return new Response(JSON.stringify({results:[]}),{headers:HEADERS});
  try{
    const params=new URLSearchParams({action:'query',generator:'prefixsearch',gpssearch:q,gpslimit:'10',prop:'info',inprop:'url',format:'json',formatversion:'2',redirects:'1'});
    const res=await fetch('https://en.wikipedia.org/w/api.php?'+params,{headers:{'User-Agent':userAgent,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
    if(!res.ok)throw Error('Wikipedia returned '+res.status);
    const data=await res.json();
    const results=(data.query?.pages||[]).filter(p=>p.ns===0 && !p.missing).sort((a,b)=>(a.index??99)-(b.index??99)).map(p=>({title:p.title}));
    return new Response(JSON.stringify({results}),{headers:HEADERS});
  }catch(e){return new Response(JSON.stringify({error:'Wikipedia search unavailable: '+e.message}),{status:502,headers:HEADERS});}
}
export const config={path:'/api/wiki-search'};
