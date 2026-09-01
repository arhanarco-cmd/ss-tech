const argon2 = require('argon2');
require('dotenv').config();

async function check() {
  const isMatch = await argon2.verify(process.env.USER_PIN_HASH, '123456');
  console.log('USER_PIN_HASH matches 123456:', isMatch);
}

check().catch(console.error);
