const puppeteer = require('puppeteer');
const { articleExists, getSourceId, saveRawArticle } = require('../db/queries');

const SOURCE_NAME = 'KisanTak';
const LIST_URL = 'https://www.kisantak.in/';

async function fetchKisantak() {
  console.log(`Starting fetch for ${SOURCE_NAME}...`);
  const sourceId = await getSourceId(SOURCE_NAME);
  
  if (!sourceId) return;

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
    
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => {
          if (!href.includes('.kisantak.in') || href.length < 40) return false;
          if (href.includes('/page-') || href.includes('/page/')) return false;
          // Filter out top-level category URLs like /farming-tips-and-tricks
          const pathSegments = href.split('/').filter(Boolean);
          return pathSegments.length > 3; 
        })
        .filter((v, i, a) => a.indexOf(v) === i);
    });

    let newArticlesCount = 0;
    
    for (const link of links.slice(0, 10)) {
      if (await articleExists(link)) continue;

      console.log(`Scraping new article: ${link}`);
      try {
        const articlePage = await browser.newPage();
        await articlePage.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const articleData = await articlePage.evaluate(() => {
          const titleEl = document.querySelector('h1');
          const title = titleEl ? titleEl.innerText.trim() : document.title;
          
          const pEls = Array.from(document.querySelectorAll('p'));
          const content = pEls
            .map(p => p.innerText.trim())
            .filter(text => text.length > 50)
            .join('\n\n');
            
          return { title, content };
        });

        await articlePage.close();

        if (articleData.title && articleData.content) {
          await saveRawArticle(sourceId, link, articleData.title, articleData.content);
          newArticlesCount++;
        }
      } catch (err) {
        console.error(`Error scraping ${link}:`, err.message);
      }
    }
    console.log(`Finished ${SOURCE_NAME}. Added ${newArticlesCount} new articles.`);
  } catch (error) {
    console.error(`Error fetching ${SOURCE_NAME}:`, error);
  } finally {
    await browser.close();
  }
}

module.exports = fetchKisantak;
