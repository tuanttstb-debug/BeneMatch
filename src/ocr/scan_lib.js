/* scan_lib.js — CHÉP từ công cụ ẩn danh v3.5 (src/app.template.html: OCR/pdf.js/xoay trang/xoá kẻ + đọc/ghi xlsx tối giản).
 * Sửa lỗi gốc ở công cụ ẩn danh rồi chép lại; không sửa lệch ở đây. */
const codeSort=(a,b)=>a.localeCompare(b,'vi',{numeric:true});
const OCR = {sched:null, nWorkers:0, stop:false, twURL:null, pdfReady:false};
const hasOcrLibs = () => typeof window.pdfjsLib!=='undefined' && typeof window.Tesseract!=='undefined' && typeof window.__TCORE_SRC==='string';
const blobJs = src => URL.createObjectURL(new Blob([src],{type:'text/javascript'}));

function parseRange(s, max){
  s=(s||'').trim(); if(!s) return Array.from({length:max},(_,i)=>i+1);
  const set=new Set();
  s.split(/[,;\s]+/).filter(Boolean).forEach(p=>{const m=p.match(/^(\d+)(?:-(\d+))?$/); if(!m) return;
    let a=+m[1], b=m[2]?+m[2]:a; if(a>b)[a,b]=[b,a]; for(let i=Math.max(1,a);i<=Math.min(max,b);i++) set.add(i);});
  return [...set].sort((a,b)=>a-b);
}
function initPdfJs(){
  if(OCR.pdfReady) return;
  pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(blobJs(window.__PDFW_SRC));
  OCR.pdfReady = true;
}
async function initTesseract(n, onStatus){
  if(OCR.sched && OCR.nWorkers>=n) return OCR.sched;
  if(!OCR.twURL){
    const prelude = `(function(){var b64=${JSON.stringify(window.__VIE_B64)};var bin=null;
      self.fetch=function(u){u=String(u);if(u.indexOf('https://offline.invalid/')===0){
        if(!bin){var s=atob(b64);bin=new Uint8Array(s.length);for(var i=0;i<s.length;i++)bin[i]=s.charCodeAt(i);}
        return Promise.resolve(new Response(bin.slice()));}
      return Promise.reject(new Error('Offline: chặn kết nối '+u));};})();`;
    OCR.twURL = blobJs(window.__TCORE_SRC + '\n;\n' + prelude + '\n;\n' + window.__TW_SRC);
  }
  if(!OCR.sched) OCR.sched = Tesseract.createScheduler();
  while(OCR.nWorkers<n){
    onStatus('Đang khởi động bộ nhận dạng chữ '+(OCR.nWorkers+1)+'/'+n+'…');
    const w = await Tesseract.createWorker('vie', 1, {workerPath:OCR.twURL, workerBlobURL:false, corePath:'offline-core.js',
      langPath:'https://offline.invalid/lang', cacheMethod:'none', gzip:true});
    // Giữ khoảng trắng giữa cột (bảng số liệu) · PSM theo tùy chọn (mặc định 3 = tự nhận bố cục)
    await w.setParameters({preserve_interword_spaces:'1', tessedit_pageseg_mode:String(window.__PSM||3)});
    OCR.sched.addWorker(w); OCR.nWorkers++;
  }
  return OCR.sched;
}
/* Xóa đường kẻ bảng (BCTC, sao kê có kẻ ô): vệt tối chạy ngang ≥ 12% chiều rộng hoặc dọc ≥ 3% chiều cao
 * không thể là nét chữ → tô trắng. Không xóa thì Tesseract đọc nhầm cả dòng (đo trên mẫu: CER 59% → xem test). */
