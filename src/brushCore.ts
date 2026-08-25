// @ts-nocheck
// 程序式筆刷核心：**從樣本間原樣搬過來的程式碼，刻意不改寫**。
// 對照檔：「01 - 研究/樣本間/筆刷/index.html」與「筆刷偏好設定.html」的同名函式，
// 一個字都沒動，才能跟樣本間對 diff。型別檢查關掉也是為了保持逐字相同。
// 每個常數都是量出來的，推導寫在「開源筆刷盤點.md」。改配方前先回樣本間試，別在這裡調。
//
// 畫法：逐點蓋章（lighter 疊進 MASK）→ 模糊＋補濃度（讓點黏成一塊）
//      → 紙紋 destination-in 鏤空 → source-in 上色 → 一次貼回目標畫布。

export const S = {
  paper: 0, aspect: 1, gmode: 1, gscale: .35, ts: 8 / 7, tooth: .8, goo: .92, scExp: .55,
  scatter: 1, grain: 1, op: 1.2, hard: 1, gain: 1.5, tip: 1, cap: .32, w: 10,
  opa: 1, spread: 1, dens: 1, dotL: 1, jit: 1, glin: 1, tipL: 1, soften: 0, edge: 0, scExpL: 1,
  __a: 1,
};
const zoom = 1;
// STB 的畫布就是分鏡座標（1280×720），縮放交給 CSS——不像樣本間那樣自己乘 devicePixelRatio，
// 所以這裡固定 1（devBox 的髒區換算會用到）。
const DPR = 1;
let CW = 0, CH = 0;
let MASK = null, GOO = null, GRAIN = null, GKEY = "";
const SOFT_PX = 40; let SOFT = null;
let RESP = [0,0.1205,0.2453,0.3599,0.4148,0.4584,0.4901,0.5215,0.5527,0.5808,0.6094,
  0.6371,0.6614,0.6845,0.7055,0.7254,0.757,0.8075,0.8695,0.9346,1];

// 換畫布尺寸才重配（MASK 是共用的暫存層；GRAIN 依尺寸與紙張參數快取）
// 依尺寸池化：縮圖（72×22）與畫布（1280×720）會交替用，重配就等於每次都要
// 重烤 GRAIN（92 萬像素的迴圈）——池化之後換回來是零成本。
const POOL = new Map();
export function ensure(w, h) {
  if (CW === w && CH === h && MASK) return;
  if (MASK) POOL.set(CW + "x" + CH, { MASK, GOO, GRAIN, GKEY });
  CW = w; CH = h;
  const hit = POOL.get(w + "x" + h);
  if (hit) { MASK = hit.MASK; GOO = hit.GOO; GRAIN = hit.GRAIN; GKEY = hit.GKEY; }
  else {
    MASK = document.createElement("canvas"); MASK.width = w; MASK.height = h;
    GOO = null; GRAIN = null; GKEY = "";
  }
  if (!SOFT) bakeSoft();
}

function hash01(a,b,c){let h=(a*374761393+b*668265263+(c|0)*2246822519)|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return (h>>>0)/4294967296;}

