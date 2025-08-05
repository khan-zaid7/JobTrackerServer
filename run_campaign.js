import minimist from 'minimist'; 
import {spawn} from 'child_process';
import {v4 as uuidv4} from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const argv = minimist(process.argv.slice(2), {
   string: ['_'],
   default: {matches: 1, tailors: 1, scrapers: 1} 
});

const targetRole = argv._[0];
if (!targetRole){
    console.error(`Error: You must provide a role. Example: node run_campain.js  "Devops Engineer" --matches=10`);
    process.exit(1);
}

const campaignId = uuidv4();

console.log(`---Launching New Compaign---\nTarget Role: ${targetRole}\nCampaign ID: ${campaignId}`);
console.log(`MATCHERS: ${argv.matchers}, TAILORS: ${argv.tailors}, SCRAPERS: ${argv.scrapers}`);
console.log(`-----------------------------`);

const envBase = {
    ...process.env, 
    CAMPAIGN_ID: campaignId, 
    CAMPAIGN_TARGET: targetRole
};

async function spawnWorkers(path, roleName, count){
    for (let i=0; i<count; i++){
        const env = {
            ...envBase, 
            WORKER_ROLE: roleName, 
            WORKER_INSTANCE_ID: String(i)
        };
        const child = spawn('node', [path], {env, stdio: 'inherit'});
        child.on('error', (err) => console.error(`Error spawing ${roleName} #${i}:`, err));
        child.on('close', (code) => console.log(`${roleName} #${i} exited with code ${code}`));
    }
} 

spawnWorkers('services/scraper/linkedin/scraper-worker.js', 'scraper', Number(argv.scrapers));
spawnWorkers('services/matchAndTailor/linkedin/matcher-worker.js', 'matcher', Number(argv.matchers));
spawnWorkers('services/matchAndTailor/linkedin/tailor-worker.js', 'tailor', Number(argv.tailors));