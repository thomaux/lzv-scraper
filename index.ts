import * as puppeteer from 'puppeteer';
import { ElementHandle, Page } from 'puppeteer';

const LZV_HOME = 'https://www.lzvcup.be';

async function recursiveScrapeRegions(regionLinks: ElementHandle<Element>[], result: string[], page: Page): Promise<string[]> {
   if (!regionLinks.length) {
      return result;
   }

   const curLink = regionLinks.shift() as ElementHandle<Element>;

   const curRes = await page.evaluate(el => el.textContent, curLink);

   result.push(curRes);

   return recursiveScrapeRegions(regionLinks, result, page);
}

async function scrape() {
   const browser = await puppeteer.launch({});
   const page = await browser.newPage();

   // Navigate to LZV
   await page.goto(LZV_HOME);

   // Fetch all competitions from the main drop down
   const regionLinks = await page.$$("#lzvmainnav .dropdown-item");

   // Recurse through all competitions
   const result = await recursiveScrapeRegions(regionLinks, [], page);

   // Output the result
   console.log(result)
   browser.close()
}
scrape();