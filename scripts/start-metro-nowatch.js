const path = require('path');
const Metro = require('metro');
const {loadConfig} = require('metro-config');

async function main() {
  process.env.CI = '1';
  const projectRoot = path.resolve(__dirname, '..');
  const config = await loadConfig({
    projectRoot,
    cwd: projectRoot,
    resetCache: process.env.RESET_CACHE === '1',
  });
  const port = process.env.RCT_METRO_PORT
    ? Number(process.env.RCT_METRO_PORT)
    : 8081;
  config.server.port = port;
  await Metro.runServer(config, {
    host: '0.0.0.0',
    port,
    watch: false,
    waitForBundler: true,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});