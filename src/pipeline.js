const fetchKrishijagran = require('./fetchers/krishijagran');
const fetchAajtak = require('./fetchers/aajtak');
const fetchAbp = require('./fetchers/abp');
const fetchZeebiz = require('./fetchers/zeebiz');
const fetchKisanTak = require('./fetchers/kisantak');
const processPendingArticles = require('./ai/processor');

async function runPipeline() {
  console.log("=== STARTING ROSNI NEWS PIPELINE ===");
  
  // Step 1: Fetch from all sources sequentially
  console.log("\n[STEP 1] Fetching raw articles from sources...");
  await fetchKrishijagran();
  
  // We will uncomment these as we build them
  await fetchAajtak();
  await fetchAbp();
  await fetchZeebiz();
  await fetchKisanTak();

  // Step 2: Process any pending articles with AI (Text)
  console.log("\n[STEP 2] Processing fetched articles with AI...");
  await processPendingArticles();
  
  // Step 3: Generate images for processed articles
  console.log("\n[STEP 3] Generating images for articles...");
  const { processPendingImages } = require('./ai/imageGenerator');
  await processPendingImages();

  console.log("\n=== PIPELINE FINISHED ===");
}

if (require.main === module) {
  runPipeline().catch(console.error);
}

module.exports = runPipeline;
