import { prisma } from './src/config/db';
async function run() {
    const jobs = await prisma.emailJob.findMany();
    console.log(jobs);
}
run();
