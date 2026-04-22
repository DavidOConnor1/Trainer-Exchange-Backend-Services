import express from 'express';

const router = express.Router();

// Simple HTML dashboard
router.get('/dashboard', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Pokemon TCG API - Monitoring Dashboard</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #1e1e1e; color: #d4d4d4; }
        h1 { color: #4ec9b0; }
        .card { background: #2d2d2d; border-radius: 8px; padding: 15px; margin: 10px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #3c3c3c; border-radius: 4px; }
        .value { font-size: 24px; font-weight: bold; color: #4ec9b0; }
        .label { font-size: 12px; color: #858585; }
        .error { color: #f48771; }
        .success { color: #6a9955; }
        pre { background: #1e1e1e; padding: 10px; overflow-x: auto; }
        button { background: #0e639c; color: white; border: none; padding: 8px 16px; cursor: pointer; margin: 5px; }
        button:hover { background: #1177bb; }
        .refresh { position: fixed; top: 20px; right: 20px; }
    </style>
</head>
<body>
    <button class="refresh" onclick="refreshData()">🔄 Refresh</button>
    <h1>🎴 Pokemon TCG API - Monitoring Dashboard</h1>
    
    <div class="card">
        <h2>📊 System Health</h2>
        <div id="health"></div>
    </div>
    
    <div class="card">
        <h2>📈 API Metrics</h2>
        <div id="metrics"></div>
    </div>
    
    <div class="card">
        <h2>🔒 Security Status</h2>
        <div id="security"></div>
    </div>
    
    <div class="card">
        <h2>💾 Cache Performance</h2>
        <div id="cache"></div>
    </div>
    
    <div class="card">
        <h2>⚠️ Active Alerts</h2>
        <div id="alerts"></div>
    </div>
    
    <script>
        async function refreshData() {
            try {
                // Fetch health data
                const healthRes = await fetch('/api/monitoring/health');
                const health = await healthRes.json();
                document.getElementById('health').innerHTML = \`
                    <div class="metric"><div class="value">\${health.data.uptime}</div><div class="label">Uptime</div></div>
                    <div class="metric"><div class="value">\${health.data.process.memoryUsage.heapUsed}</div><div class="label">Heap Used</div></div>
                    <div class="metric"><div class="value">\${health.data.system.cpus}</div><div class="label">CPU Cores</div></div>
                \`;
                
                // Fetch metrics
                const metricsRes = await fetch('/api/monitoring/metrics');
                const metrics = await metricsRes.json();
                document.getElementById('metrics').innerHTML = \`
                    <div class="metric"><div class="value \${metrics.data.summary.successRate > 90 ? 'success' : 'error'}">\${metrics.data.summary.successRate}</div><div class="label">Success Rate</div></div>
                    <div class="metric"><div class="value">\${metrics.data.summary.totalApiCalls}</div><div class="label">Total API Calls</div></div>
                    <div class="metric"><div class="value">\${metrics.data.cache.hitRate || '0%'}</div><div class="label">Cache Hit Rate</div></div>
                \`;
                
                // Fetch security
                const securityRes = await fetch('/api/monitoring/security');
                const security = await securityRes.json();
                document.getElementById('security').innerHTML = \`
                    <div class="metric"><div class="value">\${security.data.rateLimit.currentActive}</div><div class="label">Rate Limiting</div></div>
                    <div class="metric"><div class="value">\${security.data.abuseDetection.potentialAbuse}</div><div class="label">Potential Abuse</div></div>
                    <div class="metric"><div class="value">\${security.data.endpoints.totalUnique}</div><div class="label">Unique Endpoints</div></div>
                \`;
                
                // Fetch cache
                const cacheRes = await fetch('/api/monitoring/cache');
                const cache = await cacheRes.json();
                document.getElementById('cache').innerHTML = \`
                    <div class="metric"><div class="value">\${cache.data.currentCache.size}</div><div class="label">Cache Size</div></div>
                    <div class="metric"><div class="value">\${cache.data.effectiveness.reductionRatio}</div><div class="label">Reduction Ratio</div></div>
                    <div class="metric"><div class="value">\${cache.data.memoryUsage.totalHeap}</div><div class="label">Total Heap</div></div>
                \`;
                
                // Fetch alerts
                const alertsRes = await fetch('/api/monitoring/alerts');
                const alerts = await alertsRes.json();
                if (alerts.data.alerts.length > 0) {
                    document.getElementById('alerts').innerHTML = alerts.data.alerts.map(alert => 
                        \`<div class="metric error"><div class="value">\${alert.severity}</div><div class="label">\${alert.message}</div></div>\`
                    ).join('');
                } else {
                    document.getElementById('alerts').innerHTML = '<div class="metric success"><div class="value">✅ No Active Alerts</div></div>';
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        }
        
        refreshData();
        setInterval(refreshData, 30000); // Refresh every 30 seconds
    </script>
</body>
</html>
    `);
});

export default router;