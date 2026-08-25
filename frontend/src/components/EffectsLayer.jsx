/**
 * EffectsLayer.jsx
 * Reverse Mask Video & Animated Effects Engine for Krajden Grid
 * 
 * Features:
 * - Dynamic Reverse Mask Revealer: reveals animated video/GIF/textures beneath the tabletop.
 * - 4 Powerful Mask Tools:
 *     1. Brush: Freehand smooth painting brush with round caps & adjustable size.
 *     2. Marquee: Rectangular selection window.
 *     3. Bezier: Flowing curved vector path.
 *     4. Eraser: Erases from the mask (restores normal background).
 * - Video Tiling: Seamlessly repeat video as a tiled pattern with controllable tile scale (25% - 300%) or stretch across bounds.
 * - Built-in High Quality Video & Animated Presets (Lava, River Water, Arcane Portal, Toxic Acid, Blizzard, Firestorm, Void).
 * - Real-time Live Drawing Feedback: See the glowing animated video as you drag.
 * - Firebase Firestore synchronization & local caching.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useGrid } from '../context/GridContext';
import { subscribeEffects, saveEffectToFirebase, deleteEffectFromFirebase } from '../lib/firebase';

// ── Local Effect Storage (IndexedDB via localStorage for large files) ────────
// Stores effects locally — no size limit, no server, works offline.
// Effects are keyed by id and stored as base64 data URLs.

const LOCAL_EFFECTS_KEY = 'krajden_local_effects';

function getLocalEffects() {
  try {
    const raw = localStorage.getItem(LOCAL_EFFECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(_) { return []; }
}

function saveLocalEffect(effect) {
  try {
    const effects = getLocalEffects().filter(e => e.id !== effect.id);
    effects.unshift(effect);
    // Store metadata separately from data URL to avoid quota issues
    localStorage.setItem(LOCAL_EFFECTS_KEY, JSON.stringify(effects.map(e => ({ ...e, url: undefined, imageUrl: undefined }))));
    // Store data URL separately keyed by id
    if (effect.url || effect.imageUrl) {
      localStorage.setItem(`effect_asset_${effect.id}`, effect.url || effect.imageUrl);
    }
    return true;
  } catch(e) {
    // localStorage quota exceeded — try IndexedDB via sessionStorage
    try {
      sessionStorage.setItem(`effect_asset_${effect.id}`, effect.url || effect.imageUrl);
      return true;
    } catch(_) { return false; }
  }
}

function deleteLocalEffect(id) {
  try {
    const effects = getLocalEffects().filter(e => e.id !== id);
    localStorage.setItem(LOCAL_EFFECTS_KEY, JSON.stringify(effects));
    localStorage.removeItem(`effect_asset_${id}`);
    sessionStorage.removeItem(`effect_asset_${id}`);
  } catch(_) {}
}

function getLocalEffectUrl(id) {
  return localStorage.getItem(`effect_asset_${id}`)
      || sessionStorage.getItem(`effect_asset_${id}`)
      || null;
}

// ── Static SVG Splatter Presets ───────────────────────────────────────────────
// Simple blob splats — no drips, no animation, just paint marks

function makeSplatSvg(color1, color2, count = 12, seed = 0) {
  const rng = (n) => { let x = Math.sin(n + seed) * 43758.5453; return x - Math.floor(x); };
  let blobs = '';
  for (let i = 0; i < count; i++) {
    const cx = 10 + rng(i * 7 + 1) * 80;
    const cy = 10 + rng(i * 7 + 2) * 80;
    const rx = 3 + rng(i * 7 + 3) * 14;
    const ry = 2 + rng(i * 7 + 4) * 10;
    const rot = rng(i * 7 + 5) * 360;
    const alpha = 0.6 + rng(i * 7 + 6) * 0.4;
    const c = rng(i * 7) > 0.5 ? color1 : color2;
    blobs += `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${c}" opacity="${alpha.toFixed(2)}" transform="rotate(${rot.toFixed(1)},${cx.toFixed(1)},${cy.toFixed(1)})"/>`;
    // Small satellite dots
    for (let j = 0; j < 3; j++) {
      const dx = cx + (rng(i*21+j*3)*30-15), dy = cy + (rng(i*21+j*3+1)*30-15);
      const dr = 0.8 + rng(i*21+j*3+2) * 3;
      blobs += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${dr.toFixed(1)}" fill="${c}" opacity="${(alpha*0.7).toFixed(2)}"/>`;
    }
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">${blobs}</svg>`)}`;
}

const STATIC_BLOOD_SPLAT_URL = makeSplatSvg('#8b0000', '#cc0000', 14, 42);
const STATIC_ACID_SPLAT_URL  = makeSplatSvg('#4a7c00', '#88cc00', 12, 17);
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { toast } from 'sonner';
import {
  Sparkles, Flame, Droplets, Compass, Zap, Shield, Eye, EyeOff,
  Trash2, Undo, Plus, Upload, Play, Pause, Grid, Layers, RefreshCw,
  Maximize2, Crop, Move, Sliders, Check
} from 'lucide-react';

// ── Built-in High Performance Animated Shader/SVG Vector Presets ─────────────

// ── Effect Categories ─────────────────────────────────────────────────────
// FLOW effects follow a drawn path (rivers, streams, lava flows)
// AREA effects fill a painted region (fire, fog, poison, splatter)
export const FLOW_EFFECTS = new Set([
  'river', 'lava_river', 'mud_river', 'blood_stream', 'acid_stream', 'water_stream',
  'shader_lava_river', 'shader_mud_river',
]);
export const AREA_EFFECTS = new Set([
  'fire', 'fog', 'poison', 'ice', 'lightning', 'firefly', 'wind', 'smoke',
  'blood_splatter', 'acid_splatter', 'arcane',
  'shader_fire', 'shader_ice', 'shader_lightning', 'shader_poison',
  'shader_fog', 'shader_firefly', 'shader_wind', 'shader_smoke',
  'shader_blood_splatter', 'shader_acid_splatter', 'shader_arcane',
]);

export function getEffectMode(effect) {
  if (!effect) return 'area';
  const id = effect.id || '';
  const cat = (effect.category || '').toLowerCase();
  if (FLOW_EFFECTS.has(id) || cat === 'flow' || cat === 'river' || cat === 'stream') return 'flow';
  return 'area';
}

// ── WebGL Shader System ────────────────────────────────────────────────────
const SHADER_VERT = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() { v_uv = (a_pos + 1.0) * 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Each shader is distinct — different palettes, timing, and visual character
const SHADER_FRAGS = {

  // FIRE — chaotic high-frequency domain warp, ember-like sparks, orange-white core
  fire: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.6;for(int i=0;i<6;i++){v+=a*n(p);p*=2.3;a*=0.45;}return v;}
    float warp(vec2 p,float t){
      vec2 q=vec2(fbm(p+vec2(0,t*3.1)),fbm(p+vec2(5.2,1.3)+vec2(t*1.1,0)));
      vec2 r=vec2(fbm(p+4.*q+vec2(1.7,9.2)-vec2(0,t*3.0)),fbm(p+4.*q+vec2(8.3,2.8)-vec2(0,t*5.5)));
      return fbm(p+4.*r);
    }
    void main(){
      vec2 p=v_uv*u_res/180.;
      float w=warp(p,u_time);
      // Sparks: fast small noise
      float spark=n(v_uv*22.+vec2(u_time*8.,-u_time*12.))*0.18;
      w+=spark;
      float i=smoothstep(0.52,1.0,w);
      // Hot white core, deep crimson edges
      vec3 c=i<0.2?mix(vec3(0.35,0.0,0.0),vec3(1.0,0.2,0.0),i*5.)
              :i<0.5?mix(vec3(1.0,0.2,0.0),vec3(1.0,0.6,0.05),(i-0.2)/0.3)
              :i<0.8?mix(vec3(1.0,0.6,0.05),vec3(1.0,0.95,0.4),(i-0.5)/0.3)
              :mix(vec3(1.0,0.95,0.4),vec3(1.0,1.0,0.95),(i-0.8)/0.2);
      float a=step(0.52,w);
      gl_FragColor=vec4(c*a,a);
    }`,

  // ICE — crystalline facet pattern + slow warp, deep navy to bright cyan-white
  ice: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(443.9,441.4));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.1;a*=0.5;}return v;}
    // Voronoi for crystal facets
    float voronoi(vec2 p){
      vec2 g=floor(p);float m=9.;
      for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
        vec2 c=g+vec2(i,j);vec2 jt=vec2(h(c),h(c+33.1));
        m=min(m,length(p-c-jt));
      }return m;
    }
    void main(){
      vec2 p=v_uv*u_res/200.;float t=u_time*0.18;
      vec2 q=vec2(fbm(p+vec2(0,t*0.5)),fbm(p+vec2(3.1,0)+vec2(t*0.4,0)));
      float base=fbm(p+2.*q-vec2(0,t));
      float crystal=voronoi(v_uv*12.+vec2(t*0.3,0));
      float n=base*0.7+crystal*0.3;
      float shimmer=n(v_uv*20.+vec2(t*2.,0))*0.06;
      float i=smoothstep(0.28,0.85,n+shimmer);
      vec3 c=i<0.35?mix(vec3(0.02,0.05,0.22),vec3(0.1,0.4,0.8),i/0.35)
              :i<0.7?mix(vec3(0.1,0.4,0.8),vec3(0.5,0.85,1.0),(i-0.35)/0.35)
              :mix(vec3(0.5,0.85,1.0),vec3(0.92,0.97,1.0),(i-0.7)/0.3);
      float a=step(0.28,n);
      gl_FragColor=vec4(c*a,a);
    }`,

  // POISON — acid yellow-green bubbles rising through murky fluid
  poison: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(443.9,441.4));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.1;a*=0.5;}return v;}
    float bubble(vec2 uv,vec2 c,float r){return smoothstep(r,r*0.7,length(uv-c));}
    void main(){
      vec2 p=v_uv*u_res/200.;float t=u_time*0.9;
      // Murky fluid base
      float base=fbm(p*2.+vec2(t*0.3,-t*0.2));
      float swirl=fbm(p*3.+vec2(-t*0.5,t*0.4))*0.5;
      float fluid=base*0.6+swirl*0.4;
      // Rising bubbles
      float bubb=0.;
      for(float bi=0.;bi<8.;bi++){
        float bx=h(vec2(bi,0.))*0.8+0.1;
        float by=mod(h(vec2(bi,1.))+t*mix(0.12,0.28,h(vec2(bi,2.))),1.0);
        float br=0.03+h(vec2(bi,3.))*0.04;
        bubb+=bubble(v_uv,vec2(bx,by),br)*0.6;
      }
      float total=clamp(fluid+bubb,0.,1.);
      float i=smoothstep(0.25,0.75,total);
      // Yellow-green acid palette
      vec3 c=i<0.3?mix(vec3(0.03,0.12,0.02),vec3(0.3,0.65,0.05),i/0.3)
              :i<0.7?mix(vec3(0.3,0.65,0.05),vec3(0.7,0.95,0.1),(i-0.3)/0.4)
              :mix(vec3(0.7,0.95,0.1),vec3(0.95,1.0,0.5),(i-0.7)/0.3);
      float a=smoothstep(0.22,0.45,total);
      gl_FragColor=vec4(c*a,a);
    }`,

  // LIGHTNING — branching bolts, purple-white with afterglow
  lightning: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h1(float n){return fract(sin(n)*93758.5453);}
    float h2(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float seg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float t=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*t);}
    float bolt(vec2 uv,float id,float phase){
      vec2 o=vec2(h1(id*1.7),h1(id*2.3));
      float ang=h1(id*3.9)*6.2831;float lf=0.08+h1(id*4.1)*0.45;
      float md=1.;vec2 cur=o;
      // Main bolt
      for(int i=0;i<12;i++){
        float sp=float(i+1)/12.;
        float dev=(h1(id*11.+float(i))-0.5)*2.8;
        float sl=lf/12.*(0.6+h1(id*22.+float(i))*0.8);
        vec2 dir=normalize(vec2(cos(ang+dev),sin(ang+dev)));
        dir.x*=max(u_res.x,u_res.y)/max(u_res.x,1.);
        dir.y*=max(u_res.x,u_res.y)/max(u_res.y,1.);
        vec2 nxt=cur+dir*sl;
        if(sp<=phase){md=min(md,seg(uv,cur,nxt));}
        // Branch every 3 segments
        if(mod(float(i),3.)==0. && sp<=phase*0.7){
          vec2 bc=mix(cur,nxt,0.5);
          float bang=ang+1.2*(h1(id*33.+float(i))-0.5);
          vec2 bend=bc+vec2(cos(bang),sin(bang))*sl*0.5;
          md=min(md,seg(uv,bc,bend));
        }
        cur=nxt;
      }
      return md;
    }
    void main(){
      float t=u_time;vec3 col=vec3(0.);float alpha=0.;
      for(int b=0;b<10;b++){
        float id=float(b)*13.17;
        float cycle=2.5+h1(id+5.)*2.5;
        float phase=mod(t*0.8+h1(id+7.)*cycle,cycle)/cycle;
        if(phase>0.85) continue;
        float grow=min(phase*3.,1.);
        float fade=1.-smoothstep(0.5,0.85,phase);
        float d=bolt(v_uv,id,grow);
        float glow=exp(-d*80.)*0.7*fade;
        float core=exp(-d*300.)*fade;
        // Purple-white palette (distinct from original blue-white)
        vec3 c=mix(vec3(0.6,0.3,1.0),vec3(1.0,0.95,1.0),core);
        col+=c*glow;alpha=max(alpha,glow);
      }
      gl_FragColor=vec4(col,clamp(alpha,0.,1.));
    }`,

  // FOG — warm amber-grey fog with slow billowing, distinct from cold fog
  fog: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(443.9,441.4));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.;a*=0.5;}return v;}
    void main(){
      float t=u_time*0.5;
      vec2 uv=v_uv;uv.x*=u_res.x/max(u_res.y,1.);
      // Three overlapping fog layers at different speeds
      vec2 b1=uv*2.8;b1.x-=t*0.9;
      vec2 b2=uv*3.5+vec2(7.3,2.1);b2.x-=t*0.6;
      vec2 b3=uv*1.8+vec2(13.7,8.4);b3.x+=t*0.4;
      float layer1=fbm(b1+vec2(t*0.1,t*0.07));
      float layer2=fbm(b2+vec2(-t*0.08,t*0.05));
      float layer3=fbm(b3+vec2(t*0.06,-t*0.09));
      float cloud=layer1*0.5+layer2*0.35+layer3*0.15;
      float pulse=sin(fbm(uv*2.+vec2(t*0.4))*6.+t*0.8)*0.5+0.5;
      cloud*=(0.7+pulse*0.5);
      float a=smoothstep(0.32,0.56,cloud)*0.82;
      // Warm amber-grey (tavern smoke, dungeon haze)
      vec3 c=mix(vec3(0.55,0.5,0.44),vec3(0.82,0.77,0.68),smoothstep(0.32,0.7,cloud));
      gl_FragColor=vec4(c,a);
    }`,

  // FIREFLIES — multicolor orbs (gold/blue/green mix), slower fade
  firefly: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(float n){return fract(sin(n)*43758.5453123);}
    vec2 h2(float n){return vec2(h(n),h(n+17.37));}
    vec2 orbit(float s,float t){
      float sa=mix(0.2,0.7,h(s+10.));float sb=mix(0.15,0.5,h(s+20.));
      float aa=t*sa+h(s+30.)*6.283;float ab=t*sb+h(s+40.)*6.283;
      return vec2(cos(aa),sin(aa))*0.6+vec2(cos(ab*0.73),sin(ab*1.21))*0.4;
    }
    void main(){
      vec2 uv=v_uv;vec3 col=vec3(0.);float alpha=0.;
      vec2 asp=u_res.x>u_res.y?vec2(u_res.x/u_res.y,1.):vec2(1.,u_res.y/u_res.x);
      for(float i=0.;i<40.;i++){
        float s=i*19.713;
        vec2 pos=h2(s)+orbit(s,u_time*mix(0.3,0.7,h(s+9.)))*0.08;
        if(pos.x<0.||pos.x>1.||pos.y<0.||pos.y>1.) continue;
        float sz=0.005*mix(0.5,1.5,h(s+5.5));
        float d=distance(uv*asp,pos*asp);
        float fade=sin(u_time*mix(0.2,0.6,h(s+44.))+h(s+55.)*6.283)*0.5+0.5;
        float glow=smoothstep(sz*5.,0.,d)*fade;
        float core=smoothstep(sz,0.,d)*fade;
        // Color varies per firefly: gold, blue, green
        float ci=h(s+77.);
        vec3 fc=ci<0.33?mix(vec3(1.,0.85,0.2),vec3(1.,1.,0.6),core)
                :ci<0.66?mix(vec3(0.2,0.5,1.),vec3(0.6,0.8,1.),core)
                :mix(vec3(0.2,0.9,0.3),vec3(0.7,1.,0.5),core);
        col+=fc*glow;alpha=max(alpha,glow*0.9);
      }
      gl_FragColor=vec4(col,clamp(alpha,0.,1.));
    }`,

  // WIND — rain streaks mixed with wind lines, blue-grey tint
  wind: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(443.9,441.4));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.5;for(int i=0;i<3;i++){v+=a*n(p);p*=2.;a*=0.5;}return v;}
    void main(){
      float t=u_time*1.8;
      vec2 uv=v_uv;uv.x*=u_res.x/max(u_res.y,1.);
      // Wind streaks (diagonal)
      float row=uv.y*28.-uv.x*0.3;
      float rid=floor(row);float rf=fract(row);
      float rh=h(vec2(rid,0.));
      float xs=uv.x*2.+uv.y*0.4-t*(1.+rh*0.7)-rh*8.;
      float sid=floor(xs);float sf=fract(xs);
      float sh=h(vec2(rid,sid));
      float line=step(0.8,sh);
      float sl=0.7+h(vec2(rid,sid+7.))*0.9;
      float tx=smoothstep(0.,sl*0.4,sf)*smoothstep(1.,1.-sl*0.4,sf);
      float thick=0.08+h(vec2(rid,sid+23.))*0.1;
      float ty=smoothstep(0.5-thick,0.5,rf)*smoothstep(0.5+thick,0.5,rf);
      float fade=sin(t*mix(0.6,1.4,h(vec2(rid,sid+41.)))+h(vec2(rid,sid+31.))*6.28)*0.5+0.5;
      float la=line*tx*ty*fade*0.45;
      // Rain drops (short vertical streaks)
      float rx=(uv.x+uv.y*0.1)*40.;
      float ry=(uv.y-u_time*0.9)*60.;
      float rdrop=step(0.92,h(vec2(floor(rx),floor(ry))))*smoothstep(0.,0.3,fract(ry))*smoothstep(1.,0.7,fract(ry))*0.35;
      float total=clamp(la+rdrop,0.,1.);
      gl_FragColor=vec4(0.75,0.82,0.95,total);
    }`,

  // SMOKE — dark grey rolling clouds, slower than fog, more opaque
  smoke: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(443.9,441.4));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.55;for(int i=0;i<5;i++){v+=a*n(p);p*=2.1;a*=0.48;}return v;}
    void main(){
      float t=u_time*0.3;
      vec2 uv=v_uv;uv.x*=u_res.x/max(u_res.y,1.);
      vec2 q=vec2(fbm(uv*2.5+vec2(t*0.4,0.)),fbm(uv*2.5+vec2(0.,t*0.3)));
      float cloud=fbm(uv*2.+3.*q-vec2(t*0.5,0.));
      float billow=fbm(uv*4.+vec2(t*0.2,-t*0.15))*0.4;
      float total=cloud*0.65+billow*0.35;
      float a=smoothstep(0.38,0.62,total)*0.9;
      vec3 c=mix(vec3(0.12,0.12,0.13),vec3(0.42,0.40,0.41),smoothstep(0.38,0.75,total));
      gl_FragColor=vec4(c,a);
    }`,

  // BLOOD SPLATTER — dark red splatter pattern with drip edges
  blood_splatter: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.6;for(int i=0;i<4;i++){v+=a*n(p);p*=2.5;a*=0.4;}return v;}
    float splat(vec2 uv,vec2 c,float r,float seed){
      float d=length((uv-c)*vec2(1.+h(vec2(seed,1.))*0.6,1.+h(vec2(seed,2.))*0.4));
      float edge=fbm(normalize(uv-c)*4.+vec2(seed))*0.3;
      return smoothstep(r+edge,r*0.5,d);
    }
    void main(){
      vec2 uv=v_uv;float total=0.;
      // Static splatter pattern (no time animation — blood stays)
      for(float i=0.;i<12.;i++){
        vec2 c=vec2(h(vec2(i,0.)),h(vec2(i,1.)));
        float r=0.04+h(vec2(i,2.))*0.12;
        total+=splat(uv,c,r,i)*mix(0.6,1.,h(vec2(i,3.)));
      }
      // Drip streaks
      for(float i=0.;i<6.;i++){
        float dx=h(vec2(i,10.));float dy=h(vec2(i,11.));
        float dlen=0.05+h(vec2(i,12.))*0.2;
        float dw=0.008+h(vec2(i,13.))*0.012;
        float d=length(vec2((uv.x-dx)/dw,max(0.,(uv.y-dy)/dlen-1.)));
        total+=smoothstep(1.,0.6,d)*0.7;
      }
      total=clamp(total,0.,1.);
      vec3 c=mix(vec3(0.5,0.,0.),vec3(0.85,0.02,0.02),total);
      gl_FragColor=vec4(c*total,total*0.95);
    }`,

  // ACID SPLATTER — neon yellow-green corrosive puddles with bubbling edge
  acid_splatter: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.55;for(int i=0;i<4;i++){v+=a*n(p);p*=2.3;a*=0.45;}return v;}
    void main(){
      float t=u_time;vec2 uv=v_uv;float total=0.;
      // Puddle blobs
      for(float i=0.;i<10.;i++){
        vec2 c=vec2(h(vec2(i,0.)),h(vec2(i,1.)));
        float r=0.05+h(vec2(i,2.))*0.15;
        // Bubbling animated edge
        float edge=fbm(normalize(uv-c)*5.+vec2(t*0.8+i))*0.25;
        float d=length((uv-c)*vec2(1.+h(vec2(i,3.))*0.5,1.));
        total+=smoothstep(r+edge,r*0.4,d)*mix(0.5,1.,h(vec2(i,4.)));
      }
      // Corrosive bubbles on surface
      for(float i=0.;i<8.;i++){
        float bx=h(vec2(i,20.));float by=h(vec2(i,21.));
        float r=0.012+h(vec2(i,22.))*0.025;
        float pulse=sin(t*mix(1.5,3.,h(vec2(i,23.)))+h(vec2(i,24.))*6.283)*0.5+0.5;
        total+=smoothstep(r,r*0.3,length(uv-vec2(bx,by)))*pulse*0.5;
      }
      total=clamp(total,0.,1.);
      float i=smoothstep(0.1,0.8,total);
      vec3 c=i<0.4?mix(vec3(0.1,0.35,0.0),vec3(0.55,0.9,0.0),i/0.4)
              :mix(vec3(0.55,0.9,0.0),vec3(0.9,1.0,0.3),(i-0.4)/0.6);
      gl_FragColor=vec4(c*total,total*0.92);
    }`,

  // LAVA RIVER — for flow mode: scrolling molten channels
  lava_river: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.55;for(int i=0;i<5;i++){v+=a*n(p);p*=2.1;a*=0.48;}return v;}
    void main(){
      // Flow direction: along X (path handles the curve)
      vec2 uv=v_uv;float t=u_time;
      vec2 p=uv*vec2(u_res.x/max(u_res.y,1.),1.)*3.;
      p.x-=t*0.8;
      float base=fbm(p);
      float vein=fbm(p*vec2(1.,3.)+vec2(t*0.4,0.));
      float n=base*0.6+vein*0.4;
      // Crust dark edges, glowing center channels
      float crush=abs(uv.y-0.5)*2.;// edge darkness
      n*=(1.-crush*0.5);
      float i=smoothstep(0.3,0.85,n);
      vec3 c=i<0.2?vec3(0.12,0.02,0.0)
              :i<0.5?mix(vec3(0.7,0.1,0.0),vec3(1.0,0.4,0.0),(i-0.2)/0.3)
              :i<0.8?mix(vec3(1.0,0.4,0.0),vec3(1.0,0.85,0.1),(i-0.5)/0.3)
              :mix(vec3(1.0,0.85,0.1),vec3(1.0,1.0,0.7),(i-0.8)/0.2);
      float a=step(0.3,n);
      gl_FragColor=vec4(c*a,a);
    }`,

  // MUD RIVER — for flow mode: dark brown turbid flow
  mud_river: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(443.9,441.4));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.1;a*=0.5;}return v;}
    void main(){
      vec2 uv=v_uv;float t=u_time*0.5;
      vec2 p=uv*vec2(u_res.x/max(u_res.y,1.),1.)*2.5;
      p.x-=t*0.6;
      vec2 q=vec2(fbm(p+vec2(0.,t*0.2)),fbm(p+vec2(3.1,0.)));
      float base=fbm(p+1.5*q);
      float ripple=n(uv*vec2(8.,3.)+vec2(-t*2.,0.))*0.15;
      float total=base+ripple;
      float i=smoothstep(0.25,0.75,total);
      vec3 c=i<0.4?mix(vec3(0.12,0.07,0.02),vec3(0.28,0.18,0.06),i/0.4)
              :i<0.8?mix(vec3(0.28,0.18,0.06),vec3(0.4,0.28,0.12),(i-0.4)/0.4)
              :mix(vec3(0.4,0.28,0.12),vec3(0.5,0.38,0.18),(i-0.8)/0.2);
      float a=smoothstep(0.22,0.45,total)*0.92;
      gl_FragColor=vec4(c*a,a);
    }`,

  // SCENIC LIGHT — warm circular glow, configurable color via u_color
  scenic_light: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; uniform vec3 u_lightColor;
    varying vec2 v_uv;
    void main(){
      vec2 uv=v_uv-0.5;
      uv.x*=u_res.x/max(u_res.y,1.);
      float r=length(uv)*2.0;
      // Soft falloff with subtle flicker
      float flicker=0.95+0.05*sin(u_time*3.7+0.5)*sin(u_time*2.3);
      float glow=smoothstep(1.0,0.0,r)*smoothstep(1.0,0.05,r)*flicker;
      float core=smoothstep(0.3,0.0,r)*0.6;
      vec3 c=mix(u_lightColor*0.4,u_lightColor,glow+core);
      float a=(glow+core*0.5)*flicker;
      gl_FragColor=vec4(c,clamp(a,0.,1.));
    }`,
  arcane: `precision mediump float;
    uniform float u_time; uniform vec2 u_res; varying vec2 v_uv;
    float h(vec2 p){p=fract(p*vec2(443.9,441.4));p+=dot(p,p+19.19);return fract(p.x*p.y);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float v=0.;float a=0.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.;a*=0.5;}return v;}
    void main(){
      vec2 uv=v_uv-0.5;float t=u_time*0.7;
      float ang=atan(uv.y,uv.x)+t*0.4;
      float r=length(uv)*2.;
      // Spiral warp
      vec2 sp=vec2(ang/6.2831,r)+vec2(t*0.1,0.);
      float swirl=fbm(sp*3.+vec2(t*0.3));
      // Radial pulse
      float pulse=sin(r*8.-t*3.)*0.5+0.5;
      float total=swirl*0.7+pulse*0.3;
      total*=smoothstep(1.0,0.1,r);// fade edges
      float i=smoothstep(0.2,0.8,total);
      vec3 c=i<0.3?mix(vec3(0.1,0.0,0.3),vec3(0.5,0.1,0.9),i/0.3)
              :i<0.7?mix(vec3(0.5,0.1,0.9),vec3(0.0,0.8,0.9),(i-0.3)/0.4)
              :mix(vec3(0.0,0.8,0.9),vec3(0.9,0.95,1.0),(i-0.7)/0.3);
      float a=smoothstep(0.15,0.4,total);
      gl_FragColor=vec4(c*a,a);
    }`,
};

// Compiled shader cache
const _glCache = {};

function getWebGLRenderer(shaderName) {
  if (_glCache[shaderName]) return _glCache[shaderName];
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false });
  if (!gl) return null;
  const compile = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('Shader error', shaderName, gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vert = compile(gl.VERTEX_SHADER, SHADER_VERT);
  const frag = compile(gl.FRAGMENT_SHADER, SHADER_FRAGS[shaderName] || SHADER_FRAGS.fire);
  if (!vert || !frag) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vert); gl.attachShader(prog, frag); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const loc = { pos: gl.getAttribLocation(prog,'a_pos'), time: gl.getUniformLocation(prog,'u_time'), res: gl.getUniformLocation(prog,'u_res'), lightColor: gl.getUniformLocation(prog,'u_lightColor') };
  _glCache[shaderName] = { gl, canvas, prog, buf, loc, t0: Date.now() };
  return _glCache[shaderName];
}

export function renderShaderToCanvas(ctx, shaderName, x, y, w, h, opacity, blendMode, lightColor) {
  const r = getWebGLRenderer(shaderName);
  if (!r) return;
  const { gl, canvas, prog, buf, loc, t0 } = r;
  gl.viewport(0, 0, 512, 512);
  gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc.pos);
  gl.vertexAttribPointer(loc.pos, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1f(loc.time, (Date.now()-t0)/1000);
  gl.uniform2f(loc.res, w, h);
  // Light color uniform (for scenic_light shader)
  if (loc.lightColor && lightColor) {
    const [lr, lg, lb] = lightColor;
    gl.uniform3f(loc.lightColor, lr, lg, lb);
  } else if (loc.lightColor) {
    gl.uniform3f(loc.lightColor, 1.0, 0.85, 0.4); // default warm torch
  }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  if (blendMode === 'screen') ctx.globalCompositeOperation = 'screen';
  else if (blendMode === 'lighter') ctx.globalCompositeOperation = 'lighter';
  else if (blendMode === 'overlay') ctx.globalCompositeOperation = 'overlay';
  else ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(canvas, x, y, w, h);
  ctx.restore();
}

// ── Built-in GPU Shader Presets ────────────────────────────────────────────
export const BUILTIN_EFFECT_PRESETS = [
  // AREA effects — fill a painted region
  { id:'shader_fire',           name:'Fire',           shaderName:'fire',           category:'area',  tags:['fire','flame','heat'],            description:'Chaotic noise fire with ember sparks',         isShader:true,isPreset:true,previewColor:'#ff4400',emoji:'🔥' },
  { id:'shader_ice',            name:'Ice',            shaderName:'ice',            category:'area',  tags:['ice','frost','cold'],             description:'Crystalline frost with facet patterns',        isShader:true,isPreset:true,previewColor:'#7dd3fc',emoji:'❄️' },
  { id:'shader_lightning',      name:'Lightning',      shaderName:'lightning',      category:'area',  tags:['lightning','storm','electric'],   description:'Branching purple-white bolts',                 isShader:true,isPreset:true,previewColor:'#a070ff',emoji:'⚡' },
  { id:'shader_poison',         name:'Poison',         shaderName:'poison',         category:'area',  tags:['poison','toxic','acid'],          description:'Acid yellow-green bubbling fluid',            isShader:true,isPreset:true,previewColor:'#84cc16',emoji:'☠️' },
  { id:'shader_fog',            name:'Fog',            shaderName:'fog',            category:'area',  tags:['fog','mist','smoke'],             description:'Warm amber-grey dungeon haze',                 isShader:true,isPreset:true,previewColor:'#c8b89a',emoji:'🌫️' },
  { id:'shader_firefly',        name:'Fireflies',      shaderName:'firefly',        category:'area',  tags:['firefly','magic','fey','arcane'], description:'Multicolor glowing orbs — gold, blue, green', isShader:true,isPreset:true,previewColor:'#fbbf24',emoji:'✨' },
  { id:'shader_wind',           name:'Wind & Rain',    shaderName:'wind',           category:'area',  tags:['wind','rain','storm'],            description:'Diagonal rain streaks with wind lines',        isShader:true,isPreset:true,previewColor:'#bfdbfe',emoji:'💨' },
  { id:'shader_smoke',          name:'Smoke',          shaderName:'smoke',          category:'area',  tags:['smoke','cloud','dark'],           description:'Dense dark rolling smoke',                    isShader:true,isPreset:true,previewColor:'#6b7280',emoji:'💨' },
  { id:'shader_blood_splatter', name:'Blood Splatter', shaderName:null, url: null, category:'area', tags:['blood','combat','splatter'], description:'Dark red paint splats', isShader:false, isPreset:true, isStaticSvg:true, svgKey:'blood', previewColor:'#dc2626', emoji:'🩸' },
  { id:'shader_acid_splatter',  name:'Acid Splatter',  shaderName:null, url: null, category:'area', tags:['acid','toxic','splatter'],  description:'Neon green corrosive splats', isShader:false, isPreset:true, isStaticSvg:true, svgKey:'acid',  previewColor:'#84cc16', emoji:'🟢' },
  { id:'shader_arcane',         name:'Arcane Portal',  shaderName:'arcane',         category:'area',  tags:['arcane','magic','portal'],        description:'Swirling purple-cyan portal energy',          isShader:true,isPreset:true,previewColor:'#8b5cf6',emoji:'🔮' },
  // FLOW effects — drawn along a path
  { id:'shader_lava_river',     name:'Lava River',     shaderName:'lava_river',     category:'flow',  tags:['lava','fire','flow','river'],     description:'Scrolling molten lava channels',              isShader:true,isPreset:true,previewColor:'#f97316',emoji:'🌋' },
  { id:'shader_mud_river',      name:'Mud River',      shaderName:'mud_river',      category:'flow',  tags:['mud','earth','flow','river'],     description:'Dark brown turbid flowing mud',               isShader:true,isPreset:true,previewColor:'#92400e',emoji:'🟤' },
  // SCENIC LIGHT — click to place a circular light source
  { id:'scenic_light', name:'Scenic Light', shaderName:'scenic_light', category:'area', tags:['light','torch','glow','ambient'], description:'Placeable circular light — adjustable color and radius', isShader:true, isPreset:true, previewColor:'#fde68a', emoji:'🕯️', isLight:true },
];



function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return [r, g, b];
}

function isVideoUrl(url) {
  if (!url) return false;
  return url.startsWith('data:video/') || /\.(mp4|webm|mov|ogg)$/i.test(url);
}

function getLocalUserId() {
  try {
    let id = localStorage.getItem('krajden_user_id');
    if (!id) {
      id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('krajden_user_id', id);
    }
    return id;
  } catch (e) {
    return 'anonymous';
  }
}

function getLocalUserName() {
  try {
    return localStorage.getItem('krajden_display_name') || 'Anonymous';
  } catch (e) {
    return 'Anonymous';
  }
}

// ── REVERSE MASK VIDEO ENGINE (CANVAS 2D) ────────────────────────────────────

/**
 * EffectsDrawingOverlay
 * Renders dynamic reverse masks revealing underlying animated video or repeating textures.
 */
