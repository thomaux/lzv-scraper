import * as puppeteer from 'puppeteer';
import { Browser, ElementHandle, Page } from 'puppeteer';

type ScrapeRegionResult = {
   name: string;
   gyms: string[];
};

const LZV_HOME = 'https://www.lzvcup.be';

// TODO: make a scraper for the teams?

async function recursiveScrapeGyms($gyms: ElementHandle<Element>[], result: string[], page: Page): Promise<string[]> {
   if(!$gyms.length) {
      return result;
   }

   const $curGym = $gyms.shift() as ElementHandle<Element>;

   const gymName = await page.evaluate( (el: Element) => el.textContent.substring(3), $curGym);

   result.push(gymName);

   return recursiveScrapeGyms($gyms, result, page);
}

//! there are multiple 'Sporthallen' links per region page!
async function getGymsForRegion(regionHref: string, browser: Browser): Promise<string[]> {
   const page = await browser.newPage();
   await page.goto(regionHref);

   const $gyms = await page.waitForXPath('//a[@class="btn btn-outline-primary"][text()[contains(.,"Sporthallen")]]');
   const gymHref = await page.evaluate(el => el.href, $gyms);

   await page.goto(gymHref);

   const $gymNames = await page.$x('//h5[@class="card-title"]');
   return recursiveScrapeGyms($gymNames, [], page);
}

async function recursiveScrapeRegions(
   $regions: ElementHandle<Element>[],
   result: ScrapeRegionResult[],
   page: Page,
   browser: Browser): Promise<ScrapeRegionResult[]> {
   if (!$regions.length) {
      return result;
   }

   const $curRegion = $regions.shift() as ElementHandle<Element>;

   const { href, text } = await page.evaluate(el => ({
      href: el.href as string,
      text: el.textContent as string,
   }), $curRegion);

   const gyms = await getGymsForRegion(href, browser);

   result.push({
      name: text,
      gyms,
   });

   return recursiveScrapeRegions($regions, result, page, browser);
}

async function scrape() {
   const browser = await puppeteer.launch({});
   const page = await browser.newPage();

   // Navigate to LZV
   await page.goto(LZV_HOME);

   // Fetch all regions from the main drop down
   const $regions = await page.$$("#lzvmainnav .dropdown-item");

   // Recurse through all regions
   const result = await recursiveScrapeRegions($regions, [], page, browser);

   // Output the result
   console.log(result)
   browser.close()
}
scrape();