import React from 'react';
import {createRoot} from 'react-dom/client';
import barba from '@barba/core';
import {gsap} from 'gsap';
import App from './App.jsx';
import './styles.css';
import './integration.css';

let root;
function mount(container,namespace){root=createRoot(container.querySelector('#app'));root.render(<App page={namespace||'home'}/>);}
const initialContainer=document.querySelector('[data-barba="container"]');
if(initialContainer){mount(initialContainer,initialContainer.dataset.barbaNamespace);}
else{const fallback=document.createElement('div');fallback.setAttribute('data-barba','container');fallback.dataset.barbaNamespace='home';fallback.innerHTML='<div id="app"></div>';document.body.prepend(fallback);mount(fallback,'home');}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const curtain=document.createElement('div');
curtain.className='transition-layer';
curtain.innerHTML='<span class="transition-mark" aria-hidden="true">VANTA<sup>®</sup></span>';
document.body.appendChild(curtain);
const mark=curtain.querySelector('.transition-mark');
barba.init({timeout:8000,prevent:({el})=>el.hasAttribute('data-barba-prevent')||el.getAttribute('href')?.startsWith('#'),transitions:[{name:'signal-dissolve',async leave({current}){if(reduced()){root?.unmount();return;}await gsap.timeline().set(curtain,{yPercent:101,opacity:1}).to(curtain,{yPercent:0,duration:.5,ease:'power4.inOut'}).to(mark,{opacity:1,duration:.18},'-=.22');root?.unmount();},beforeEnter({next}){window.scrollTo(0,0);mount(next.container,next.namespace);},async enter({next}){if(reduced()){gsap.fromTo(next.container,{opacity:0},{opacity:1,duration:.4});return;}await gsap.timeline({onComplete(){gsap.set(curtain,{opacity:0,yPercent:101});}}).to(mark,{opacity:1,duration:.2}).to(next.container,{opacity:1,duration:.01},'<').to(curtain,{yPercent:-101,duration:.75,ease:'power4.inOut'}).to(mark,{opacity:0,duration:.12},'-=.5');}}]});
