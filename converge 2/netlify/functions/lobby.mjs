import { getStore } from '@netlify/blobs';
import { randomBytes, randomUUID } from 'node:crypto';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 7-character codes without confusing O/0 or I/1
const userAgent='ConvergeWikiPuzzle/3.0 (Wikipedia browser race; https://github.com)';
const store=()=>getStore('converge-multiplayer-v1');
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers:HEADERS});
const cleanName=s=>typeof s==='string'?s.trim().replace(/\s+/g,' ').slice(0,24):'';
const cleanTitle=s=>typeof s==='string'?s.trim().replace(/_/g,' ').replace(/\s+/g,' ').slice(0,240):'';
const norm=s=>cleanTitle(s).toLowerCase();
const code7=()=>Array.from(randomBytes(7),b=>ALPHABET[b%ALPHABET.length]).join('');
const fail=(message,status=400)=>({error:message,status});
async function lookupTitle(title){
  if(!title||/[\x00-\x1f<>[\]{}|#]/.test(title))return null;
  const p=new URLSearchParams({action:'query',titles:title,redirects:'1',prop:'info',format:'json',formatversion:'2'});
  const r=await fetch('https://en.wikipedia.org/w/api.php?'+p,{headers:{'User-Agent':userAgent,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error('Wikipedia article verification is temporarily unavailable');
  const data=await r.json();
  const article=(data.query?.pages||[]).find(p=>p.ns===0&&!p.missing&&!p.invalid);
  return article?.title||null;
}
// Prevent arbitrary jumps by checking the target appears as a real hyperlink in the current article.
async function hasLink(from,to){
  const p=new URLSearchParams({action:'parse',page:from,prop:'links',format:'json',formatversion:'2',redirects:'1'});
  const r=await fetch('https://en.wikipedia.org/w/api.php?'+p,{headers:{'User-Agent':userAgent,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('Wikipedia could not verify this link. Try again.');
  const data=await r.json();
  if(data.error)throw new Error('Could not verify the source article');
  return (data.parse?.links||[]).some(link=>link.ns===0 && (norm(link.title)===norm(to) || norm(link['*'])===norm(to)));
}
function publiclyVisible(room,player){
  const complete=room.status==='finished';
  return {code:room.code,status:room.status,hostId:room.hostId,
    starts:room.starts,createdAt:room.createdAt,startedAt:room.startedAt||null,
    finishedAt:room.finishedAt||null,winnerId:room.winnerId||null,
    players:room.players.map(p=>({id:p.id,name:p.name,ready:true,moves:p.paths.reduce((n,path)=>n+path.length-1,0),
      paths:complete?p.paths:undefined,
      ...(p.id===player.id?{myPaths:p.paths}:{})})),
    me:player.id};
}
async function getRoom(code){return store().getWithMetadata('room/'+code,{type:'json',consistency:'strong'});}
async function updateRoom(code,fn){
  for(let attempt=0;attempt<7;attempt++){
    const entry=await getRoom(code);
    if(!entry)return fail('Lobby not found',404);
    const data=entry.data;
    const result=await fn(data);
    if(result?.error)return result;
    // Conditional update protects against two people winning in the same race.
    const saved=await store().setJSON('room/'+code,data,{onlyIfMatch:entry.etag});
    if(saved.modified)return {room:data};
  }
  return fail('Lobby changed too quickly. Please retry.',409);
}
export default async function(request){
  if(request.method!=='POST')return json(405,{error:'POST required'});
  let body;try{body=await request.json()}catch{return json(400,{error:'Invalid request'})}
  const action=body.action;
  try{
    if(action==='create'){
      const name=cleanName(body.name);
      if(name.length<2)return json(400,{error:'Enter a player name with at least 2 characters'});
      for(let i=0;i<8;i++){
        const code=code7(),id=randomUUID(),token=randomUUID();
        const room={code,hostId:id,status:'waiting',starts:[],createdAt:Date.now(),players:[{id,token,name,paths:[[],[],[]]}]};
        const saved=await store().setJSON('room/'+code,room,{onlyIfNew:true});
        if(saved.modified)return json(200,{code,id,token,room:publiclyVisible(room,room.players[0])});
      }
      return json(503,{error:'Unable to create a lobby. Please try again.'});
    }
    const code=String(body.code||'').toUpperCase().trim();
    if(!/^[A-Z0-9]{7}$/.test(code))return json(400,{error:'Enter a valid seven-character lobby code'});
    if(action==='join'){
      const name=cleanName(body.name);
      if(name.length<2)return json(400,{error:'Enter your name before joining'});
      const id=randomUUID(),token=randomUUID();
      const result=await updateRoom(code,room=>{
        if(room.status!=='waiting')return fail('This game has already started');
        if(room.players.length>=12)return fail('Lobby is full (12 players maximum)');
        if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return fail('That name is already taken in this lobby');
        room.players.push({id,token,name,paths:[[],[],[]]});
      });
      if(result.error)return json(result.status,result);
      const player=result.room.players.find(p=>p.id===id);
      return json(200,{code,id,token,room:publiclyVisible(result.room,player)});
    }
    const id=String(body.id||''),token=String(body.token||'');
    const entry=await getRoom(code);
    if(!entry)return json(404,{error:'Lobby not found'});
    const player=entry.data.players.find(p=>p.id===id&&p.token===token);
    if(!player)return json(403,{error:'Your session has expired. Rejoin with your player name.'});
    if(action==='status')return json(200,{room:publiclyVisible(entry.data,player)});
    if(action==='configure'){
      if(id!==entry.data.hostId)return json(403,{error:'Only the host can choose articles'});
      if(entry.data.status!=='waiting')return json(409,{error:'Game has already started'});
      const titles=Array.isArray(body.titles)?body.titles.map(cleanTitle):[];
      if(titles.length!==3||titles.some(t=>!t))return json(400,{error:'Select exactly three Wikipedia articles'});
      const canonical=[];
      for(const title of titles){
        const valid=await lookupTitle(title);
        if(!valid)return json(400,{error:'Article not found: '+title});
        canonical.push(valid);
      }
      if(new Set(canonical.map(norm)).size!==3)return json(400,{error:'Choose three different articles'});
      const result=await updateRoom(code,room=>{
        if(room.status!=='waiting'||room.hostId!==id)return fail('Cannot change articles now');
        room.starts=canonical;
      });
      return result.error?json(result.status,result):json(200,{room:publiclyVisible(result.room,result.room.players.find(p=>p.id===id))});
    }
    if(action==='start'){
      if(id!==entry.data.hostId)return json(403,{error:'Only the host can start'});
      const result=await updateRoom(code,room=>{
        if(room.status!=='waiting')return fail('Game already started');
        if(room.starts.length!==3)return fail('Choose three articles first');
        room.status='playing';room.startedAt=Date.now();
        room.players.forEach(p=>p.paths=room.starts.map(t=>[t]));
      });
      return result.error?json(result.status,result):json(200,{room:publiclyVisible(result.room,result.room.players.find(p=>p.id===id))});
    }
    if(action==='move'){
      if(entry.data.status!=='playing')return json(409,{error:'The race has ended'});
      const pathIndex=Number(body.pathIndex),next=cleanTitle(body.title),from=cleanTitle(body.from);
      if(!Number.isInteger(pathIndex)||pathIndex<0||pathIndex>2||!next||!from)return json(400,{error:'Invalid move'});
      const actual=player.paths[pathIndex]?.at(-1);
      if(norm(from)!==norm(actual))return json(409,{error:'Page changed. Refresh the game and try again.'});
      const canonical=await lookupTitle(next);
      if(!canonical)return json(400,{error:'That Wikipedia article does not exist'});
      const linked=await hasLink(from,next);
      if(!linked)return json(400,{error:'That page is not linked from the current Wikipedia article'});
      const result=await updateRoom(code,room=>{
        if(room.status!=='playing')return fail('The race has ended',409);
        const p=room.players.find(x=>x.id===id&&x.token===token);
        if(!p)return fail('Player not found',403);
        if(norm(p.paths[pathIndex].at(-1))!==norm(from))return fail('Your page changed. Please retry.',409);
        p.paths[pathIndex].push(canonical);
        if(p.paths.every(path=>norm(path.at(-1))===norm(p.paths[0].at(-1)))){
          room.status='finished';room.winnerId=p.id;room.finishedAt=Date.now();
        }
      });
      return result.error?json(result.status,result):json(200,{room:publiclyVisible(result.room,result.room.players.find(p=>p.id===id))});
    }
    return json(400,{error:'Unknown action'});
  }catch(e){return json(500,{error:'Server error: '+(e?.message||String(e))});}
}
export const config={path:'/api/lobby'};
