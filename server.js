const express=require('express'),http=require('http'),{Server}=require('socket.io'),fs=require('fs'),path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server);
app.get('/health',(req,res)=>res.status(200).json({ok:true,service:'word-duel-online'}));
app.get('/word-duel-victory-fanfare.wav',(req,res)=>{
 const sr=44100,duration=2.6,n=Math.floor(sr*duration),audio=new Float64Array(n);
 const notes=[[0,.18,523.25,.28],[.18,.18,659.25,.28],[.36,.18,783.99,.30],[.54,.24,1046.5,.34],[.86,.16,783.99,.25],[1.02,.16,987.77,.28],[1.18,.20,1174.66,.30],[1.38,.65,1318.51,.30],...[523.25,659.25,783.99,1046.5].map(f=>[1.55,.90,f,.16])];
 function tone(start,dur,freq,amp){let a=Math.floor(start*sr),b=Math.min(n,Math.floor((start+dur)*sr));for(let i=a;i<b;i++){let j=i-a,rem=b-i,env=Math.min(1,j/(.012*sr),rem/(.10*sr)),t=i/sr;audio[i]+=amp*env*(Math.sin(2*Math.PI*freq*t)+.28*Math.sin(4*Math.PI*freq*t)+.12*Math.sin(6*Math.PI*freq*t))}}
 notes.forEach(x=>tone(...x));[[2.05,1567.98],[2.16,2093],[2.27,2637.02]].forEach(([st,hz])=>tone(st,.12,hz,.12));
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(audio[i]));let scale=.88/(peak||1),data=Buffer.alloc(n*2),header=Buffer.alloc(44);
 header.write('RIFF',0);header.writeUInt32LE(36+data.length,4);header.write('WAVE',8);header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(sr,24);header.writeUInt32LE(sr*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);
 for(let i=0;i<n;i++){let v=Math.max(-1,Math.min(1,audio[i]*scale));data.writeInt16LE(Math.trunc(v*32767),i*2)}
 res.type('audio/wav').set('Cache-Control','public, max-age=31536000, immutable').send(Buffer.concat([header,data]));
});
app.use(express.static(path.join(__dirname,'public')));
const WORD_LIST=fs.readFileSync(path.join(__dirname,'english_words.txt'),'utf8').split(/\r?\n/).map(x=>x.trim().toUpperCase()).filter(x=>/^[A-Z]{2,}$/.test(x));
const WORDS=new Set(WORD_LIST);
// Easy AI uses a curated common-English vocabulary. Human plays still validate against WORDS above.
const EASY_COMMON=`
ABLE ABOUT ABOVE ACT ADD AFTER AGAIN AGE AGO AIR ALL ALONE ALONG ALSO ALWAYS AMONG AN AND ANIMAL ANSWER ANY APPLE AREA ARM AROUND ART ASK AT AWAY
BABY BACK BAD BALL BANK BASE BE BEACH BEAR BEAUTY BED BEEN BEFORE BEGIN BEST BETTER BIG BIRD BLACK BLUE BOAT BODY BOOK BOTH BOX BOY BRING BROTHER BUILD BUS BUSINESS BUT BUY BY
CALL CAN CAR CARE CARRY CAT CHANGE CHILD CITY CLASS CLEAN CLEAR CLOSE COLD COLOR COME COMMON COOK COOL COULD COUNTRY COURSE CUT
DAD DAY DEAR DEEP DID DIE DIFFERENT DO DOG DONE DOOR DOWN DRAW DREAM DRIVE DRY
EACH EAR EARLY EARTH EAST EASY EAT END ENOUGH EVEN EVER EVERY EYE
FACE FACT FAMILY FAR FARM FAST FATHER FEEL FEET FEW FIELD FIND FINE FIRE FIRST FISH FIVE FLOOR FLOWER FLY FOOD FOOT FOR FORM FOUR FREE FRIEND FROM FRONT FULL FUN
GAME GARDEN GET GIRL GIVE GO GOOD GREAT GREEN GROUND GROUP GROW
HAD HALF HAND HAPPEN HAPPY HARD HAS HAVE HE HEAD HEAR HEART HELP HER HERE HIGH HILL HIM HIS HOME HOPE HORSE HOT HOUSE HOW
IDEA IF IMPORTANT IN INTO IS IT
JOB JOIN JUST
KEEP KIND KING KNOW
LAND LARGE LAST LATE LEARN LEFT LESS LET LETTER LIFE LIGHT LIKE LINE LIST LITTLE LIVE LONG LOOK LOVE LOW
MADE MAKE MAN MANY MAP MAY ME MEAN MEN MIGHT MIND MISS MONEY MONTH MORE MORNING MOST MOTHER MOVE MUCH MUSIC MUST MY
NAME NEAR NEED NEVER NEW NEXT NIGHT NO NORTH NOT NOTE NOW NUMBER
OF OFF OFTEN OLD ON ONCE ONE ONLY OPEN OR ORDER OTHER OUR OUT OVER OWN
PAGE PAPER PART PARTY PEOPLE PERSON PICK PICTURE PLACE PLAN PLAY POINT PUT
QUESTION QUICK
RAIN READ REAL RED REMEMBER RIGHT RIVER ROAD ROCK ROOM RUN
SAME SAW SAY SCHOOL SEA SECOND SEE SEEM SET SHE SHORT SHOULD SHOW SIDE SIMPLE SISTER SIX SMALL SO SOME SONG SOON SOUND SOUTH START STATE STAY STEP STILL STOP STORY STREET STRONG SUCH SUN
TABLE TAKE TALK TELL TEN THAN THAT THE THEIR THEM THEN THERE THESE THEY THING THINK THIS THREE THROUGH TIME TO TODAY TOGETHER TOO TOP TOWN TREE TRY TURN TWO
UNDER UP US USE
VERY
WAIT WALK WANT WAR WAS WATCH WATER WAY WE WEEK WELL WENT WERE WHAT WHEN WHERE WHICH WHITE WHO WHY WILL WIND WITH WOMAN WORD WORK WORLD WOULD WRITE
YEAR YES YET YOU YOUNG YOUR
`.trim().split(/\s+/).map(w=>w.toUpperCase()).filter(w=>w.length>=2&&w.length<=7&&WORDS.has(w));
const AI_WORDS=EASY_COMMON;
const SIZE=11, STARTS=['10,0','0,10'], STARS=new Set(['1,1','1,9','3,5','5,3','5,7','7,5','9,1','9,9']);
const FREQ='EEEEEEEEEEEEAAAAAAAAAIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ?';
const rooms=new Map();
function code(){let s='';do{s=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(s));return s}
function bag(){return FREQ.repeat(3).split('').sort(()=>Math.random()-.5)}
function draw(g,p){while(g.racks[p].length<7&&g.bag.length)g.racks[p].push(g.bag.pop())}
function publicState(g,sid){let me=g.players.findIndex(p=>p&&p.id===sid);return {code:g.code,mode:g.mode||'online',difficulty:g.difficulty||'easy',goal:g.goal,timer:g.timer,turn:g.turn,scores:g.scores,bonusPoints:g.bonusPoints||[{connection:0,seven:0,stars:0},{connection:0,seven:0,stars:0}],board:g.board,owners:g.owners||{},starts:STARTS,connected:!!g.connected,stars:[...STARS],players:g.players.map(p=>p?{name:p.name}:null),rack:me>=0?g.racks[me]:[],opponentRackCount:me>=0?(g.racks[1-me]?.length||0):0,me,status:g.status,lastComputerMove:g.lastComputerMove||null,winner:g.winner,deadline:g.deadline,replayDeadline:g.replayDeadline||null}}
function emit(g){g.players.forEach(p=>{if(p&&p.id)io.to(p.id).emit('state',publicState(g,p.id))})}
function wordsFor(board,pending){let merged={...board,...pending},seen=new Set(),out=[];for(const k of Object.keys(pending)){let [r,c]=k.split(',').map(Number);for(const [dr,dc] of [[0,1],[1,0]]){let sr=r,sc=c;while(merged[`${sr-dr},${sc-dc}`]){sr-=dr;sc-=dc}let cells=[],rr=sr,cc=sc;while(merged[`${rr},${cc}`]){cells.push(`${rr},${cc}`);rr+=dr;cc+=dc}if(cells.length>=2){let sig=cells.join('|');if(!seen.has(sig)){seen.add(sig);out.push(cells)}}}}return out}
function resetDeadline(g){g.deadline=g.timer?Date.now()+g.timer*1000:null}
function scorePlay(keys,seq){return 10*seq.reduce((n,a)=>n+a.length,0)+50*keys.filter(k=>STARS.has(k)).length}
function adjacentKeys(k){let[r,c]=k.split(',').map(Number);return [[1,0],[-1,0],[0,1],[0,-1]].map(([dr,dc])=>`${r+dr},${c+dc}`).filter(x=>{let[a,b]=x.split(',').map(Number);return a>=0&&b>=0&&a<SIZE&&b<SIZE})}
function hasOwned(g,p){return Object.values(g.owners||{}).some(x=>x===p)}
function touchesOwner(g,keys,p){return keys.some(k=>adjacentKeys(k).some(n=>g.owners?.[n]===p))}
function coversStart(keys,p){return keys.includes(STARTS[p])}
function makesFirstConnection(g,keys,p){if(g.connected)return false;let other=1-p;return keys.some(k=>adjacentKeys(k).some(n=>g.owners?.[n]===other))}
function networkLegal(g,keys,p){if(g.connected)return keys.some(k=>adjacentKeys(k).some(n=>g.board[n]));if(!hasOwned(g,p))return coversStart(keys,p);return touchesOwner(g,keys,p)}
function placementText(placements){if(!placements||!placements.length)return '';let ps=[...placements].sort((a,b)=>a.r-b.r||a.c-b.c);return ps.map(p=>`${p.letter}@R${p.r+1}C${p.c+1}`).join(', ')}
function resetGame(g){g.bag=bag();g.racks=[[],[]];g.board={};g.owners={};g.scores=[0,0];g.bonusPoints=[{connection:0,seven:0,stars:0},{connection:0,seven:0,stars:0}];g.turn=0;g.winner=null;g.connected=false;g.lastComputerMove=null;g.replayDeadline=null;g.replayAnswers={};draw(g,0);draw(g,1);resetDeadline(g);g.status=`${g.players[0]?.name||'Player 1'}'s turn.`;emit(g)}
function closeGame(g){g.replayDeadline=null;g.players.forEach(p=>{if(p&&p.id)io.to(p.id).emit('gameClosed')});rooms.delete(g.code)}
function offerReplay(g){g.replayAnswers={};g.replayDeadline=Date.now()+10000;emit(g);setTimeout(()=>{if(rooms.get(g.code)===g&&g.winner&&g.replayDeadline&&Date.now()>=g.replayDeadline)closeGame(g)},10100)}
function scheduleComputer(g){if(g.mode==='computer'&&g.turn===1&&!g.winner)setTimeout(()=>computerTurn(g),5000)}
function advance(g,statusOverride){g.turn=1-g.turn;resetDeadline(g);g.status=statusOverride||`${g.players[g.turn]?.name||'Player'}'s turn.`;emit(g);scheduleComputer(g)}
function finishIfTilesExhausted(g,p){
 if(g.bag.length||g.racks[p].length)return false;
 let other=1-p,penalty=10*g.racks[other].length;
 g.scores[other]=Math.max(0,g.scores[other]-penalty);
 if(g.scores[p]>g.scores[other])g.winner=p;
 else if(g.scores[other]>g.scores[p])g.winner=other;
 else g.winner=p;
 g.deadline=null;
 let winnerName=g.players[g.winner]?.name||'Player';
 let loserName=g.players[other]?.name||'Opponent';
 g.status=`No tiles remain. ${loserName} loses ${penalty} point${penalty===1?'':'s'} for ${g.racks[other].length} rack tile${g.racks[other].length===1?'':'s'}. ${winnerName} Wins!`;
 offerReplay(g);
 return true
}
function canUseWord(g,word,r,c,dr,dc){let rack=[...g.racks[1]],pending={},placements=[],touches=false,newCount=0;for(let i=0;i<word.length;i++){let rr=r+dr*i,cc=c+dc*i,k=`${rr},${cc}`,ch=word[i];if(rr<0||cc<0||rr>=SIZE||cc>=SIZE)return null;if(g.board[k]){if(g.board[k]!==ch)return null;touches=true}else{let idx=rack.indexOf(ch),tile=ch;if(idx<0){idx=rack.indexOf('?');tile='?'}if(idx<0)return null;rack.splice(idx,1);pending[k]=ch;placements.push({r:rr,c:cc,tile,letter:ch});newCount++}}
 if(!newCount)return null;
 let keys=Object.keys(pending);if(!networkLegal(g,keys,1))return null;
 let seq=wordsFor(g.board,pending);if(!seq.length)return null;let merged={...g.board,...pending},ws=seq.map(a=>a.map(k=>merged[k]).join(''));if(ws.some(w=>!WORDS.has(w)))return null;
 let connection=makesFirstConnection(g,Object.keys(pending),1);return {pending,placements,rack,seq,ws,connection,seven:placements.length===7,points:scorePlay(Object.keys(pending),seq)+(connection?75:0)+(placements.length===7?50:0)}
}
function findMove(g){let difficulty=g.difficulty||'easy';let pool=difficulty==='easy'?AI_WORDS:WORD_LIST.filter(w=>w.length>=2&&w.length<=7);let candidates=pool.slice();for(let i=candidates.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
 let boardEmpty=!hasOwned(g,1);
 for(const word of candidates){if(word.length>7&&boardEmpty)continue;for(const [dr,dc] of [[0,1],[1,0]]){for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){if(r+dr*(word.length-1)>=SIZE||c+dc*(word.length-1)>=SIZE)continue;if(boardEmpty&&!Array.from({length:word.length},(_,i)=>`${r+dr*i},${c+dc*i}`).includes(STARTS[1]))continue;let m=canUseWord(g,word,r,c,dr,dc);if(m)return m}}}return null}
