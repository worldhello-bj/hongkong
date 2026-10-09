// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
const model=JSON.parse(readFileSync('../data/normalized/model.json','utf-8'));
const example=JSON.parse(readFileSync('public/preview/journey-example.json','utf-8'));
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs()});
it('aligns recorded preview origin, destination and Hong Kong departure with its displayed journey',async()=>{
 vi.useFakeTimers();vi.resetModules();vi.stubEnv('VITE_REPLAY_PREVIEW','1');document.body.innerHTML='<div id="app"></div>';
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>String(url).includes('journey-example')?example:{result:String(url).includes('bootstrap')?model:String(url).includes('bus-services')?{services:[]}:{state:'REPLAY',predictions:[]}}})));
 await import('../src/main');for(let i=0;i<30;i++)await Promise.resolve();
 const request=example.result.request;
 expect(document.querySelector<HTMLSelectElement>('#from')!.value).toBe(request.from_id);
 expect(document.querySelector<HTMLSelectElement>('#to')!.value).toBe(request.to_id);
 expect(document.querySelector<HTMLInputElement>('#depart')!.value).toBe('2026-10-09T21:00');
 expect(document.querySelector('#form-status')!.textContent).toContain('唯讀記錄');
 expect(document.querySelector<HTMLButtonElement>('#plan-button')!.disabled).toBe(true);
 expect(document.querySelector<HTMLSelectElement>('#mode')!.value).toBe('REPLAY');
});
