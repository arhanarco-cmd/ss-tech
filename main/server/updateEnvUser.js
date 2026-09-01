const argon2 = require('argon2');
const fs = require('fs');
const path = require('path');

async function updateEnv() {
  const userHash = await argon2.hash('916912');
  const adminHash = await argon2.hash('226020');
  
  const envPath = path.join(__dirname, '.env');
  let env = fs.readFileSync(envPath, 'utf8');
  
  env = env.replace(/USER_PIN_HASH=.*/, `USER_PIN_HASH=${userHash}`);
  env = env.replace(/ADMIN_PIN_HASH=.*/, `ADMIN_PIN_HASH=${adminHash}`);
  
  fs.writeFileSync(envPath, env);
  console.log('Updated .env with user (916912) and admin (226020) PIN hashes');
}

updateEnv().catch(console.error);