function cleanLines(c){
  const W=c.width, H=c.height, ctx=c.getContext('2d',{willReadFrequently:true});
  const im=ctx.getImageData(0,0,W,H), d=im.data, n=W*H, dark=new Uint8Array(n);
  // Ngưỡng dò nét kẻ 185 (nét kẻ scan thường xám nhạt hơn chữ)
  for(let i=0;i<n;i++){const k=i*4; dark[i]=(d[k]*0.299+d[k+1]*0.587+d[k+2]*0.114)<185?1:0;}
  const kill=new Uint8Array(n), Lh=Math.round(W*0.12), Lv=Math.round(H*0.03), rawH=[], rawV=[];
  // Dò BÁM NÉT: đi dọc đường kẻ, cho phép lệch ±1px mỗi bước + hở 1px → bắt được đường kẻ trên ảnh scan hơi nghiêng
  const trace=(sx,sy,horiz)=>{ const path=[]; let a=horiz?sx:sy, b=horiz?sy:sx, gap=0; const A=horiz?W:H, B=horiz?H:W;
    const D=(a,b)=>b>=0&&b<B&&(horiz?dark[b*W+a]:dark[a*W+b]);
    while(a<A){ if(D(a,b)){gap=0;} else if(D(a,b-1)){b--;gap=0;} else if(D(a,b+1)){b++;gap=0;} else if(++gap>2) break;
      if(!gap) path.push(horiz?b*W+a:a*W+b); a++; }
    return path; };
  const vis=new Uint8Array(n);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x; if(!dark[i]||vis[i]) continue; if(x>0&&dark[i-1]) continue;
    const pth=trace(x,y,true); if(pth.length>=Lh){ pth.forEach(k=>{kill[k]=1;vis[k]=1;}); const ys=pth.map(k=>(k/W)|0); rawH.push({y:ys.reduce((s,v)=>s+v,0)/ys.length,x1:x,x2:pth[pth.length-1]%W}); } }
  vis.fill(0);
  for(let x=0;x<W;x++) for(let y=0;y<H;y++){ const i=y*W+x; if(!dark[i]||vis[i]) continue; if(y>0&&dark[i-W]) continue;
    const pth=trace(x,y,false); if(pth.length>=Lv){ pth.forEach(k=>{kill[k]=1;vis[k]=1;}); const xs=pth.map(k=>k%W); rawV.push({x:xs.reduce((s,v)=>s+v,0)/xs.length,y1:y,y2:(pth[pth.length-1]/W)|0}); } }
  // Nới vùng xóa ±2px để bỏ viền mờ (anti-alias) của đường kẻ — viền sót lại bị đọc thành chữ rác
  const R=2, kill2=new Uint8Array(n);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){ const i=y*W+x; if(!kill[i]) continue;
    for(let dy=-R;dy<=R;dy++){const yy=y+dy; if(yy<0||yy>=H) continue; for(let dx=-R;dx<=R;dx++){const xx=x+dx; if(xx>=0&&xx<W) kill2[yy*W+xx]=1;}} }
  let removed=0;
  for(let i=0;i<n;i++) if(kill2[i]){const k=i*4; d[k]=d[k+1]=d[k+2]=255; removed++;}
  if(removed) ctx.putImageData(im,0,0);
  // Toạ độ đường kẻ (px): gộp các vệt song song của cùng 1 nét dày thành 1 đoạn
  const mergeSeg=(raw,horiz)=>{ const out=[]; raw.sort((a,b)=>(horiz?a.y-b.y:a.x-b.x)).forEach(s=>{ const p=horiz?s.y:s.x, a1=horiz?s.x1:s.y1, a2=horiz?s.x2:s.y2;
      const g=out.find(o=>Math.abs(o.p-p)<=4 && Math.min(a2,o.a2)-Math.max(a1,o.a1)>0.3*Math.min(a2-a1,o.a2-o.a1));
      if(g){ g.p=(g.p*g.n+p)/(g.n+1); g.n++; g.a1=Math.min(g.a1,a1); g.a2=Math.max(g.a2,a2); } else out.push({p,n:1,a1,a2}); });
    // Nối các đoạn thẳng hàng bị đứt quãng (nét scan mờ) nếu khoảng hở ≤ 3% kích thước trang
    const gapMax=0.03*(horiz?W:H); out.sort((a,b)=>a.p-b.p||a.a1-b.a1);
    const joined=[]; out.forEach(o=>{ const g=joined.find(j=>Math.abs(j.p-o.p)<=5 && o.a1-j.a2<=gapMax && o.a2>=j.a1);
      if(g){ g.a1=Math.min(g.a1,o.a1); g.a2=Math.max(g.a2,o.a2); g.p=(g.p+o.p)/2; } else joined.push({...o}); });
    return joined.map(o=>horiz?{y:o.p,x1:o.a1,x2:o.a2}:{x:o.p,y1:o.a1,y2:o.a2}); };
  c._segs={h:mergeSeg(rawH,true), v:mergeSeg(rawV,false)};
  return c;
}
/* V3.4 — TỰ NHẬN HƯỚNG TRANG SCAN. Bảng khổ ngang hay bị scan xoay 90° trên trang dọc → Tesseract đọc ra chữ rác.
 * (1) Trục: trên ảnh thu nhỏ đã bỏ đường kẻ, hình chiếu mực theo HÀNG của chữ nằm ngang gợn mạnh (dòng chữ xen dòng trắng)
 *     còn theo CỘT thì mượt → cột gợn hơn rõ rệt = chữ đang chạy dọc. (2) Chiều: tiếng Việt nhiều dấu phía trên lõi chữ hơn
 *     phần chân chữ phía dưới → đoán 90° hay 270° (0° hay 180°). Tín hiệu (2) yếu → chỉ là đoán đầu; OCR độ tin cậy thấp
 *     thì thử chiều ngược lại (xem readFiles). Đo trên 1 biên bản scan 17 trang: trục đúng 17/17. */
