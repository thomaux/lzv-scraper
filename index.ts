import * as puppeteer from 'puppeteer';
import { Browser, ElementHandle, Page } from 'puppeteer';

type ScrapeRegionResult = {
   name: string;
   gyms: string[];
};

const LZV_HOME = 'https://www.lzvcup.be';

// TODO: make a scraper for the teams?

async function scrapeGyms($gyms: ElementHandle<Element>[], result: string[], page: Page): Promise<string[]> {
   if(!$gyms.length) {
      return result;
   }

   const $curGym = $gyms.shift() as ElementHandle<Element>;

   const gymName = await page.evaluate( (el: Element) => el.textContent.substring(3), $curGym);

   result.push(gymName);

   return scrapeGyms($gyms, result, page);
}

async function scrapeCompetitions(gymHrefs: string[], result: string[], browser: Browser): Promise<string[]> {
   if(!gymHrefs.length) {
      return result;
   }

   const curHref = gymHrefs.shift() as string;
   const page = await browser.newPage();

   await page.goto(curHref);

   const $gyms = await page.$x('//h5[@class="card-title"]');

   return scrapeCompetitions(gymHrefs, await scrapeGyms($gyms, result, page), browser);
}

async function scrapeGymHrefs($gyms: ElementHandle<Element>[], result: string[], page: Page): Promise<string[]> {
   if(!$gyms.length) {
      return result;
   }

   const $curGym = $gyms.shift() as ElementHandle<Element>;
   const gymHref = await page.evaluate(el => el.href, $curGym);

   result.push(gymHref);

   return scrapeGymHrefs($gyms, result, page);
}

async function scrapeGymsForRegion(regionHref: string, browser: Browser): Promise<string[]> {
   const page = await browser.newPage();
   await page.goto(regionHref);

   const $gyms = await page.$x('//a[@class="btn btn-outline-primary"][text()[contains(.,"Sporthallen")]]');
   const gymHrefs = await scrapeGymHrefs($gyms, [], page);

   return scrapeCompetitions(gymHrefs, [], browser);
}

async function scrapeRegions(
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

   const gyms = await scrapeGymsForRegion(href, browser);

   result.push({
      name: text,
      gyms,
   });

   return scrapeRegions($regions, result, page, browser);
}

async function output(result: ScrapeRegionResult[]): Promise<void> {
   console.log(result)
}

async function scrape() {
   const browser = await puppeteer.launch({});
   const page = await browser.newPage();

   // Navigate to LZV
   await page.goto(LZV_HOME);

   // Fetch all regions from the main drop down
   const $regions = await page.$$("#lzvmainnav .dropdown-item");

   // Recurse through all regions
   const result = await scrapeRegions($regions, [], page, browser);

   // Output the result
   await output(result);
   browser.close();
}
scrape();