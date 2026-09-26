import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

async function generate() {
    try {
        console.log("Generating Ethereal account...");
        const account = await nodemailer.createTestAccount();
        console.log("Got account!", account.user, account.pass);
        
        const envPath = path.join(__dirname, '.env');
        let envFile = fs.readFileSync(envPath, 'utf8');
        
        envFile = envFile.replace(/ETHEREAL_USER="dummy-ethereal-user"/g, `ETHEREAL_USER="${account.user}"`);
        envFile = envFile.replace(/ETHEREAL_PASS="dummy-ethereal-pass"/g, `ETHEREAL_PASS="${account.pass}"`);
        
        // Also just replace "dummy" if it was that
        envFile = envFile.replace(/ETHEREAL_USER="dummy"/g, `ETHEREAL_USER="${account.user}"`);
        envFile = envFile.replace(/ETHEREAL_PASS="dummy"/g, `ETHEREAL_PASS="${account.pass}"`);
        
        fs.writeFileSync(envPath, envFile);
        console.log("Successfully updated .env file!");
    } catch (e) {
        console.error(e);
    }
}
generate();
