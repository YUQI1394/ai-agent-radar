const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = {
  'agents:latest': 'agents.json',
  'agents:archive': 'archive.json',
  'weekly:reports': 'weekly-reports.json'
};

function fileFor(key) {
  const name = FILES[key];
  return name ? path.join(DATA_DIR, name) : null;
}

function readJson(file) {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  if (process.env.RADAR_STATIC_WRITE !== '1') {
    throw new Error('Static feed is read-only at runtime');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

const kv = {
  async get(key) {
    return readJson(fileFor(key));
  },
  async set(key, value) {
    const file = fileFor(key);
    if (!file) return 'SKIPPED';
    writeJson(file, value);
    return 'OK';
  },
  async lpush() { return 0; },
  async ltrim() { return 'OK'; }
};

function createClient() {
  return kv;
}

module.exports = { createClient, kv, DATA_DIR };