function computerTurn(g){if(g.winner||g.turn!==1||g.mode!=='computer')return;let moves=[];if((g.difficulty||'easy')==='easy'){let m=findMove(g);if(m)moves=[m]}else{let pool=(g.difficulty==='hard'?WORD_LIST:WORD_LIST.filter(w=>w.length<=6));let sample=g.difficulty==='hard'?pool:pool.filter((_,i)=>i%3===0);for(const word of sample){if(word.length<2||word.length>7)continue;for(const [dr,dc] of [[0,1],[1,0]])for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){if(r+dr*(word.length-1)>=SIZE||c+dc*(word.length-1)>=SIZE)continue;let m=canUseWord(g,word,r,c,dr,dc);if(m)moves.push(m)}}}let m=moves.length?((g.difficulty||'easy')==='easy'?moves[0]:moves.sort((a,b)=>b.points-a.points)[0]):null;if(!m){if(g.bag.length){g.bag.unshift(...g.racks[1]);g.racks[1]=[];g.bag.sort(()=>Math.random()-.5);draw(g,1);g.status='Computer exchanged its tiles.'}else g.status='Computer passed.';return advance(g)}
 g.board={...g.board,...m.pending};if(m.connection)g.connected=true;g.owners=g.owners||{};Object.keys(m.pending).forEach(k=>g.owners[k]=1);g.racks[1]=m.rack;draw(g,1);g.scores[1]+=m.points;g.bonusPoints=g.bonusPoints||[{connection:0,seven:0,stars:0},{connection:0,seven:0,stars:0}];if(m.connection)g.bonusPoints[1].connection+=75;if(m.seven)g.bonusPoints[1].seven+=50;g.bonusPoints[1].stars+=50*Object.keys(m.pending).filter(k=>STARS.has(k)).length;g.lastComputerMove={words:m.ws,points:m.points,placements:m.placements,placementText:placementText(m.placements)};g.status=`Computer scored ${m.points}: ${m.ws.join(', ')}${m.connection?' — CONNECTED! +75 bonus':''}${m.seven?' — 7 TILES! +50 bonus':''}`;if(g.scores[1]>=g.goal){g.winner=1;g.deadline=null;g.status='Computer Wins!';offerReplay(g)}else if(!finishIfTilesExhausted(g,1))advance(g)}
