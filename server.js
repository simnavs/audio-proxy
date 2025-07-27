const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

app.use("/stream", createProxyMiddleware({
  target: "https://radio2.pro-fhi.net/flux-ddrzvfve",
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

app.get("/", (req, res) => {
  res.redirect("/stream");
});

