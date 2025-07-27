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
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 10000;
const TARGET_URL = "https://radio2.pro-fhi.net";

// CORS middleware for preflight requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Proxy configuration
const proxyOptions = {
  target: TARGET_URL,
  changeOrigin: true,
  followRedirects: true,
  secure: true,
  timeout: 30000, // 30 seconds timeout
  pathRewrite: {
    "^/stream": "/listen-ddrzvfve-stream.mp3"
  },
  onProxyRes: (proxyRes, req, res) => {
    // Set CORS headers
    proxyRes.headers["Access-Control-Allow-Origin"] = "*";
    proxyRes.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    proxyRes.headers["Access-Control-Allow-Headers"] = "Origin, X-Requested-With, Content-Type, Accept, Authorization";
    
    // For audio streaming, preserve important headers
    if (proxyRes.headers["content-type"]) {
      res.setHeader("Content-Type", proxyRes.headers["content-type"]);
    }
    if (proxyRes.headers["content-length"]) {
      res.setHeader("Content-Length", proxyRes.headers["content-length"]);
    }
    
    // Enable streaming for audio
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
  },
  onError: (err, req, res) => {
    console.error("Proxy error:", err.message);
    res.status(500).json({ 
      error: "Proxy error", 
      message: "Unable to connect to the target server" 
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${req.method} ${req.url} to ${TARGET_URL}${req.url}`);
  }
};

// Apply proxy middleware to specific routes
app.use("/stream", createProxyMiddleware(proxyOptions));

// Also handle direct access to the stream
app.use("/listen-ddrzvfve-stream.mp3", createProxyMiddleware({
  ...proxyOptions,
  pathRewrite: {
    "^/listen-ddrzvfve-stream.mp3": "/listen-ddrzvfve-stream.mp3"
  }
}));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ 
    error: "Internal server error", 
    message: err.message 
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ 
    error: "Not found", 
    message: `Route ${req.originalUrl} not found` 
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Proxy server is running on port ${PORT}`);
  console.log(`📡 Proxying to: ${TARGET_URL}`);
  console.log(`🎵 Stream available at: http://localhost:${PORT}/stream`);
  console.log(`💓 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;