setInterval(()=>{for(const g of rooms.values()){if(!g.winner&&g.deadline&&Date.now()>g.deadline){let timedOut=g.players[g.turn]?.name||'Player',next=g.players[1-g.turn]?.name||'the opponent';advance(g,`TIME'S UP for ${timedOut}! Turn passed to ${next}.`)}}},500);
io.on('connection',s=>{
 s.on('create',({name,goal=800,timer=0})=>{let c=code(),b=bag(),g={code:c,mode:'online',goal:+goal||800,timer:+timer||0,players:[{id:s.id,name:name||'Player 1'},null],racks:[[],[]],bag:b,board:{},owners:{},scores:[0,0],bonusPoints:[{connection:0,seven:0,stars:0},{connection:0,seven:0,stars:0}],turn:0,status:'Waiting for Player 2...',winner:null,connected:false,deadline:null};draw(g,0);draw(g,1);rooms.set(c,g);s.join(c);emit(g)});
 s.on('createComputer',({name,goal=800,timer=0,difficulty='easy'})=>{let c=code(),b=bag(),g={code:c,mode:'computer',difficulty:['easy','medium','hard'].includes(difficulty)?difficulty:'easy',goal:+goal||800,timer:+timer||0,players:[{id:s.id,name:name||'Player'},{id:null,name:'Computer',computer:true}],racks:[[],[]],bag:b,board:{},owners:{},scores:[0,0],bonusPoints:[{connection:0,seven:0,stars:0},{connection:0,seven:0,stars:0}],turn:0,status:`${name||'Player'}'s turn.`,winner:null,connected:false,deadline:null};draw(g,0);draw(g,1);rooms.set(c,g);resetDeadline(g);emit(g)});
 s.on('join',({code:c,name})=>{let g=rooms.get(String(c||'').toUpperCase());if(!g)return s.emit('errorMsg','Room not found.');if(g.mode==='computer')return s.emit('errorMsg','That game is against the computer.');if(g.players[1])return s.emit('errorMsg','Room is full.');g.players[1]={id:s.id,name:name||'Player 2'};s.join(g.code);resetDeadline(g);g.status=`${g.players[0].name}'s turn.`;emit(g)});
 s.on('play',({code:c,placements})=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(!g||p<0||g.turn!==p||g.winner)return;let rack=[...g.racks[p]],pending={};for(const q of placements||[]){let k=`${q.r},${q.c}`;if(q.r<0||q.c<0||q.r>=SIZE||q.c>=SIZE||g.board[k]||pending[k])return s.emit('errorMsg','Invalid square.');let idx=rack.indexOf(q.tile);if(idx<0)return s.emit('errorMsg','Rack changed. Please place the tiles again.');rack.splice(idx,1);let ch=q.tile==='?'?String(q.letter||'').toUpperCase():q.tile;if(!/^[A-Z]$/.test(ch))return s.emit('errorMsg','Choose a letter for the blank tile.');pending[k]=ch}
  let keys=Object.keys(pending);if(!keys.length)return s.emit('errorMsg','Place at least one tile.');let rs=new Set(keys.map(k=>k.split(',')[0])),cs=new Set(keys.map(k=>k.split(',')[1]));if(rs.size>1&&cs.size>1)return s.emit('errorMsg','New tiles must share one row or column.');let merged={...g.board,...pending};if(!networkLegal(g,keys,p))return s.emit('errorMsg',hasOwned(g,p)?'Before the networks connect, build from your own tiles.':'Your first word must cover your corner start square.');let seq=wordsFor(g.board,pending);if(!seq.length)return s.emit('errorMsg','Create a word of at least two letters.');let ws=seq.map(a=>a.map(k=>merged[k]).join(''));let bad=ws.filter(w=>!WORDS.has(w));if(bad.length)return s.emit('errorMsg','Not in dictionary: '+bad.join(', '));let connection=makesFirstConnection(g,keys,p);let seven=keys.length===7;let points=scorePlay(keys,seq)+(connection?75:0)+(seven?50:0);g.board=merged;if(connection)g.connected=true;g.owners=g.owners||{};keys.forEach(k=>g.owners[k]=p);g.racks[p]=rack;draw(g,p);g.scores[p]+=points;g.bonusPoints=g.bonusPoints||[{connection:0,seven:0,stars:0},{connection:0,seven:0,stars:0}];if(connection)g.bonusPoints[p].connection+=75;if(seven)g.bonusPoints[p].seven+=50;g.bonusPoints[p].stars+=50*keys.filter(k=>STARS.has(k)).length;g.status=`${g.players[p].name} scored ${points}: ${ws.join(', ')}${connection?' — CONNECTED! +75 bonus':''}${seven?' — 7 TILES! +50 bonus':''}`;if(g.scores[p]>=g.goal){g.winner=p;g.deadline=null;g.status=`${g.players[p].name} Wins!`;offerReplay(g)}else if(!finishIfTilesExhausted(g,p))advance(g)
 });
 s.on('exchange',({code:c,tiles})=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(!g||p<0||g.turn!==p||g.winner)return;let rack=[...g.racks[p]],returned=[];for(const t of tiles||[]){let i=rack.indexOf(t);if(i>=0){rack.splice(i,1);returned.push(t)}}if(!returned.length)return s.emit('errorMsg','Select at least one tile to exchange.');if(g.bag.length<returned.length)return s.emit('errorMsg','Not enough tiles remain in the bag to exchange that many.');g.racks[p]=rack;draw(g,p);g.bag.unshift(...returned);g.bag.sort(()=>Math.random()-.5);g.status=`${g.players[p].name} exchanged ${returned.length} tile${returned.length===1?'':'s'}.`;advance(g)});
 s.on('resign',c=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(!g||p<0||g.winner)return;g.winner=1-p;g.deadline=null;g.status=`${g.players[p].name} resigned. ${g.players[1-p]?.name||'Opponent'} wins!`;emit(g)});
 s.on('replayAnswer',({code:c,answer})=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(!g||p<0||!g.winner||!g.replayDeadline)return;if(answer!=='yes')return closeGame(g);g.replayAnswers=g.replayAnswers||{};g.replayAnswers[p]='yes';if(g.mode==='computer')return resetGame(g);if(g.replayAnswers[0]==='yes'&&g.replayAnswers[1]==='yes')resetGame(g)});
 s.on('pass',c=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(g&&p===g.turn&&!g.winner){g.status=`${g.players[p].name} passed.`;advance(g)}});
 s.on('disconnect',()=>{for(const g of rooms.values()){let p=g.players.findIndex(x=>x&&x.id===s.id);if(p>=0){g.status=`${g.players[p].name} disconnected.`;emit(g)}}})
});
server.listen(process.env.PORT||3000,()=>console.log('Word Duel Online on port '+(process.env.PORT||3000)));
