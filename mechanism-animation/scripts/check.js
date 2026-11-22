#!/usr/bin/env node
/* 原理动画页自测：node check.js <页面.html> [截图输出目录]
 *
 * 查的是读者会看到的那几件事，逐条给 PASS / FAIL（没条件查的给 SKIP），任何一条 FAIL 退出码为 1：
 *   1 errors      页面脚本没有报错
 *   2 still       每一步结束时所有对象都已经停住（动画在这一步里走完了）
 *   3 overlap     每一步结束时，看得见的文字两两不重叠
 *   4 canvas      每一步结束时，看得见的东西都在画布里
 *   5 contain     标了 data-in="X" 的对象，整段时间轴上都待在 data-box="X" 的框里（没标就跳过）
 *   6 wheel       滚轮一下一步，从开头走到结尾，一步不跳、一步不卡；顶部导航能跳到各模块；回到开头页时模块文字不露出来
 *   7 text        每一步的说明文字整段都在屏幕里（1366×768 和 1280×720，13 寸笔记本的常见尺寸）
 *   8 mobile      手机宽度下页面不横向溢出
 *   9 fontsize    1280 × 720 的屏上，图里看得见的字实际渲染不小于 11px
 *  10 bends       每一步结束时，看得见的箭头（带 marker-end 的折线）没有短于 12 的小折弯、拐角不超过两次（标 data-route-ok 的豁免）
 * 另外存截图：step-NN.png（每一步结束时的图）、mid-NN.png（这一步走到一半）、page-NN.png（那一步的整页，文字和图一起）、hero.png、mobile.png。
 * 耗时：4 步的页面约 1 分钟，12 步约 3 分钟。经 Bash 工具跑要把工具的超时设到 300000 毫秒，或放后台跑。
 * 脚本通过不等于讲清楚了，截图要自己逐张看。
 *
 * 依赖 playwright。找不到时设环境变量：
 *   PLAYWRIGHT_PATH=<node_modules/playwright 的路径>  CHROMIUM_PATH=<chrome 可执行文件>
 */
