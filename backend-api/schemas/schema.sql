-- Users table with basic profile and personality data
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    language TEXT DEFAULT 'en',
    auth_type TEXT DEFAULT 'guest',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_personality_update DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Personality assessments for rolling updates
CREATE TABLE IF NOT EXISTS personality_assessments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    trait_scores TEXT NOT NULL, -- JSON string
    confidence_level REAL DEFAULT 0.5,
    assessment_method TEXT DEFAULT 'quiz',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Worlds with artifacts for story coherence
CREATE TABLE IF NOT EXISTS worlds (
    id TEXT PRIMARY KEY,
    creator_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    genre TEXT,
    thumbnail_url TEXT,
    preview_content TEXT,
    privacy_flag TEXT DEFAULT 'public',
    artifacts TEXT NOT NULL, -- JSON string with characters, settings, rules
    coherence_version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- Demo worlds for instant access
CREATE TABLE IF NOT EXISTS demo_worlds (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL,
    preview_content TEXT,
    access_level TEXT DEFAULT 'public',
    target_personality TEXT, -- JSON string
    quick_play_optimized BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (world_id) REFERENCES worlds(id)
);

-- Sessions for tracking story interactions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    world_id TEXT NOT NULL,
    personality_snapshot TEXT, -- JSON string
    coherence_level REAL DEFAULT 1.0,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (world_id) REFERENCES worlds(id)
);

-- Chat logs for story interactions and coherence tracking
CREATE TABLE IF NOT EXISTS chat_logs (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    speaker TEXT NOT NULL, -- 'user' or 'narrator'
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    system_prompt_used TEXT,
    coherence_score REAL DEFAULT 1.0,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- System prompts for AI coherence
CREATE TABLE IF NOT EXISTS system_prompts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'creation', 'narration', 'coherence', 'engagement'
    template TEXT NOT NULL,
    variables TEXT, -- JSON string
    effectiveness_score REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_users_auth_type ON users(auth_type);
CREATE INDEX IF NOT EXISTS idx_worlds_creator_public ON worlds(creator_id, privacy_flag);
CREATE INDEX IF NOT EXISTS idx_sessions_user_world ON sessions(user_id, world_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_personality_user_timestamp ON personality_assessments(user_id, timestamp); 