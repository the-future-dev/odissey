-- User authentication and session management
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- World definitions
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT
);

-- Active user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  world_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

-- Message history for conversations
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('user', 'narrator')) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_world_id ON sessions(world_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- Sample world data (Titanic adventure)
INSERT OR IGNORE INTO worlds (id, title, description) VALUES 
('titanic-adventure',
'The Titanic',
'April 1912. Board the legendary ship. Historical story.'); 