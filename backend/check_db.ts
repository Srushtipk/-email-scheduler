import { prisma } from './src/config/db';

async function run() {
    const campaigns = await prisma.campaign.findMany();
    const jobs = await prisma.emailJob.findMany();
    console.log(`Campaigns: ${campaigns.length}, Jobs: ${jobs.length}`);
    console.log(campaigns);
}
run();
