const config = require('./config');

/**
 * Structured logger for Cloud Functions
 */
class Logger {
  constructor(level = 'info') {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    this.currentLevel = this.levels[level] || this.levels.info;
  }

  log(level, message, metadata = {}) {
    if (this.levels[level] > this.currentLevel) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      service: 'gcp-email-service',
      ...metadata
    };

    // Use console for Cloud Functions logging
    console.log(JSON.stringify(logEntry));
  }

  error(message, metadata = {}) {
    this.log('error', message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('warn', message, metadata);
  }

  info(message, metadata = {}) {
    this.log('info', message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('debug', message, metadata);
  }
}

module.exports = new Logger(config.logging.level);