// postgres storage for opaque stuff
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

// create postgres connection pool
const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'cypher_db',
    user: process.env.POSTGRES_USER || 'cypher_user',
    password: process.env.POSTGRES_PASSWORD || 'cypher_password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// test connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ PostgreSQL connection failed:', err);
    } else {
        console.log('✅ PostgreSQL connected successfully');
    }
});

export function createPostgresStorage() {
    return {
        async store(username, opaqueRecord) {
            try {
                // store user with OPAQUE record in PostgreSQL
                // opaque_record is stored as base64 text
                const opaqueRecordB64 = Buffer.from(opaqueRecord).toString('base64');
                
                const query = `
                    INSERT INTO users (
                        id, username, opaque_record, is_active, 
                        email_verified, totp_enabled, failed_login_attempts,
                        created_at, updated_at, password_changed_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, true, 
                        false, false, 0,
                        NOW(), NOW(), NOW()
                    )
                    ON CONFLICT (username) DO UPDATE 
                    SET opaque_record = EXCLUDED.opaque_record
                    RETURNING id
                `;
                
                // FIXED: was missing failed_login_attempts, created_at, updated_at columns
                // caused "null value violates not-null constraint" errors
                
                const result = await pool.query(query, [username, opaqueRecordB64]);
                console.log(`Stored OPAQUE record for user: ${username}`);
                return true;
            } catch (error) {
                console.error('Error storing user:', error);
                return false;
            }
        },
        
        async lookup(username) {
            try {
                const query = 'SELECT opaque_record FROM users WHERE username = $1 AND is_active = true';
                const result = await pool.query(query, [username]);
                
                if (result.rows.length === 0) {
                    return false;
                }
                
                const opaqueRecordB64 = result.rows[0].opaque_record;
                if (!opaqueRecordB64) {
                    return false;
                }
                
                // convert base64 back to Uint8Array
                const buffer = Buffer.from(opaqueRecordB64, 'base64');
                return new Uint8Array(buffer);
            } catch (error) {
                console.error('Error looking up user:', error);
                return false;
            }
        },
        
        async delete(username) {
            try {
                const query = 'DELETE FROM users WHERE username = $1';
                await pool.query(query, [username]);
                return true;
            } catch (error) {
                console.error('Error deleting user:', error);
                return false;
            }
        },
        
        async storeTotpSecret(username, secret) {
            try {
                // store TOTP secret (will be encrypted by Python descriptor)
                const query = 'UPDATE users SET totp_secret = $1 WHERE username = $2';
                await pool.query(query, [secret, username]);
                return true;
            } catch (error) {
                console.error('Error storing TOTP secret:', error);
                return false;
            }
        },
        
        async getTotpSecret(username) {
            try {
                const query = 'SELECT totp_secret FROM users WHERE username = $1';
                const result = await pool.query(query, [username]);
                
                if (result.rows.length === 0 || !result.rows[0].totp_secret) {
                    return false;
                }
                
                return result.rows[0].totp_secret;
            } catch (error) {
                console.error('Error getting TOTP secret:', error);
                return false;
            }
        },
        
        async enableTotp(username) {
            try {
                const query = 'UPDATE users SET totp_enabled = true WHERE username = $1';
                await pool.query(query, [username]);
                return true;
            } catch (error) {
                console.error('Error enabling TOTP:', error);
                return false;
            }
        },
        
        async clear() {
            try {
                await pool.query('DELETE FROM users');
                return true;
            } catch (error) {
                console.error('Error clearing users:', error);
                return false;
            }
        }
    };
}

export default createPostgresStorage;
