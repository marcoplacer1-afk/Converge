/** Server-side Wikipedia article fetch for Converge. No API key needed. */
export default async (request) => {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=3600', 'access-control-allow-origin': '*' };
  const reply = (code, payload) => new Response(JSON.stringify(payload), { status:code, headers });
  const title = new URL(request.url).searchParams.get('title')?.trim();
  if (!title || title.length > 240 || /[\x00-\x1f<>[\]{}|]/.test(title)) return reply(400,{error:'Invalid article title'});
  const agent = 'ConvergeWikiPuzzle/1.0 (Wikipedia-based learning game; contact: https://github.com/netlify; respects MediaWiki API)';
  const baseOpts = { headers: { 'User-Agent':agent, Accept:'application/json' }, signal:AbortSignal.timeout(15000) };
  try {
    const params = new URLSearchParams({action:'parse',page:title,prop:'text',format:'json',formatversion:'2',redirects:'1',disableeditsection:'1'});
    const res = await fetch('https://en.wikipedia.org/w/api.php?'+params,baseOpts);
    if (!res.ok) throw Error('MediaWiki returned '+res.status);
    const body = await res.json();
    if(body.error) return reply(404,{error:body.error.info||'Article not found'});
    if(!body.parse?.text) throw Error('Wikipedia returned no article text');
    return reply(200,{title:body.parse.title||title,html:body.parse.text});
  } catch(firstError) {
    // Wikipedia's REST content endpoint is an independent fallback.
    try {
      const res=await fetch('https://en.wikipedia.org/api/rest_v1/page/html/'+encodeURIComponent(title.replaceAll(' ','_')),{headers:{'User-Agent':agent,Accept:'text/html'},signal:AbortSignal.timeout(15000)});
      if(!res.ok) throw Error('REST returned '+res.status);
      const html=await res.text();
      if(!html.includes('<body'))throw Error('REST returned no HTML body');
      const body=html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
      if(!body)throw Error('REST returned an empty article');
      return reply(200,{title,html:body});
    }catch(secondError){return reply(502,{error:'Wikipedia is temporarily unreachable from the server: '+firstError.message+' / '+secondError.message});}
  }
};
export const config = { path: '/api/wiki' };