function mulberry(s){return function(){s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}

function h2(a,b){
  let h=Math.imul(a|0,0x27d4eb2d)^Math.imul(b|0,0x165667b1);
  h^=h>>>15;h=Math.imul(h,0x85ebca6b);
  h^=h>>>13;h=Math.imul(h,0xc2b2ae35);
  h^=h>>>16;return (h>>>0)/4294967296;
}

function vn(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=h2(xi,yi),b=h2(xi+1,yi),c=h2(xi,yi+1),d=h2(xi+1,yi+1);
  const p=a+(b-a)*u,q=c+(d-c)*u;return p+(q-p)*v;}

function vnr(x,y,s,ang,ox,oy){const c=Math.cos(ang),n=Math.sin(ang);
  return vn((x*c-y*n)/s+ox,(x*n+y*c)/s+oy);}

function sm(t){return t<=0?0:t>=1?1:t*t*(3-2*t);}

function fbm(x,y){return .62*vn(x,y)+.38*vn(x*2.3+5.1,y*2.3+9.7);}

function tooth(x,y,s){
  const P=S.paper|0;
  if(P===5)return 1;
  // 紋路拉伸：>1＝橫向拉長（纖維變長條）、<1＝縱向拉長。面積不變，只改長寬比
  const ax=S.aspect||1;
  if(ax!==1){x/=ax;y*=ax;}                       // 無紋＝乾淨
  // 低頻扭曲：先把取樣座標揉一下，值雜訊的格點就藏起來了（紙纖維本來就是彎的）
  const wx=vn(x/(s*7)+3.1,y/(s*7)+8.7)-.5, wy=vn(x/(s*7)+19.3,y/(s*7)+5.2)-.5;
  const X=x+wx*s*2.6, Y=y+wy*s*2.6;
  const cl=v=>Math.max(0,Math.min(1,v));
  switch(P){
    case 1:{ // 粗紋（水彩紙）：尺度大、對比強、塊狀
      const v=.55*vnr(X,Y,s*1.9,0.37,4.3,9.1)+.30*vnr(X,Y,s*0.8,1.71,31.7,11.3)+.15*vnr(X,Y,s*0.3,2.62,57.2,23.9);
      return cl((v-.5)*1.55+.5);
    }
    case 2:{ // 織紋（帆布）：兩個方向的經緯交織——這種紋路本來就有規律
      const a=.5+.5*Math.sin((X/(s*1.15))*6.2832), b=.5+.5*Math.sin((Y/(s*1.15))*6.2832);
      const n=vnr(X,Y,s*.5,0.9,12.1,7.7);
      return cl(Math.min(a,b)*.58+n*.42);
    }
    case 3:{ // 纖維（和紙）：長條、有方向性
      const v=.55*vn(X/(s*4.2)+2.2,Y/(s*.42)+6.1)+.30*vn(X/(s*1.6)+9.4,Y/(s*.28)+3.3)+.15*vnr(X,Y,s*.5,1.2,21,4);
      return cl((v-.5)*1.30+.5);
    }
    case 4:{ // 平滑（影印紙）：很細、對比低
      const v=.6*vnr(X,Y,s*.45,0.37,4.3,9.1)+.4*vnr(X,Y,s*.2,1.71,31.7,11.3);
      return cl((v-.5)*.62+.5);
    }
    default: // 0 細紋（原本這個）
      return .50*vnr(X,Y,s,0.37,4.3,9.1)
           + .32*vnr(X,Y,s*0.44,1.71,31.7,11.3)
           + .18*vnr(X,Y,s*0.19,2.62,57.2,23.9);
  }
}

function bakeSoft(){
  const c=document.createElement("canvas");c.width=c.height=SOFT_PX;
  const g=c.getContext("2d"),im=g.createImageData(SOFT_PX,SOFT_PX),D=im.data,h=SOFT_PX/2;
  for(let y=0;y<SOFT_PX;y++)for(let x=0;x<SOFT_PX;x++){
    const dx=(x-h+.5)/h,dy=(y-h+.5)/h,r=Math.hypot(dx,dy);
    let a=r>=1?0:Math.exp(-2.6*r*r)-Math.exp(-2.6);      // 高斯：中心實、外緣自己淡掉
    a*=.55+.60*fbm(x/3.4,y/3.4);
    const i=(y*SOFT_PX+x)*4;D[i]=D[i+1]=D[i+2]=255;
    D[i+3]=Math.round(Math.max(0,Math.min(1,a))*255);
  }
  g.putImageData(im,0,0);SOFT=c;
}

function bakeGrain(str,scale){
  const key=str.toFixed(2)+"|"+scale.toFixed(2)+"|"+(S.paper|0)+"|"+(S.aspect||1).toFixed(2);if(key===GKEY&&GRAIN)return;GKEY=key;
  const c=document.createElement("canvas");c.width=CW;c.height=CH;
  const g=c.getContext("2d"),im=g.createImageData(CW,CH),D=im.data;
  for(let y=0;y<CH;y++)for(let x=0;x<CW;x++){
    const t=tooth(x,y,scale);
    const a=t<str*.30?0:Math.max(0,Math.min(1,(1-str)+str*Math.min(1,.28+1.3*t)));
    const i=(y*CW+x)*4;D[i]=D[i+1]=D[i+2]=255;D[i+3]=Math.round(a*255);
  }
  g.putImageData(im,0,0);GRAIN=c;
}

function gooey(m,B,px,boost,dpr){
  if(px<=0){return;}
  const d=devBox(B);if(d.w<=0||d.h<=0)return;
  if(!GOO)GOO=document.createElement("canvas");
  if(GOO.width!==MASK.width||GOO.height!==MASK.height){GOO.width=MASK.width;GOO.height=MASK.height;}
  const t=GOO.getContext("2d");
  t.setTransform(1,0,0,1,0,0);t.globalCompositeOperation="copy";t.globalAlpha=1;
  const canFilter=("filter" in t);
  if(canFilter){
    t.filter="blur("+px.toFixed(2)+"px)";
    t.drawImage(MASK,d.x,d.y,d.w,d.h,d.x,d.y,d.w,d.h);
    t.filter="none";
  }else{
    // 退路（舊 Safari 沒有 ctx.filter）：小位移多次疊，效果近似
    t.clearRect(d.x,d.y,d.w,d.h);t.globalCompositeOperation="source-over";t.globalAlpha=.3;
    const o=[[0,0],[px,0],[-px,0],[0,px],[0,-px]];
    for(const[ox,oy]of o)t.drawImage(MASK,d.x,d.y,d.w,d.h,d.x+ox*dpr,d.y+oy*dpr,d.w,d.h);
    t.globalAlpha=1;
  }
  m.setTransform(1,0,0,1,0,0);m.globalAlpha=1;
  m.globalCompositeOperation="copy";
  m.drawImage(GOO,d.x,d.y,d.w,d.h,d.x,d.y,d.w,d.h);
  m.globalCompositeOperation="source-over";
  for(let i=1;i<boost;i++)m.drawImage(GOO,d.x,d.y,d.w,d.h,d.x,d.y,d.w,d.h);
  // 還原成畫筆畫時的座標系（finishMask 的紙紋要用）
  m.setTransform(dpr,0,0,dpr,0,0);
  if(zoom!==1){m.translate(CW/2,CH/2);m.scale(zoom,zoom);m.translate(-CW/2,-CH/2);}
}

function finishMask(g,m,s,R,S,dpr,B,noGrain){
  // 紙紋鏤空：GRAIN 固定在畫布座標（Procreate 叫 Texturized），所以線壓過去才露出紙的低谷
  // 只做外接框那一塊；框外的殘影會被 destination-in 一併清掉
  m.globalCompositeOperation="destination-in";m.globalAlpha=1;
  if(noGrain){m.fillStyle="#fff";m.fillRect(B.x,B.y,B.w,B.h);}          // 移動模式：紋路已逐點吃過，這裡只負責裁掉框外
  else if(B&&B.w>0&&B.h>0)m.drawImage(GRAIN,B.x,B.y,B.w,B.h,B.x,B.y,B.w,B.h);
  else m.drawImage(GRAIN,0,0,CW,CH);
  m.globalCompositeOperation="source-in";m.fillStyle="#"+s.color;
  if(B)m.fillRect(B.x,B.y,B.w,B.h);else m.fillRect(-CW,-CH,CW*3,CH*3);
  m.globalCompositeOperation="source-over";
  g.setTransform(1,0,0,1,0,0);
  g.globalAlpha=Math.min(1,R.strokeA*S.op*(m.__tiltA??1)*(S.__a??1));m.__tiltA=1;
  if(B){const d=devBox(B);if(d.w>0&&d.h>0)g.drawImage(MASK,d.x,d.y,d.w,d.h,d.x,d.y,d.w,d.h);}
  else g.drawImage(MASK,0,0);
  g.globalAlpha=1;g.setTransform(dpr,0,0,dpr,0,0);
}

function strokeBox(s,w){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const q of s.pts){if(q.x<x0)x0=q.x;if(q.y<y0)y0=q.y;if(q.x>x1)x1=q.x;if(q.y>y1)y1=q.y;}
  const pad=w*3+18;
  const bx=Math.max(0,Math.floor(x0-pad)),by=Math.max(0,Math.floor(y0-pad));
  return {x:bx,y:by,w:Math.min(CW,Math.ceil(x1+pad))-bx,h:Math.min(CH,Math.ceil(y1+pad))-by};
}

