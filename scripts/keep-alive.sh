# External Keep-Alive Monitoring Script for Render
# Use this with external services like UptimeRobot, Pingdom, or cron jobs

# Basic curl command to keep server alive (run every 10-14 minutes)
curl -s https://ctrleforediting-backend.onrender.com/keep-alive

# Advanced monitoring with response checking
check_server() {
  response=$(curl -s -w "%{http_code}" https://ctrleforediting-backend.onrender.com/keep-alive)
  
  if [ "${response: -3}" = "200" ]; then
    echo "✅ Server is alive at $(date)"
  else
    echo "❌ Server issue at $(date) - Response: $response"
  fi
}

# For cron job (run every 14 minutes):
# */14 * * * * /path/to/this/script.sh

# For GitHub Actions workflow:
# Create .github/workflows/keep-alive.yml in your repository
# 
# name: Keep Alive
# on:
#   schedule:
#     - cron: '*/14 * * * *'  # Every 14 minutes
# 
# jobs:
#   keep-alive:
#     runs-on: ubuntu-latest
#     steps:
#       - name: Ping server
#         run: curl -s https://ctrleforediting-backend.onrender.com/keep-alive

# UptimeRobot configuration:
# URL to monitor: https://ctrleforediting-backend.onrender.com/ping
# Monitoring interval: 5 minutes
# HTTP method: GET
# Expected keyword: "pong"

echo "Keep-alive script for Render deployment"
echo "Server URL: https://ctrleforediting-backend.onrender.com"
echo "Health check: /health"
echo "Keep-alive: /keep-alive"
echo "Simple ping: /ping"
echo "Stats: /keep-alive-stats"
