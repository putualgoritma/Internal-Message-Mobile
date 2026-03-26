const fs = require('fs');
const http = require('http');

const url = 'http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false';
const marker = 'src\\components\\ConversationItem.tsx';

http
  .get(url, res => {
    let data = '';
    res.setEncoding('utf8');
    res.on('data', chunk => {
      data += chunk;
    });
    res.on('end', () => {
      const index = data.indexOf(marker);
      if (index < 0) {
        fs.writeFileSync('bundle-conversationitem-snippet.txt', 'NOT_FOUND');
        fs.writeFileSync('bundle-debug-probe.json', JSON.stringify({ status: res.statusCode, markerFound: false }, null, 2));
        console.log('marker not found');
        return;
      }

      const start = Math.max(0, index - 400);
      const end = Math.min(data.length, index + 3000);
      fs.writeFileSync('bundle-conversationitem-snippet.txt', data.slice(start, end));
      fs.writeFileSync(
        'bundle-debug-probe.json',
        JSON.stringify(
          {
            status: res.statusCode,
            markerFound: true,
            index,
            has_titleOverride: data.includes('titleOverride'),
            has_assigned_user_name: data.includes('assigned_user_name'),
            has_chat_hash: data.includes('Chat #'),
            has_conversation_hash: data.includes('Conversation #')
          },
          null,
          2,
        ),
      );
      console.log('snippet written');
    });
  })
  .on('error', err => {
    fs.writeFileSync('bundle-debug-probe.json', JSON.stringify({ error: err.message }, null, 2));
    console.error(err.message);
    process.exit(1);
  });