function devBox(b){
  let x0=b.x,y0=b.y,x1=b.x+b.w,y1=b.y+b.h;
  if(zoom!==1){x0=(x0-CW/2)*zoom+CW/2;x1=(x1-CW/2)*zoom+CW/2;
               y0=(y0-CH/2)*zoom+CH/2;y1=(y1-CH/2)*zoom+CH/2;}
  const x=Math.max(0,Math.floor((x0-2)*DPR)),y=Math.max(0,Math.floor((y0-2)*DPR));
  return {x,y,w:Math.min(CW*DPR,Math.ceil((x1+2)*DPR))-x,h:Math.min(CH*DPR,Math.ceil((y1+2)*DPR))-y};
}

function pathLen(pts){let L=0;for(let i=1;i<pts.length;i++)L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);return L;}

function strokeSeed(s){
  // 裂開的段帶著原筆畫的種子（s.seed）——不然橡皮擦啃掉頭幾點，後段起點變、種子變，
  // 使用者沒碰到的整條後段每幀換紋理（沸騰），放手後也永久異於原畫（代理人審查抓到）。
  if(s.seed!=null)return s.seed|0;
  // 只用起點座標——畫的當下與放手之後必須算出同一個種子，不然放手會「跳一次」
  const p=s.pts[0]||{x:0,y:0};
  return seedOfPoint(p.x,p.y);
}
export function seedOfPoint(x,y){
  return (Math.imul(Math.round(x*10)|0,2654435761)^Math.imul(Math.round(y*10)|0,1299721)^0x9e3779b9)|0;
}

