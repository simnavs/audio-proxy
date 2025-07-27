
/*
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

app.use("", createProxyMiddleware({
  target: "https://radio2.pro-fhi.net/listen-ddrzvfve-stream.mp3",
  changeOrigin: true,
  pathRewrite: {
    "^/stream": "/listen-ddrzvfve-stream.mp3"
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers["Access-Control-Allow-Origin"] = "*";
  }
}));

app.listen(10000, () => {
  console.log("Proxy is running on port 10000");
});

*/

const http = require('http');
const https = require('https');
const url = require('url');

const TARGET_URL = 'https://radio2.pro-fhi.net/flux-ddrzvfve/stream';
const PORT = process.env.PORT || 10000;

// Create an agent with keep-alive disabled to avoid connection reuse issues
const httpsAgent = new https.Agent({
  keepAlive: false,
  maxSockets: 1,
  timeout: 30000
});

const httpAgent = new http.Agent({
  keepAlive: false,
  maxSockets: 1,
  timeout: 30000
});

const server = http.createServer((req, res) => {
  const targetUrl = url.parse(TARGET_URL);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`Proxying ${req.method} ${req.url} to ${TARGET_URL}`);
  
  // Try multiple approaches in sequence
  tryDirectConnection(targetUrl, req, res)
    .catch((err) => {
      console.log('Direct connection failed, trying with fetch...');
      return tryWithFetch(targetUrl, req, res);
    })
    .catch((err) => {
      console.error('All connection methods failed:', err.message);
      if (!res.headersSent) {
        res.writeHead(503);
        res.end(`Unable to connect to stream: ${err.message}`);
      }
    });
});

function tryDirectConnection(targetUrl, req, res) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || 443,
      path: targetUrl.path,
      method: 'GET',
      agent: targetUrl.protocol === 'https:' ? httpsAgent : httpAgent,
      headers: {
        'User-Agent': 'VLC/3.0.16 LibVLC/3.0.16',
        'Accept': '*/*',
        'Connection': 'close',
        'Host': targetUrl.hostname,
        'Icy-MetaData': '1'
      }
    };
    
    const protocol = targetUrl.protocol === 'https:' ? https : http;
    
    const proxyReq = protocol.request(options, (proxyRes) => {
      console.log(`Response status: ${proxyRes.statusCode}`);
      console.log(`Response headers:`, Object.keys(proxyRes.headers));
      
      if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
        // Success - pipe the response
        res.writeHead(proxyRes.statusCode, {
          ...proxyRes.headers,
          'Access-Control-Allow-Origin': '*'
        });
        
        proxyRes.pipe(res);
        
        proxyRes.on('end', () => {
          console.log('Stream ended normally');
          resolve();
        });
        
        proxyRes.on('error', (err) => {
          console.error('Response stream error:', err.message);
          reject(err);
        });
      } else {
        reject(new Error(`HTTP ${proxyRes.statusCode}`));
      }
    });
    
    proxyReq.setTimeout(10000, () => {
      console.log('Request timeout - this might be normal for a stream');
      proxyReq.destroy();
      reject(new Error('Connection timeout'));
    });
    
    proxyReq.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });
    
    // Handle client disconnect
    req.on('close', () => {
      console.log('Client disconnected');
      proxyReq.destroy();
    });
    
    proxyReq.end();
  });
}

async function tryWithFetch(targetUrl, req, res) {
  // Fallback method using a different approach
  return new Promise((resolve, reject) => {
    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || 443,
      path: targetUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'audio/*,*/*;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'close',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };
    
    const protocol = targetUrl.protocol === 'https:' ? https : http;
    
    const proxyReq = protocol.get(options, (proxyRes) => {
      console.log(`Fallback response status: ${proxyRes.statusCode}`);
      
      if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 400) {
        res.writeHead(proxyRes.statusCode, {
          ...proxyRes.headers,
          'Access-Control-Allow-Origin': '*'
        });
        
        proxyRes.pipe(res);
        resolve();
      } else {
        reject(new Error(`HTTP ${proxyRes.statusCode}`));
      }
    });
    
    proxyReq.on('error', (err) => {
      reject(err);
    });
    
    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      reject(new Error('Fallback timeout'));
    });
  });
}

// Test the target URL on startup
function testConnection() {
  console.log('Testing connection to target URL...');
  const targetUrl = url.parse(TARGET_URL);
  
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 443,
    path: targetUrl.path,
    method: 'HEAD',
    timeout: 5000,
    headers: {
      'User-Agent': 'curl/7.68.0'
    }
  };
  
  const testReq = https.request(options, (testRes) => {
    console.log(`✓ Target URL responds with status: ${testRes.statusCode}`);
    console.log(`✓ Content-Type: ${testRes.headers['content-type'] || 'unknown'}`);
  });
  
  testReq.on('error', (err) => {
    console.log(`⚠ Target URL test failed: ${err.message}`);
    console.log('This might indicate the stream requires specific conditions');
  });
  
  testReq.setTimeout(5000, () => {
    console.log('⚠ Target URL test timeout');
    testReq.destroy();
  });
  
  testReq.end();
}

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Proxying requests to: ${TARGET_URL}`);
  console.log(`Access the stream at: http://localhost:${PORT}`);
  console.log('---');
  testConnection();
});

process.on('SIGINT', () => {
  console.log('\nShutting down proxy server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down proxy server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

