const puppeteer = require('puppeteer');
const { articleExists, getSourceId, saveRawArticle } = require('../db/queries');

const SOURCE_NAME = 'Krishijagran';
const LIST_URL = 'https://hindi.krishijagran.com/news';

async function fetchKrishijagran() {
  console.log(`Starting fetch for ${SOURCE_NAME}...`);
  const sourceId = await getSourceId(SOURCE_NAME);
  
  if (!sourceId) {
    console.error(`Could not find source ID for ${SOURCE_NAME}. Make sure it is in the DB.`);
    return;
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    // 1. Go to the listing page
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded' });
    
    // 2. Extract article links (Finding typical anchor tags inside news blocks)
    // We might need to adjust selectors based on the actual HTML structure
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      return anchors
        .map(a => a.href)
        .filter(href => href.includes('/news/') || href.includes('/agriculture/'))
        // Basic deduplication of links on the page
        .filter((v, i, a) => a.indexOf(v) === i);
    });

    console.log(`Found ${links.length} potential links on ${SOURCE_NAME}`);

    // 3. Process each link
    let newArticlesCount = 0;
    
    for (const link of links.slice(0, 10)) { // Limit to top 10 to avoid huge initial scrapes
      // Check if we already have it
      const exists = await articleExists(link);
      if (exists) {
        console.log(`Skipping (already exists): ${link}`);
        continue;
      }

      console.log(`Scraping new article: ${link}`);
      
      try {
        const articlePage = await browser.newPage();
        await articlePage.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Extract title and text
        const articleData = await articlePage.evaluate(() => {
          // Attempt to find the main title (h1 is standard)
          const titleEl = document.querySelector('h1');
          const title = titleEl ? titleEl.innerText.trim() : document.title;
          
          // Attempt to find paragraphs of the article body
          // We avoid nav, footer, etc by selecting standard p tags and joining them
          const pEls = Array.from(document.querySelectorAll('p'));
          const content = pEls
            .map(p => p.innerText.trim())
            .filter(text => text.length > 50) // Filter out tiny UI snippets
            .join('\n\n');
            
          return { title, content };
        });

        await articlePage.close();

        if (articleData.title && articleData.content) {
          await saveRawArticle(sourceId, link, articleData.title, articleData.content);
          newArticlesCount++;
        } else {
          console.log(`Skipped ${link} - not enough content found.`);
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

// Allow running this script directly for testing
if (require.main === module) {
  fetchKrishijagran();
}

module.exports = fetchKrishijagran;
