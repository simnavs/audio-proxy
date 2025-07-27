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



