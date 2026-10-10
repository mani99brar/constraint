// Procedural textures for the neon themes, written as CSS by gen-neon-art.mjs: all code-drawn, no third-party assets.
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export const enc=s=>'url("data:image/svg+xml;utf8,'+encodeURIComponent(s).replace(/%20/g,' ').replace(/'/g,'%27')+'")';
export const grain=(o=.9)=>enc(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${o}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
export function stars(seed,n=90,w=390,h=640,tint=['#fff','#cfe3ff','#ffe9c4']){const r=mulberry32(seed);let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
 for(let i=0;i<n;i++){const x=r()*w,y=r()*h,rad=r()<.12?1.5:r()<.4?1:.6;s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="${tint[Math.floor(r()*tint.length)]}" opacity="${(.35+r()*.65).toFixed(2)}"/>`;}
 return enc(s+'</svg>');}
export function nebula(seed,c1,c2,w=390,h=640){return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><filter id="f" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".007 .011" numOctaves="4" seed="${seed}"/><feColorMatrix values="0 0 0 0 ${c1[0]} 0 0 0 0 ${c1[1]} 0 0 0 0 ${c1[2]} 1.6 0 0 0 -.55"/></filter><filter id="g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".009 .006" numOctaves="3" seed="${seed+9}"/><feColorMatrix values="0 0 0 0 ${c2[0]} 0 0 0 0 ${c2[1]} 0 0 0 0 ${c2[2]} 0 1.5 0 0 -.5"/></filter><rect width="100%" height="100%" filter="url(#f)"/><rect width="100%" height="100%" filter="url(#g)"/></svg>`);}
export function aurora(seed,cols,w=390,h=640,base=170){const r=mulberry32(seed);let d='',g='';
 cols.forEach((c,k)=>{const ph=r()*6,A=22+r()*26,f=.012+r()*.012,y0=base+k*58+r()*30,th=70+r()*50;let top='',bot='';
  for(let x=-20;x<=w+20;x+=20){const y=y0+A*Math.sin(x*f+ph);top+=`${x===-20?'M':'L'}${x} ${y.toFixed(1)} `;}
  for(let x=w+20;x>=-20;x-=20){const y=y0+th+A*.6*Math.sin(x*f*1.3+ph+1);bot+=`L${x} ${y.toFixed(1)} `;}
  g+=`<linearGradient id="a${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".0"/><stop offset=".35" stop-color="${c}" stop-opacity=".8"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
  d+=`<path d="${top}${bot}Z" fill="url(#a${k})"/>`;});
 return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${g}<filter id="b" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="13"/></filter></defs><g filter="url(#b)">${d}</g></svg>`);}
export function bubbles(seed,n=26,w=390,h=640){const r=mulberry32(seed);let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
 for(let i=0;i<n;i++){const x=r()*w,y=r()*h,rad=1+r()*4;s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="none" stroke="#9ffcec" stroke-opacity="${(.15+r()*.3).toFixed(2)}" stroke-width=".8"/>`;}
 return enc(s+'</svg>');}
export function caustics(seed){return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="640"><filter id="c" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency=".014 .022" numOctaves="2" seed="${seed}"/><feColorMatrix values="0 0 0 0 .3 0 0 0 0 1 0 0 0 0 .9 0 0 3 0 -1.1"/></filter><rect width="100%" height="100%" filter="url(#c)"/></svg>`);}
export function floorGrid(w=390,h=210){let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g stroke="#ff4fd8" stroke-width="1" fill="none">`;
 for(let i=0;i<=14;i++){const x=-300+i*(w+600)/14;s+=`<path d="M${w/2} 0L${x} ${h}" opacity=".55"/>`;}
 let y=0,st=5;for(let i=0;i<9;i++){y+=st;st*=1.45;if(y>h)break;s+=`<path d="M0 ${y.toFixed(1)}H${w}" opacity="${(.2+y/h*.5).toFixed(2)}"/>`;}
 return enc(s+'</g></svg>');}
export function sunSVG(){let s=`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd35a"/><stop offset=".55" stop-color="#ff5ea8"/><stop offset="1" stop-color="#9b3cff"/></linearGradient><mask id="m"><rect width="200" height="100" fill="#fff"/>`;
 [58,70,80,88,94].forEach((y,i)=>{s+=`<rect x="0" y="${y}" width="200" height="${1.5+i*1.2}" fill="#000"/>`;});
 return enc(s+`</mask></defs><circle cx="100" cy="100" r="98" fill="url(#s)" mask="url(#m)"/></svg>`);}
