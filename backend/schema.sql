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

-- Story models for each session (MPC storytelling system)
CREATE TABLE IF NOT EXISTS story_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  plot TEXT NOT NULL,                   -- Plot structure of incidents
  characters TEXT NOT NULL,             -- Character development and tragic hero
  theme_moral_message TEXT NOT NULL,    -- Theme/Moral Message and catharsis
  conflict TEXT NOT NULL,               -- Internal vs external conflict
  setting TEXT NOT NULL,                -- Unities of Time and Place
  style_genre TEXT NOT NULL,            -- Style and Genre elements
  audience_effect TEXT NOT NULL,        -- Intended audience effect (pity, fear, catharsis)
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Story optimization steps (from StoryOptimizer agent)
CREATE TABLE IF NOT EXISTS story_step (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  story_step TEXT NOT NULL,            -- The single optimization step
  context_user_input TEXT NOT NULL,    -- User input that triggered this step
  reasoning TEXT,                      -- Optimizer's reasoning
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Story predictions for future choice-based updates (from StoryPredictor agent)
CREATE TABLE IF NOT EXISTS story_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  choice_number INTEGER NOT NULL CHECK(choice_number IN (1, 2, 3)),
  predicted_model_update TEXT NOT NULL, -- JSON of predicted StoryModel changes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_world_id ON sessions(world_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_story_models_session_id ON story_models(session_id);
CREATE INDEX IF NOT EXISTS idx_story_step_session_id ON story_step(session_id);
CREATE INDEX IF NOT EXISTS idx_story_predictions_session_id ON story_predictions(session_id);

-- Sample world data (Titanic adventure)
INSERT OR IGNORE INTO worlds (id, title, description) VALUES 
('titanic-adventure',
'The Titanic',
'April 1912. Board the legendary ship. Historical story.'); 