
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

const server = http.createServer((req, res) => {
  // Parse the target URL
  const targetUrl = url.parse(TARGET_URL);
  
  // Set CORS headers to allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`Proxying ${req.method} ${req.url} to ${TARGET_URL}`);
  
  // Create options for the proxy request
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.path + (req.url.startsWith('/') ? req.url.slice(1) : req.url),
    method: req.method,
    timeout: 30000, // 30 second timeout
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'en-US,en;q=0.9',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'Host': targetUrl.hostname,
      // Copy some original headers but filter problematic ones
      ...(req.headers.range && { 'Range': req.headers.range }),
      ...(req.headers.referer && { 'Referer': req.headers.referer })
    }
  };
  
  // Choose http or https based on target URL
  const protocol = targetUrl.protocol === 'https:' ? https : http;
  
  // Create the proxy request
  const proxyReq = protocol.request(options, (proxyRes) => {
    console.log(`Response status: ${proxyRes.statusCode}`);
    console.log(`Response headers:`, proxyRes.headers);
    
    // Copy status code and headers from target response
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Pipe the response from target to client
    proxyRes.pipe(res);
    
    proxyRes.on('error', (err) => {
      console.error('Target response error:', err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Proxy response error');
      }
    });
  });
  
  // Set timeout for the request
  proxyReq.setTimeout(30000, () => {
    console.error('Request timeout');
    proxyReq.destroy();
    if (!res.headersSent) {
      res.writeHead(408);
      res.end('Request timeout');
    }
  });
  
  // Handle proxy request errors
  proxyReq.on('error', (err) => {
    console.error('Proxy request error:', err.message);
    if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
      console.log('Connection was reset or broken, this is normal for streaming');
    }
    if (!res.headersSent) {
      res.writeHead(502);
      res.end(`Proxy error: ${err.message}`);
    }
  });
  
  // Handle client disconnect
  req.on('close', () => {
    proxyReq.destroy();
  });
  
  // Pipe the request from client to target
  req.pipe(proxyReq);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
});

// Start the server
server.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`Proxying requests to: ${TARGET_URL}`);
  console.log(`Access the stream at: http://localhost:${PORT}`);
});

// Graceful shutdown
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