function pressResp(u){
  let x=Math.max(0,Math.min(1,Math.pow(u,S.hard)));
  // 基礎黑度：在「已校正的線性黑度」上直接加成，1.5＝同樣力道黑 50%。
  // 接近全黑用軟壓縮而不是硬切，才不會上面三分之一的力道全部一樣黑。
  x*=S.gain;
  const K=0.80;
  if(x>K)x=K+(1-K)*Math.tanh((x-K)/(1-K));
  x=Math.max(0,Math.min(1,x));
  if(!RESP)return x;
  const t=x*(RESP.length-1),i=Math.floor(t),f=t-i;
  return RESP[i]+((RESP[Math.min(RESP.length-1,i+1)]-RESP[i])*f);
}

function speedPress(pts,refW){const n=pts.length;if(n<3)return pts.map(()=>1);
  let p=0.35;const raw=[p];
  for(let i=1;i<n;i++){const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
    const sp=Math.min(1,d/(refW*1.6));p=Math.min(1,p+(Math.min(1,1-sp)-p)*(sp*0.275));raw.push(p);}
  for(let i=n-2;i>=0;i--)raw[i]=raw[i+1]*0.3+raw[i]*0.7;
  return raw.map(v=>0.45+0.7*Math.max(0,Math.min(1,v)));}

function streamline(pts,t){if(pts.length<3)return pts;const o=[pts[0]];
  for(let i=1;i<pts.length;i++){const l=o[i-1];o.push({x:l.x+(pts[i].x-l.x)*t,y:l.y+(pts[i].y-l.y)*t});}
  o[o.length-1]=pts[pts.length-1];return o;}

