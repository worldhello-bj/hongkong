// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
const model=JSON.parse(readFileSync('../data/normalized/model.json','utf-8'));
const levels=JSON.parse(readFileSync('public/preview/geometry-ADM-levels.json','utf-8'));
const units=JSON.parse(readFileSync('public/preview/geometry-ADM-units.json','utf-8'));
vi.mock('maplibre-gl',()=>({default:{Map:class{constructor(){throw new Error('WebGL context creation failed requestedAttributes '+JSON.stringify({antialias:true,huge:'x'.repeat(5000)}))}},AttributionControl:class{}}}));
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs()});
it('renders real official polygons in SVG when WebGL construction fails, without exposing raw errors',async()=>{
 vi.useFakeTimers();vi.resetModules();vi.stubEnv('VITE_REPLAY_PREVIEW','0');document.body.innerHTML='<div id="app"></div>';
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>({result:String(url).includes('bootstrap')?model:String(url).includes('geometry?layer=levels')?levels:String(url).includes('geometry?layer=units')?units:String(url).includes('bus/services')?{services:[]}:{state:'UNAVAILABLE',predictions:[]}})})));
 await import('../src/main');for(let i=0;i<20;i++)await Promise.resolve();
 document.querySelector<HTMLButtonElement>('#map-view')!.click();
 await vi.waitFor(()=>expect(document.querySelector('#map-caption')!.textContent).toContain('二維軟件渲染'));
 expect(document.querySelectorAll('#diagram path').length).toBeGreaterThan(100);
 expect(document.querySelector<HTMLElement>('#geo-map')!.style.display).toBe('none');
 expect(document.querySelector<HTMLElement>('#map-empty')!.hidden).toBe(true);
 expect(document.querySelector('#selected-info')!.textContent).toContain('已改用');
 expect(document.body.textContent).not.toContain('requestedAttributes');
 expect(document.querySelector('#selected-info')!.textContent!.length).toBeLessThan(120);
 document.querySelector<HTMLButtonElement>('[data-floor="L5"]')!.click();
 await vi.waitFor(()=>expect(document.querySelectorAll('#diagram path').length).toBeLessThan(100));
 expect(document.querySelectorAll('#diagram path').length).toBeGreaterThan(0);
});
