import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=fileURLToPath(new URL('./',import.meta.url));
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[extname(path)]??'text/plain');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:width===1440?1000:844},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/validation/ticket-page/fixture.html');await page.locator('[data-ticket-action="confirm"]').waitFor();
  const check=async(phase)=>{const metrics=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,focus:document.activeElement?.id,inputCount:document.querySelectorAll('input,form').length}));assert.ok(metrics.width<=width,`overflow ${width} ${phase}: ${metrics.width}`);assert.equal(metrics.inputCount,0);results.push({width,phase,...metrics});};
  await check('confirm');
  // Native keyboard activation progresses the focused button.
  await page.locator('[data-ticket-action="confirm"]').focus();await page.keyboard.press('Enter');await check('summary');
  if(width!==320)await page.screenshot({path:output+`summary-${width}.png`,fullPage:true});
  await page.locator('[data-ticket-action="issue"]').click();await page.locator('.tp-issuing').waitFor();await check('issuing');
  await page.locator('.tp-credential').waitFor();await page.waitForTimeout(650);await check('issued');
  await page.screenshot({path:output+`credential-${width}.png`,fullPage:true});
  const passId=await page.evaluate(()=>window.ticketFixture.controller.snapshot().pass.id);
  await page.evaluate(()=>{window.ticketFixture.changeClock();});assert.match(await page.locator('.tp-alert').textContent(),/当时行程/);
  await page.goto(origin+'/validation/ticket-page/fixture.html#wallet');await page.locator('[data-ticket-action="open-pass"]').click();await page.locator('.tp-credential').waitFor();assert.equal(await page.evaluate(()=>window.ticketFixture.controller.snapshot().pass.id),passId);
  assert.deepEqual(errors,[]);await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await page.goto(origin+'/validation/ticket-page/fixture.html');await page.locator('[data-ticket-action="confirm"]').click();await page.locator('[data-ticket-action="issue"]').click();await page.locator('.tp-credential').waitFor();assert.equal(await page.locator('.tp-credential').evaluate(el=>getComputedStyle(el).animationName),'none');results.push({reducedMotion:true,animation:'none'});await page.close();
 await writeFile(output+'browser-results.json',JSON.stringify({scope:'Standalone ticket module fixture, not integrated application',results},null,2));
 console.log(`PASS: ${results.length} browser checks; screenshots saved under validation/ticket-page/`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