// ── 蓋章：把 [from, to) 這段弧長的 dab 疊進 mask（不清畫布、不做後續合成）──────
// 亂數改成「位置決定」（由 k,j 與筆畫種子雜湊出來），不是循序 rnd()。
// 這是增量渲染的前提：跳過已經畫過的 dab 之後，後面每一顆的隨機值都必須跟「整筆重畫」時一樣，
// 否則畫面每格都在重骰＝閃爍。順帶好處：畫的順序不影響結果。
function dabSpan(m,s,R,S,dpr,si,from,to){
  const w=s.w*S.w/10;
  // off＝這段在「原筆畫」上的弧長起點（裂筆帶過來）。所有 d 都是絕對弧長：
  // dab 網格（k）與紋理取樣落在原位，裂開後未被擦到的部分長相不變。
  const off=s.off||0;
  const REF=10, gr=Math.pow(Math.max(1,w)/REF,S.scExp);   // 次線性成長因子
  const dotR=Math.max(.32,R.dot*REF*Math.pow(Math.max(1,w)/REF,.35));
  const fuzz=R.fuzz*REF*gr*S.scatter;                     // 毛邊振幅（絕對尺度）
  const step=Math.max(.42,dotR*.9);
  const N=Math.max(1,Math.min(46,Math.round(R.dens*w/dotR)));
  const nrm=Math.pow(REF/Math.max(1,w),.22);
  const MOVE=(S.gmode|0)===0, gstr=(R.tooth||0)*S.tooth;
  const gs=Math.max(.6,(S.ts*7)*S.gscale), gs2=gs*2.4;   // 沿筆畫拉長 2.4 倍
  const SL=pathLen(s.pts)+off;
  const tipPx=Math.max(1.5,Math.min(SL*.35,R.tip*REF*Math.pow(Math.max(1,w)/REF,.5)*S.tip));
  const SD=strokeSeed(s)|0;
  const rv=(k,j,n)=>h2(k*1543+j*97+n*7919, SD+n*131);    // 位置決定的亂數
  const pts=s.pts,press=s.press,tilt=s.tilt,US=s.u;
  let acc=off;
  for(let i=1;i<pts.length;i++){
    const p=pts[i-1],q=pts[i],seg=Math.hypot(q.x-p.x,q.y-p.y);if(seg<=0)continue;
    if(acc+seg<from){acc+=seg;continue;}                  // 整段都在起點之前＝跳過
    const ux=(q.x-p.x)/seg,uy=(q.y-p.y)/seg;
    let k=Math.ceil(acc/step);
    for(let d=k*step;d<acc+seg;d+=step,k++){
      if(d>to)return;
      if(d<from)continue;
      const u=(d-acc)/seg;
      const pr=press[i-1]+(press[i]-press[i-1])*u;
      const tl=tilt?tilt[i-1]+(tilt[i]-tilt[i-1])*u:0;
      const uu=US?US[i-1]+(US[i]-US[i-1])*u:Math.max(0,Math.min(1,(pr-.2)/1.15));
      // 收筆：頭尾在「絕對長度」內收細收淡，尾端收得比頭端兇（真鉛筆離紙時是拖出去的）
      const dS=d, dE=Math.max(0,SL-d);
      const tIn=Math.min(1,dS/(tipPx*.55)), tOut=Math.min(1,dE/tipPx);
      const tp=Math.min(tIn,tOut), tps=tp*tp*(3-2*tp);
      const half=w/2*Math.pow(pr,.9)*(1+1.6*tl)*(.16+.84*tps);   // 筆身：線性
      const cx=p.x+ux*(d-acc), cy=p.y+uy*(d-acc);
      for(let j=0;j<N;j++){
        const r1=rv(k,j,0),r2=rv(k,j,1),r3=rv(k,j,2),r4=rv(k,j,3);
        if(r1>=R.grain*S.grain*Math.max(.4,pr))continue;
        // 中心密、邊緣疏（兩個均勻相加≈三角分布）——真鉛筆的接觸面就是中間壓得最實，
        // 這樣芯會自己聚起來變濃，毛邊留在外圈：這就是「收邊但不收死」
        const perp=half*Math.max(-1.25,Math.min(1.25,(r2+rv(k,j,4)-1)*1.5))+fuzz*(r3+r4-1);
        const alng=(rv(k,j,5)-.5)*step*1.6;
        const qq=Math.abs(perp)/(half+fuzz+.001);
        const edge=Math.max(0,1-qq*qq*qq);                 // 軟收邊：不切齊、不外爆
        if(edge<=0)continue;
        let av=R.dabA*nrm*edge*pressResp(uu)*(.18+.82*tps)*(1-.4*tl)*(.7+.5*r1);
        if(MOVE&&gstr>0){
          const gv=tooth(d/gs2, perp/gs + si*53);        // 筆畫座標：沿線 d、跨線 perp
          if(gv<gstr*.30)continue;
          av*=(1-gstr)+gstr*Math.min(1,.28+1.3*gv);
        }
        m.globalAlpha=Math.min(1,av);
        const rr=dotR*(.75+.5*r2);
        m.drawImage(SOFT,cx+perp*(-uy)+alng*ux-rr, cy+perp*ux+alng*uy-rr, rr*2, rr*2);
      }
    }
    acc+=seg;
  }
}

