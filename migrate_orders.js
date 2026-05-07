const fs = require('fs');
const https = require('https');

const dbUrl = 'https://mula-eatery-default-rtdb.asia-southeast1.firebasedatabase.app';

// Helper to make PATCH request
function patchFirebase(path, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(`${dbUrl}${path}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(JSON.stringify(data));
        req.end();
    });
}

// Helper to make GET request
function getFirebase(path) {
    return new Promise((resolve, reject) => {
        const req = https.request(`${dbUrl}${path}.json`, {
            method: 'GET'
        }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.end();
    });
}

async function migrateStrandedOrders() {
    console.log("Fetching tableOrders...");
    const tableOrders = await getFirebase('/tableOrders');
    if (!tableOrders) {
        console.log("No table orders found.");
        return;
    }

    const updates = {};
    let count = 0;
    let totalRp = 0;

    // We know today is 2026-05-03 based on local time
    const targetDate = "2026-05-03";

    for (const [tid, order] of Object.entries(tableOrders)) {
        // If it doesn't have a financeKey, it was made before the update
        if (!order.financeKey) {
            const pushId = "-MIGRATED_" + Date.now() + "_" + Math.floor(Math.random()*1000);
            
            updates[pushId] = {
                time: order.createdAt || Date.now(),
                tableLabel: order.tableLabel || "Takeaway/Kasir (Migrasi)",
                total: order.total || 0,
                items: order.items || {}
            };
            count++;
            totalRp += (order.total || 0);
        }
    }

    if (count > 0) {
        console.log(`Found ${count} stranded orders totaling Rp ${totalRp}. Migrating to /orders/${targetDate}...`);
        await patchFirebase(`/orders/${targetDate}`, updates);
        console.log("Migration complete!");
    } else {
        console.log("No stranded orders to migrate.");
    }
}

migrateStrandedOrders().catch(console.error);
