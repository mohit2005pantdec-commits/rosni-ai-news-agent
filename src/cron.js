require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '..', 'pipeline.log');

// Format: minute hour day month dayOfWeek
// Default to every hour on the hour (0 * * * *) if CRON_SCHEDULE is not set
const schedule = process.env.CRON_SCHEDULE || '0 * * * *';

console.log(`🕒 Cron daemon started. Scheduled to run: ${schedule}`);
console.log(`📝 Logs will be written to: ${LOG_FILE}`);

// Setup log file stream
function appendLog(text) {
  fs.appendFileSync(LOG_FILE, text + '\n');
}

let isRunning = false;

cron.schedule(schedule, () => {
  if (isRunning) {
    console.log(`[${new Date().toISOString()}] Previous pipeline run is still active. Skipping this schedule.`);
    appendLog(`[${new Date().toISOString()}] Previous pipeline run is still active. Skipping this schedule.`);
    return;
  }

  isRunning = true;
  const startTime = new Date();
  const header = `\n\n=================================================================\n🚀 AUTOMATED RUN START: ${startTime.toLocaleString()}\n=================================================================\n`;
  
  console.log(header.trim());
  appendLog(header);

  const process = spawn('node', [path.join(__dirname, 'pipeline.js')]);

  process.stdout.on('data', (data) => {
    fs.appendFileSync(LOG_FILE, data);
  });

  process.stderr.on('data', (data) => {
    fs.appendFileSync(LOG_FILE, data);
  });

  process.on('close', (code) => {
    const endTime = new Date();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
    const footer = `\n✅ AUTOMATED RUN FINISHED: ${endTime.toLocaleString()} (Duration: ${duration} mins) (Exit code: ${code})\n=================================================================\n`;
    
    console.log(`[${endTime.toISOString()}] Pipeline finished. See pipeline.log for details.`);
    appendLog(footer);
    
    isRunning = false;
  });
});