// 收好的筆畫：整筆重畫（每次結果都一樣）
function drawSoftStroke(g,s,R,S,dpr,to,si){
  const w=s.w*S.w/10, m=MASK.getContext("2d"), B=strokeBox(s,w);
  {const _d=devBox(B);m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation="source-over";
   m.clearRect(_d.x,_d.y,_d.w,_d.h);}   // 清到「模糊讀得到」的範圍為止，框外殘影才不會被吸進來
  m.setTransform(dpr,0,0,dpr,0,0);
  if(zoom!==1){m.translate(CW/2,CH/2);m.scale(zoom,zoom);m.translate(-CW/2,-CH/2);}
  m.globalCompositeOperation="source-over";m.clearRect(B.x,B.y,B.w,B.h);
  m.globalCompositeOperation="lighter";
  const dotR=Math.max(.32,R.dot*10*Math.pow(Math.max(1,w)/10,.35));
  const blur=dotR*2.6*S.goo, boost=1+Math.round(3*S.goo);
  const MOVE=(S.gmode|0)===0, gstr=(R.tooth||0)*S.tooth;
  const gs=Math.max(.6,(S.ts*7)*S.gscale);
  if(!MOVE)bakeGrain(gstr,gs);   // 紋理化要用鎖在畫布的 GRAIN；沒烤過會是 null，drawImage 直接炸掉整筆
  dabSpan(m,s,R,S,dpr,si,0,to);
  gooey(m,B,blur,boost,dpr);
  finishMask(g,m,s,R,S,dpr,B,MOVE);
}

// ── 作畫中：增量渲染 ────────────────────────────────────────────────
// 剖析結果（2026-08-25，3231 點那筆）：整筆 28.4ms 裡有 ~25ms 花在蓋章迴圈，模糊只佔 ~3.6ms。
// 所以每一格重蓋整筆是純浪費：已經定案的那段不會再變。
//   BAKED＝離筆尖夠遠、不會再變的那段（只追加，永不重畫）
//   TAIL ＝尾端收筆區（長度會隨筆畫變長而移動，每格重畫，但只有十幾像素）
// 合成時 BAKED + TAIL 用 lighter 疊回 MASK——alpha 是線性相加，等同一次畫完。
let LIVE=null;
export function liveEnd(){ LIVE=null; }
function drawSoftStrokeLive(g,s,R,S,dpr,si,key){
  const w=s.w*S.w/10, m=MASK.getContext("2d"), B=strokeBox(s,w);
  const dotR=Math.max(.32,R.dot*10*Math.pow(Math.max(1,w)/10,.35));
  const blur=dotR*2.6*S.goo, boost=1+Math.round(3*S.goo);
  const MOVE=(S.gmode|0)===0, gstr=(R.tooth||0)*S.tooth;
  const gs=Math.max(.6,(S.ts*7)*S.gscale);
  if(!MOVE)bakeGrain(gstr,gs);
  const SL=pathLen(s.pts)+(s.off||0);
  const tipMax=R.tip*10*Math.pow(Math.max(1,w)/10,.5)*S.tip;
  const tipPx=Math.max(1.5,Math.min(SL*.35,tipMax));
  // 「定案區」要退得夠遠，有三個回頭改的來源（實測不退夠＝預覽與成品差一千多像素）：
  //   ① tipPx 在 SL*.35 蓋過 tipMax 之前一直在長 → 頭端 tIn 會回頭變
  //   ② speedPress 有反向平滑（raw[i]=raw[i+1]*.3+raw[i]*.7）→ 新點會改到往前 ~10 個點
  //   ③ 筆壓中位數濾波窗 ±2 → 尾端兩點未定
  // 所以：tipPx 沒定形前完全不烘焙；定形後再多退 40px（≳16 個點，0.3^16≈4e-9）。
  const safe=SL*.35>=tipMax?Math.max(0,SL-tipPx-40):0;
  // done>safe+8：容差 8px。dedup 對「最後一點」的特例＋streamline 端點吸附會讓 SL 偶爾
  // 倒退不到 1px，沒有容差就整包丟掉重烘（畫到一半突然頓一下）。8px 遠小於 40px 安全邊界。
  if(!LIVE||LIVE.key!==key||LIVE.w!==CW||LIVE.h!==CH||LIVE.done>safe+8){
    const mk=()=>{const c=document.createElement("canvas");c.width=CW;c.height=CH;return c;};
    LIVE={key,w:CW,h:CH,baked:mk(),tail:mk(),done:0};
  }
  const bc=LIVE.baked.getContext("2d"), tc=LIVE.tail.getContext("2d");
  if(safe>LIVE.done){                      // 追加烘焙（只畫新增的那段）
    bc.setTransform(dpr,0,0,dpr,0,0);bc.globalCompositeOperation="lighter";
    dabSpan(bc,s,R,S,dpr,si,LIVE.done,safe);
    LIVE.done=safe;
  }
  tc.setTransform(1,0,0,1,0,0);tc.globalCompositeOperation="source-over";
  tc.clearRect(0,0,CW,CH);
  tc.setTransform(dpr,0,0,dpr,0,0);tc.globalCompositeOperation="lighter";
  dabSpan(tc,s,R,S,dpr,si,LIVE.done+1e-7,SL+1);   // +ε＝d 恰好落在烘焙邊界時不重複蓋；+1＝尾端最後一顆一定進來
  {const _d=devBox(B);m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation="source-over";
   m.clearRect(_d.x,_d.y,_d.w,_d.h);}
  m.globalAlpha=1;m.drawImage(LIVE.baked,0,0);
  m.globalCompositeOperation="lighter";m.drawImage(LIVE.tail,0,0);
  m.setTransform(dpr,0,0,dpr,0,0);
  gooey(m,B,blur,boost,dpr);
  finishMask(g,m,s,R,S,dpr,B,MOVE);
}