function binSmall(c, maxW){
  const k=Math.min(1,maxW/c.width), W=Math.max(1,Math.round(c.width*k)), H=Math.max(1,Math.round(c.height*k));
  const s=document.createElement('canvas'); s.width=W; s.height=H;
  const x=s.getContext('2d',{willReadFrequently:true}); x.fillStyle='#fff'; x.fillRect(0,0,W,H); x.drawImage(c,0,0,W,H);
  const d=x.getImageData(0,0,W,H).data, b=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){const q=i*4; b[i]=(d[q]*0.299+d[q+1]*0.587+d[q+2]*0.114)<160?1:0;}
  s.width=s.height=0;
  // Bỏ vệt ngang/dọc dài (đường kẻ bảng) — không bỏ thì bảng làm nhiễu cả 2 hình chiếu
  const L=Math.max(25,(W/20)|0), out=b.slice();
  for(let y=0;y<H;y++){let r=0; for(let xx=0;xx<=W;xx++){ if(xx<W&&b[y*W+xx]){r++;continue;} if(r>=L) for(let j=xx-r;j<xx;j++) out[y*W+j]=0; r=0; }}
  for(let xx=0;xx<W;xx++){let r=0; for(let y=0;y<=H;y++){ if(y<H&&b[y*W+xx]){r++;continue;} if(r>=L) for(let j=y-r;j<y;j++) out[j*W+xx]=0; r=0; }}
  return {b:out,W,H};
}
const roughness=p=>{ let m=0,d=0; for(let i=0;i<p.length;i++){m+=p[i]; if(i) d+=Math.abs(p[i]-p[i-1]);} return m? (d/(p.length-1))/(m/p.length) : 0; };
/** Tỷ lệ mực ngay TRÊN / ngay DƯỚI lõi dòng chữ, cho hình chiếu theo hàng p (>1 = chữ đứng thẳng). */
function inkAsym(p){
  const nz=[...p].filter(v=>v>0).sort((a,b)=>a-b); if(!nz.length) return 1;
  const thr=0.5*nz[Math.floor(nz.length*0.9)]; let up=0, dn=0;
  for(let i=0;i<p.length;){ if(p[i]<thr){i++;continue;} let z=i; while(z<p.length&&p[z]>=thr) z++;
    const k=Math.max(2,Math.round((z-i)*0.6)); for(let j=Math.max(0,i-k);j<i;j++) up+=p[j]; for(let j=z;j<Math.min(p.length,z+k);j++) dn+=p[j]; i=z; }
  return dn? up/dn : 1;
}
/** Góc cần xoay theo chiều kim đồng hồ để chữ đứng thẳng: {rot:0|90|180|270, alt:góc dự phòng, vertical} */
function detectOrientation(c){
  const {b,W,H}=binSmall(c,700), rows=new Float64Array(H), cols=new Float64Array(W);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) if(b[y*W+x]){rows[y]++;cols[x]++;}
  const rr=roughness(rows), rc=roughness(cols), vertical = rc > rr*1.15;
  // Chữ chạy dọc: xoay 90° chiều kim đồng hồ thì cột x cũ thành hàng y=x mới (mép trái cũ lên trên)
  const a = vertical ? inkAsym(cols) : inkAsym(rows);
  const rot = vertical ? (a>=1?90:270) : (a>=1?0:180);
  return {rot, alt:(rot+180)%360, vertical, rr:+rr.toFixed(2), rc:+rc.toFixed(2), asym:+a.toFixed(2)};
}
function rotateCanvas(c, deg, keep){
  if(!deg) return c;
  const r=document.createElement('canvas'), q=deg%180!==0; r.width=q?c.height:c.width; r.height=q?c.width:c.height;
  const x=r.getContext('2d',{willReadFrequently:true}); x.fillStyle='#fff'; x.fillRect(0,0,r.width,r.height);
  x.translate(r.width/2,r.height/2); x.rotate(deg*Math.PI/180); x.drawImage(c,-c.width/2,-c.height/2);
  if(!keep) c.width=c.height=0; return r;
}
/** Xoay 180° canvas đã xoá kẻ + đoạn kẻ đi kèm (thử chiều ngược lại mà không dò kẻ lại). */
function flip180(c){
  const W=c.width, H=c.height, s=c._segs, o=c._orient||{rot:0}, r=rotateCanvas(c,180,true);
  if(s) r._segs={h:s.h.map(g=>({y:H-g.y,x1:W-g.x2,x2:W-g.x1})), v:s.v.map(g=>({x:W-g.x,y1:H-g.y2,y2:H-g.y1}))};
  r._orient={...o, rot:(o.rot+180)%360, alt:o.rot}; return r;
}
/** Nhận hướng → xoay (hint: góc đã chốt ở trang dọc trước của cùng file, ưu tiên dùng) → xoá đường kẻ. */
function orientAndClean(c, hint){
  const o = window.__NO_ORIENT ? {rot:0,alt:180,vertical:false} : detectOrientation(c);
  if(o.vertical && (hint===90||hint===270)){ o.rot=hint; o.alt=(hint+180)%360; }
  const r=cleanLines(rotateCanvas(c,o.rot)); r._orient=o; return r;
}
async function renderPage(pdf, no, scale, hint){
  const page = await pdf.getPage(no);
  const vp = page.getViewport({scale});
  const c = document.createElement('canvas'); c.width=Math.ceil(vp.width); c.height=Math.ceil(vp.height);
  const ctx = c.getContext('2d',{willReadFrequently:true}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height);
  await page.render({canvasContext:ctx, viewport:vp}).promise;
  page.cleanup();
  return orientAndClean(c, hint);
}
async function imageToCanvas(file, hint){
  const bmp = await createImageBitmap(file);
  const c=document.createElement('canvas'); c.width=bmp.width; c.height=bmp.height;
  const ctx=c.getContext('2d',{willReadFrequently:true}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,c.width,c.height); ctx.drawImage(bmp,0,0); bmp.close();
  return orientAndClean(c, hint);
}
// Font PDF (CIC, hệ thống NH) hay map chữ Đ thành Ð (Eth, U+00D0) → AI/tìm kiếm không nhận "Địa chỉ"
const fixVi=s=>s.replace(/Ð/g,'Đ').replace(/ð/g,'đ');
async function textLayer(pdf, no){
  const page = await pdf.getPage(no); const tc = await page.getTextContent();
  let out='', lastY=null;
  tc.items.forEach(it=>{const y=Math.round(it.transform[5]); if(lastY!==null && Math.abs(y-lastY)>3) out+='\n'; else if(out && !out.endsWith(' ')) out+=' '; out+=fixVi(it.str); lastY=y;});
  return out.replace(/[ \t]+\n/g,'\n').trim();
}
const fmtTime = s => s<60 ? Math.round(s)+' giây' : Math.floor(s/60)+' phút '+Math.round(s%60)+' giây';

