const express=require('express'),http=require('http'),{Server}=require('socket.io'),fs=require('fs'),path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server);
app.get('/health',(req,res)=>res.status(200).json({ok:true,service:'word-duel-online'}));
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
const SIZE=11, STARS=new Set(['1,1','1,9','3,5','5,3','5,7','7,5','9,1','9,9']);
const FREQ='EEEEEEEEEEEEAAAAAAAAAIIIIIIIIOOOOOOOONNNNNNRRRRRRTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ?';
const rooms=new Map();
function code(){let s='';do{s=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(s));return s}
function bag(){return FREQ.repeat(3).split('').sort(()=>Math.random()-.5)}
function draw(g,p){while(g.racks[p].length<7&&g.bag.length)g.racks[p].push(g.bag.pop())}
function publicState(g,sid){let me=g.players.findIndex(p=>p&&p.id===sid);return {code:g.code,mode:g.mode||'online',goal:g.goal,timer:g.timer,turn:g.turn,scores:g.scores,board:g.board,stars:[...STARS],players:g.players.map(p=>p?{name:p.name}:null),rack:me>=0?g.racks[me]:[],me,status:g.status,lastComputerMove:g.lastComputerMove||null,winner:g.winner,deadline:g.deadline}}
function emit(g){g.players.forEach(p=>{if(p&&p.id)io.to(p.id).emit('state',publicState(g,p.id))})}
function wordsFor(board,pending){let merged={...board,...pending},seen=new Set(),out=[];for(const k of Object.keys(pending)){let [r,c]=k.split(',').map(Number);for(const [dr,dc] of [[0,1],[1,0]]){let sr=r,sc=c;while(merged[`${sr-dr},${sc-dc}`]){sr-=dr;sc-=dc}let cells=[],rr=sr,cc=sc;while(merged[`${rr},${cc}`]){cells.push(`${rr},${cc}`);rr+=dr;cc+=dc}if(cells.length>=2){let sig=cells.join('|');if(!seen.has(sig)){seen.add(sig);out.push(cells)}}}}return out}
function resetDeadline(g){g.deadline=g.timer?Date.now()+g.timer*1000:null}
function scorePlay(keys,seq){return 10*seq.reduce((n,a)=>n+a.length,0)+50*keys.filter(k=>STARS.has(k)).length}
function placementText(placements){if(!placements||!placements.length)return '';let ps=[...placements].sort((a,b)=>a.r-b.r||a.c-b.c);return ps.map(p=>`${p.letter}@R${p.r+1}C${p.c+1}`).join(', ')}
function scheduleComputer(g){if(g.mode==='computer'&&g.turn===1&&!g.winner)setTimeout(()=>computerTurn(g),650)}
function advance(g){g.turn=1-g.turn;resetDeadline(g);g.status=`${g.players[g.turn]?.name||'Player'}'s turn.`;emit(g);scheduleComputer(g)}
function canUseWord(g,word,r,c,dr,dc){let rack=[...g.racks[1]],pending={},placements=[],touches=false,newCount=0;for(let i=0;i<word.length;i++){let rr=r+dr*i,cc=c+dc*i,k=`${rr},${cc}`,ch=word[i];if(rr<0||cc<0||rr>=SIZE||cc>=SIZE)return null;if(g.board[k]){if(g.board[k]!==ch)return null;touches=true}else{let idx=rack.indexOf(ch),tile=ch;if(idx<0){idx=rack.indexOf('?');tile='?'}if(idx<0)return null;rack.splice(idx,1);pending[k]=ch;placements.push({r:rr,c:cc,tile,letter:ch});newCount++}}
 if(!newCount)return null;
 let boardKeys=Object.keys(g.board);if(boardKeys.length&&!touches&&!Object.keys(pending).some(k=>{let[rr,cc]=k.split(',').map(Number);return [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b])=>g.board[`${rr+a},${cc+b}`])}))return null;
 let seq=wordsFor(g.board,pending);if(!seq.length)return null;let merged={...g.board,...pending},ws=seq.map(a=>a.map(k=>merged[k]).join(''));if(ws.some(w=>!WORDS.has(w)))return null;
 return {pending,placements,rack,seq,ws,points:scorePlay(Object.keys(pending),seq)}
}
function findEasyMove(g){let candidates=AI_WORDS.slice();for(let i=candidates.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]]}
 let boardEmpty=!Object.keys(g.board).length;
 for(const word of candidates){if(word.length>7&&boardEmpty)continue;for(const [dr,dc] of [[0,1],[1,0]]){for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){if(r+dr*(word.length-1)>=SIZE||c+dc*(word.length-1)>=SIZE)continue;if(boardEmpty&&!(r<=5&&5<=r+dr*(word.length-1)&&c<=5&&5<=c+dc*(word.length-1)))continue;let m=canUseWord(g,word,r,c,dr,dc);if(m)return m}}}return null}
function computerTurn(g){if(g.winner||g.turn!==1||g.mode!=='computer')return;let m=findEasyMove(g);if(!m){if(g.bag.length){g.bag.unshift(...g.racks[1]);g.racks[1]=[];g.bag.sort(()=>Math.random()-.5);draw(g,1);g.status='Computer exchanged its tiles.'}else g.status='Computer passed.';return advance(g)}
 g.board={...g.board,...m.pending};g.racks[1]=m.rack;draw(g,1);g.scores[1]+=m.points;g.lastComputerMove={words:m.ws,points:m.points,placements:m.placements,placementText:placementText(m.placements)};g.status=`Computer scored ${m.points}: ${m.ws.join(', ')}`;if(g.scores[1]>=g.goal){g.winner=1;g.deadline=null;g.status='Computer wins!';emit(g)}else advance(g)}
