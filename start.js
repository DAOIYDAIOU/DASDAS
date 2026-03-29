require('dotenv').config();

console.log('Starting TRENDSETTER on Bothost...');
console.log(`PORT=${process.env.PORT || 3000}`);
console.log(`WEB_APP_URL=${process.env.WEB_APP_URL || 'not set'}`);
console.log(`ADMIN_CHAT_ID=${process.env.ADMIN_CHAT_ID || 'not set'}`);
console.log(`BOT_TOKEN=${process.env.BOT_TOKEN ? 'set' : 'missing'}`);

require('./server');
require('./bot');
