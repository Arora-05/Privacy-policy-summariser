/**
 * What it does: Schedules a recurring cron job every Sunday at midnight to recheck all tracked sites for policy updates.
 * Why it exists: Automates background policy monitoring so users are notified of silent modifications without manual checks.
 * Connects to: node-cron package, Site model, and executeSiteRecheckLogic in src/routes/sites.js.
 */

const cron = require('node-cron');
const Site = require('../models/Site');
const { executeSiteRecheckLogic } = require('../routes/sites');

const CRON_SCHEDULE = process.env.RECHECK_CRON_SCHEDULE || '0 0 * * 0';

async function processAllSitesRecheck() {
  console.log('[Cron Job] Starting scheduled weekly privacy policy recheck for all tracked sites...');
  try {
    const sites = await Site.find();
    console.log(`[Cron Job] Found ${sites.length} sites to evaluate.`);

    for (const site of sites) {
      try {
        await executeSiteRecheckLogic(site);
      } catch (error) {
        console.error(`[Cron Job Error] Failed to recheck site ${site.name} (${site.url}): ${error.message}`);
      }
    }
    console.log('[Cron Job] Completed weekly privacy policy recheck cycle.');
  } catch (error) {
    console.error(`[Cron Job Fatal Error] Failed to retrieve sites from database: ${error.message}`);
  }
}

function startRecheckCronJob() {
  console.log(`[Cron Job] Initializing recheck scheduler with pattern: "${CRON_SCHEDULE}" (Every Sunday at midnight).`);
  const scheduledTask = cron.schedule(CRON_SCHEDULE, () => {
    processAllSitesRecheck();
  });
  return scheduledTask;
}

module.exports = {
  startRecheckCronJob,
  processAllSitesRecheck
};
