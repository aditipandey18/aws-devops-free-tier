const express = require('express');
const os = require('os');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET = process.env.S3_BUCKET_NAME || '';

app.use(express.json());

// Simple request logger -> writes to a log file that CloudWatch Agent will tail
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logFile = path.join(logDir, 'app.log');

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms\n`;
    fs.appendFile(logFile, line, () => {});
  });
  next();
});

// Health check endpoint - used by load balancer / monitoring
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', host: os.hostname(), uptime: process.uptime() });
});

// Root
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Free-Tier Sample API',
    hostname: os.hostname(),
    timestamp: new Date().toISOString()
  });
});

// Simple in-memory "items" API to demonstrate CRUD + latency you can load-test
let items = [];
let nextId = 1;

app.get('/api/items', (req, res) => {
  res.json(items);
});

app.post('/api/items', (req, res) => {
  const item = { id: nextId++, ...req.body, createdAt: new Date().toISOString() };
  items.push(item);
  res.status(201).json(item);
});

app.get('/api/items/:id', (req, res) => {
  const item = items.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

// Example S3 integration - list objects in the configured bucket
if (BUCKET) {
  const s3 = new AWS.S3({ region: REGION });
  app.get('/api/backups', async (req, res) => {
    try {
      const data = await s3.listObjectsV2({ Bucket: BUCKET }).promise();
      res.json(data.Contents ? data.Contents.map(o => ({ key: o.Key, size: o.Size })) : []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// Artificial CPU-bound endpoint - useful for load testing / CloudWatch CPU alarms
app.get('/api/compute', (req, res) => {
  let sum = 0;
  for (let i = 0; i < 5_000_000; i++) sum += Math.sqrt(i);
  res.json({ result: sum });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