function drawLayered(g,pts,press,w,color,layers){
  const sLen=pathLen(pts);
  g.save();g.lineJoin="round";
  layers.forEach((L,li)=>{
    const seed=(L.seed??0)*1000+li*97, lw=Math.max(.3,w*L.w);
    g.lineCap=L.cap??"round";g.lineWidth=lw;
    g.strokeStyle="#"+color;g.fillStyle="#"+color;g.globalAlpha=L.alpha*S.opa;
    if(L.kind==="fill"){
      const sp=Math.max(2,lw*.35);const src=[];let a=0;
      src.push({...pts[0],a:0,p:press[0]});
      for(let i=1;i<pts.length;i++){a+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
        const l=src[src.length-1];
        if(Math.hypot(pts[i].x-l.x,pts[i].y-l.y)>=sp||i===pts.length-1)src.push({...pts[i],a,p:press[i]});}
      if(src.length<2){g.restore();return;}
      const zone=Math.min(w*4,sLen*.45)*S.tipL;
      const rs=src.map((q,i)=>{let m=q.p;const dE=Math.min(q.a,sLen-q.a);
        if(L.taper)m*=.15+.85*Math.min(1,zone<=0?1:dE/zone);
        if(L.tip){const tz=w*L.tip*S.tipL;m*=.5+.5*Math.min(1,tz<=0?1:dE/tz);}
        const gw=L.grainW?L.grainW*S.glin:0;
        if(gw)m*=1-gw/2+gw*hash01(7,i,seed);
        return Math.max(.15,lw*m/2);});
      const nx=[],ny=[];
      for(let i=0;i<src.length;i++){const a0=src[Math.max(0,i-1)],b0=src[Math.min(src.length-1,i+1)];
        const dx=b0.x-a0.x,dy=b0.y-a0.y,L2=Math.hypot(dx,dy)||1;nx.push(-dy/L2);ny.push(dx/L2);}
      const flat=L.cap==="butt";
      g.beginPath();g.moveTo(src[0].x+nx[0]*rs[0],src[0].y+ny[0]*rs[0]);
      for(let i=1;i<src.length;i++)g.lineTo(src[i].x+nx[i]*rs[i],src[i].y+ny[i]*rs[i]);
      const e=src.length-1;
      if(!flat)for(let k=1;k<=8;k++){const th=-Math.PI*k/8,c=Math.cos(th),sn=Math.sin(th);
        const vx=nx[e]*rs[e],vy=ny[e]*rs[e];g.lineTo(src[e].x+vx*c-vy*sn,src[e].y+vx*sn+vy*c);}
      else g.lineTo(src[e].x-nx[e]*rs[e],src[e].y-ny[e]*rs[e]);
      for(let i=src.length-2;i>=0;i--)g.lineTo(src[i].x-nx[i]*rs[i],src[i].y-ny[i]*rs[i]);
      if(!flat)for(let k=1;k<8;k++){const th=-Math.PI*k/8,c=Math.cos(th),sn=Math.sin(th);
        const vx=-nx[0]*rs[0],vy=-ny[0]*rs[0];g.lineTo(src[0].x+vx*c-vy*sn,src[0].y+vx*sn+vy*c);}
      g.closePath();g.fill();
    } else if(L.kind==="stamp"&&L.stamp){
      const st=L.stamp,dn=Math.max(.2,S.dens),step=lw/(st.perWidth*dn),cnt=Math.max(1,Math.round(st.count*dn));
      const lwS=10*Math.pow(Math.max(1,lw)/10,S.scExpL);   // 散布成長＝1 時 lwS===lw，舊筆畫完全不變
      let acc=0;
      for(let i=1;i<pts.length;i++){
        const p=pts[i-1],q=pts[i],seg=Math.hypot(q.x-p.x,q.y-p.y);if(seg<=0)continue;
        const ux=(q.x-p.x)/seg,uy=(q.y-p.y)/seg;let k=Math.ceil(acc/step);
        for(let d=k*step;d<acc+seg;d+=step,k++){
          const u=(d-acc)/seg,wm=press[i-1]+(press[i]-press[i-1])*u;
          const cx=p.x+ux*(d-acc),cy=p.y+uy*(d-acc);
          for(let j=0;j<cnt;j++){
            const r1=hash01(1,k*31+j,seed),r2=hash01(6,k*31+j,seed),r3=hash01(10,k*31+j,seed);
            const rad=(r1+r2-1)*st.spread*S.spread*lwS*wm,ang=r3*6.2832;
            g.globalAlpha=L.alpha*S.opa*(st.aMin+(st.aMax-st.aMin)*hash01(4,k*31+j,seed))*Math.min(1,wm+.25);
            g.beginPath();g.arc(cx+Math.cos(ang)*rad,cy+Math.sin(ang)*rad,
              Math.max(.25,st.r*S.dotL*lwS*(.6+.8*r2)*wm),0,6.2832);g.fill();
          }
        }
        acc+=seg;
      }
    } else {
      const jt=(L.jitter||0)*S.jit, gl=Math.min(1,(L.grain||0)*S.glin);
      const j=i=>({x:(hash01(1,i,700+seed)-.5)*w*jt,y:(hash01(14,i,700+seed)-.5)*w*jt});
      for(let i=1;i<pts.length;i++){
        const p=pts[i-1],q=pts[i],a0=j(i-1),b0=j(i);
        g.lineWidth=Math.max(.3,lw*((press[i-1]+press[i])/2));
        g.globalAlpha=L.alpha*S.opa*(gl?(1-gl)+gl*hash01(1,i,4242+seed):1);
        g.beginPath();g.moveTo(p.x+a0.x,p.y+a0.y);g.lineTo(q.x+b0.x,q.y+b0.y);g.stroke();
      }
    }
  });
  g.restore();g.globalAlpha=1;
}

// 預熱：紙紋烤一次要 ~80ms（921,600 像素 × 每像素 5 次 value noise）。
// 不預熱的話「第一筆鉛筆」落筆瞬間同步烤＝開編輯器後第一筆就凍 80ms。
export function warmGrain(R){
  if(!MASK)return;
  bakeGrain((R.tooth||0)*S.tooth,Math.max(.6,(S.ts*7)*S.gscale));
}

export { drawSoftStroke, drawSoftStrokeLive, drawLayered, streamline, speedPress };