const path=require('path'), fs=require('fs');
function loadPlaywright(){
  const tries=[process.env.PLAYWRIGHT_PATH,'playwright','playwright-core'].filter(Boolean);
  try{ const d=path.join(process.env.HOME||'/root','.npm/_npx'); for(const x of fs.readdirSync(d)) tries.push(path.join(d,x,'node_modules/playwright')); }catch(e){}
  for(const t of tries){ try{ return require(t); }catch(e){} }
  console.error('找不到 playwright：设 PLAYWRIGHT_PATH，或在这台机器上 npx playwright install chromium'); process.exit(2);
}
function findChromium(){
  if(process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try{ const d=path.join(process.env.HOME||'/root','.cache/ms-playwright');
    for(const x of fs.readdirSync(d).filter(n=>/^chromium-\d+$/.test(n)).sort().reverse()){
      for(const sub of ['chrome-linux64/chrome','chrome-linux/chrome','chrome-mac/Chromium.app/Contents/MacOS/Chromium']){ const f=path.join(d,x,sub); if(fs.existsSync(f)) return f; } } }catch(e){}
  return undefined;   // 交给 playwright 自己找
}
const file=process.argv[2]; if(!file){ console.error('用法：node check.js <页面.html> [截图输出目录]'); process.exit(2); }
const url='file://'+path.resolve(file);
const out=path.resolve(process.argv[3]||path.join(path.dirname(path.resolve(file)),'check-out'));
fs.mkdirSync(out,{recursive:true});

(async()=>{
  const {chromium}=loadPlaywright();
  const browser=await chromium.launch({executablePath:findChromium()});
  const res=[]; const add=(name,ok,detail)=>{ res.push({name,ok,detail}); };
  const settle=async(pg,max=12000)=>{ const t0=Date.now(); await pg.waitForTimeout(120);
    while(Date.now()-t0<max){ if(!(await pg.evaluate(()=>window.__anim.state().busy))) break; await pg.waitForTimeout(80); } await pg.waitForTimeout(200); };

  /* ---------- 画面本身：1388 × 868 ---------- */
  {
    const pg=await browser.newPage({viewport:{width:1388,height:868}}); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)+((e.stack||'').split('\n').filter(l=>/\.html:\d+/.test(l)).slice(0,3).map(l=>'\n        '+l.trim().replace(/^at /,'出自 ').replace(/file:\/\/\S*\//,'')).join(''))));
    await pg.goto(url); await pg.waitForTimeout(600);
    const has=await pg.evaluate(()=>!!window.__anim);
    if(!has){ add('errors',false,['页面没有 window.__anim（脚本没跑完？）'].concat(errs)); report(); return; }
    const N=await pg.evaluate(()=>window.__anim.n);
    await pg.evaluate(()=>window.__anim.goSection(1)); await settle(pg);
    const snap=q=>pg.evaluate(q=>{ window.__anim.render(q);
      return [...document.querySelectorAll('#fig *')].filter(e=>e.tagName!=='defs'&&!e.closest('defs')).map(e=>{ let o=1; for(let n=e;n&&n.id!=='fig';n=n.parentNode)o*=+getComputedStyle(n).opacity;
        return ['x','y','width','height','cx','cy','r','d','transform','stroke-dashoffset','fill'].map(a=>e.getAttribute(a)).join('|')+'|'+Math.round(o*100)+'|'+(e.children.length?'':e.textContent); }); },q);
    // 2 still
    // （报出是哪几个对象：标签名、class、里面的字，最多 4 个）
    const names=await pg.evaluate(()=>[...document.querySelectorAll('#fig *')].filter(e=>e.tagName!=='defs'&&!e.closest('defs')).map(e=>e.tagName+(e.getAttribute('class')?'.'+e.getAttribute('class').split(' ')[0]:'')+(e.children.length||!e.textContent?'':'「'+e.textContent.slice(0,12)+'」')));
    const moving=[]; for(let k=0;k<N;k++){ const a=await snap(k+1-0.015), c=await snap(k+1); const who=[]; for(let i=0;i<a.length;i++)if(a[i]!==c[i])who.push(names[i]||'?'); if(who.length)moving.push('第 '+(k+1)+' 步结束前还有 '+who.length+' 个对象在动：'+who.slice(0,4).join('、')+(who.length>4?' …':'')); }
    add('still',!moving.length,moving);
    // 3 overlap + 4 canvas，顺便截图
    const over=[], outside=[], bends=[];
    for(let k=0;k<N;k++){
      const r=await pg.evaluate(t=>{ window.__anim.render(t);
        const fig=document.getElementById('fig'), vb=fig.viewBox.baseVal;
        const vis=e=>{ let o=1; for(let n=e;n&&n.id!=='fig';n=n.parentNode)o*=+getComputedStyle(n).opacity; return o; };
        const bb=e=>{ const r=e.getBBox(), m=e.getCTM(), f=fig.getCTM().inverse().multiply(m); return {x:r.x*f.a+f.e,y:r.y*f.d+f.f,w:r.width*f.a,h:r.height*f.d}; };
        const T=[...fig.querySelectorAll('text')].filter(e=>vis(e)>0.3&&e.textContent.trim()).map(e=>Object.assign(bb(e),{t:e.textContent}));
        const o=[]; for(let i=0;i<T.length;i++)for(let j=i+1;j<T.length;j++){ const a=T[i],c=T[j]; if(a.x<c.x+c.w-1&&c.x<a.x+a.w-1&&a.y<c.y+c.h-1&&c.y<a.y+a.h-1)o.push('「'+a.t.slice(0,14)+'」压着「'+c.t.slice(0,14)+'」'); }
        const out=[]; [...fig.querySelectorAll('rect,text,circle,path,line')].filter(e=>!e.closest('defs')&&vis(e)>0.3).forEach(e=>{ let b; try{ b=bb(e); }catch(_){ return; } if(!b.w&&!b.h)return;
          if(b.x<vb.x-1||b.y<vb.y-1||b.x+b.w>vb.x+vb.width+1||b.y+b.h>vb.y+vb.height+1) out.push(e.tagName+(e.textContent?'「'+e.textContent.slice(0,14)+'」':'')+' 出了画布 ('+Math.round(b.x)+','+Math.round(b.y)+','+Math.round(b.w)+'×'+Math.round(b.h)+')'); });
        // 连线拐角：只看画着箭头（marker-end）的折线；M/L/H/V 以外的命令（曲线）不查；标了 data-route-ok 的豁免
        const bend=[]; [...fig.querySelectorAll('path[marker-end]')].filter(e=>vis(e)>0.3&&!e.hasAttribute('data-route-ok')).forEach(e=>{
          const d=e.getAttribute('d')||''; if(/[CcSsQqTtAa]/.test(d))return;
          const tk=d.match(/[MLHVmlhv]|-?\d*\.?\d+(?:e-?\d+)?/g)||[]; let x=0,y=0,cmd='',pts=[];
          for(let i=0;i<tk.length;){ if(/[A-Za-z]/.test(tk[i])){ cmd=tk[i++]; continue; } const n=()=>+tk[i++];
            if(cmd==='M'||cmd==='L'){ x=n(); y=n(); } else if(cmd==='m'||cmd==='l'){ x+=n(); y+=n(); } else if(cmd==='H'){ x=n(); } else if(cmd==='h'){ x+=n(); } else if(cmd==='V'){ y=n(); } else if(cmd==='v'){ y+=n(); } else { i++; continue; } pts.push([x,y]); }
          const segs=[]; for(let i=1;i<pts.length;i++){ const dx=pts[i][0]-pts[i-1][0], dy=pts[i][1]-pts[i-1][1], len=Math.hypot(dx,dy); if(len<0.5)continue; const dir=Math.abs(dx)>=Math.abs(dy)?'h':'v'; if(segs.length&&segs[segs.length-1].dir===dir)segs[segs.length-1].len+=len; else segs.push({dir,len}); }
          const turns=Math.max(0,segs.length-1), tiny=segs.slice(1,-1).concat(segs.length>1?[segs[0],segs[segs.length-1]]:[]).filter(g=>g.len<12);
          if(turns>=3||tiny.length){ const p0=pts[0]||[0,0]; bend.push('从 ('+Math.round(p0[0])+','+Math.round(p0[1])+') 起的箭头'+(turns>=3?'拐了 '+turns+' 次':'')+(tiny.length?(turns>=3?'，':'')+'有 '+tiny.length+' 段短于 12 的小折弯':'')); } });
        return {o,out,bend}; },k+1);
      r.o.forEach(x=>over.push('第 '+(k+1)+' 步：'+x)); r.out.forEach(x=>outside.push('第 '+(k+1)+' 步：'+x)); r.bend.forEach(x=>bends.push('第 '+(k+1)+' 步：'+x));
      await pg.evaluate(t=>window.__anim.render(t),k+0.5);
      const clip=await pg.evaluate(()=>{ const r=document.getElementById('fig').getBoundingClientRect(); return {x:Math.max(0,r.left-8),y:Math.max(0,r.top-8),width:Math.min(innerWidth-Math.max(0,r.left-8),r.width+16),height:Math.min(innerHeight-Math.max(0,r.top-8),r.height+16)}; });
      await pg.screenshot({path:path.join(out,'mid-'+String(k+1).padStart(2,'0')+'.png'),clip});    // 这一步走到一半
      await pg.evaluate(t=>window.__anim.render(t),k+1);
      await pg.screenshot({path:path.join(out,'step-'+String(k+1).padStart(2,'0')+'.png'),clip});   // 只截图，不带左边文字（文字停在第 1 步，会误导）
    }
    add('overlap',!over.length,over); add('canvas',!outside.length,outside);
    add('bends',!bends.length,bends.length?['箭头别出现小折弯、也别拐三次以上：端点放在两个框相对的边上（别瞄着框中心），两框高度有重叠就画一条直线，要拐就经一个明确的拐点（绕开障碍的 U 形最多两次），数据包和线共用这组拐点。确实要这么走的那条线，给它标 data-route-ok 豁免：'].concat([...new Set(bends)]):[]);
    // 5 contain
    const cont=await pg.evaluate(N=>{ const fig=document.getElementById('fig'); const ins=[...fig.querySelectorAll('[data-in]')]; if(!ins.length)return null;
      const vis=e=>{ let o=1; for(let n=e;n&&n.id!=='fig';n=n.parentNode)o*=+getComputedStyle(n).opacity; return o; };
      const bb=e=>{ const r=e.getBBox(), m=e.getCTM(), f=fig.getCTM().inverse().multiply(m); return {x:r.x*f.a+f.e,y:r.y*f.d+f.f,w:r.width*f.a,h:r.height*f.d}; };
      const bad={}; for(let i=0;i<=N*40;i++){ const t=i/40; window.__anim.render(t);
        ins.forEach(e=>{ const id=e.getAttribute('data-in'), boxEl=fig.querySelector('[data-box="'+id+'"]'); if(!boxEl||vis(e)<0.05)return; const a=bb(e), b=bb(boxEl);
          if(a.x<b.x-0.5||a.y<b.y-0.5||a.x+a.w>b.x+b.w+0.5||a.y+a.h>b.y+b.h+0.5){ const key=id+'：'+e.tagName+(e.textContent?'「'+e.textContent.slice(0,12)+'」':''); (bad[key]=bad[key]||[]).push(t.toFixed(2)); } }); }
      return Object.keys(bad).map(k=>k+' 在时刻 '+bad[k][0]+'–'+bad[k][bad[k].length-1]+' 出了框（'+bad[k].length+' 帧）'); },N);
    add('contain',cont===null?null:!cont.length,cont===null?['页面里没有 data-in 标记，这一项没有查。有「应该一直待在某个框里」的东西（框里的字、格子）就给它和框标上 data-in / data-box；只有飞来飞去的块时不用标']:cont);
    add('errors',!errs.length,errs);
    await pg.close();
  }

  /* ---------- 交互：1388×868 查滚轮，1366×768 查文字，1280×720 两样都查 ---------- */
  const wheelBad=[], textBad=[];
  for(const [W,H,what] of [[1388,868,'w'],[1366,768,'t'],[1280,720,'wt']]){   // 后两档是 13 寸笔记本的常见尺寸
    const pg=await browser.newPage({viewport:{width:W,height:H}}); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
    await pg.goto(url); await pg.waitForTimeout(600);
    await pg.evaluate(()=>window.__anim.speed(0.15));                          // 查的是翻页逻辑，不是时长：走快一点
    const info=await pg.evaluate(()=>({n:window.__anim.n,sm:window.__anim.stepMod,mods:window.__anim.mods}));
    const st=()=>pg.evaluate(()=>{ const s=window.__anim.state(); return [s.section,s.target]; });
    await pg.mouse.move(Math.round(W/2),Math.round(H/2));
    if(what.includes('w')){
      // 6 wheel：期望 [页, 步] 依次是每一步，最后到结尾页
      const want=info.sm.map((m,k)=>[m+1,k]).concat([[info.mods.length+1,info.n-1]]), seen=[];
      for(let i=0;i<want.length;i++){ await pg.mouse.wheel(0,120); await settle(pg); await pg.waitForTimeout(260); seen.push(await st()); }
      if(JSON.stringify(seen)!==JSON.stringify(want)) wheelBad.push(W+'×'+H+'：滚轮走到的 [页,步] 是 '+JSON.stringify(seen)+'，应为 '+JSON.stringify(want));
      for(let g=1;g<=info.mods.length;g++){ await pg.click('.nav a[data-go="'+g+'"]'); await settle(pg); const s=await st(); const first=info.sm.indexOf(g-1);
        if(s[0]!==g||s[1]!==first) wheelBad.push(W+'×'+H+'：点导航第 '+g+' 个模块后停在 '+JSON.stringify(s)+'，应为 ['+g+','+first+']'); }
      await pg.click('.nav a[data-go="0"]'); await settle(pg); await pg.waitForTimeout(900);
      const leak=await pg.evaluate(()=>[...document.querySelectorAll('.mod h2,.mod .steps>li')].filter(e=>{ const r=e.getBoundingClientRect(); return r.bottom>0&&r.top<innerHeight-1; }).length);
      if(leak) wheelBad.push(W+'×'+H+'：回到开头页时有 '+leak+' 处模块页的文字露出来');
      if(W===1388) await pg.screenshot({path:path.join(out,'hero.png')});
    }
    if(what.includes('t')){
      // 7 text：每一步的说明整段在屏幕里
      let cur=-1;
      for(let k=0;k<info.n;k++){
        if(info.sm[k]!==cur){ cur=info.sm[k]; await pg.evaluate(m=>window.__anim.goSection(m+1),cur); await settle(pg); await pg.waitForTimeout(500); }
        await pg.evaluate(k=>window.__anim.jump(k),k); await pg.waitForTimeout(1700);        // 等左栏挪到位
        const b=await pg.evaluate(()=>{ const e=document.querySelector('.steps>li.on'); if(!e)return null; const r=e.getBoundingClientRect(); return [Math.round(r.top),Math.round(r.bottom)]; });
        if(W===1366) await pg.screenshot({path:path.join(out,'page-'+String(k+1).padStart(2,'0')+'.png')});
        if(!b) textBad.push(W+'×'+H+'：第 '+(k+1)+' 步没有高亮的说明'); else if(b[1]>H-20||b[0]<70) textBad.push(W+'×'+H+'：第 '+(k+1)+' 步的说明不在屏幕里（上 '+b[0]+'，下 '+b[1]+'，屏高 '+H+'）。删字，或把这个模块拆成两个');
      }
    }
    if(errs.length) wheelBad.push(W+'×'+H+'：脚本报错 '+errs.join(' | '));
    await pg.close();
  }
  add('wheel',!wheelBad.length,wheelBad); add('text',!textBad.length,textBad);

  /* ---------- 手机宽度 ---------- */
  {
    const pg=await browser.newPage({viewport:{width:390,height:844}}); await pg.goto(url); await pg.waitForTimeout(500);
    const ov=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    await pg.evaluate(()=>window.__anim.goSection(1)); await settle(pg); await pg.waitForTimeout(800);
    await pg.screenshot({path:path.join(out,'mobile.png')});
    add('mobile',ov<=1,ov>1?['手机宽度下横向溢出 '+ov+' 像素']:[]);
    await pg.close();
  }
  /* ---------- 小屏上图里的字够不够大 ---------- */
  {
    const pg=await browser.newPage({viewport:{width:1280,height:720}}); await pg.goto(url); await pg.waitForTimeout(500);
    await pg.evaluate(()=>window.__anim.goSection(1)); await settle(pg); await pg.waitForTimeout(900);
    const N=await pg.evaluate(()=>window.__anim.n), small={};
    for(let k=0;k<N;k++){
      const r=await pg.evaluate(t=>{ window.__anim.render(t); const fig=document.getElementById('fig'), sc=fig.getScreenCTM().a;
        const vis=e=>{ let o=1; for(let n=e;n&&n.id!=='fig';n=n.parentNode)o*=+getComputedStyle(n).opacity; return o; };
        return [...fig.querySelectorAll('text')].filter(e=>vis(e)>0.3&&e.textContent.trim()).map(e=>[e.textContent.slice(0,14),Math.round(parseFloat(getComputedStyle(e).fontSize)*sc*10)/10]).filter(x=>x[1]<11); },k+1);
      r.forEach(x=>{ small['「'+x[0]+'」 '+x[1]+'px']=1; });
    }
    const list=Object.keys(small);
    add('fontsize',!list.length,list.length?['1280×720 下这些字小于 11px（把字号调到 14 个画布单位以上，或减少内容）：'].concat(list):[]);
    await pg.close();
  }
  report();

  async function report(){
    await browser.close();
    let fail=0, skip=0;
    for(const r of res){ const tag=r.ok===null?'SKIP':r.ok?'PASS':'FAIL';
      console.log(tag+'  '+r.name+(r.detail&&r.detail.length?'\n      '+r.detail.slice(0,12).join('\n      ')+(r.detail.length>12?'\n      …共 '+r.detail.length+' 条':''):'')); if(r.ok===false)fail++; if(r.ok===null)skip++; }
    console.log('\n截图：'+out+'（step / mid / page 逐张看过才算查完）');
    console.log('结果：'+res.length+' 项，'+(res.length-fail-skip)+' PASS'+(skip?'、'+skip+' SKIP':'')+(fail?'、'+fail+' FAIL':'')+(fail?'':'（没有 FAIL）'));
    process.exit(fail?1:0);
  }
})().catch(e=>{ console.error(e); process.exit(2); });