/* ---------- Xuất Excel .xlsx tối giản (không thư viện): zip "store" + CRC32 ---------- */
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=t[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};})();
function zipStore(files){ // files: [{name, data:Uint8Array}]
  const enc=new TextEncoder(), parts=[], cd=[]; let off=0;
  const u16=v=>[v&255,(v>>8)&255], u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  files.forEach(f=>{ const nm=enc.encode(f.name), crc=CRC(f.data), sz=f.data.length;
    const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(sz),...u32(sz),...u16(nm.length),...u16(0)]);
    parts.push(lh,nm,f.data);
    cd.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(sz),...u32(sz),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
    off+=lh.length+nm.length+sz; });
  const cdLen=cd.reduce((s,a)=>s+a.length,0);
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cdLen),...u32(off),...u16(0)]);
  return new Blob([...parts,...cd,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
const xesc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
const colName=c=>{let s='';c++;while(c>0){const m=(c-1)%26;s=String.fromCharCode(65+m)+s;c=Math.floor((c-1)/26);}return s;};
// Số kiểu VN "250.000.000.000" / "(1.234)" → số thật để Excel tính được; còn lại giữ chữ
async function readXlsxFirstSheet(file){
  const buf=await file.arrayBuffer(), dv=new DataView(buf), dec=new TextDecoder();
  let e=buf.byteLength-22; while(e>=0 && dv.getUint32(e,true)!==0x06054b50) e--; if(e<0) throw new Error('không phải file .xlsx');
  const z={}; let p=dv.getUint32(e+16,true); const n=dv.getUint16(e+10,true);
  for(let i=0;i<n;i++){ const method=dv.getUint16(p+10,true), csize=dv.getUint32(p+20,true), nl=dv.getUint16(p+28,true), xl=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true), off=dv.getUint32(p+42,true);
    const name=dec.decode(new Uint8Array(buf,p+46,nl)); const lnl=dv.getUint16(off+26,true), lxl=dv.getUint16(off+28,true);
    z[name]={method,data:new Uint8Array(buf,off+30+lnl+lxl,csize)}; p+=46+nl+xl+cl; }
  const txt=async k=>{ const f=z[k]; if(!f) return null; if(f.method===0) return dec.decode(f.data);
    const s=new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return dec.decode(await new Response(s).arrayBuffer()); };
  const P=s=>new DOMParser().parseFromString(s,'application/xml');
  const ss=[]; const sst=await txt('xl/sharedStrings.xml'); if(sst) P(sst).querySelectorAll('si').forEach(si=>ss.push([...si.querySelectorAll('t')].map(x=>x.textContent).join('')));
  const sheets=Object.keys(z).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort(codeSort); if(!sheets.length) throw new Error('file không có sheet');
  const all=[];
  for(const sh of sheets){ const rows=[]; P(await txt(sh)).querySelectorAll('row').forEach(r=>{ const a=[];
    r.querySelectorAll('c').forEach(c=>{ const col=(c.getAttribute('r')||'').replace(/\d+/g,''); let ci=0; for(const ch of col) ci=ci*26+ch.charCodeAt(0)-64; ci--;
      const t=c.getAttribute('t'), v=c.querySelector('v'); a[ci]= t==='s'? (ss[+v.textContent]||'') : t==='inlineStr'? [...c.querySelectorAll('t')].map(x=>x.textContent).join('') : (v?v.textContent:''); });
    rows.push(Array.from(a,x=>x===undefined?'':x)); });
    all.push(rows); }
  return all; // mọi sheet (sheet đầu có thể là Hướng dẫn)
}