export function EffectsDrawingOverlay({ canvasSize: canvasSizeProp }) {
  const {
    settings,
    updateSettings,
    addEffectPath,
  } = useGrid();

  // ── Self-measured canvas size ─────────────────────────────────────────────
  const containerRef = useRef(null);
  const [measuredSize, setMeasuredSize] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setMeasuredSize({ width, height });
      }
    });
    ro.observe(el);
    // Initial measure
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setMeasuredSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  // Use prop if provided, otherwise use measured size
  const canvasSize = canvasSizeProp || measuredSize;

  // ── State ────────────────────────────────────────────────────────────────
  const [isDrawing, setIsDrawing]         = useState(false);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [marqueeStart, setMarqueeStart]   = useState(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState(null);
  const [flowPoints, setFlowPoints]       = useState([]);
  const [mousePos, setMousePos]           = useState(null); // for cursor preview

  const canvasRef       = useRef(null);
  const mediaRef        = useRef(new Map()); // url → HTMLVideoElement | HTMLImageElement
  const rafRef          = useRef(null);

  // ── Derive settings ───────────────────────────────────────────────────────
  const effectPaths     = settings.effectPaths    || [];
  const effectsEnabled  = !!settings.effectsEnabled;
  const activeEffectUrl = settings.activeEffectUrl || null;
  const activeShader    = settings.activeEffectShader || null;
  const activeEffectId  = settings.activeEffectId || '';
  const brushSize       = settings.effectBrushSize  || 60;
  const opacity         = settings.effectOpacity    ?? 0.9;
  const tile            = settings.effectTile       !== false;
  const tileScale       = settings.effectTileScale  || 100;
  const blendMode       = settings.effectBlendMode  || 'normal';
  const effectTool      = settings.effectTool       || 'brush'; // 'brush'|'marquee'|'eraser'

  // Auto-detect flow vs area based on selected effect
  const activePreset = BUILTIN_EFFECT_PRESETS.find(p => p.id === activeEffectId);
  const effectMode   = activePreset ? getEffectMode(activePreset) : 'area';

  const hasActiveEffect = !!(activeEffectUrl || activeShader);

  // ── Canvas size ───────────────────────────────────────────────────────────
  const cW = canvasSize?.width  || (typeof window !== 'undefined' ? window.innerWidth  : 1920);
  const cH = canvasSize?.height || (typeof window !== 'undefined' ? window.innerHeight : 1080);

  // ── Media element management ──────────────────────────────────────────────
  useEffect(() => {
    const needed = new Set(effectPaths.map(ep => ep.effectUrl).filter(Boolean));
    if (activeEffectUrl) needed.add(activeEffectUrl);

    needed.forEach(url => {
      if (mediaRef.current.has(url)) return;
      const isVid = url.startsWith('data:video/') || /\.(mp4|webm)$/i.test(url);
      if (isVid) {
        const v = document.createElement('video');
        v.src = url; v.loop = true; v.muted = true; v.playsInline = true;
        v.play().catch(() => {});
        mediaRef.current.set(url, v);
      } else {
        const img = new Image();
        img.src = url;
        mediaRef.current.set(url, img);
      }
    });

    // Prune unused
    mediaRef.current.forEach((_, url) => {
      if (!needed.has(url)) mediaRef.current.delete(url);
    });
  }, [effectPaths, activeEffectUrl]);

  // ── Render loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let alive = true;

    const drawPath = (pts, type, w) => {
      if (!pts || pts.length < 1) return;
      ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      if (type === 'bezier' && pts.length >= 3) {
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i+1].x) / 2;
          const my = (pts[i].y + pts[i+1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
      } else {
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      }
    };

    const renderEffect = (effect) => {
      const {
        type = 'brush', points = [], rect,
        effectUrl, isShader, shaderName,
        width: w = brushSize, opacity: op = 0.9,
        tile: doTile = true, tileScale: ts = 100,
        blendMode: bm = 'normal',
      } = effect;

      // ── Shader effect ─────────────────────────────────────────────────────
      if (isShader && shaderName) {
        ctx.save();
        ctx.globalAlpha = op;

        // Build clip path
        if (type === 'marquee' && rect) {
          ctx.beginPath();
          ctx.rect(rect.x, rect.y, rect.width, rect.height);
          ctx.clip();
          renderShaderToCanvas(ctx, shaderName, rect.x, rect.y, rect.width, rect.height, 1, bm);
        } else if (points.length >= 2) {
          // Expand bounding box by brush radius
          const xs = points.map(p => p.x), ys = points.map(p => p.y);
          const bx = Math.min(...xs) - w/2, by = Math.min(...ys) - w/2;
          const bw = Math.max(...xs) - Math.min(...xs) + w;
          const bh = Math.max(...ys) - Math.min(...ys) + w;
          ctx.beginPath();
          drawPath(points, type, w);
          ctx.save(); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.clip();
          renderShaderToCanvas(ctx, shaderName, bx, by, bw, bh, 1, bm,
            effect.lightColor ? hexToRgb(effect.lightColor) : null);
          ctx.restore();
        }
        ctx.restore();
        return;
      }

      // ── Video/image effect via offscreen mask ─────────────────────────────
      if (!effectUrl) return;
      const media = mediaRef.current.get(effectUrl);
      if (!media) return;
      const isVid = media instanceof HTMLVideoElement;
      const ready = isVid
        ? media.readyState >= 2 && media.videoWidth > 0
        : media.complete && media.naturalWidth > 0;

      if (!ready) {
        // Gold placeholder while loading
        ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = '#caa055';
        ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (points.length >= 2) { drawPath(points, type, w); ctx.stroke(); }
        ctx.restore(); return;
      }

      // Offscreen mask canvas
      const off = document.createElement('canvas');
      off.width = cW; off.height = cH;
      const oc = off.getContext('2d');
      oc.lineCap = 'round'; oc.lineJoin = 'round'; oc.lineWidth = w;
      oc.fillStyle = '#fff'; oc.strokeStyle = '#fff';

      if (type === 'marquee' && rect) {
        oc.fillRect(rect.x, rect.y, rect.width, rect.height);
      } else if (points.length === 1) {
        oc.beginPath(); oc.arc(points[0].x, points[0].y, w/2, 0, Math.PI*2); oc.fill();
      } else if (points.length >= 2) {
        drawPath(points, type, w);
        oc.stroke();
      }

      // Clip video/image to the white shape
      const mW = isVid ? media.videoWidth  : media.naturalWidth;
      const mH = isVid ? media.videoHeight : media.naturalHeight;
      const sc  = Math.max(0.1, ts / 100);
      const tW  = Math.max(1, Math.round(mW * sc));
      const tH  = Math.max(1, Math.round(mH * sc));

      oc.globalCompositeOperation = 'source-in';
      if (doTile) {
        try {
          const pat = oc.createPattern(media, 'repeat');
          if (pat) {
            const dm = new DOMMatrix(); dm.a = sc; dm.d = sc;
            pat.setTransform(dm);
            oc.fillStyle = pat; oc.fillRect(0, 0, cW, cH);
          }
        } catch (_) {
          for (let tx = 0; tx < cW; tx += tW)
            for (let ty = 0; ty < cH; ty += tH)
              try { oc.drawImage(media, tx, ty, tW, tH); } catch (__) {}
        }
      } else {
        const xs = points.map(p => p.x), ys = points.map(p => p.y);
        const bx = type === 'marquee' ? rect.x : Math.min(...xs) - w/2;
        const by = type === 'marquee' ? rect.y : Math.min(...ys) - w/2;
        const bw = type === 'marquee' ? rect.width  : Math.max(...xs) - Math.min(...xs) + w;
        const bh = type === 'marquee' ? rect.height : Math.max(...ys) - Math.min(...ys) + w;
        try { oc.drawImage(media, bx, by, bw, bh); } catch (_) {}
      }

      // Apply edge fade (feather) if requested
      const edgeFade = effect.edgeFade || 0;
      if (edgeFade > 0) {
        // Use destination-out with a blurred version to soften edges
        const fadeOff = document.createElement('canvas');
        fadeOff.width = cW; fadeOff.height = cH;
        const fc = fadeOff.getContext('2d');
        fc.drawImage(off, 0, 0);
        fc.filter = `blur(${edgeFade}px)`;
        fc.globalCompositeOperation = 'destination-in';
        fc.drawImage(off, 0, 0);
        ctx.save();
        ctx.globalAlpha = op;
        if (bm === 'screen') ctx.globalCompositeOperation = 'screen';
        else if (bm === 'lighter') ctx.globalCompositeOperation = 'lighter';
        else if (bm === 'overlay') ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(fadeOff, 0, 0);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = op;
        if (bm === 'screen') ctx.globalCompositeOperation = 'screen';
        else if (bm === 'lighter') ctx.globalCompositeOperation = 'lighter';
        else if (bm === 'overlay') ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(off, 0, 0);
        ctx.restore();
      }
    };

    const render = () => {
      if (!alive) return;
      ctx.clearRect(0, 0, cW, cH);

      // Committed paths
      effectPaths.forEach(renderEffect);

      // Live preview while drawing
      if (isDrawing && hasActiveEffect) {
        const liveEffect = {
          type: effectMode === 'flow' ? 'bezier' : effectTool,
          points: currentStroke,
          rect: marqueeStart && marqueeCurrent ? {
            x: Math.min(marqueeStart.x, marqueeCurrent.x),
            y: Math.min(marqueeStart.y, marqueeCurrent.y),
            width:  Math.abs(marqueeCurrent.x - marqueeStart.x),
            height: Math.abs(marqueeCurrent.y - marqueeStart.y),
          } : null,
          effectUrl: activeEffectUrl,
          isShader:  !!activeShader,
          shaderName: activeShader,
          width: brushSize, opacity: opacity * 0.7, // slightly transparent while drawing
          tile, tileScale, blendMode,
        };

        if (effectTool === 'marquee' && liveEffect.rect && liveEffect.rect.width > 2) {
          renderEffect(liveEffect);
          // Dashed border
          ctx.save(); ctx.strokeStyle = '#caa055'; ctx.lineWidth = 1.5;
          ctx.setLineDash([6,4]);
          ctx.strokeRect(liveEffect.rect.x, liveEffect.rect.y, liveEffect.rect.width, liveEffect.rect.height);
          ctx.setLineDash([]); ctx.restore();
        } else if (currentStroke.length >= 2) {
          renderEffect(liveEffect);
        }
      }

      // Cursor size ring preview
      if (effectsEnabled && mousePos && effectMode === 'area' && effectTool !== 'marquee') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#caa055'; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
        ctx.globalAlpha = 0.6; ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [effectPaths, isDrawing, currentStroke, marqueeStart, marqueeCurrent,
      activeEffectUrl, activeShader, effectMode, effectTool, brushSize,
      opacity, tile, tileScale, blendMode, hasActiveEffect, effectsEnabled,
      mousePos, cW, cH]);

  // ── Coordinate mapping ────────────────────────────────────────────────────
  const getCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = cW / rect.width;
    const scaleY = cH / rect.height;
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }, [cW, cH]);

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const pt = getCoords(e);
    setMousePos(pt);
    if (!isDrawing) return;

    if (effectTool === 'marquee') {
      setMarqueeCurrent(pt);
    } else if (effectTool === 'eraser') {
      const r = brushSize / 2;
      const remaining = effectPaths.filter(ep => {
        if (ep.rect) return !(pt.x >= ep.rect.x && pt.x <= ep.rect.x + ep.rect.width && pt.y >= ep.rect.y && pt.y <= ep.rect.y + ep.rect.height);
        if (ep.points) return !ep.points.some(p => Math.hypot(p.x - pt.x, p.y - pt.y) <= r + (ep.width || 60) / 2);
        return true;
      });
      if (remaining.length !== effectPaths.length) updateSettings({ effectPaths: remaining });
    } else {
      setCurrentStroke(prev => {
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (Math.hypot(pt.x - last.x, pt.y - last.y) < 4) return prev;
        }
        return [...prev, pt];
      });
    }
  }, [isDrawing, effectTool, brushSize, effectPaths, getCoords, updateSettings]);

  const handleMouseDown = useCallback((e) => {
    if (!effectsEnabled || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    const pt = getCoords(e);

    // FLOW MODE: click to add points, double-click to commit
    if (effectMode === 'flow') {
      if (e.detail === 2 && flowPoints.length >= 2) {
        if (hasActiveEffect) {
          addEffectPath({
            type: 'bezier',
            points: [...flowPoints],
            effectUrl: activeEffectUrl,
            effectId: activeEffectId,
            isShader: !!activeShader,
            shaderName: activeShader || null,
            width: brushSize, opacity, tile, tileScale, blendMode,
          });
        }
        setFlowPoints([]);
        return;
      }
      setFlowPoints(prev => [...prev, pt]);
      return;
    }

    // AREA MODE: drag to paint
    setIsDrawing(true);

    // Scenic light — single click places a circular glow
    if (activeEffectId === 'scenic_light') {
      const r = brushSize * 1.5;
      addEffectPath({
        type: 'marquee',
        rect: { x: pt.x - r, y: pt.y - r, width: r * 2, height: r * 2 },
        effectUrl: null, effectId: activeEffectId,
        isShader: true, shaderName: 'scenic_light', isLight: true,
        lightColor: '#ffcc44', opacity, blendMode: 'lighter',
      });
      setIsDrawing(false);
      return;
    }
    if (effectTool === 'marquee') {
      setMarqueeStart(pt); setMarqueeCurrent(pt);
    } else if (effectTool === 'eraser') {
      // handled in mousemove
    } else {
      setCurrentStroke([pt]);
    }
  }, [effectsEnabled, effectMode, effectTool, flowPoints, hasActiveEffect,
      activeEffectUrl, activeEffectId, activeShader, brushSize, opacity,
      tile, tileScale, blendMode, getCoords, addEffectPath]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (effectTool === 'marquee' && marqueeStart && marqueeCurrent) {
      const x = Math.min(marqueeStart.x, marqueeCurrent.x);
      const y = Math.min(marqueeStart.y, marqueeCurrent.y);
      const w = Math.abs(marqueeCurrent.x - marqueeStart.x);
      const h = Math.abs(marqueeCurrent.y - marqueeStart.y);
      if (w > 10 && h > 10 && hasActiveEffect) {
        addEffectPath({
          type: 'marquee', rect: { x, y, width: w, height: h },
          effectUrl: activeEffectUrl, effectId: activeEffectId,
          isShader: !!activeShader, shaderName: activeShader || null,
          opacity, tile, tileScale, blendMode,
        });
      }
      setMarqueeStart(null); setMarqueeCurrent(null);
    } else if (currentStroke.length >= 2 && hasActiveEffect) {
      addEffectPath({
        type: effectTool === 'bezier' ? 'bezier' : 'brush',
        points: [...currentStroke],
        effectUrl: activeEffectUrl, effectId: activeEffectId,
        isShader: !!activeShader, shaderName: activeShader || null,
        width: brushSize, opacity, tile, tileScale, blendMode,
      });
    }
    setCurrentStroke([]);
  }, [isDrawing, effectTool, marqueeStart, marqueeCurrent, currentStroke,
      hasActiveEffect, activeEffectUrl, activeEffectId, activeShader,
      brushSize, opacity, tile, tileScale, blendMode, addEffectPath]);

  // Release on window mouseup (handles dragging off canvas)
  useEffect(() => {
    if (!isDrawing) return;
    const up = () => handleMouseUp();
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [isDrawing, handleMouseUp]);

  // Escape cancels flow path
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { setFlowPoints([]); setIsDrawing(false); setCurrentStroke([]); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!effectPaths.length && !effectsEnabled) return null;

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursorStyle = !effectsEnabled    ? 'default'
    : !hasActiveEffect                    ? 'not-allowed'
    : effectMode === 'flow'               ? 'crosshair'
    : effectTool === 'eraser'             ? 'cell'
    : effectTool === 'marquee'            ? 'crosshair'
    : 'none'; // brush uses the canvas ring preview as cursor

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 15, pointerEvents: effectsEnabled ? 'all' : 'none' }}
    >
      <canvas
        ref={canvasRef}
        width={cW}
        height={cH}
        className="absolute inset-0 w-full h-full block"
        style={{ cursor: cursorStyle, touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setMousePos(null)}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />

      {/* Flow mode: SVG point overlay */}
      {effectsEnabled && effectMode === 'flow' && flowPoints.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 16 }}>
          {flowPoints.length >= 2 && (
            <polyline
              points={flowPoints.map(p => `${p.x * cW / cW},${p.y * cH / cH}`).join(' ')}
              fill="none" stroke="#caa055" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.8"
            />
          )}
          {flowPoints.map((pt, idx) => (
            <g key={idx}>
              <circle cx={pt.x} cy={pt.y} r={idx === 0 ? 8 : 5}
                fill={idx === 0 ? '#caa055' : '#fff'}
                stroke="#caa055" strokeWidth="2" opacity="0.95" />
              {idx === 0 && (
                <text x={pt.x + 12} y={pt.y - 8} fill="#caa055"
                  fontSize="11" fontFamily="monospace" opacity="0.9">START</text>
              )}
            </g>
          ))}
          <rect x="8" y="8" width="340" height="20" rx="4" fill="rgba(0,0,0,0.6)" />
          <text x="14" y="22" fill="#caa055" fontSize="11" fontFamily="monospace">
            {`Click to place · Double-click to finish · ${flowPoints.length} point${flowPoints.length !== 1 ? 's' : ''}`}
          </text>
        </svg>
      )}

      {/* Flow cancel button */}
      {effectsEnabled && effectMode === 'flow' && flowPoints.length > 0 && (
        <button
          onClick={() => setFlowPoints([])}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded bg-black/80 border border-red-500/40 text-red-400 text-xs font-mono hover:bg-red-900/30 transition-all"
          style={{ zIndex: 20 }}
        >
          Cancel (Esc)
        </button>
      )}

      {/* No effect selected warning */}
      {effectsEnabled && !hasActiveEffect && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded bg-black/80 border border-[#caa055]/30 text-[#caa055] text-xs font-mono pointer-events-none" style={{ zIndex: 20 }}>
          Select an effect from the panel first
        </div>
      )}
    </div>
  );
}


