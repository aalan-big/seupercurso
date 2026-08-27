import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

async function uploadLogo() {
  const logoPath = path.resolve(__dirname, '../../../client/public/logo-header.png');
  const buffer = fs.readFileSync(logoPath);
  const base64Image = buffer.toString('base64');

  const postData = JSON.stringify({
    image: base64Image,
    type: 'base64',
  });

  const options = {
    hostname: 'api.imgur.com',
    port: 443,
    path: '/3/image',
    method: 'POST',
    headers: {
      'Authorization': 'Client-ID 5464b5e32d4b69d',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('LOGO_CDN_URL:', json.data?.link || json);
      } catch (e) {
        console.log('RESPONSE:', data);
      }
    });
  });

  req.on('error', (e) => console.error(e));
  req.write(postData);
  req.end();
}

uploadLogo();
