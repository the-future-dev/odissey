-- Odissey Database Schema

-- Users table for anonymous authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Worlds table for different story worlds
CREATE TABLE IF NOT EXISTS worlds (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    initial_state TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table for user story sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    world_id TEXT NOT NULL,
    world_state TEXT,
    coherence_state TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (world_id) REFERENCES worlds(id)
);

-- Messages table for session interactions
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('user', 'narrator')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_world_id ON sessions(world_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Insert some default worlds
INSERT OR IGNORE INTO worlds (id, title, description, initial_state) VALUES 
(
    'fantasy-adventure',
    'Fantasy Adventure',
    'A classic fantasy world filled with magic, dragons, and ancient mysteries.',
    'You find yourself standing at the edge of a mystical forest. The ancient trees tower above you, their branches intertwining to form a natural canopy that filters the sunlight into dancing patterns on the forest floor. In the distance, you can hear the faint sound of running water and the occasional bird call. Your adventure begins here. What do you choose to do?'
),
(
    'sci-fi-explorer',
    'Sci-Fi Explorer',
    'Explore the vast reaches of space in this futuristic adventure.',
    'You are aboard the starship Odyssey, floating in the void between star systems. The ship''s AI has just detected an unknown signal coming from a nearby planet. Your instruments show the planet has a breathable atmosphere and signs of ancient technology. As the ship''s lead explorer, the decision of how to proceed is yours. What do you do?'
),
(
    'mystery-detective',
    'Mystery Detective',
    'Solve crimes and uncover secrets in this noir-style detective story.',
    'Rain patters against the window of your detective office on the third floor of the old Blackwood building. It''s been a quiet week until she walked in - a mysterious woman in a red coat with a story that doesn''t quite add up. She claims her brother has disappeared, but something in her eyes suggests there''s more to this case than meets the eye. What''s your first move?'
); 