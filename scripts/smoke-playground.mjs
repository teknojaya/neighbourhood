import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { stubMapTiles } from './map-test-tiles.mjs';
const web=process.env.SMOKE_WEB_URL??'http://localhost:5173';assert(['localhost','127.0.0.1'].includes(new URL(web).hostname));
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??'msedge'});
try{
 for(const role of ['owner','neighbour','volunteer','moderator','newcomer']){
  const context=await browser.newContext({viewport:{width:440,height:956}});await stubMapTiles(context);const page=await context.newPage();page.setDefaultTimeout(20000);
  await page.goto(web+'/login');const profile=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/me'&&response.ok());await page.getByRole('button',{name:role,exact:true}).click();await page.waitForURL(url=>url.pathname==='/');const me=await (await profile).json();assert(me.profile.homeLocation&&me.profile.displayName&&me.profile.areaLabel,role+': incomplete profile');
  for(const [route,endpoint,min] of [['/activity?tab=requests','/api/v1/requests/outgoing',1],['/notifications','/api/v1/notifications',1],['/needs/saved','/api/v1/needs',3]]){
   const data=page.waitForResponse(response=>new URL(response.url()).pathname===endpoint&&response.ok()).catch(error=>{throw new Error(role+': '+route+' expected '+endpoint+' ('+error.name+')');});await page.goto(web+route);assert((await (await data).json()).items.length>=min,role+': missing '+route+' at '+endpoint);
  }
  await page.goto(web+'/explore');await page.locator('.product-map-pin').first().waitFor();
  console.log(`PASS ${role}: complete profile, requests, notification history, saved needs and mapped products in an independent browser context`);await context.close();
 }
}finally{await browser.close();}
