import type { ReactNode } from "react";
import { sketchAxes, type SketchKind } from "@/lib/catalog/measurement-sketch";
import type { DimensionSpec } from "@/lib/catalog/product-specs";

/** Isometric furniture schematics, deliberately not manufacturing drawings. */
export function FurnitureSketch({kind, type, specs, name}: {kind:SketchKind; type:string; specs:DimensionSpec[]; name:string}) {
  const axes = sketchAxes(specs, kind);
  const tall = ["wardrobe", "corner-wardrobe", "open-wardrobe", "cabinet", "wine-rack", "bunk"].includes(kind);
  const narrow = ["chair", "recliner", "nightstand", "floating-nightstand", "trolley", "tv-cart"].includes(kind);
  const w = tall ? 112 : narrow ? 100 : 174;
  const h = tall || kind === "tv-cart" ? 143 : kind === "bed" ? 95 : kind.includes("tv") || /coffee/i.test(type) ? 64 : 96;
  const dx = kind === "bed" || kind === "bunk" ? 67 : 43;
  const dy = kind === "bed" || kind === "bunk" ? 57 : 32;
  const ox = (380 - w - dx) / 2;
  const p = (x:number,y:number,z:number) => [ox + x*w + z*dx, 202-y*h-z*dy];
  const point = (x:number,y:number,z:number) => p(x,y,z).join(",");
  const line = (a:number[],b:number[],key?:string) => <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}/>;
  const box = (x:number,y:number,z:number,a:number,b:number,c:number,key:string) => <g key={key}>
    <polygon points={[point(x,y+b,z),point(x+a,y+b,z),point(x+a,y+b,z+c),point(x,y+b,z+c)].join(" ")} fill="#f3f0e9"/>
    <polygon points={[point(x+a,y,z),point(x+a,y,z+c),point(x+a,y+b,z+c),point(x+a,y+b,z)].join(" ")} fill="#e8e3d9"/>
    <polygon points={[point(x,y,z),point(x+a,y,z),point(x+a,y+b,z),point(x,y+b,z)].join(" ")} fill="#faf8f3"/>
  </g>;
  const legs = (top=.65) => [0,.92].flatMap(x => [0,.92].map(z => box(x,0,z,.06,top,.06,`leg-${x}-${z}`)));
  const parts: ReactNode[] = [];
  const drawers = (count:number, bottom:number, top:number) => {
    for(let i=0;i<count;i++) {
      const y=bottom+(top-bottom)*i/count;
      parts.push(line(p(.04,y,0),p(.96,y,0),`drawer-${i}`));
      parts.push(line(p(.43,y+(top-bottom)/count/2,0),p(.57,y+(top-bottom)/count/2,0),`handle-${i}`));
    }
  };
  if (["sofa","sectional","recliner"].includes(kind)) {
    const front = kind === "sectional" ? .3 : 0;
    if(kind === "sectional") {
      for(const [x,z] of [[0,.3],[.85,0],[0,.92],[.92,.92]]) parts.push(box(x,0,z,.06,.19,.06,`section-leg-${x}-${z}`));
    } else parts.push(...legs(.19));
    parts.push(box(0,.16,front,1,.24,1-front,"base"),box(.07,.4,.8,.86,.6,.2,"back"));
    const seats = kind === "recliner" ? 1 : /3-seater/i.test(type) ? 3 : 2;
    for(let i=0;i<seats;i++) {
      parts.push(box(.09+i*.82/seats,.4,front+.05,.82/seats-.015,.13,.73-front,`seat-${i}`));
      parts.push(box(.09+i*.82/seats,.55,.78,.82/seats-.015,.4,.12,`back-${i}`));
    }
    parts.push(box(0,.38,front,.08,.35,1-front,"left-arm"),box(.92,.38,front,.08,.35,1-front,"right-arm"));
    if(kind === "sectional") parts.push(box(.55,.17,0,.37,.36,.36,"chaise"));
    if(kind === "recliner") parts.push(box(.1,.16,0,.8,.2,.05,"footrest"));
  } else if(kind === "chair") {
    parts.push(...legs(.48),box(0,.45,0,1,.09,1,"seat"),box(.02,.54,.9,.96,.46,.08,"back"));
    if(/metal|ornate/i.test(type)) for(let i=1;i<5;i++) parts.push(line(p(i/5,.59,.9),p(i/5,.95,.9),`slat-${i}`));
  } else if(kind === "bed" || kind === "bunk") {
    parts.push(...legs(kind === "bunk" ? 1 : .26));
    parts.push(box(0,.17,0,1,.14,1,"frame"),box(.02,.31,.02,.96,.13,.96,"mattress"));
    if(kind === "bunk") {
      parts.push(box(0,.7,0,1,.12,1,"upper-frame"),box(.02,.82,.02,.96,.08,.96,"upper-mattress"));
      parts.push(line(p(0,1,0),p(1,1,0),"rail"),line(p(0,.93,0),p(1,.93,0),"rail2"));
      parts.push(line(p(.65,0,0),p(.65,.95,0),"ladder1"),line(p(.84,0,0),p(.84,.95,0),"ladder2"));
      for(let i=1;i<6;i++) parts.push(line(p(.65,i*.15,0),p(.84,i*.15,0),`rung-${i}`));
    } else parts.push(box(0,.26,.94,1,.74,.06,"headboard"));
    parts.push(box(.1,.44,.73,.33,.05,.18,"pillow1"));
    if(!/single/i.test(type)) parts.push(box(.57,.44,.73,.33,.05,.18,"pillow2"));
  } else if(kind === "table" || kind === "round-table") {
    if(kind === "round-table") {
      for(const x of [.18,.76]) for(const z of [.18,.76]) parts.push(box(x,0,z,.05,.93,.05,`round-leg-${x}-${z}`));
    } else parts.push(...legs(.93));
    if(kind === "round-table") {
      const ring=(y:number)=>Array.from({length:49},(_,i)=>point(.5+.5*Math.cos(i*Math.PI/24),y,.5+.5*Math.sin(i*Math.PI/24))).join(" ");
      parts.push(<polygon key="rim" points={ring(.93)} fill="#e8e3d9"/>,<polygon key="top" points={ring(1)} fill="#faf8f3"/>);
    } else {
      parts.push(box(0,.91,0,1,.09,1,"top"));
      if(/extendable/i.test(type)) parts.push(line(p(.5,1,0),p(.5,1,1),"extension-seam"));
    }
  } else if(kind === "tv-cart") {
    parts.push(box(0,.06,0,1,.08,1,"base"),box(.44,.14,.45,.12,.86,.1,"post"),box(.12,.64,.42,.76,.07,.1,"mount"),box(.18,.36,.1,.64,.05,.65,"shelf"));
    for(const x of [.05,.95]) for(const z of [0,1]) parts.push(<circle key={`wheel-${x}-${z}`} cx={p(x,.03,z)[0]} cy={p(x,.03,z)[1]} r="4" fill="#faf8f3"/>);
  } else if(kind === "trolley" || kind === "wine-rack" || kind === "open-wardrobe") {
    parts.push(...legs(1));
    for(const y of [.1,.5,.94]) parts.push(box(0,y,0,1,.04,1,`shelf-${y}`));
    if(kind === "trolley") for(const x of [.04,.95]) for(const z of [0,.95]) parts.push(<circle key={`wheel-${x}-${z}`} cx={p(x,0,z)[0]} cy={p(x,0,z)[1]} r="4" fill="#faf8f3"/>);
    if(kind === "wine-rack") for(let i=0;i<4;i++) parts.push(line(p(i/4,.15,0),p((i+1)/4,.45,0),`wine-${i}`),line(p(i/4,.45,0),p((i+1)/4,.15,0),`wine-cross-${i}`));
    if(kind === "open-wardrobe") parts.push(line(p(.08,.82,.5),p(.92,.82,.5),"hanging-rail"));
  } else if(kind === "nightstand" && /metal/i.test(type)) {
    parts.push(...legs(.95),box(0,.92,0,1,.08,1,"top"),box(0,.3,0,1,.04,1,"shelf"));
  } else if(kind !== "unknown") {
    const floating = kind.startsWith("floating");
    const bottom = floating ? 0 : .12;
    if(!floating) parts.push(...legs(bottom));
    parts.push(box(0,bottom,kind === "corner-wardrobe" ? .3 : 0,1,1-bottom,kind === "corner-wardrobe" ? .7 : 1,"case"));
    if(kind === "corner-wardrobe") parts.push(box(0,bottom,0,.43,1-bottom,.3,"corner-return"));
    if(kind.includes("nightstand")) drawers(2,bottom,1);
    else {
      const doors = /3-door/i.test(type) || kind.includes("tv") ? 3 : 2;
      const frontZ = kind === "corner-wardrobe" ? .3 : 0;
      for(let i=1;i<doors;i++) parts.push(line(p(i/doors,bottom,frontZ),p(i/doors,1,frontZ),`door-${i}`));
      for(let i=0;i<doors;i++) if(!(kind.includes("tv") && i===1)) parts.push(line(p((i+.85)/doors,.45,frontZ),p((i+.85)/doors,.6,frontZ),`pull-${i}`));
      if(kind.includes("tv")) parts.push(line(p(1/3,.58,0),p(2/3,.58,0),"media-shelf"));
    }
  }
  const abbreviations: Record<string,string> = {diameter:"Ø",length:"L","bed length":"L","headboard height":"HB","back cushions height":"BC","backrest height":"BH","width left":"Left","width right":"Right"};
  const label = (axis:"width"|"depth"|"height", short:string) => axes[axis] ? `${abbreviations[axes[axis]!.label.toLowerCase()] || short} ${axes[axis]!.text}` : `${short} —`;
  return <svg viewBox="0 0 380 284" className="mx-auto block h-auto w-full max-w-[460px]" role="img" aria-label={`${name}, ${type} schematic. ${label("width","W")}; ${label("height","H")}; ${label("depth","D")}. Not to scale.`}>
    <g stroke="#494740" strokeWidth="1.15" strokeLinejoin="round" strokeLinecap="round" fill="none">{parts}</g>
    <g stroke="#aaa69d" strokeWidth=".8" fill="none">
      <path d={`M${ox} 213V239 M${ox+w} 213V239 M${ox} 232H${ox+w} M${ox-3} 228l6 8 M${ox+w-3} 228l6 8`}/>
      <path d={`M${ox-21} ${202-dy}V${202-h-dy} M${ox-25} ${202-dy}h8 M${ox-25} ${202-h-dy}h8`}/>
      <path strokeDasharray="3 3" d={`M${ox-17} ${202-dy}H${ox+dx} M${ox-17} ${202-h-dy}H${ox+dx}`}/>
      <path d={`M${ox+w+14} 213l${dx} ${-dy} M${ox+w+11} 209l6 8 M${ox+w+dx+11} ${209-dy}l6 8`}/>
    </g>
    <g fill="currentColor" fontSize="13" fontFamily="inherit">
      <text x={ox+w/2} y="253" textAnchor="middle">{label("width","W")}</text>
      <text transform={`translate(${ox-30} ${202-dy-h/2}) rotate(-90)`} textAnchor="middle">{label("height","H")}</text>
      <text transform={`translate(${ox+w+dx/2+24} ${223-dy/2}) rotate(${-Math.atan2(dy,dx)*180/Math.PI})`} textAnchor="middle">{label("depth","D")}</text>
    </g>
  </svg>;
}
