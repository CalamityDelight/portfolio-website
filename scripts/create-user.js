// Creates Axel's login, or changes the password if the username already exists.
// Run with: npm run create-user
// There is no public sign-up: this script is the only way to make an account.
require('dotenv').config({ quiet: true });
const readline = require('readline');
const bcrypt = require('bcrypt');
const { Client } = require('pg');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

// Asks without showing what you type, so the password never appears on screen
function askHidden(question) {
  process.stdout.write(question);
  rl._writeToOutput = () => {};
  return ask('').then((answer) => {
    rl._writeToOutput = (s) => process.stdout.write(s);
    process.stdout.write('\n');
    return answer;
  });
}

async function main() {
  const username = (await ask('Username: ')).trim();
  const password = await askHidden('Password (at least 10 characters): ');
  const repeat = await askHidden('Repeat password: ');
  rl.close();

  if (!username) throw new Error('Username cannot be empty.');
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (password !== repeat) throw new Error('The passwords do not match.');

  // bcrypt turns the password into a one-way hash. 12 is the "cost": how much
  // work each guess takes, which makes guessing passwords slow for an attacker.
  const hash = await bcrypt.hash(password, 12);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, hash]
  );
  await client.end();
  console.log(`Saved login for "${username}".`);
}

main().catch((err) => {
  rl.close();
  console.error('Could not save the login:', err.message);
  process.exit(1);
});
