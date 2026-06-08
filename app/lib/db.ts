import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export async function getPool(): Promise<mysql.Pool> {
  if (pool) {
    return pool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse DATABASE_URL
  // Format: mysql://user:password@host:port/database
  const url = new URL(databaseUrl);
  const user = url.username;
  const password = url.password;
  const host = url.hostname;
  const port = url.port ? parseInt(url.port) : 3306;
  const database = url.pathname.substring(1);

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  console.log(`✅ MySQL connected to ${host}:${port}/${database}`);

  return pool;
}

export async function query<T>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  try {
    const pool = await getPool();
    const [rows] = await pool.query<mysql.RowDataPacket[]>(sql, params);
    return rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

export async function queryOne<T>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

export async function execute(
  sql: string,
  params?: any[]
): Promise<mysql.OkPacket> {
  try {
    const pool = await getPool();
    const [result] = await pool.execute(sql, params);
    return result as mysql.OkPacket;
  } catch (error) {
    console.error('Database execute error:', error);
    throw error;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ MySQL pool closed');
  }
}