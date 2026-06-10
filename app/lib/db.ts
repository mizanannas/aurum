import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

function createPool(): mysql.Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL environment variable is not set');

  const url = new URL(databaseUrl);
  return mysql.createPool({
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1),
    port: url.port ? parseInt(url.port) : 3306,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 30000,
  });
}

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

function resetPool() {
  try { pool?.end(); } catch {}
  pool = null;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isConnErr = err?.code === 'ECONNRESET' || err?.code === 'PROTOCOL_CONNECTION_LOST' || err?.fatal;
      if (isConnErr && attempt < retries) {
        resetPool();
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

export async function query<T>(sql: string, params?: any[]): Promise<T[]> {
  return withRetry(async () => {
    const p = await getPool();
    const [rows] = await p.query<mysql.RowDataPacket[]>(sql, params);
    return rows as T[];
  });
}

export async function queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

export async function execute(sql: string, params?: any[]): Promise<mysql.OkPacket> {
  return withRetry(async () => {
    const p = await getPool();
    const [result] = await p.execute(sql, params);
    return result as mysql.OkPacket;
  });
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
