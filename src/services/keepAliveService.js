const https = require('https');
const http = require('http');

class KeepAliveService {
  constructor() {
    this.serviceUrl = process.env.RENDER_EXTERNAL_URL || 'https://ctrleforediting-backend.onrender.com';
    this.isActive = false;
    this.intervalId = null;
    this.pingCount = 0;
    this.lastPing = null;
    this.errors = [];
    
    // Self-ping every 14 minutes (just before 15-minute sleep threshold)
    this.pingInterval = 14 * 60 * 1000; // 14 minutes
  }

  start() {
    if (this.isActive) {
      console.log('⚠️  Keep-alive service is already running');
      return;
    }

    this.isActive = true;
    console.log('🟢 Starting keep-alive service...');
    console.log(`📡 Will ping ${this.serviceUrl}/keep-alive every 14 minutes`);
    
    // Initial ping after 2 minutes
    setTimeout(() => {
      this.ping();
    }, 2 * 60 * 1000);

    // Set up regular pinging
    this.intervalId = setInterval(() => {
      this.ping();
    }, this.pingInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
    console.log('🔴 Keep-alive service stopped');
  }

  async ping() {
    if (!this.isActive) return;

    const url = `${this.serviceUrl}/keep-alive`;
    this.pingCount++;
    this.lastPing = new Date();

    console.log(`🏓 Keep-alive ping #${this.pingCount} at ${this.lastPing.toLocaleString()}`);

    const requestModule = url.startsWith('https:') ? https : http;
    
    return new Promise((resolve) => {
      const req = requestModule.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log(`✅ Keep-alive successful - Status: ${res.statusCode}`);
          this.clearOldErrors();
          resolve(true);
        });
      });

      req.on('error', (error) => {
        console.log(`❌ Keep-alive failed:`, error.message);
        this.errors.push({
          timestamp: new Date(),
          error: error.message
        });
        
        // Keep only last 5 errors
        if (this.errors.length > 5) {
          this.errors = this.errors.slice(-5);
        }
        
        resolve(false);
      });

      req.setTimeout(30000, () => {
        req.destroy();
        console.log('⏰ Keep-alive request timeout');
        resolve(false);
      });
    });
  }

  clearOldErrors() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.errors = this.errors.filter(error => error.timestamp > oneHourAgo);
  }

  getStats() {
    return {
      isActive: this.isActive,
      pingCount: this.pingCount,
      lastPing: this.lastPing,
      serviceUrl: this.serviceUrl,
      errors: this.errors,
      nextPing: this.lastPing ? new Date(this.lastPing.getTime() + this.pingInterval) : null
    };
  }
}

// Create singleton instance
const keepAliveService = new KeepAliveService();

module.exports = keepAliveService;