setInterval(()=>{for(const g of rooms.values()){if(!g.winner&&g.deadline&&Date.now()>g.deadline){g.status=`Time expired. ${g.players[g.turn]?.name||'Player'} forfeited the turn.`;advance(g)}}},500);
io.on('connection',s=>{
 s.on('create',({name,goal=800,timer=0})=>{let c=code(),b=bag(),g={code:c,mode:'online',goal:+goal||800,timer:+timer||0,players:[{id:s.id,name:name||'Player 1'},null],racks:[[],[]],bag:b,board:{},scores:[0,0],turn:0,status:'Waiting for Player 2...',winner:null,deadline:null};draw(g,0);draw(g,1);rooms.set(c,g);s.join(c);emit(g)});
 s.on('createComputer',({name,goal=800,timer=0})=>{let c=code(),b=bag(),g={code:c,mode:'computer',goal:+goal||800,timer:+timer||0,players:[{id:s.id,name:name||'Player'},{id:null,name:'Computer',computer:true}],racks:[[],[]],bag:b,board:{},scores:[0,0],turn:0,status:`${name||'Player'}'s turn.`,winner:null,deadline:null};draw(g,0);draw(g,1);rooms.set(c,g);resetDeadline(g);emit(g)});
 s.on('join',({code:c,name})=>{let g=rooms.get(String(c||'').toUpperCase());if(!g)return s.emit('errorMsg','Room not found.');if(g.mode==='computer')return s.emit('errorMsg','That game is against the computer.');if(g.players[1])return s.emit('errorMsg','Room is full.');g.players[1]={id:s.id,name:name||'Player 2'};s.join(g.code);resetDeadline(g);g.status=`${g.players[0].name}'s turn.`;emit(g)});
 s.on('play',({code:c,placements})=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(!g||p<0||g.turn!==p||g.winner)return;let rack=[...g.racks[p]],pending={};for(const q of placements||[]){let k=`${q.r},${q.c}`;if(q.r<0||q.c<0||q.r>=SIZE||q.c>=SIZE||g.board[k]||pending[k])return s.emit('errorMsg','Invalid square.');let idx=rack.indexOf(q.tile);if(idx<0)return s.emit('errorMsg','Rack changed. Please place the tiles again.');rack.splice(idx,1);let ch=q.tile==='?'?String(q.letter||'').toUpperCase():q.tile;if(!/^[A-Z]$/.test(ch))return s.emit('errorMsg','Choose a letter for the blank tile.');pending[k]=ch}
  let keys=Object.keys(pending);if(!keys.length)return s.emit('errorMsg','Place at least one tile.');let rs=new Set(keys.map(k=>k.split(',')[0])),cs=new Set(keys.map(k=>k.split(',')[1]));if(rs.size>1&&cs.size>1)return s.emit('errorMsg','New tiles must share one row or column.');let merged={...g.board,...pending};if(Object.keys(g.board).length&&!keys.some(k=>{let[r,c]=k.split(',').map(Number);return [[1,0],[-1,0],[0,1],[0,-1]].some(([dr,dc])=>g.board[`${r+dr},${c+dc}`])}))return s.emit('errorMsg','The play must connect to the existing board.');let seq=wordsFor(g.board,pending);if(!seq.length)return s.emit('errorMsg','Create a word of at least two letters.');let ws=seq.map(a=>a.map(k=>merged[k]).join(''));let bad=ws.filter(w=>!WORDS.has(w));if(bad.length)return s.emit('errorMsg','Not in dictionary: '+bad.join(', '));let points=scorePlay(keys,seq);g.board=merged;g.racks[p]=rack;draw(g,p);g.scores[p]+=points;g.status=`${g.players[p].name} scored ${points}: ${ws.join(', ')}`;if(g.scores[p]>=g.goal){g.winner=p;g.deadline=null;g.status=`${g.players[p].name} wins!`;emit(g)}else advance(g)
 });
 s.on('exchange',({code:c,tiles})=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(!g||p<0||g.turn!==p||g.winner)return;let rack=[...g.racks[p]];for(const t of tiles||[]){let i=rack.indexOf(t);if(i>=0){rack.splice(i,1);g.bag.unshift(t)}}g.bag.sort(()=>Math.random()-.5);g.racks[p]=rack;draw(g,p);g.status=`${g.players[p].name} exchanged tiles.`;advance(g)});
 s.on('pass',c=>{let g=rooms.get(c),p=g?.players.findIndex(x=>x&&x.id===s.id);if(g&&p===g.turn&&!g.winner){g.status=`${g.players[p].name} passed.`;advance(g)}});
 s.on('disconnect',()=>{for(const g of rooms.values()){let p=g.players.findIndex(x=>x&&x.id===s.id);if(p>=0){g.status=`${g.players[p].name} disconnected.`;emit(g)}}})
});
server.listen(process.env.PORT||3000,()=>console.log('Word Duel Online on port '+(process.env.PORT||3000)));
