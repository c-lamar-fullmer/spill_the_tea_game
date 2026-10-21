(function(){

// This app is now a single-player scorecard.
// There is no room creation or join flow, because there is no backend yet.
// The user starts by choosing a name and their starting points, then enters the scorecard.

const WEEKS = 7;
const SAVE_KEY = 'spillTheTea.game';
const SAVE_VERSION = 1;
const CARD_LEGEND = [
  {name:"Spill Tea", pts:0, desc:"Reveal your Final Total from the previous week to a player of your choice.", type:"neutral"},
  {name:"Sip Tea", pts:0, desc:"A player of your choice must reveal their Final Total from the previous week.", type:"neutral"},
  {name:"Tea Party (1–4 pts)", pts:null, desc:"Gather friends, each rolls the die and records the points earned or lost.", type:"neutral"},
  {name:"Save Face", pts:0, desc:"Play to protect your reputation during the Saturday Night Party ranking.", type:"neutral"},
  {name:"Eavesdrop", pts:0, desc:"Look at all of one player's cards, or steal a random card from one player.", type:"neutral"},
  {name:"Burn Book", pts:0, desc:"Look at all of a player's cards and steal one card of your choice.", type:"neutral"},
  {name:"Bitter Tea", pts:-1, desc:"The tea looked tasty but didn't taste right.", type:"neg"},
  {name:"Leftover Tea", pts:-2, desc:"You were too busy to get it while it was still hot.", type:"neg"},
  {name:"Expired Tea", pts:-3, desc:"You waited way too long to bring this tea to the party.", type:"neg"},
  {name:"Sweet Tea", pts:1, desc:"This refreshing drink will sweeten up your day.", type:"pos"},
  {name:"Hot Tea", pts:2, desc:"Who doesn't love tea that's fresh off the pot?", type:"pos"},
  {name:"Spicy Tea", pts:3, desc:"The tea is almost too spicy, but you can't stop drinking it.", type:"pos"},
];

let state = {
  screen:'home',
  playerId:'solo-player',
  playerName:'',
  playerNumber:1,
  startingPoints:0,
  room:{
    players:[{id:'solo-player', name:'', startingPoints:0, playerNumber:1}]
  },
  scores:null,
  activeWeek:1,
  legendOpen:false,
  showReveal:false,
  showFullScorecard:false,
  error:null,
};

function emptyWeek(){
  return { teaParty:0, partyHost:null, reputationRuined:null, teaCardPoints:0 };
}

function emptyScores(){
  const s = {};
  for(let i=1;i<=WEEKS;i++) s['week'+i] = emptyWeek();
  return s;
}

function isSavedGame(value){
  return value &&
    value.version === SAVE_VERSION &&
    typeof value.playerName === 'string' &&
    value.playerName.trim().length > 0 &&
    Number.isFinite(value.playerNumber) &&
    value.playerNumber >= 1 &&
    Number.isFinite(value.startingPoints) &&
    Number.isInteger(value.activeWeek) &&
    value.activeWeek >= 1 &&
    value.activeWeek <= WEEKS &&
    value.scores &&
    Array.from({length:WEEKS}, (_, i)=>{
      const week = value.scores['week'+(i+1)];
      return week &&
        Number.isFinite(week.teaParty) &&
        (week.partyHost === null || typeof week.partyHost === 'boolean') &&
        (week.reputationRuined === null || typeof week.reputationRuined === 'boolean') &&
        Number.isFinite(week.teaCardPoints);
    }).every(Boolean);
}

function saveGame(){
  if(state.screen !== 'game' || !state.scores) return;

  const savedGame = {
    version:SAVE_VERSION,
    playerName:state.playerName,
    playerNumber:state.playerNumber,
    startingPoints:state.startingPoints,
    activeWeek:state.activeWeek,
    scores:state.scores,
  };

  try{
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(savedGame));
  }catch(error){
    console.error('Unable to save the game to this browser.', error);
  }
}

function loadGame(){
  let saved;
  try{
    saved = window.localStorage.getItem(SAVE_KEY);
  }catch(error){
    console.error('Unable to read the saved game from this browser.', error);
    return;
  }

  if(!saved) return;

  let game;
  try{
    game = JSON.parse(saved);
  }catch(error){
    console.error('Unable to restore the saved game: saved data is not valid JSON.', error);
    return;
  }

  if(!isSavedGame(game)){
    console.error('Unable to restore the saved game: saved data is invalid or unsupported.');
    return;
  }

  state.playerName = game.playerName;
  state.playerNumber = game.playerNumber;
  state.startingPoints = game.startingPoints;
  state.activeWeek = game.activeWeek;
  state.scores = game.scores;
  state.room = {
    players:[{
      id:state.playerId,
      name:state.playerName,
      startingPoints:state.startingPoints,
      playerNumber:state.playerNumber,
    }]
  };
  state.screen = 'game';
}

function clearGame(){
  try{
    window.localStorage.removeItem(SAVE_KEY);
  }catch(error){
    console.error('Unable to clear the saved game from this browser.', error);
  }
}

function computeWeek(startingPrev, wk){
  const subtotal = startingPrev + (Number(wk.teaParty)||0) + (wk.partyHost?3:0) + (wk.reputationRuined?-3:0);
  const final = subtotal + (Number(wk.teaCardPoints)||0);
  return {subtotal, final};
}

function computeAll(scores, startingPoints){
  let prev = Number(startingPoints)||0;
  const results = {};
  for(let i=1;i<=WEEKS;i++){
    const wk = scores['week'+i] || emptyWeek();
    const {subtotal, final} = computeWeek(prev, wk);
    results['week'+i] = {subtotalFromPrev:prev, subtotal, final};
    prev = subtotal;
  }
  return results;
}

function fmtSigned(n){
  n = Number(n)||0;
  return n>0 ? '+'+n : String(n);
}

function startNewGame(name, startingPoints, playerNumber){
  state.playerName = name.trim();
  state.playerNumber = Math.max(1, Number(playerNumber)||1);
  state.startingPoints = Number(startingPoints)||0;
  state.scores = emptyScores();
  state.room = {
    players:[{
      id: state.playerId,
      name: state.playerName,
      startingPoints: state.startingPoints,
      playerNumber: state.playerNumber,
    }]
  };
  state.screen = 'game';
  state.error = null;
  render();
}

function updateField(field, value){
  const wk = state.scores['week'+state.activeWeek];
  wk[field] = value;
  render();
}

function render(){
  saveGame();
  const app = document.getElementById('app');
  app.innerHTML = '';

  if(state.screen === 'game' && state.showReveal){
    app.appendChild(renderRevealOverlay());
    return;
  }
  if(state.screen === 'game' && state.showFullScorecard){
    app.appendChild(renderFullScorecardOverlay());
    return;
  }

  app.appendChild(renderStains());

  if(state.screen === 'home') app.appendChild(renderHome());
  else if(state.screen === 'setup') app.appendChild(renderSetup());
  else if(state.screen === 'game') app.appendChild(renderGame());
}

function renderStains(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="stain" style="width:260px;height:260px;top:-60px;right:-90px;"></div>
    <div class="stain" style="width:140px;height:140px;bottom:40px;left:-50px;"></div>
  `;
  return wrap;
}

function brandHeader(subtitle){
  const div = document.createElement('div');
  div.className = 'brand';
  div.innerHTML = `
    <svg class="cup" viewBox="0 0 64 64" fill="none">
      <path d="M12 24h32v18a12 12 0 0 1-12 12H24a12 12 0 0 1-12-12V24z" stroke="var(--gold)" stroke-width="2.2"/>
      <path d="M44 28h4a7 7 0 0 1 0 14h-4" stroke="var(--gold)" stroke-width="2.2"/>
      <path d="M18 24c0-4 3-5 3-9M28 24c0-4 3-5 3-9M38 24c0-4 3-5 3-9" stroke="var(--rose)" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>
    </svg>
    <div class="eyebrow">I don’t need friends. I need an audience.</div>
    <h1>Spill the <span>Tea</span></h1>
    <div class="sub">${subtitle||''}</div>
  `;
  return div;
}

function renderHome(){
  const wrap = document.createElement('div');
  wrap.appendChild(brandHeader('A digital scorecard to keep track of all the drama'));

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h2>Start a new game</h2>
    <div class="desc">Set up your player details and begin tracking the weekly tea drama.</div>
    <button class="btn btn-primary" id="btn-start-game">Start New Game</button>
  `;
  wrap.appendChild(card);

  wrap.appendChild(renderLegendCard());

  setTimeout(()=>{
    document.getElementById('btn-start-game').onclick = ()=>{ state.screen='setup'; state.error=null; render(); };
  },0);

  return wrap;
}

function renderLegendCard(){
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="collapsible-header" id="legend-toggle">
      <h2 style="font-size:16px;">Tea Card reference</h2>
      <svg class="chev ${state.legendOpen?'open':''}" width="16" height="16" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>
    </div>
    ${state.legendOpen ? `<div style="margin-top:12px;">
      ${CARD_LEGEND.map(c=>`
        <div class="legend-item">
          <div class="lname"><span>${c.name}</span>${c.pts!==null?`<span class="pts ${c.pts>0?'pos':c.pts<0?'neg':''}">${c.pts>0?'+':''}${c.pts}</span>`:''}</div>
          <div class="ldesc">${c.desc}</div>
        </div>
      `).join('')}
    </div>` : ''}
  `;
  setTimeout(()=>{
    const t = document.getElementById('legend-toggle');
    if(t) t.onclick = ()=>{ state.legendOpen = !state.legendOpen; render(); };
  },0);
  return card;
}

function renderSetup(){
  const wrap = document.createElement('div');
  wrap.appendChild(brandHeader('Set up your game'));

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <h2>Your player details</h2>
    <div class="desc">Enter your turn number, name, and the starting points from your Player Card.</div>

    <label>Your Turn Number</label>
    <input type="number" id="in-number" value="${state.playerNumber || 1}" min="1" step="1" placeholder="e.g. 1">

    <label>Your Name</label>
    <input type="text" id="in-name" value="${state.playerName||''}" placeholder="e.g. Jordan" maxlength="20">

    <label>Starting points</label>
    <div class="starter-control">
      <button class="step-btn" id="start-minus" type="button">−</button>
      <div class="slot-value start-slot-value">${fmtSigned(state.startingPoints)}</div>
      <button class="step-btn" id="start-plus" type="button">+</button>
    </div>

    ${state.error ? `<div class="error-msg">${state.error}</div>` : ''}

    <button class="btn btn-primary" id="btn-start-game" style="margin-top:14px;">Start Game</button>
    <button class="btn btn-ghost" id="btn-back" style="margin-top:10px;">Back</button>
  `;
  wrap.appendChild(card);

  setTimeout(()=>{
    document.getElementById('start-minus').onclick = ()=>{
      state.startingPoints -= 1;
      render();
    };

    document.getElementById('start-plus').onclick = ()=>{
      state.startingPoints += 1;
      render();
    };

    document.getElementById('btn-back').onclick = ()=>{
      state.screen = 'home';
      state.error = null;
      render();
    };

    document.getElementById('btn-start-game').onclick = ()=>{
      const name = document.getElementById('in-name').value.trim();
      const number = document.getElementById('in-number').value;
      const parsedNumber = Number(number);

      if(!name){
        state.error = 'Please enter your name before starting.';
        render();
        return;
      }

      if(!number || Number.isNaN(parsedNumber) || parsedNumber < 1){
        state.error = 'Please enter a valid player number before starting.';
        render();
        return;
      }

      state.playerNumber = parsedNumber;
      startNewGame(name, state.startingPoints, state.playerNumber);
    };
  },0);

  return wrap;
}

function rowControl(leftHtml, rightHtml){
  return `<div class="control-left">${leftHtml||''}</div><div class="control-right">${rightHtml}</div>`;
}

function yesNoControl(idPrefix, currentValue, pointValue){
  const posNeg = pointValue > 0 ? 'pos' : 'neg';
  const badgeLabel = pointValue > 0 ? ('+'+pointValue) : String(pointValue);
  const appliedValue = currentValue === true ? badgeLabel : '0';
  const left = `
    <div class="point-badge ${posNeg}">${badgeLabel}</div>
    <div class="yesno" id="${idPrefix}">
      <div class="yesno-opt ${currentValue===false?'active-no':''}" data-val="no">No</div>
      <div class="yesno-opt ${currentValue===true?'active-yes':''}" data-val="yes">Yes</div>
    </div>
  `;
  const right = `
    <div class="slot"></div>
    <div class="slot-value">${appliedValue}</div>
    <div class="slot"></div>
  `;
  return rowControl(left, right);
}

function renderRevealOverlay(){
  const me = state.room.players[0];
  const computed = computeAll(state.scores, me.startingPoints);
  const value = computed['week'+state.activeWeek].subtotalFromPrev;
  const caption = state.activeWeek === 1
    ? 'Starting points'
    : 'Final Total from Week ' + (state.activeWeek - 1);

  const wrap = document.createElement('div');
  wrap.className = 'reveal-overlay';
  wrap.innerHTML = `
    <div class="eyebrow">${state.playerName}</div>
    <div class="big-num">${value}</div>
    <div class="cap">${caption}</div>
    <button class="btn btn-primary" id="btn-close-reveal">Back to Scorecard</button>
  `;
  setTimeout(()=>{
    document.getElementById('btn-close-reveal').onclick = ()=>{ state.showReveal=false; render(); };
  },0);
  return wrap;
}

function renderFullScorecardOverlay(){
  const me = state.room.players[0];
  const computed = computeAll(state.scores, me.startingPoints);

  const rows = [
    {label:'Prev Wk', cls:'', get:(i)=>computed['week'+i].subtotalFromPrev},
    {label:'Tea Party', cls:'', get:(i)=>fmtSigned(state.scores['week'+i].teaParty)},
    {label:'Host', cls:'', get:(i)=> state.scores['week'+i].partyHost===true ? '+3' : '0'},
    {label:'Ruined', cls:'', get:(i)=> state.scores['week'+i].reputationRuined===true ? '−3' : '0'},
    {label:'Subtotal', cls:'subtotal', get:(i)=>computed['week'+i].subtotal},
    {label:'Tea Cards', cls:'', get:(i)=>fmtSigned(state.scores['week'+i].teaCardPoints)},
    {label:'Final', cls:'final', get:(i)=>computed['week'+i].final},
  ];

  let gridCells = '';
  gridCells += `<div class="gcell head rowlabel">Week</div>`;
  for(let i=1;i<=WEEKS;i++) gridCells += `<div class="gcell head">${i}</div>`;
  rows.forEach(r=>{
    gridCells += `<div class="gcell rowlabel ${r.cls}">${r.label}</div>`;
    for(let i=1;i<=WEEKS;i++){
      gridCells += `<div class="gcell ${r.cls}">${r.get(i)}</div>`;
    }
  });

  const wrap = document.createElement('div');
  wrap.className = 'full-overlay';
  wrap.innerHTML = `
    <div class="full-head">
      <h2>${state.playerName}'s Full Scorecard</h2>
      <div class="sub">All 7 weeks — Spill the Tea</div>
    </div>
    <div class="full-grid">${gridCells}</div>
    <button class="btn btn-primary" id="btn-close-full">Back to Scorecard</button>
  `;
  setTimeout(()=>{
    document.getElementById('btn-close-full').onclick = ()=>{ state.showFullScorecard=false; render(); };
  },0);
  return wrap;
}

function renderGame(){
  const wrap = document.createElement('div');
  const me = state.room.players[0];
  const computed = computeAll(state.scores, me.startingPoints);
  const wk = state.scores['week'+state.activeWeek];
  const c = computed['week'+state.activeWeek];

  const top = document.createElement('div');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="who"><span class="player-number">#${state.playerNumber}</span> ${state.playerName}</div>
  `;
  wrap.appendChild(top);

  const fullBtn = document.createElement('button');
  fullBtn.className = 'action-btn gold';
  fullBtn.id = 'btn-view-full';
  fullBtn.textContent = 'View My Entire Scorecard';
  wrap.appendChild(fullBtn);

  const weekLabel = document.createElement('div');
  weekLabel.className = 'week-label';
  weekLabel.innerHTML = `<label>Week</label>`;
  wrap.appendChild(weekLabel);

  const weekGrid = document.createElement('div');
  weekGrid.className = 'week-grid';
  for(let i=1;i<=WEEKS;i++){
    const t = document.createElement('div');
    t.className = 'week-btn' + (state.activeWeek===i?' active':'');
    t.textContent = i;
    t.onclick = ()=>{ state.activeWeek=i; render(); };
    weekGrid.appendChild(t);
  }
  wrap.appendChild(weekGrid);

  const revealBtn = document.createElement('button');
  revealBtn.className = 'action-btn rose';
  revealBtn.id = 'btn-reveal';
  revealBtn.innerHTML = `Show My Final Total From Previous Week`;
  wrap.appendChild(revealBtn);

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="row">
      <div class="row-label">Subtotal from previous week<small>${state.activeWeek===1?'Your starting points':'Carried from Week '+(state.activeWeek-1)}</small></div>
      <div class="row-control">${rowControl('', `<div class="slot"></div><div class="slot-value">${c.subtotalFromPrev}</div><div class="slot"></div>`)}</div>
    </div>
    <div class="row">
      <div class="row-label">Tea Party<small>Points earned or lost from the die roll</small></div>
      <div class="row-control">${rowControl('', `<div class="slot"><div class="step-btn" id="tp-minus">−</div></div><div class="slot-value" id="tp-val">${wk.teaParty}</div><div class="slot"><div class="step-btn" id="tp-plus">+</div></div>`)}</div>
    </div>
    <div class="row">
      <div class="row-label">Party Host<small>Did you host this week?</small></div>
      <div class="row-control">${yesNoControl('yn-host', wk.partyHost, 3)}</div>
    </div>
    <div class="row">
      <div class="row-label">Reputation Ruined<small>Were you chosen this week?</small></div>
      <div class="row-control">${yesNoControl('yn-ruined', wk.reputationRuined, -3)}</div>
    </div>
    <div class="row subtotal-row">
      <div class="row-label">Subtotal</div>
      <div class="row-control">${rowControl('', `<div class="slot"></div><div class="slot-value">${c.subtotal}</div><div class="slot"></div>`)}</div>
    </div>
    <div class="row" style="border-bottom:none;">
      <div class="row-label">Tea Card Points<small>Total from Tea cards drawn this week</small></div>
      <div class="row-control">${rowControl('', `<div class="slot"><div class="step-btn" id="tc-minus">−</div></div><div class="slot-value" id="tc-val">${wk.teaCardPoints}</div><div class="slot"><div class="step-btn" id="tc-plus">+</div></div>`)}</div>
    </div>
    <div class="row final-row">
      <div class="row-label">Final Total</div>
      <div class="row-control">${rowControl('', `<div class="slot"></div><div class="slot-value">${c.final}</div><div class="slot"></div>`)}</div>
    </div>
  `;
  wrap.appendChild(card);
  wrap.appendChild(renderLegendCard());

  const nav = document.createElement('div');
  nav.className = 'bottom-nav';
  nav.innerHTML = `<button class="btn btn-reset" id="btn-reset">Reset the Game</button>`;
  wrap.appendChild(nav);

  setTimeout(()=>{
    document.getElementById('btn-reveal').onclick = ()=>{ state.showReveal=true; render(); };
    document.getElementById('btn-view-full').onclick = ()=>{ state.showFullScorecard=true; render(); };
    document.getElementById('btn-reset').onclick = ()=>{
      if(!window.confirm('Reset the game and erase all saved scores? This cannot be undone.')) return;

      clearGame();
      state.screen = 'home';
      state.playerName = '';
      state.startingPoints = 0;
      state.activeWeek = 1;
      state.showReveal = false;
      state.showFullScorecard = false;
      state.error = null;
      state.scores = null;
      render();
    };

    document.getElementById('tp-minus').onclick = ()=>updateField('teaParty', (Number(wk.teaParty)||0) - 1);
    document.getElementById('tp-plus').onclick = ()=>updateField('teaParty', (Number(wk.teaParty)||0) + 1);
    document.getElementById('tc-minus').onclick = ()=>updateField('teaCardPoints', (Number(wk.teaCardPoints)||0) - 1);
    document.getElementById('tc-plus').onclick = ()=>updateField('teaCardPoints', (Number(wk.teaCardPoints)||0) + 1);
    document.getElementById('yn-host').querySelectorAll('.yesno-opt').forEach(opt=>{
      opt.onclick = ()=>updateField('partyHost', opt.dataset.val === 'yes');
    });
    document.getElementById('yn-ruined').querySelectorAll('.yesno-opt').forEach(opt=>{
      opt.onclick = ()=>updateField('reputationRuined', opt.dataset.val === 'yes');
    });
  },0);

  return wrap;
}

loadGame();
render();
})();