export function EffectsControlPanel({ onClose }) {
  const {
    settings,
    updateSettings,
    addEffectPath,
    updateEffectPath,
    removeEffectPath,
    undoLastEffectPath,
    clearEffectPaths
  } = useGrid();

  const [activeTab, setActiveTab] = useState('builtin'); // 'builtin' | 'vault' | 'community' | 'mine'
  const [firebaseEffects, setFirebaseEffects] = useState([]);
  const [communityEffects, setCommunityEffects] = useState([]);
  const [myEffects, setMyEffects] = useState([]);
  const [localEffects, setLocalEffects] = useState(() => getLocalEffects());
  const [selectedPathId, setSelectedPathId] = useState(null); // id of placed effect being edited
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('ALL');
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  const fileInputRef = useRef(null);
  const userId = getLocalUserId();
  const effectPaths = settings.effectPaths || [];

  // Active Tool & Settings
  const effectsEnabled = !!settings.effectsEnabled;
  const activeEffectUrl = settings.activeEffectUrl || BUILTIN_EFFECT_PRESETS[0]?.url;
  const effectTool = settings.effectTool || 'brush';
  const effectBrushSize = settings.effectBrushSize || 60;
  const effectTile = settings.effectTile !== false;
  const effectTileScale = settings.effectTileScale || 100;
  const effectOpacity = settings.effectOpacity ?? 0.9;
  const effectBlendMode = settings.effectBlendMode || 'normal';
  const effectSpeed = settings.effectSpeed || 1;

  // Real-time Firestore Effects sync
  useEffect(() => {
    const unsubscribe = subscribeEffects((fbEffects) => {
      if (Array.isArray(fbEffects)) {
        setFirebaseEffects(fbEffects);
      }
    });
    return () => unsubscribe?.();
  }, []);

  // Fetch effects on load
  const loadEffectsData = async () => {
    try {
      const res = await fetch('/api/library/effects');
      const ct = res.headers?.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data?.effects)) {
          setCommunityEffects(data.effects);
          setMyEffects(data.effects.filter(e => e.authorId === userId));
        }
      }
    } catch (e) {
      // offline fallback
    }
  };

  useEffect(() => {
    loadEffectsData();
    window.addEventListener('krajden_library_updated', loadEffectsData);
    return () => window.removeEventListener('krajden_library_updated', loadEffectsData);
  }, [userId]);

  // Combine Presets + Firebase Effects + Local/Community Effects
  const allEffects = useMemo(() => {
    const map = new Map();

    // 0. GPU Shader Built-ins — resolve static SVG URLs for splatter presets
    BUILTIN_EFFECT_PRESETS.forEach(p => {
      let resolved = { ...p, source: 'builtin' };
      if (p.isStaticSvg) {
        const url = p.svgKey === 'blood' ? STATIC_BLOOD_SPLAT_URL : STATIC_ACID_SPLAT_URL;
        resolved = { ...resolved, url, imageUrl: url };
      }
      map.set(p.id, resolved);
    });

    // 0b. Local effects (stored in localStorage)
    localEffects.forEach(p => {
      if (!p || !p.id) return;
      const url = getLocalEffectUrl(p.id) || p.url || p.imageUrl || '';
      map.set(p.id, { ...p, url, imageUrl: url, source: 'local' });
    });

    // 1. Cloud Firestore Effects (admin vault)
    firebaseEffects.forEach(p => {
      if (!p || !p.id) return;
      map.set(p.id, { ...p, source: 'vault' });
    });

    // 2. Community / user-uploaded effects
    communityEffects.forEach(p => {
      if (!p || !p.id) return;
      if (map.has(p.id)) return;
      map.set(p.id, { ...p, source: p.authorId === userId ? 'mine' : 'community' });
    });

    return Array.from(map.values());
  }, [firebaseEffects, communityEffects, localEffects, userId]);

  // Filtered Effects
  const filteredEffects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return allEffects.filter(e => {
      if (activeTab === 'builtin' && e.source !== 'builtin') return false;
      if (activeTab === 'vault' && e.source !== 'vault') return false;
      if (activeTab === 'community' && e.source !== 'community') return false;
      if (activeTab === 'mine' && e.source !== 'mine' && e.source !== 'local') return false;

      if (selectedTheme !== 'ALL') {
        const t = (e.theme || e.category || '').toLowerCase();
        if (!t.includes(selectedTheme.toLowerCase())) return false;
      }

      if (q) {
        const nameMatch = (e.name || '').toLowerCase().includes(q);
        const descMatch = (e.description || '').toLowerCase().includes(q);
        const tagMatch = (e.tags || []).some(t => t.toLowerCase().includes(q));
        if (!nameMatch && !descMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [allEffects, activeTab, selectedTheme, searchQuery]);

  const selectEffect = (eff) => {
    updateSettings({
      activeEffectId: eff.id,
      activeEffectUrl: eff.isShader ? null : (eff.url || eff.imageUrl),
      activeEffectShader: eff.isShader ? eff.shaderName : null,
      effectsEnabled: true
    });
    toast.success(`Active: "${eff.name}" — Draw on map!`);
  };

  // Upload Custom Effect File — Firebase Storage handles any size
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif';
    const name = file.name.replace(/\.[^/.]+$/, '');
    const toastId = toast.loading(`Uploading "${name}" to vault...`);

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (!event.target?.result) return;
      let url = event.target.result;

      if (!isVideo && !isGif && url.startsWith('data:image/')) {
        url = await optimizeBase64ForFirestore(url, 1024, 0.82);
      }

      const newEff = {
        id: `fx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name, theme: 'Custom', url, imageUrl: url,
        category: isVideo ? 'video' : isGif ? 'animated' : 'image',
        tags: ['custom', isVideo ? 'video' : isGif ? 'gif' : 'image'],
        authorId: userId, authorName: getLocalUserName(),
        source: 'mine', created_at: new Date().toISOString(),
      };

      // Save locally first for instant access
      saveLocalEffect(newEff);
      setMyEffects(prev => [newEff, ...prev]);
      selectEffect(newEff);

      // Upload to Firebase Storage — no size limit
      try {
        const saved = await saveEffectToFirebase(newEff);
        toast.success(`"${name}" uploaded to vault!`, { id: toastId });
        if (saved?.url && saved.url !== url) {
          setMyEffects(prev => prev.map(e => e.id === newEff.id ? { ...e, url: saved.url, imageUrl: saved.url } : e));
        }
      } catch(err) {
        toast.warning(`Saved locally. Vault sync failed: ${err.message}`, { id: toastId });
      }
    };
    reader.onerror = () => toast.error('Failed to read file', { id: toastId });
    reader.readAsDataURL(file);
  };

  const handleSyncFirebase = async () => {
    setIsSyncingFirebase(true);
    const toastId = toast.loading('☁️ Syncing Visual Effects from Firebase Vault...');
    try {
      await loadEffectsData();
      toast.success('☁️ Effects vault refreshed from cloud!', { id: toastId });
    } catch (e) {
      toast.error('Sync failed: ' + e.message, { id: toastId });
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#0d0f12] border border-[#caa055]/30 rounded-xl shadow-2xl text-white min-w-[280px]" data-testid="effects-control-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#caa055]/20 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#caa055]" />
          <h3 className="text-xs font-bold font-cinzel uppercase tracking-widest text-[#caa055]">
            Reverse Mask Effects
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleSyncFirebase}
            disabled={isSyncingFirebase}
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[9px] text-[#caa055] hover:bg-[#caa055]/10"
            title="Sync effects from Firebase Vault"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
          </Button>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white text-xs p-1">✕</button>
          )}
        </div>
      </div>

      {/* Main Activation Banner */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => updateSettings({ effectsEnabled: !effectsEnabled })}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2 ${
            effectsEnabled
              ? 'bg-[#caa055] text-black shadow-[#caa055]/25 border border-[#caa055]'
              : 'bg-white/10 text-gray-200 hover:bg-white/15 border border-white/10'
          }`}
          data-testid="toggle-effects-tool-btn"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{effectsEnabled ? 'Painting Mode Active' : 'Enable Effects Tool'}</span>
        </button>
      </div>

      {/* Mask Tool Selectors (Brush / Marquee / Bezier / Eraser) */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
          Mask Revealer Tool
        </Label>
        <div className="grid grid-cols-4 gap-1 p-1 bg-black/50 border border-white/10 rounded-lg">
          {[
            { id: 'brush', label: 'Brush', icon: '🖌️', desc: 'Freehand Paint' },
            { id: 'marquee', label: 'Marquee', icon: '🔲', desc: 'Box Window' },
            { id: 'bezier', label: 'Bezier', icon: '〰️', desc: 'Curved Path' },
            { id: 'eraser', label: 'Eraser', icon: '🧹', desc: 'Erase Mask' }
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => updateSettings({ effectTool: tool.id, effectsEnabled: true })}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded transition-all text-center ${
                effectTool === tool.id
                  ? 'bg-[#caa055]/30 text-[#caa055] border border-[#caa055]/60 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
              title={tool.desc}
            >
              <span className="text-xs">{tool.icon}</span>
              <span className="text-[9px] font-bold mt-0.5">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tool Sliders & Tiling Controls */}
      <div className="space-y-2.5 bg-black/40 border border-white/10 p-2.5 rounded-lg">
        {/* Brush Size / Line Width */}
        {effectTool !== 'marquee' && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-300">
              <span>{effectTool === 'eraser' ? 'Eraser Radius' : 'Brush / Stroke Size'}</span>
              <span className="font-mono text-[#caa055]">{effectBrushSize}px</span>
            </div>
            <Slider
              value={[effectBrushSize]}
              min={10}
              max={250}
              step={5}
              onValueChange={([val]) => updateSettings({ effectBrushSize: val })}
              className="py-1"
            />
          </div>
        )}

        {/* Video Tiling Toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <div>
            <span className="text-[10px] font-bold text-gray-300 block">Tile Video Effect</span>
            <span className="text-[8px] text-gray-500 block">Repeat seamless pattern vs stretch</span>
          </div>
          <Switch
            checked={effectTile}
            onCheckedChange={(checked) => updateSettings({ effectTile: checked })}
            className="scale-75"
          />
        </div>

        {/* Tile Scale (when tile is on) */}
        {effectTile && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-gray-300">
              <span>Tile Texture Scale</span>
              <span className="font-mono text-[#caa055]">{effectTileScale}%</span>
            </div>
            <Slider
              value={[effectTileScale]}
              min={25}
              max={300}
              step={5}
              onValueChange={([val]) => updateSettings({ effectTileScale: val })}
              className="py-1"
            />
          </div>
        )}

        {/* Opacity */}
        <div className="space-y-1 pt-1 border-t border-white/5">
          <div className="flex justify-between text-[10px] text-gray-300">
            <span>Effect Opacity</span>
            <span className="font-mono text-[#caa055]">{Math.round(effectOpacity * 100)}%</span>
          </div>
          <Slider
            value={[effectOpacity]}
            min={0.1}
            max={1}
            step={0.05}
            onValueChange={([val]) => updateSettings({ effectOpacity: val })}
            className="py-1"
          />
        </div>

        {/* Blend Mode Selection */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-[10px] text-gray-300">Blend Mode</span>
          <select
            value={effectBlendMode}
            onChange={(e) => updateSettings({ effectBlendMode: e.target.value })}
            className="bg-black/60 border border-white/20 text-white rounded px-2 py-0.5 text-[9px] font-mono"
          >
            <option value="normal">Normal (Opaque)</option>
            <option value="screen">Screen (Glowing Magic)</option>
            <option value="lighter">Additive (Lighter)</option>
            <option value="overlay">Overlay</option>
          </select>
        </div>
      </div>

      {/* Video & Effect Presets Vault */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase font-bold tracking-wider text-[#caa055]">
            Effect Media Library
          </Label>
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
            className="h-6 text-[9px] border-[#caa055]/40 text-[#caa055] hover:bg-[#caa055]/15 px-2 flex items-center gap-1"
          >
            <Upload className="w-3 h-3" /> Upload Video
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,image/gif,image/png,image/jpeg,image/webp"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex rounded-lg overflow-hidden border border-white/10 bg-black/40 text-[9px]">
          {[
            { id: 'builtin', label: '⚡ Built-in' },
            { id: 'vault', label: '⭐ Vault' },
            { id: 'community', label: '🌐 Cloud' },
            { id: 'mine', label: '👤 Mine' }
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-1 font-bold transition-all ${
                activeTab === t.id
                  ? 'bg-[#caa055]/25 text-[#caa055] border-b-2 border-[#caa055]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Effect Grid */}
        <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
          {filteredEffects.map((eff) => {
            const isSelected = settings.activeEffectId === eff.id;
            const isVideo = !eff.isShader && isVideoUrl(eff.url || eff.imageUrl);

            return (
              <div
                key={eff.id}
                onClick={() => selectEffect(eff)}
                className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
                  isSelected
                    ? 'border-[#caa055] bg-[#caa055]/15 shadow-md shadow-[#caa055]/20 ring-1 ring-[#caa055]'
                    : 'border-white/10 hover:border-white/30 bg-black/40'
                }`}
              >
                {/* Media Preview Box */}
                <div className="w-full h-16 bg-black relative overflow-hidden flex items-center justify-center">
                  {eff.isShader ? (
                    // GPU shader: colored gradient + emoji preview
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1"
                      style={{ background: `radial-gradient(ellipse at center, ${eff.previewColor || '#caa055'}55 0%, ${eff.previewColor || '#caa055'}11 70%, transparent 100%)` }}>
                      <span className="text-2xl leading-none">{eff.emoji || '✨'}</span>
                      <span className="text-[7px] text-white/40 font-mono uppercase tracking-wider">GPU</span>
                    </div>
                  ) : isVideo ? (
                    <video
                      src={eff.url || eff.imageUrl}
                      autoPlay loop muted playsInline
                      className="w-full h-full object-cover pointer-events-none"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <img
                      src={eff.url || eff.imageUrl}
                      alt={eff.name}
                      className="w-full h-full object-cover pointer-events-none"
                      onError={(e) => {
                        // Broken image — show placeholder
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement.style.background = '#1a1a1a';
                        const ph = document.createElement('div');
                        ph.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px';
                        ph.innerHTML = '<span style="font-size:20px">🎬</span><span style="font-size:8px;color:rgba(255,255,255,0.3);font-family:monospace">No preview</span>';
                        e.currentTarget.parentElement.appendChild(ph);
                      }}
                    />
                  )}

                  {/* Active Badge */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 bg-[#caa055] text-black text-[7px] font-black px-1.5 py-0.5 rounded shadow">
                      ACTIVE
                    </div>
                  )}
                  {eff.isShader && (
                    <div className="absolute bottom-1 left-1 bg-black/60 text-[#a0b4ff] text-[7px] font-bold px-1 py-0.5 rounded">
                      GPU
                    </div>
                  )}
                </div>

                {/* Info Footer */}
                <div className="p-1.5 bg-[#0a0c0f]">
                  <p className="text-[10px] font-bold text-gray-200 truncate group-hover:text-[#caa055]">
                    {eff.name}
                  </p>
                  <p className="text-[8px] text-gray-500 truncate">
                    {eff.description || eff.theme || 'Animated Effect'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Placed Effect Masks Manager */}
      {effectPaths.length > 0 && (
        <div className="space-y-1.5 border-t border-white/10 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Placed Effect Masks ({effectPaths.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={undoLastEffectPath}
                className="text-[9px] text-gray-300 hover:text-white flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/5 border border-white/10"
                title="Undo last placed mask"
              >
                <Undo className="w-2.5 h-2.5" /> Undo
              </button>
              <button
                onClick={clearEffectPaths}
                className="text-[9px] text-red-400 hover:text-red-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-950/20 border border-red-900/30"
              >
                <Trash2 className="w-2.5 h-2.5" /> Clear All
              </button>
            </div>
          </div>

          <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
            {effectPaths.map((ep, idx) => {
              const isSelected = selectedPathId === ep.id;
              return (
                <div key={ep.id || idx}>
                  <div
                    className={`flex items-center justify-between p-1.5 rounded border text-[9px] cursor-pointer transition-all ${isSelected ? 'bg-[#caa055]/15 border-[#caa055]/40' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                    onClick={() => setSelectedPathId(isSelected ? null : ep.id)}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-[#caa055]">#{idx + 1}</span>
                      <span className="capitalize text-gray-300">{ep.type || 'brush'}</span>
                      <span className="text-gray-500 font-mono">({Math.round((ep.opacity || 0.9) * 100)}%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[#caa055]/60 text-[8px]">{isSelected ? '▲' : '▼'}</span>
                      <button onClick={(e) => { e.stopPropagation(); removeEffectPath(ep.id); }}
                        className="text-red-400 hover:text-red-300 p-0.5" title="Remove">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Property editor — shows when selected */}
                  {isSelected && (
                    <div className="bg-black/40 border border-[#caa055]/20 rounded p-2 mt-0.5 space-y-2">
                      {/* Opacity */}
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[8px] text-white/50 uppercase tracking-wider">Opacity</span>
                          <span className="text-[8px] text-white/40 font-mono">{Math.round((ep.opacity ?? 0.9) * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.05" value={ep.opacity ?? 0.9}
                          onChange={e => updateEffectPath(ep.id, { opacity: parseFloat(e.target.value) })}
                          className="w-full h-1 accent-[#caa055]" />
                      </div>
                      {/* Width (for stroke effects) */}
                      {ep.type !== 'marquee' && (
                        <div>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[8px] text-white/50 uppercase tracking-wider">Width</span>
                            <span className="text-[8px] text-white/40 font-mono">{ep.width ?? 60}px</span>
                          </div>
                          <input type="range" min="10" max="400" step="5" value={ep.width ?? 60}
                            onChange={e => updateEffectPath(ep.id, { width: parseInt(e.target.value) })}
                            className="w-full h-1 accent-[#caa055]" />
                        </div>
                      )}
                      {/* Tile scale */}
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[8px] text-white/50 uppercase tracking-wider">Tile Scale</span>
                          <span className="text-[8px] text-white/40 font-mono">{ep.tileScale ?? 100}%</span>
                        </div>
                        <input type="range" min="10" max="400" step="10" value={ep.tileScale ?? 100}
                          onChange={e => updateEffectPath(ep.id, { tileScale: parseInt(e.target.value) })}
                          className="w-full h-1 accent-[#caa055]" />
                      </div>
                      {/* Edge fade */}
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[8px] text-white/50 uppercase tracking-wider">Edge Fade</span>
                          <span className="text-[8px] text-white/40 font-mono">{ep.edgeFade ?? 0}px</span>
                        </div>
                        <input type="range" min="0" max="80" step="4" value={ep.edgeFade ?? 0}
                          onChange={e => updateEffectPath(ep.id, { edgeFade: parseInt(e.target.value) })}
                          className="w-full h-1 accent-[#caa055]" />
                      </div>
                      {/* Tile toggle */}
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id={`tile-${ep.id}`} checked={ep.tile !== false}
                          onChange={e => updateEffectPath(ep.id, { tile: e.target.checked })}
                          className="accent-[#caa055] w-3 h-3" />
                        <label htmlFor={`tile-${ep.id}`} className="text-[8px] text-white/50 uppercase tracking-wider cursor-pointer">Tile Texture</label>
                      </div>
                      {/* Blend mode */}
                      <div>
                        <span className="text-[8px] text-white/50 uppercase tracking-wider block mb-0.5">Blend</span>
                        <select value={ep.blendMode || 'normal'}
                          onChange={e => updateEffectPath(ep.id, { blendMode: e.target.value })}
                          className="w-full bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-white">
                          {['normal','screen','lighter','overlay'].map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      {/* Scenic light color picker */}
                      {ep.isLight && (
                        <div>
                          <span className="text-[8px] text-white/50 uppercase tracking-wider block mb-0.5">Light Color</span>
                          <input type="color" value={ep.lightColor || '#ffcc44'}
                            onChange={e => updateEffectPath(ep.id, { lightColor: e.target.value })}
                            className="w-full h-6 rounded cursor-pointer border-0" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default EffectsControlPanel;
