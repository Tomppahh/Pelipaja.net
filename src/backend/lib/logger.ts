import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = '/tmp/pelipaja';
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB before rotation

function getLogFile() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  return path.join(LOG_DIR, 'pelipaja.log');
}

function rotateIfNeeded(logFile: string) {
  try {
    const stats = fs.statSync(logFile);
    if (stats.size > MAX_LOG_SIZE) {
      const rotated = path.join(LOG_DIR, `pelipaja-${Date.now()}.log`);
      fs.renameSync(logFile, rotated);
    }
  } catch {
    // file doesn't exist yet, that's fine
  }
}

export function log(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());

  const logFile = getLogFile();
  rotateIfNeeded(logFile);
  fs.appendFileSync(logFile, line);
}
