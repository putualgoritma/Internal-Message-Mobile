const fs = require('fs');
const https = require('https');
const {execSync} = require('child_process');

function readSessionToken() {
  const raw = execSync('sqlite3 rkstorage.db "SELECT value FROM catalystLocalStorage WHERE key=\'@ptab_internal:session_token\';"', {
    encoding: 'utf8',
  }).trim();
  return raw;
}

function requestJson(url, token) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
      res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({status: res.statusCode || 0, body});
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    const token = readSessionToken();
    const base = 'https://internalchat.ptab-vps-storage.com/api/close/internal-ops';

    const conv = await requestJson(`${base}/conversations`, token);
    fs.writeFileSync('debug-conversations-response.json', conv.body);

    let conversationIds = [];
    try {
      const parsed = JSON.parse(conv.body);
      const rows = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.data)
          ? parsed.data
          : Array.isArray(parsed?.data?.items)
            ? parsed.data.items
          : Array.isArray(parsed?.items)
            ? parsed.items
            : [];
      conversationIds = rows.map(row => Number(row.id)).filter(Number.isFinite).slice(0, 3);
    } catch {
      // ignore parsing failure
    }

    const messagesByConversation = {};
    for (const id of conversationIds) {
      const msg = await requestJson(`${base}/conversations/${id}/messages`, token);
      messagesByConversation[id] = {
        status: msg.status,
        raw: (() => {
          try {
            return JSON.parse(msg.body);
          } catch {
            return msg.body;
          }
        })(),
      };
    }

    fs.writeFileSync('debug-messages-response.json', JSON.stringify(messagesByConversation, null, 2));
    console.log('ok');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
