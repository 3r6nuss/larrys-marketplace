import session from 'express-session';

/**
 * Simple SQLite session store for express-session.
 * Stores sessions in the 'session' table.
 */
export default class SqliteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
  }

  async get(sid, callback) {
    try {
      const result = await this.db.query(
        'SELECT sess FROM session WHERE sid = ? AND expire > datetime(?)',
        [sid, new Date().toISOString()]
      );
      if (result.rows.length === 0) return callback(null, null);
      const sess = typeof result.rows[0].sess === 'string'
        ? JSON.parse(result.rows[0].sess)
        : result.rows[0].sess;
      callback(null, sess);
    } catch (err) {
      callback(err);
    }
  }

  async set(sid, sess, callback) {
    try {
      const expireDate = sess.cookie?.expires
        ? new Date(sess.cookie.expires).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const sessStr = JSON.stringify(sess);

      // Upsert
      await this.db.query(
        `INSERT INTO session (sid, sess, expire) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = ?, expire = ?`,
        [sid, sessStr, expireDate, sessStr, expireDate]
      );
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  async destroy(sid, callback) {
    try {
      await this.db.query('DELETE FROM session WHERE sid = ?', [sid]);
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }

  async touch(sid, sess, callback) {
    try {
      const expireDate = sess.cookie?.expires
        ? new Date(sess.cookie.expires).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await this.db.query(
        'UPDATE session SET expire = ? WHERE sid = ?',
        [expireDate, sid]
      );
      callback?.(null);
    } catch (err) {
      callback?.(err);
    }
  }
}
