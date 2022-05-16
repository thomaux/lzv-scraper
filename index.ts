import * as puppeteer from 'puppeteer';
import { Browser, ElementHandle, Page } from 'puppeteer';
import { writeFile } from 'fs/promises';

type Named = {
   name: string;
};

type ScrapeRegionResult = GymsAndLowestLevelForRegion & Named;

type RegionLink = {
   href: string;
} & Named;

type GymsAndLowestLevelForRegion = {
   gyms: string[];
   lowestPossibleLevel: number;
};

const LZV_HOME = 'https://www.lzvcup.be';

// TODO: make a scraper for the teams?

async function getGyms($gyms: ElementHandle<Element>[], result: string[], page: Page): Promise<string[]> {
   if(!$gyms.length) {
      return result;
   }

   const $curGym = $gyms.shift() as ElementHandle<Element>;

   const gymName = await page.evaluate( (el: Element) => el.textContent.substring(3), $curGym);

   if(!result.includes(gymName)) {
      result.push(gymName);
   }

   return getGyms($gyms, result, page);
}

async function getGymsOfCompetition(competitionGymLinks: string[], result: string[], browser: Browser): Promise<string[]> {
   if(!competitionGymLinks.length) {
      return result;
   }

   const curLink = competitionGymLinks.shift() as string;
   const page = await browser.newPage();

   await page.goto(curLink);

   const $gyms = await page.$x('//h5[@class="card-title"]');

   await getGyms($gyms, result, page)
   await page.close();

   return getGymsOfCompetition(competitionGymLinks, result, browser);
}

async function getCompetitionGymLinks($gyms: ElementHandle<Element>[], result: string[], page: Page): Promise<string[]> {
   if(!$gyms.length) {
      return result;
   }

   const $curGym = $gyms.shift() as ElementHandle<Element>;
   const gymHref = await page.evaluate(el => el.href, $curGym);

   result.push(gymHref);

   return getCompetitionGymLinks($gyms, result, page);
}

async function getLowestPossibleLevelOfRegion($competitionLinks: ElementHandle<Element>[], result: number, page: Page): Promise<number> {
   if(!$competitionLinks.length) {
      return result;
   }

   const $curLink = $competitionLinks.shift() as ElementHandle<Element>;
   const curLevel = await page.evaluate((el: HTMLButtonElement) => parseInt(el.textContent.match(/\d+/)[0]), $curLink);

   return getLowestPossibleLevelOfRegion($competitionLinks, curLevel > result ? curLevel : result, page);
}

async function getGymsAndLowestLevelForRegion(regionHref: string, browser: Browser): Promise<GymsAndLowestLevelForRegion> {
   const page = await browser.newPage();
   await page.goto(regionHref);

   const $gyms = await page.$x('//a[@class="btn btn-outline-primary"][text()[contains(.,"Sporthallen")]]');
   const competitionGymLinks = await getCompetitionGymLinks($gyms, [], page);
   
   const $competitions = await page.$x('//a[@class="btn btn-outline-primary"][text()[not(contains(.,"Sporthallen"))]]');
   const lowestPossibleLevel = await getLowestPossibleLevelOfRegion($competitions, 1, page);

   await page.close();

   const gyms = await getGymsOfCompetition(competitionGymLinks, [], browser);

   return {
      lowestPossibleLevel,
      gyms,
   };
}

async function getRegions(
   regionLinks: RegionLink[],
   result: ScrapeRegionResult[],
   browser: Browser): Promise<ScrapeRegionResult[]> {
   if (!regionLinks.length) {
      return result;
   }

   const { name, href } = regionLinks.shift() as RegionLink;

   const gymsAndLowestLevel = await getGymsAndLowestLevelForRegion(href, browser);

   result.push({
      name,
      ...gymsAndLowestLevel,
   });

   return getRegions(regionLinks, result, browser);
}

async function output(result: ScrapeRegionResult[]): Promise<void> {
   return writeFile('output.json', JSON.stringify(result, undefined, 4));
}

async function getRegionLinks(
   $regions: ElementHandle<Element>[],
   result: RegionLink[],
   page: Page,
): Promise<RegionLink[]> {
   if(!$regions.length) {
      return result;
   }

   const $curRegion = $regions.shift() as ElementHandle<Element>;

   const link = await page.evaluate(el => ({
      href: el.href as string,
      name: el.textContent as string,
   }), $curRegion);

   result.push(link);

   return getRegionLinks($regions, result, page);
}

async function scrape() {
   const browser = await puppeteer.launch({});
   const page = await browser.newPage();

   // Navigate to LZV
   await page.goto(LZV_HOME);

   // Fetch all regions from the main drop down
   const $regions = await page.$$("#lzvmainnav .dropdown-item");

   const regionLinks = await getRegionLinks($regions, [], page);
   await page.close();

   // Recurse through all regions
   const result = await getRegions(regionLinks, [], browser);

   // Output the result
   await output(result);
   browser.close();
}
scrape();