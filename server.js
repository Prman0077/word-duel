const express=require('express'),http=require('http'),{Server}=require('socket.io'),fs=require('fs'),path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server);
app.get('/health',(req,res)=>res.status(200).json({ok:true,service:'word-duel-online'}));
app.use(express.static(path.join(__dirname,'public')));
const WORDS=new Set(fs.readFileSync(path.join(__dirname,'english_words.txt'),'utf8').split(/\r?\n/).map(x=>x.trim().toUpperCase()).filter(x=>/^[A-Z]{2,}$/.test(x)));
const SIZE=11, STARS=new Set(['1,1','1,9','3,5','5,3','5,7','7,5','9,1','9,9']);
const FREQ='EEEEEEEEEEEEAAAAAAAAAIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ?';
const rooms=new Map();
function code(){let s='';do{s=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(s));return s}
function bag(){return (FREQ.repeat(3).split('').sort(()=>Math.random()-.5))}
function draw(g,p){while(g.racks[p].length<7&&g.bag.length)g.racks[p].push(g.bag.pop())}
function publicState(g,sid){let me=g.players.findIndex(p=>p&&p.id===sid);return {code:g.code,goal:g.goal,timer:g.timer,turn:g.turn,scores:g.scores,board:g.board,stars:[...STARS],players:g.players.map(p=>p?{name:p.name}:null),rack:me>=0?g.racks[me]:[],me,status:g.status,winner:g.winner,deadline:g.deadline}}
function emit(g){g.players.forEach(p=>{if(p)io.to(p.id).emit('state',publicState(g,p.id))})}
function wordsFor(board,pending){let merged={...board,...pending},seen=new Set(),out=[];for(const k of Object.keys(pending)){let [r,c]=k.split(',').map(Number);for(const [dr,dc] of [[0,1],[1,0]]){let sr=r,sc=c;while(merged[`${sr-dr},${sc-dc}`]){sr-=dr;sc-=dc}let cells=[],rr=sr,cc=sc;while(merged[`${rr},${cc}`]){cells.push(`${rr},${cc}`);rr+=dr;cc+=dc}if(cells.length>=2){let sig=cells.join('|');if(!seen.has(sig)){seen.add(sig);out.push(cells)}}}}return out}
function resetDeadline(g){g.deadline=g.timer?Date.now()+g.timer*1000:null}
function advance(g){g.turn=1-g.turn;resetDeadline(g);g.status=`${g.players[g.turn]?.name||'Player'}'s turn.`;emit(g)}
setInterval(()=>{for(const g of rooms.values()){if(!g.winner&&g.deadline&&Date.now()>g.deadline){g.status=`Time expired. ${g.players[g.turn]?.name||'Player'} forfeited the turn.`;advance(g)}}},500);
io.on('connection',s=>{
 s.on('create',({name,goal=800,timer=0})=>{let c=code(),b=bag(),g={code:c,goal:+goal||800,timer:+timer||0,players:[{id:s.id,name:name||'Player 1'},null],racks:[[],[]],bag:b,board:{},scores:[0,0],turn:0,status:'Waiting for Player 2...',winner:null,deadline:null};draw(g,0);draw(g,1);rooms.set(c,g);s.join(c);emit(g)});
 s.on('join',({code:c,name})=>{let g=rooms.get(String(c||'').toUpperCase());if(!g)return s.emit('errorMsg','Room not found.');if(g.players[1])return s.emit('errorMsg','Room is full.');g.players[1]={id:s.id,name:name||'Player 2'};s.join(g.code);resetDeadline(g);g.status=`${g.players[0].name}'s turn.`;emit(g)});
 s.on('play',({code:c,placements})=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(!g||p<0||g.turn!==p||g.winner)return;let rack=[...g.racks[p]],pending={};for(const q of placements||[]){let k=`${q.r},${q.c}`;if(q.r<0||q.c<0||q.r>=SIZE||q.c>=SIZE||g.board[k]||pending[k])return s.emit('errorMsg','Invalid square.');let idx=rack.indexOf(q.tile);if(idx<0)return s.emit('errorMsg','Rack changed. Please place the tiles again.');rack.splice(idx,1);let ch=q.tile==='?'?String(q.letter||'').toUpperCase():q.tile;if(!/^[A-Z]$/.test(ch))return s.emit('errorMsg','Choose a letter for the blank tile.');pending[k]=ch}
  let keys=Object.keys(pending);if(!keys.length)return s.emit('errorMsg','Place at least one tile.');let rs=new Set(keys.map(k=>k.split(',')[0])),cs=new Set(keys.map(k=>k.split(',')[1]));if(rs.size>1&&cs.size>1)return s.emit('errorMsg','New tiles must share one row or column.');let merged={...g.board,...pending};if(Object.keys(g.board).length&&!keys.some(k=>{let[r,c]=k.split(',').map(Number);return [[1,0],[-1,0],[0,1],[0,-1]].some(([dr,dc])=>g.board[`${r+dr},${c+dc}`])}))return s.emit('errorMsg','The play must connect to the existing board.');let seq=wordsFor(g.board,pending);if(!seq.length)return s.emit('errorMsg','Create a word of at least two letters.');let ws=seq.map(a=>a.map(k=>merged[k]).join(''));let bad=ws.filter(w=>!WORDS.has(w));if(bad.length)return s.emit('errorMsg','Not in dictionary: '+bad.join(', '));let points=10*seq.reduce((n,a)=>n+a.length,0)+50*keys.filter(k=>STARS.has(k)).length;g.board=merged;g.racks[p]=rack;draw(g,p);g.scores[p]+=points;g.status=`${g.players[p].name} scored ${points}: ${ws.join(', ')}`;if(g.scores[p]>=g.goal){g.winner=p;g.deadline=null;g.status=`${g.players[p].name} wins!`;emit(g)}else advance(g)
 });
 s.on('exchange',({code:c,tiles})=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(!g||p<0||g.turn!==p||g.winner)return;let rack=[...g.racks[p]];for(const t of tiles||[]){let i=rack.indexOf(t);if(i>=0){rack.splice(i,1);g.bag.unshift(t)}}g.bag.sort(()=>Math.random()-.5);g.racks[p]=rack;draw(g,p);g.status=`${g.players[p].name} exchanged tiles.`;advance(g)});
 s.on('pass',c=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(g&&p===g.turn&&!g.winner){g.status=`${g.players[p].name} passed.`;advance(g)}});
 s.on('disconnect',()=>{for(const g of rooms.values()){let p=g.players.findIndex(x=>x&&x.id===s.id);if(p>=0){g.status=`${g.players[p].name} disconnected.`;emit(g)}}})
});
server.listen(process.env.PORT||3000,()=>console.log('Word Duel Online on port '+(process.env.PORT||3000)));
