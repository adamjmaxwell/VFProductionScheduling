const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));

// PostgreSQL connection — Railway sets DATABASE_URL automatically
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
});

// Initialize database tables
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('Database tables initialized');
  } finally {
    client.release();
  }
}

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Serve the HTML app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'production_planner_v7 (3).html'));
});

// ===== ORDERS API =====

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM orders ORDER BY updated_at DESC');
    const orders = result.rows.map(r => r.data);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Save all orders (bulk replace)
app.put('/api/orders', async (req, res) => {
  const orders = req.body;
  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: 'Expected array of orders' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM orders');
    for (const order of orders) {
      await client.query(
        'INSERT INTO orders (id, data, updated_at) VALUES ($1, $2, NOW())',
        [order.id, JSON.stringify(order)]
      );
    }
    await client.query('COMMIT');
    res.json({ saved: orders.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving orders:', err);
    res.status(500).json({ error: 'Failed to save orders' });
  } finally {
    client.release();
  }
});

// ===== USERS API =====

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM users ORDER BY updated_at');
    const users = result.rows.map(r => r.data);
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Save all users (bulk replace)
app.put('/api/users', async (req, res) => {
  const users = req.body;
  if (!Array.isArray(users)) {
    return res.status(400).json({ error: 'Expected array of users' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users');
    for (const user of users) {
      await client.query(
        'INSERT INTO users (id, data, updated_at) VALUES ($1, $2, NOW())',
        [user.id, JSON.stringify(user)]
      );
    }
    await client.query('COMMIT');
    res.json({ saved: users.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving users:', err);
    res.status(500).json({ error: 'Failed to save users' });
  } finally {
    client.release();
  }
});

// ===== APP STATE API (collapsed sections, etc.) =====

app.get('/api/state/:key', async (req, res) => {
  try {
    const result = await pool.query('SELECT value FROM app_state WHERE key = $1', [req.params.key]);
    if (result.rows.length) {
      res.json(result.rows[0].value);
    } else {
      res.json(null);
    }
  } catch (err) {
    console.error('Error fetching state:', err);
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

app.put('/api/state/:key', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [req.params.key, JSON.stringify(req.body)]
    );
    res.json({ saved: true });
  } catch (err) {
    console.error('Error saving state:', err);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
