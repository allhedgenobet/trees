const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const ui = {
  resetBtn: document.getElementById('resetBtn'),
  branchChance: document.getElementById('branchChance'),
  stopChance: document.getElementById('stopChance'),
  wind: document.getElementById('wind'),
  stats: document.getElementById('stats'),
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let occupancy, occW, occH;
let nutrients;
let tips = [];
let segments = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);

  occW = w;
  occH = h;

  occupancy = new Uint8Array(w*h);
  nutrients = new Float32Array(w*h);

  for(let i=0;i<nutrients.length;i++){
    nutrients[i] = Math.random()*0.8+0.2;
  }
}

function occIndex(x,y){
  const xi = Math.max(0,Math.min(occW-1,Math.round(x)));
  const yi = Math.max(0,Math.min(occH-1,Math.round(y)));
  return yi*occW+xi;
}

function updateNutrients(){
  for(let i=0;i<nutrients.length;i++){
    nutrients[i] = Math.min(1,nutrients[i]+0.0008);
  }
}

/* ===== GENES ===== */

function createBaseGenes(){
  const hue = 120 + (Math.random()*2-1)*18;
  return {
    heritageHue:hue,
    hueDrift:0,
    hue,
    branchBias:1+(Math.random()*2-1)*0.22,
    stopBias:1,
    jitter:0.035,
    turnBias:(Math.random()*2-1)*0.02,
    curl:0.02,
    vigor:1,
  };
}

function mutateGenes(g,m=0.1){

  let heritageHue = g.heritageHue;
  let drift = clamp(
    g.hueDrift + (Math.random()*2-1)*m*3,
    -35,35
  );

  // SPECIES EVENT
  if(Math.random()<0.0005){
    heritageHue = (heritageHue + 60 + Math.random()*80)%360;
    drift = 0;
  }

  return {
    ...g,
    heritageHue,
    hueDrift:drift,
    hue:heritageHue+drift,
    branchBias:clamp(g.branchBias+(Math.random()*2-1)*m,0.5,2)
  };
}

/* ===== TIP ===== */

class Tip{
  constructor(x,y,a,w,e,g){
    this.x=x;
    this.y=y;
    this.angle=a;
    this.width=w;
    this.energy=e;
    this.genes=g;
    this.alive=true;
  }
}

function spawnTree(x,y,scale=1,genes=null){
  const g = genes?mutateGenes(genes,0.13):createBaseGenes();

  // visible spawn flash
  ctx.fillStyle='rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(x,y,2.5,0,Math.PI*2);
  ctx.fill();

  tips.push(new Tip(
    x,y,
    Math.random()*Math.PI*2,
    (2+Math.random())*scale,
    (420+Math.random()*260),
    g
  ));
}

function drawSegment(x1,y1,x2,y2,w,g){
  const hue = g.heritageHue*0.7 + g.hue*0.3;
  ctx.strokeStyle=`hsla(${hue},100%,65%,0.8)`;
  ctx.lineWidth=w;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
}

/* ===== STEP ===== */

function step(){

  updateNutrients();

  const branchChance = Number(ui.branchChance.value);
  const stopChance = Number(ui.stopChance.value);
  const wind = Number(ui.wind.value);

  const newTips=[];

  for(const t of tips){

    if(!t.alive) continue;
    const g=t.genes;

    const idx=occIndex(t.x,t.y);

    const food = nutrients[idx];
    t.energy += 0.18*food;
    nutrients[idx]*=0.92;

    if(Math.random()<(stopChance*0.02) || t.energy<=0){
      t.alive=false;
      if(Math.random()<0.03){
        spawnTree(t.x,t.y,0.6,g);
      }
      continue;
    }

    t.angle += (Math.random()*2-1)*g.jitter + wind*0.5;

    const nx=t.x+Math.cos(t.angle)*1.2;
    const ny=t.y+Math.sin(t.angle)*1.2;

    const nidx=occIndex(nx,ny);

    if(occupancy[nidx]>=3){
      t.angle += (Math.random()*2-1)*1.2;
      continue;
    }

    drawSegment(t.x,t.y,nx,ny,t.width,g);

    occupancy[nidx]++;
    segments++;

    t.x=nx;
    t.y=ny;

    t.energy-=0.55;

    // branching
    if(Math.random()<branchChance*0.9 && t.energy>10){
      const split=Math.PI*0.5*(0.75+Math.random()*0.35);
      newTips.push(new Tip(t.x,t.y,t.angle-split,t.width*0.75,t.energy*0.6,mutateGenes(g)));
      newTips.push(new Tip(t.x,t.y,t.angle+split,t.width*0.75,t.energy*0.6,mutateGenes(g)));
      t.energy*=0.72;
    }

    /* ======================
       VERY OBVIOUS REPRODUCTION
    ====================== */

    const localFood = nutrients[idx];

    let reproduceChance =
      0.02 *
      (0.8 + localFood) *
      (t.energy/80);

    if(Math.random()<0.002){
      reproduceChance*=6;
    }

    if(Math.random()<reproduceChance && t.energy>5){

      const count = 1 + (Math.random()<0.7?1:0);

      for(let i=0;i<count;i++){
        const ang=Math.random()*Math.PI*2;
        const dist=30+Math.random()*90;

        spawnTree(
          t.x+Math.cos(ang)*dist,
          t.y+Math.sin(ang)*dist,
          0.8,
          g
        );
      }

      t.energy*=0.9;
    }
  }

  tips.push(...newTips);
  tips=tips.filter(t=>t.alive);

  ui.stats.textContent=`tips:${tips.length} segments:${segments}`;
}

function loop(){

  ctx.fillStyle='rgba(0,0,0,0.002)';
  ctx.fillRect(0,0,window.innerWidth,window.innerHeight);

  if(tips.length>0) step();

  requestAnimationFrame(loop);
}

function reset(){
  resize();
  ctx.fillStyle='#000';
  ctx.fillRect(0,0,window.innerWidth,window.innerHeight);
  tips=[];
  segments=0;
}

ui.resetBtn.addEventListener('click',reset);
window.addEventListener('resize',reset);

canvas.addEventListener('pointerdown',e=>{
  const r=canvas.getBoundingClientRect();
  spawnTree(e.clientX-r.left,e.clientY-r.top,1);
});

reset();
requestAnimationFrame(loop);
