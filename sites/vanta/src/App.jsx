import React,{lazy,Suspense,useCallback,useEffect,useRef,useState,Component} from 'react';
import {createPortal} from 'react-dom';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {SplitText} from 'gsap/SplitText';
import Lenis from 'lenis';
import {Howl} from 'howler';
gsap.registerPlugin(ScrollTrigger,SplitText);
const clamp=(v,min,max)=>Math.min(Math.max(v,min),max);
const staticMode=typeof location!=='undefined'&&location.search.includes('static');
const Scene=lazy(()=>import('./Scene.jsx'));
const HoloGlobe=lazy(()=>import('./Scene.jsx').then(m=>({default:m.HoloGlobe})));
const DissolveReveal=lazy(()=>import('./DissolveReveal.jsx'));
const Debug=lazy(()=>import('./Debug.jsx'));
const GearScene=lazy(()=>import('./GearScene.jsx'));
const asset=name=>`/assets/${name}.webp`;
const products=[{id:'outerwear',name:'TECHNICAL SHELL',zh:'城市防护系统',category:'机能外套',code:'V—01',caption:'PROTECTION / ADAPTATION',description:'立体兜帽、高领轮廓与功能口袋。以克制的黑色构建城市穿搭的第一层，在结构与自由之间找到平衡。',sizes:['S','M','L','XL']},{id:'pants',name:'UTILITY CARGO',zh:'自由移动系统',category:'工装裤装',code:'V—02',caption:'MOVEMENT / FREEDOM',description:'宽松廓形、关节剪裁与立体多口袋。每一处织带与结构，都为日常移动保留更多空间。',sizes:['S','M','L','XL']},{id:'accessories',name:'MODULAR SLING',zh:'随行装备系统',category:'都市配饰',code:'V—03',caption:'UTILITY / EVERYDAY',description:'雕塑感包型、宽幅织带与战术扣具，将日常必需收纳于一身。一抹荧光绿，让细节成为标记。',sizes:['ONE SIZE']}];
const infos={contact:['联系 VANTA','这是 VANTA 品牌官网的设计概念。联系服务尚未开放；你可以探索三个装备系列并体验购物袋。'],shipping:['配送与退换','当前为品牌设计预览，图片由 AI 生成。实际销售、配送与退换服务尚未开放。'],privacy:['隐私说明','订阅体验与购物袋仅存储在当前浏览器。页面不会向服务器提交邮箱或购物袋内容；清除该站点的浏览器数据即可删除。字体由 Google Fonts 提供。']};
class SceneBoundary extends Component{state={failed:false};static getDerivedStateFromError(){return{failed:true};}render(){return this.state.failed?null:this.props.children;}}
function WireGlobe(){return <div className="wire-globe" aria-hidden="true"><svg viewBox="0 0 400 400" fill="none" stroke="currentColor"><circle cx="200" cy="200" r="145"/><ellipse cx="200" cy="200" rx="112" ry="145"/><ellipse cx="200" cy="200" rx="59" ry="145"/><path d="M200 55v290M55 200h290"/><ellipse cx="200" cy="200" rx="145" ry="56"/><ellipse cx="200" cy="200" rx="145" ry="105"/><path d="M79 120h242M79 280h242M61 160h278M61 240h278"/><ellipse cx="200" cy="200" rx="187" ry="58" transform="rotate(-25 200 200)"/><circle cx="335" cy="122" r="5" fill="currentColor"/><path d="M13 28h20M23 18v20M367 364h20M377 354v20"/></svg></div>}
function FeatureIcon({type}){return <svg width="34" height="34" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">{type===0?<><path d="m20 4 15 9v18L20 37 5 28V12ZM5 12l15 9 15-8M20 21v16M12 8l15 9v17"/></>:type===1?<><path d="M7 10h26v26H7ZM13 5v10M27 5v10M7 20h26M14 27l4 4 9-8"/></>:<><circle cx="20" cy="20" r="16"/><ellipse cx="20" cy="20" rx="7" ry="16"/><path d="M4 20h32M7 11h26M7 29h26"/></>}</svg>}

function Cursor(){
 const root=useRef(),label=useRef();
 useEffect(()=>{
  const node=root.current;
  if(!node)return;
  if(!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.body.classList.add('has-cursor');
  const target={x:innerWidth/2,y:innerHeight/2},ring={x:target.x,y:target.y};
  let scale=1,targetScale=1,pressScale=1,visible=false,snapFrames=4,raf;
  const move=e=>{target.x=e.clientX;target.y=e.clientY;if(!visible){visible=true;node.style.opacity=1;}if(snapFrames>0){ring.x=target.x;ring.y=target.y;snapFrames--;}};
  const over=e=>{
   const hit=e.target.closest?.('a,button,input,label,[data-cursor]');
   if(hit){const text=hit.getAttribute('data-cursor')||'';if(label.current)label.current.textContent=text;node.classList.add('is-hover');node.classList.toggle('has-label',!!text);targetScale=text?3.1:2.1;}
   else{node.classList.remove('is-hover','has-label');targetScale=1;}
  };
  const press=()=>{pressScale=.78;};
  const release=()=>{pressScale=1;};
  const leave=()=>{visible=false;node.style.opacity=0;};
  addEventListener('pointermove',move,{passive:true});
  addEventListener('pointerover',over,{passive:true});
  addEventListener('pointerdown',press,{passive:true});
  addEventListener('pointerup',release,{passive:true});
  document.documentElement.addEventListener('pointerleave',leave);
  const tick=()=>{
   const ease=1-Math.exp(-.016*13);
   ring.x+=(target.x-ring.x)*ease;ring.y+=(target.y-ring.y)*ease;
   scale+=(targetScale*pressScale-scale)*.2;
   node.style.setProperty('--dot-x',`${target.x}px`);
   node.style.setProperty('--dot-y',`${target.y}px`);
   node.style.setProperty('--ring-x',`${ring.x}px`);
   node.style.setProperty('--ring-y',`${ring.y}px`);
   node.style.setProperty('--ring-scale',scale.toFixed(3));
   raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  return()=>{
   cancelAnimationFrame(raf);
   document.body.classList.remove('has-cursor');
   removeEventListener('pointermove',move);
   removeEventListener('pointerover',over);
   removeEventListener('pointerdown',press);
   removeEventListener('pointerup',release);
   document.documentElement.removeEventListener('pointerleave',leave);
  };
 },[]);
 return createPortal(
  <div className="cursor" ref={root} aria-hidden="true">
   <span className="cursor-ring"><span className="cursor-label" ref={label}/></span>
   <span className="cursor-dot"/>
  </div>,document.body);
}

function Loader({onDone}){
 const root=useRef(),num=useRef(),bar=useRef();
 const [gone,setGone]=useState(false);
 useEffect(()=>{
  const node=root.current;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce||!node){onDone();setGone(true);return;}
  document.body.classList.add('is-loading');
  const loaded={done:false};
  const img=new Image();
  img.onload=()=>{loaded.done=true;};
  img.onerror=()=>{loaded.done=true;};
  img.src='/assets/hero.webp';
  const startedAt=performance.now();
  const counter={v:0};
  let poll=null;
  const setDisplay=value=>{const text=String(Math.round(value)).padStart(3,'0');if(num.current)num.current.textContent=text;if(bar.current)bar.current.style.transform=`scaleX(${value/100})`;};
  const proceed=()=>{
   if(!loaded.done&&performance.now()-startedAt<4500){poll=gsap.delayedCall(.08,proceed);return;}
   gsap.timeline({onComplete(){document.body.classList.remove('is-loading');}})
    .add(()=>setDisplay(100))
    .to(node.querySelector('.loader-ui'),{opacity:0,y:-24,duration:.4,ease:'power2.in'},'+=.05')
    .add(()=>onDone())
    .to(node,{yPercent:-100,duration:.95,ease:'power4.inOut'},'-=.05')
    .add(()=>setGone(true));
  };
  const tl=gsap.timeline({onComplete:proceed});
  tl.to(counter,{v:100,duration:1.5,ease:'power2.inOut',onUpdate(){setDisplay(Math.min(counter.v,loaded.done?100:92));}});
  return()=>{tl.kill();poll?.kill();gsap.killTweensOf(node);document.body.classList.remove('is-loading');};
 },[onDone]);
 if(gone)return null;
 return <div className="loader" ref={root} aria-hidden="true">
  <div className="loader-ui">
   <span className="loader-mark">VANTA<sup>®</sup></span>
   <span className="loader-tag">NXT IS LOADED / SYSTEM BOOT</span>
   <span className="loader-num" ref={num}>000</span>
   <span className="loader-bar"><i ref={bar}/></span>
  </div>
 </div>;
}

function GearInspection({motion}){
 const host=useRef(),progress=useRef(0),drag=useRef(null);
 const [manual,setManual]=useState(null),[angle,setAngle]=useState(0),[ready,setReady]=useState(false),[phase,setPhase]=useState('photo');
 useEffect(()=>{if(!motion)return;const t=ScrollTrigger.create({trigger:host.current,start:'top 70%',end:'bottom 20%',onUpdate:self=>{progress.current=Math.max(0,(self.progress-.2)/.8)*.65;}});return()=>t.kill();},[motion]);
 useEffect(()=>{const node=host.current;if(!node)return;const io=new IntersectionObserver(([e])=>{if(!e.isIntersecting)setPhase('photo');},{rootMargin:'-12% 0px -12% 0px'});io.observe(node);return()=>io.disconnect();},[]);
 const activate=()=>{if(ready&&phase==='photo')setPhase('dissolve');};
 return <div className={`gear-inspection ${ready?'ready':''}`} ref={host}>
 <div className="inspection-hud"><span>V—03 / MATERIAL STUDY</span><span>{phase==='photo'?'VISUAL PREVIEW':'LIVE MODEL'} <i/></span></div>
 <div className={`inspection-stage ${phase==='photo'?'photo-phase':''}`} data-cursor={phase==='photo'?(ready?'ENTER 3D':'LOADING'):'DRAG'} onClick={activate} onPointerDown={e=>{if(phase!=='live'||!ready||!motion)return;drag.current={x:e.clientX,angle};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current)setAngle(drag.current.angle+(e.clientX-drag.current.x)*.012);}} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
 <SceneBoundary><Suspense fallback={null}><GearScene explode={manual===null?progress:manual} angle={angle} reducedMotion={!motion} onReady={setReady}/></Suspense></SceneBoundary>
 {phase==='photo'&&<img className="inspection-photo" src={asset('accessories')} alt="黑色尼龙斜挎包，立体织带与战术扣具"/>}
 {phase==='dissolve'&&<Suspense fallback={null}><DissolveReveal url={asset('accessories')} instant={!motion} onDone={()=>setPhase('live')}/></Suspense>}
 {phase==='photo'&&<button type="button" className="inspection-enter" disabled={!ready} onClick={activate}>{ready?'点击进入 3D / ENTER 3D':'模型编译中 / COMPILING'}</button>}
 <span className="inspection-hint">{phase==='photo'?'PHOTO / 实拍材质':(ready?'DRAG TO ROTATE / 拖动旋转':'V—03 / 黑色尼龙装备')}</span></div>
 <div className={`inspection-controls ${phase==='photo'?'disabled':''}`}><div role="group" aria-label="装备视图"><button className={manual===0?'active':''} aria-pressed={manual===0} disabled={!ready} onClick={()=>setManual(0)}>组装视图</button><button className={manual===1?'active':''} aria-pressed={manual===1} disabled={!ready} onClick={()=>setManual(1)}>拆解视图</button><button aria-label="重置装备视图" disabled={!ready} onClick={()=>{setManual(null);setAngle(0);}}>↺</button></div><label>ROTATE <input type="range" aria-label="装备旋转角度" min="-180" max="180" step="1" value={Math.round(angle*180/Math.PI)} disabled={!ready} onChange={e=>setAngle(Number(e.target.value)*Math.PI/180)}/></label></div>
 </div>
}
export default function App({page='home'}){
const app=useRef(),hero=useRef(),sceneProgress=useRef(0),pointer=useRef({x:0,y:0}),dialog=useRef(),sound=useRef(),lenisRef=useRef(),soundTimer=useRef();
const [filter,setFilter]=useState('all'),[menu,setMenu]=useState(false),[scrolled,setScrolled]=useState(false),[soundOn,setSoundOn]=useState(false),[modal,setModal]=useState(null),[size,setSize]=useState('S'),[toast,setToast]=useState(''),[status,setStatus]=useState(''),[sceneActive,setSceneActive]=useState(true),[sceneReady,setSceneReady]=useState(false),[motion,setMotion]=useState(!staticMode&&!matchMedia('(prefers-reduced-motion: reduce)').matches),[controls,setControls]=useState({intensity:.3});
const [showLoader]=useState(()=>page==='home'&&!staticMode&&!Boolean(window.__VANTA_BOOTED));
const [booted,setBooted]=useState(!showLoader);
const [bag,setBag]=useState(()=>{try{const b=JSON.parse(localStorage.getItem('seven-bag-v2')||'[]');return Array.isArray(b)?b.filter(i=>products.some(p=>p.id===i.id&&p.sizes.includes(i.size))&&Number.isInteger(i.qty)&&i.qty>0&&i.qty<100):[];}catch{return[];}});
const total=bag.reduce((n,i)=>n+i.qty,0);
useEffect(()=>{try{localStorage.setItem('seven-bag-v2',JSON.stringify(bag));}catch{}},[bag]);
useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2800);return()=>clearTimeout(t);},[toast]);
useEffect(()=>{if(booted)window.__VANTA_BOOTED=true;},[booted]);
const prevFilter=useRef(null);
useEffect(()=>{if(!booted)return;const changed=prevFilter.current!==null&&prevFilter.current!==filter;prevFilter.current=filter;const cards=document.querySelectorAll('.product-card:not([hidden])');if(changed&&cards.length)gsap.fromTo(cards,{opacity:0,y:26},{opacity:1,y:0,duration:.55,stagger:.07,ease:'power3.out',clearProps:'opacity,transform'});const t=setTimeout(()=>ScrollTrigger.refresh(),90);return()=>clearTimeout(t);},[filter,booted]);
useEffect(()=>{
 if(!motion||!app.current)return;
 const node=app.current;
 const pick=e=>e.target.closest?.('.filter,.email-row button,.product-card');
 const over=e=>{const t=pick(e);if(!t||t.contains(e.relatedTarget))return;const card=t.classList.contains('product-card');gsap.to(t,{scale:card?.985:.95,duration:.22,ease:'power2.out',overwrite:'auto'});};
 const out=e=>{const t=pick(e);if(!t||(e.relatedTarget&&t.contains(e.relatedTarget)))return;gsap.to(t,{scale:1,duration:.75,ease:'elastic.out(1,.42)',overwrite:'auto'});};
 node.addEventListener('pointerover',over,{passive:true});
 node.addEventListener('pointerout',out,{passive:true});
 return()=>{node.removeEventListener('pointerover',over);node.removeEventListener('pointerout',out);};
},[motion]);
useEffect(()=>{if(modal){dialog.current?.showModal();lenisRef.current?.stop();document.body.style.overflow='hidden';}else{dialog.current?.close();lenisRef.current?.start();document.body.style.overflow='';}return()=>{document.body.style.overflow='';};},[modal]);
useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setMotion(!m.matches);m.addEventListener('change',change);return()=>m.removeEventListener('change',change);},[]);
useEffect(()=>{const scroll=()=>setScrolled(window.scrollY>40);window.addEventListener('scroll',scroll,{passive:true});const move=e=>{pointer.current={x:e.clientX/innerWidth*2-1,y:1-e.clientY/innerHeight*2};};window.addEventListener('pointermove',move,{passive:true});const observer=new IntersectionObserver(([entry])=>setSceneActive(entry.isIntersecting),{rootMargin:'100px'});if(hero.current)observer.observe(hero.current);return()=>{window.removeEventListener('scroll',scroll);window.removeEventListener('pointermove',move);observer.disconnect();};},[page]);
useEffect(()=>{if(!booted)return;let lenis,ctx,split,alive=true,tick;let timer;const splits=[];const run=async()=>{await document.fonts.ready;if(!alive)return;ctx=gsap.context(()=>{if(!motion){gsap.set('.reveal',{clearProps:'all'});return;}lenis=new Lenis({duration:1.05,smoothWheel:true,anchors:true,wheelMultiplier:.9});lenisRef.current=lenis;
const grid=document.querySelector('.collection-grid');const skewTo=grid?gsap.quickTo(grid,'skewY',{duration:.55,ease:'power3'}):null;const unskew=()=>skewTo&&skewTo(0);
const marquee=gsap.to('.ticker-track',{xPercent:-50,duration:22,ease:'none',repeat:-1});let marqueeTarget=1;
lenis.on('scroll',e=>{ScrollTrigger.update();if(skewTo)skewTo(clamp(e.velocity*.03,-2.6,2.6));if(Math.abs(e.velocity)<.01)unskew();marqueeTarget=1+Math.min(Math.abs(e.velocity)*.075,2.6);});
tick=t=>{lenis.raf(t*1000);marquee.timeScale(marquee.timeScale()+(marqueeTarget-marquee.timeScale())*.08);};gsap.ticker.add(tick);gsap.ticker.lagSmoothing(0);
split=SplitText.create('.hero-title',{type:'chars,words',aria:'none',charsClass:'hero-char',wordsClass:'hero-word'});gsap.fromTo(split.chars,{yPercent:110,rotate:3,opacity:0},{yPercent:0,rotate:0,opacity:1,duration:1.25,ease:'power4.out',stagger:.027,delay:.55});
if(page==='home')gsap.to(split.chars,{x:()=>gsap.utils.random(-150,150),y:()=>gsap.utils.random(-210,40),rotation:()=>gsap.utils.random(-48,48),opacity:0,stagger:{each:.014,from:'random'},ease:'power2.in',immediateRender:false,invalidateOnRefresh:true,scrollTrigger:{trigger:'.hero',start:'38% top',end:'bottom top',scrub:1.1}});if(page==='home')gsap.fromTo('.hero-hud,.hero-description,.hero-content .button,.hero-bottom',{opacity:0,y:18},{opacity:1,y:0,duration:.9,delay:1.15,stagger:.08,ease:'power3.out'});
gsap.utils.toArray('.mask-reveal').forEach(el=>{const words=SplitText.create(el,{type:'words',mask:'words'});splits.push(words);gsap.fromTo(words.words,{yPercent:118},{yPercent:0,duration:.95,ease:'power4.out',stagger:.05,scrollTrigger:{trigger:el,start:'top 86%',once:true}});});
gsap.utils.toArray('.card-media,.note-image').forEach(media=>{gsap.fromTo(media,{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0 0 0% 0)',duration:1.15,ease:'power4.out',scrollTrigger:{trigger:media,start:'top 88%',once:true}});});
if(page==='home'){if(hero.current)ScrollTrigger.create({trigger:hero.current,start:'top top',end:'bottom top',onUpdate:self=>{sceneProgress.current=self.progress;}});gsap.to('.hero-content',{y:-80,opacity:.25,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});
}gsap.utils.toArray('.reveal').forEach(el=>gsap.fromTo(el,{y:45,opacity:0},{y:0,opacity:1,duration:.95,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 90%',once:true}}));gsap.utils.toArray('.card-media img').forEach(img=>gsap.fromTo(img,{scale:1.08,yPercent:4},{scale:1,yPercent:-4,ease:'none',scrollTrigger:{trigger:img.parentElement,start:'top bottom',end:'bottom top',scrub:1}}));if(page==='home'){gsap.fromTo('.manifesto-title',{x:-24},{x:24,ease:'none',scrollTrigger:{trigger:'.manifesto',start:'top bottom',end:'bottom top',scrub:1.5}});gsap.to('.wire-globe',{rotate:24,ease:'none',scrollTrigger:{trigger:'.manifesto',start:'top bottom',end:'bottom top',scrub:1.3}});gsap.fromTo('.community-heading h2 span',{color:'rgba(199,255,0,0)',webkitTextStroke:'1px rgba(151,162,142,.85)'},{color:'#c7ff00',webkitTextStroke:'1px rgba(199,255,0,0)',ease:'none',scrollTrigger:{trigger:'.community-section',start:'top 78%',end:'center 48%',scrub:1}});
}},app);timer=setTimeout(()=>ScrollTrigger.refresh(),350);};run();return()=>{alive=false;clearTimeout(timer);split?.revert();splits.forEach(s=>s.revert());ctx?.revert();if(tick)gsap.ticker.remove(tick);lenis?.destroy();lenisRef.current=null;};},[page,motion,booted]);
useEffect(()=>()=>{clearTimeout(soundTimer.current);sound.current?.unload();},[]);
useEffect(()=>{if(!menu)return;document.body.classList.add('menu-open');lenisRef.current?.stop();const nav=app.current.querySelector('.mobile-nav');nav?.querySelector('a')?.focus();const key=e=>{if(e.key==='Escape'){setMenu(false);app.current.querySelector('.menu-toggle')?.focus();}if(e.key==='Tab'){const nodes=[...nav.querySelectorAll('a,button'),app.current.querySelector('.menu-toggle')];const index=nodes.indexOf(document.activeElement);if(e.shiftKey&&index===0){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&index===nodes.length-1){e.preventDefault();nodes[0]?.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.classList.remove('menu-open');lenisRef.current?.start();document.removeEventListener('keydown',key);};},[menu]);
function toggleSound(){clearTimeout(soundTimer.current);if(!sound.current)sound.current=new Howl({src:['/assets/signal.wav'],loop:true,volume:.13,html5:false});if(soundOn){sound.current.fade(.13,0,250);soundTimer.current=setTimeout(()=>sound.current?.pause(),270);}else{sound.current.volume(0);sound.current.play();sound.current.fade(0,.13,500);}setSoundOn(!soundOn);}
function openProduct(p){setSize(p.sizes[0]);setModal({type:'product',product:p});}
function addItem(){const p=modal.product;setBag(old=>{const item=old.find(i=>i.id===p.id&&i.size===size);return item?old.map(i=>i===item?{...i,qty:Math.min(99,i.qty+1)}:i):[...old,{id:p.id,size,qty:1}];});setModal(null);setToast('已加入你的城市装备 / SYSTEM UPDATED');}
function subscribe(e){e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;try{localStorage.setItem('seven-newsletter-preview',new FormData(form).get('email').trim());setStatus('订阅体验已保存。正式通讯尚未上线。');form.reset();}catch{setStatus('浏览器未允许本地保存，请检查存储设置。');}}
function magnetic(e){if(!motion||matchMedia('(pointer: coarse)').matches)return;const el=e.currentTarget,r=el.getBoundingClientRect();if(!el.__magnetized){el.__magnetized=true;el.style.transitionProperty='color, background-color, border-color, box-shadow';el.style.transitionDuration='.25s';}gsap.to(el,{x:(e.clientX-r.left-r.width/2)*.12,y:(e.clientY-r.top-r.height/2)*.14,duration:.4,ease:'power2.out'});}
function unmagnet(e){gsap.to(e.currentTarget,{x:0,y:0,duration:.6,ease:'elastic.out(1,.5)'});}
const home=page==='home';
const onBooted=useCallback(()=>setBooted(true),[]);
return <div ref={app} className={`site ${home?'':'notes-page'}`}>
<a className="skip-link" href={home?'#collections':'#notes'}>跳至主要内容</a>
{createPortal(<Cursor/>,document.body)}
{showLoader&&<Loader onDone={onBooted}/>}
<div className="announcement"><span><i/> NEW SEASON. NEW SYSTEM.</span><span>VANTA® — FIELD EQUIPMENT / VOL. 01</span></div>
<header className={`site-header ${scrolled?'scrolled':''}`}><a className="wordmark" href="/" aria-label="VANTA 首页">VANTA<sup>®</sup></a><nav aria-label="主导航"><a className="nav-link" href={home?'#collections':'/#collections'} data-barba-prevent>COLLECTIONS <span>系列</span></a><a className="nav-link" href={home?'#code':'/#code'} data-barba-prevent>OUR CODE <span>品牌理念</span></a><a className="nav-link" href={home?'#equipment':'/#equipment'} data-barba-prevent>EQUIPMENT <span>装备</span></a><a className="nav-link" href="/field-notes.html">FIELD NOTES <span>手记</span></a></nav><div className="header-tools"><button className={`sound-toggle ${soundOn?'on':''}`} aria-label={soundOn?'关闭环境音':'开启环境音'} aria-pressed={soundOn} onClick={toggleSound}><span className="sound-bars"><i/><i/><i/><i/></span><span>SOUND {soundOn?'ON':'OFF'}</span></button><button className="bag-button" onClick={()=>setModal({type:'bag'})} aria-label={`打开购物袋，${total} 件商品`}>BAG <span>[{total.toString().padStart(2,'0')}]</span></button><button className="menu-toggle" onClick={()=>setMenu(!menu)} aria-expanded={menu} aria-label={menu?'关闭导航':'打开导航'}>{menu?'×':'☰'}</button></div></header>
{menu&&<nav className="mobile-nav" aria-label="移动导航"><a href={home?'#collections':'/#collections'} onClick={()=>setMenu(false)} data-barba-prevent>COLLECTIONS / 系列</a><a href={home?'#code':'/#code'} onClick={()=>setMenu(false)} data-barba-prevent>OUR CODE / 理念</a><a href={home?'#equipment':'/#equipment'} onClick={()=>setMenu(false)} data-barba-prevent>EQUIPMENT / 装备</a><a href="/field-notes.html" onClick={()=>setMenu(false)}>FIELD NOTES / 手记</a><button onClick={toggleSound}>环境音 {soundOn?'关闭':'开启'}</button></nav>}
{home?<main>
<section className={`hero ${sceneReady?'scene-ready':''}`} ref={hero} aria-labelledby="hero-title"><div className="hero-webgl" aria-hidden="true"><SceneBoundary><Suspense fallback={null}><Scene progress={sceneProgress} pointer={pointer} active={sceneActive} reducedMotion={!motion} onReady={setSceneReady} intensity={controls.intensity}/></Suspense></SceneBoundary></div><div className="hero-grain" aria-hidden="true"/><div className="hero-hud"><span className="hero-hud-left"><b>+</b> DESIGNED FOR THE NEXT.</span><span className="hero-hud-right">SYSTEM ONLINE <i/> / 25°02′ N 121°33′ E</span></div><div className="hero-content"><p className="eyebrow">NXT UTILITY / COLLECTION 01</p><h1 className="hero-title" id="hero-title" aria-label="NXT IS LOADED."><span className="line">NXT <span className="outline">IS</span></span><span className="line"><span className="word">LOADED.</span></span></h1><p className="hero-description">为城市而生。为未知而进化。<br/><span>FORM. FUNCTION. FREEDOM.</span></p><a className="button button-primary" href="#collections" onPointerMove={magnetic} onPointerLeave={unmagnet}>探索全新系列 <span>↗</span></a></div><span className="hero-side">V—01 / URBAN PROTECTION SYSTEM</span><div className="hero-bottom"><div className="hero-index"><strong>01</strong><span>/ 04</span><i/></div><span className="hero-coordinate">THE NXT STARTS AT STREET LEVEL.</span><a className="hero-scroll" href="#collections">SCROLL TO EXPLORE <span>↓</span></a></div></section>
<div className="ticker" aria-hidden="true"><div className="ticker-track">NXT IS LOADED <span>✳</span> BUILT FOR THE UNKNOWN <span>✳</span> FORM / FUNCTION / FREEDOM <span>✳</span> NXT IS LOADED <span>✳</span> BUILT FOR THE UNKNOWN <span>✳</span> FORM / FUNCTION / FREEDOM <span>✳</span> </div></div>
<section className="benefits" aria-label="品牌设计理念">{[['TECHNICAL FABRICS','机能面料，适应城市日常'],['LIMITED BY DESIGN','限定设计，表达独立态度'],['BEYOND BORDERS','无界视野，连接全球街头']].map(([title,text],i)=><div className="benefit reveal" key={title}><FeatureIcon type={i}/><div><h2>{title}</h2><p>{text}</p></div><span>0{i+1}</span></div>)}</section>
<section className="collection-section" id="collections"><div className="section-number"><span>+ 02 / THE COLLECTIONS</span><span>FIELD TESTED. NXT READY.</span></div><div className="section-heading reveal"><div><p className="heading-kicker">YOUR EVERYDAY, RE-ENGINEERED.</p><h2 className="mask-reveal">CHOOSE YOUR<br/><span>NEXT MOVE.</span></h2></div><p className="section-description">不被环境定义。<br/>以功能为语言，重新表达自我。</p></div><div className="filters" role="group" aria-label="系列筛选">{[['all','全部系列'],...products.map(p=>[p.id,p.category])].map(([id,label])=><button key={id} className={`filter ${filter===id?'active':''}`} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}{id==='all'&&<sup>03</sup>}</button>)}<span className="filter-count" aria-live="polite">{filter==='all'?'01—03':'01—01'}</span></div><div className="collection-grid">{products.map((p,i)=><button className={`product-card card-${i+1}`} key={p.id} data-cursor="VIEW" onClick={()=>openProduct(p)} hidden={filter!=='all'&&filter!==p.id} aria-label={`探索${p.zh} ${p.name}`}><div className="card-media"><img src={asset(p.id)} alt={p.zh+' — 黑色机能装备'} loading="lazy"/><span className="card-index">0{i+1}</span><span className="card-tag">{p.code} / BLACK</span><div className="card-overlay"/><span className="card-title">{i===0?'OUTERWEAR':i===1?'CARGO SYSTEM':'DAILY UTILITY'}</span><span className="card-arrow">↗</span></div><div className="card-info"><div><span className="card-name">{p.zh}</span><p className="card-caption">{p.caption}</p></div><span>EXPLORE ↗</span></div></button>)}</div></section>
<section className="manifesto" id="code"><span className="manifesto-watermark" aria-hidden="true">THE CODE</span><div className="manifesto-top"><span>+ 03 / THE VANTA CODE</span><span>NO BORDERS. NO LIMITS.</span></div><h2 className="manifesto-title">BEYOND<br/><span>THE EXPECTED.</span></h2><div className="manifesto-layout"><div className="manifesto-copy reveal"><p className="eyebrow">THE CITY IS YOUR TESTING GROUND.</p><h3>未来不是等待。<br/>是此刻的选择。</h3><p>在秩序与未知之间，找到自己的行动方式。<br/>我们用结构、材质与功能，回应城市的每一种可能。<br/>VANTA，把机能穿进日常。</p><div className="manifesto-stats"><span><b>03</b>装备系统</span><span><b>100%</b>概念设计</span><span><b>24/7</b>城市响应</span></div><a className="field-link" href="/field-notes.html">探索设计手记 <span>↗</span></a></div><div className="globe-wrap"><WireGlobe/><Suspense fallback={null}><HoloGlobe/></Suspense><span>25°02′ N / 121°33′ E<br/>VANTA WORLDWIDE — SIGNAL ACTIVE</span></div></div></section>
<section className="gear-section" id="equipment"><GearInspection motion={motion}/><div className="gear-copy reveal"><p className="eyebrow">THE DETAILS MAKE THE DIFFERENCE.</p><h2 className="mask-reveal">SMALL GEAR.<br/>BIG <span>ENERGY.</span></h2><p>每一条织带，每一处扣具，都为行动而存在。<br/>将日常必需，收进你的城市装备。</p><button className="button button-outline" onClick={()=>openProduct(products[2])} onPointerMove={magnetic} onPointerLeave={unmagnet}>探索随行配饰 <span>↗</span></button><div className="gear-specs"><span>01 / MODULAR FORM</span><span>02 / EVERYDAY FUNCTION</span></div></div></section>
<section className="community-section" id="community"><div className="community-heading reveal"><p className="eyebrow">+ 04 / JOIN THE SIGNAL</p><h2 className="mask-reveal">STAY AHEAD.<br/>STAY <span>VANTA.</span></h2><p>新系列、独家内容与街头灵感。<br/>与下一种可能，保持连接。</p></div><form className="subscribe-form" onSubmit={subscribe}><label htmlFor="email">加入 VANTA 通讯 / JOIN THE SIGNAL</label><div className="email-row"><input id="email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="输入你的电子邮箱" required/><button aria-label="提交订阅体验" type="submit">↗</button></div><p className="form-note">概念预览：邮箱仅保存在本机，不会发送邮件。</p><p className="status-message" role="status">{status}</p></form></section>
</main>:<main className="field-notes" id="notes"><div className="notes-intro"><span className="notes-watermark" aria-hidden="true">FN—01</span><p className="eyebrow">VANTA / FIELD NOTES — VOL. 01</p><h1 className="hero-title" aria-label="FUNCTION IS A FORM."><span className="line">FUNCTION</span><span className="line">IS <span className="word">A FORM.</span></span></h1><p>结构即表达。功能即态度。</p><a className="field-link" href="/">RETURN TO THE SYSTEM <span>↗</span></a></div>{products.map((p,i)=><section className="note-chapter" key={p.id}><div className="note-image"><img src={asset(p.id)} alt={p.zh} loading={i===0?'eager':'lazy'}/><span>{p.code}</span></div><div className="note-copy reveal"><p className="eyebrow">FIELD NOTE / 0{i+1}</p><h2>{['PROTECT.','MOVE.','CARRY.'][i]}</h2><h3>{p.zh}</h3><p>{p.description}</p><button className="button button-outline" onClick={()=>openProduct(p)}>查看装备 <span>↗</span></button></div></section>)}</main>}
<footer className="footer"><div className="footer-main"><a className="wordmark" href="/">VANTA<sup>®</sup></a><p>NXT IS NOT A DESTINATION.<br/>IT'S WHAT YOU WEAR TODAY.</p><div className="footer-links"><a href={home?'#collections':'/#collections'} data-barba-prevent>探索系列 ↗</a><a href="/field-notes.html">设计手记 ↗</a><button onClick={()=>setModal({type:'info',id:'contact'})}>联系我们 ↗</button></div><div className="footer-links"><button onClick={()=>setModal({type:'info',id:'shipping'})}>配送与退换 ↗</button><button onClick={()=>setModal({type:'info',id:'privacy'})}>隐私说明 ↗</button><a href={home?'#community':'/#community'} data-barba-prevent>加入社群 ↗</a></div></div><div className="footer-bottom"><span>© 2026 VANTA — BRAND CONCEPT / AI VISUALS</span><span className="barcode" aria-hidden="true"/><button className="motion-preference" aria-pressed={!motion} onClick={()=>setMotion(!motion)}>{motion?'减少动态效果':'启用动态效果'}</button><a href="#">BACK TO TOP ↑</a></div></footer>
<dialog className={`modal ${modal?.type==='product'?'modal-product':''}`} ref={dialog} onCancel={()=>setModal(null)} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setModal(null);}}} aria-label={modal?.type==='product'?modal.product.name:modal?.type==='bag'?'购物袋':'信息说明'}><button className="dialog-close" aria-label="关闭弹窗" onClick={()=>setModal(null)}>×</button>{modal?.type==='product'?<><img className="modal-image" src={asset(modal.product.id)} alt={modal.product.zh}/><div className="modal-content"><p className="eyebrow">{modal.product.code} / BLACK</p><h2 className="product-title">{modal.product.name}</h2><p className="product-description">{modal.product.description}</p><p className="form-note">概念单品 / 设计预览</p><fieldset className="size-options"><legend>选择尺码</legend>{modal.product.sizes.map(s=><label className="size-choice" key={s}><input name="size" type="radio" checked={size===s} onChange={()=>setSize(s)}/><span>{s}</span></label>)}</fieldset><button className="button button-primary" onClick={addItem}>加入购物袋 <span>↗</span></button><p className="form-note">体验购物袋，实际下单与付款尚未开放。</p></div></>:modal?.type==='bag'?<div className="modal-content"><p className="eyebrow">YOUR EVERYDAY SYSTEM</p><h2 className="product-title">YOUR BAG.</h2><div className="bag-items">{bag.length?bag.map((i,index)=>{const p=products.find(p=>p.id===i.id);return <div className="bag-row" key={p.id+i.size}><img src={asset(p.id)} alt={p.zh}/><div><h3>{p.name}</h3><p>{i.size} / BLACK / 数量 {i.qty}</p></div><button aria-label={`移除 ${p.name} ${i.size}`} onClick={()=>setBag(b=>b.filter((_,n)=>n!==index))}>移除 ×</button></div>}):<p className="empty-state">你的购物袋还没有装备。<br/>探索系列，找到你的下一步。</p>}</div><p className="form-note">概念预览 · 已选装备仅保存在本机。</p><button className="button button-primary" onClick={()=>setModal(null)}>继续探索 <span>↗</span></button></div>:modal?.type==='info'?<div className="modal-content"><p className="eyebrow">VANTA / INFORMATION</p><h2>{infos[modal.id][0]}</h2><p className="product-description">{infos[modal.id][1]}</p></div>:null}</dialog><div className={`toast ${toast?'visible':''}`} role="status">{toast}</div>
{location.search.includes('debug')&&<Suspense fallback={null}><Debug onChange={setControls}/></Suspense>}
</div>;
}
