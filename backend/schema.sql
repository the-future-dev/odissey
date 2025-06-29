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
  story_state TEXT, -- JSON  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
('1',
 'The Titanic',
 'World-Building: The Ship & Its Society

The Grandeur of the Titanic: Portray the ship as a symbol of human ambition, luxury, and technological marvel. Detail its opulent first-class amenities (Grand Staircase, dining saloons, promenade decks), comfortable second class, and more modest but still advanced steerage (third class).

Strict Class Divide: Emphasize the rigid social hierarchy of 1912. Show how class dictated everything from cabin location and dining to social interaction and, tragically, survival chances during the disaster. Illustrate the distinct customs, expectations, and attire of each class.

Era Specifics: Integrate details of the early 20th century: social etiquette, fashion, limited technology (e.g., wireless telegraphy as cutting-edge but not infallible), and the prevalent attitudes of the time (e.g., belief in technological invincibility).

The Maiden Voyage Setting: The story unfolds during the ship''s first and only journey. Build a sense of excitement and optimism at the outset, contrasting sharply with the impending doom.

Character & Narrative:

Intertwined Fates: Center the narrative around a small cast of fictional characters whose lives intersect against the backdrop of the real historical event. These characters should represent different facets of the ship''s society.

Character-Driven Drama: The focus is on human relationships, conflicts, and emotional arcs. A common trope is a forbidden romance across social classes, highlighting societal constraints.

Impending Doom & Dramatic Irony: The audience knows the ship''s fate, but the characters do not. Use this dramatic irony to heighten tension, foreshadow, and make everyday interactions poignant.

Historical Accuracy (Broad Strokes): While fictional elements are central, ensure key historical facts about the Titanic''s construction, maiden voyage, collision, sinking timeline, and rescue efforts are respected. Integrate real historical figures where appropriate.

Escalating Disaster: Detail the sinking sequence with a sense of increasing panic, chaos, and the gradual breakdown of order, from the initial impact to the final plunge. Highlight individual acts of heroism, cowardice, and desperation.

Emotional Resonance: Aim for a high degree of emotional impact. Portray the fear, love, loss, sacrifice, and the sheer tragedy of the event.

Core Themes:

Class & Social Divide: The stark realities of social stratification and its consequences.

Love & Sacrifice: The power of love to transcend barriers and lead to profound acts of selflessness.

Human Hubris vs. Nature''s Power: The idea that human technological achievement, no matter how grand, is ultimately vulnerable to the forces of nature.

Life & Death: The fragility of life and the dramatic choices made in the face of imminent death.

Memory & Legacy: The lasting impact of traumatic events and the way they are remembered.
');

INSERT OR IGNORE INTO worlds (id, title, description) VALUES 
('2',
'star wars',
'World-Building: A Galaxy Far, Far Away

Vast Galaxy: The setting is a diverse galaxy with countless planets, each with unique environments, cultures, and species. Showcase this variety, from bustling ecumenopolises like Coruscant to arid desert worlds like Tatooine or lush forest moons like Endor.

The Force: The central mystical energy field that binds all living things. It has a light side (peace, knowledge, serenity) and a dark side (anger, fear, aggression). Describe its subtle manifestations, telekinetic abilities, precognition, and emotional influence. Avoid treating it as simple "magic" with arbitrary spells; its power stems from connection and discipline.

Diverse Species & Cultures: Populate the galaxy with a rich array of sentient species (humans, Twi leks, Wookiees, Duros, etc.), each with distinct physical characteristics, societal norms, languages, and historical roles.

Technology & Aesthetics: Integrate iconic Star Wars technology: hyperdrives for interstellar travel, blasters, lightsabers (energy swords, requiring Force connection for true mastery), droids with distinct personalities, and starships of various classes (fighters, freighters, capital ships). The aesthetic blends advanced tech with lived-in, sometimes gritty, appearances.

Galactic Powers & Conflicts: Frame narratives within the context of major galactic political entities (e.g., Galactic Republic, Galactic Empire, New Republic, First Order) and their ongoing ideological and military conflicts.

Character & Narrative:

Hero s Journey (Often Reluctant): Frequently feature protagonists, often from humble beginnings, who are drawn into a larger conflict, discover their potential (especially Force-sensitivity), and face profound personal and galactic stakes.

Archetypal Conflicts: Stories typically involve a clear struggle between heroic figures (often rebels, Jedi, or freedom fighters) and oppressive forces (the Empire, the Sith, criminal syndicates).

Mentorship & Legacy: Emphasize the transfer of knowledge, wisdom, and skills from older, experienced characters (Jedi Masters, seasoned pilots) to younger protégés. The weight of legacy and past events often shapes present actions.

Complex Characters & Redemption: Characters should have flaws and internal struggles. Explore themes of temptation, fall from grace, and the possibility of redemption, especially concerning those drawn to the dark side.

Dynamic Action & Space Combat: Describe thrilling space battles, lightsaber duels, and blaster skirmishes with strategic and visceral detail.

Pacing & Structure: Blend moments of quiet character development and world exploration with high-stakes action sequences, suspense, and dramatic reveals.

Core Themes:

Good vs. Evil: The eternal struggle between the forces of freedom, hope, and compassion against tyranny, fear, and hatred.

Hope vs. Despair: The enduring power of hope even in the darkest times.

Destiny vs. Choice: While prophecy exists, ultimately, individual choices define characters paths and the fate of the galaxy.

Family & Belonging: The importance of chosen families, loyalty among comrades, and finding ones place in the galaxy.

Freedom vs. Oppression: The fight for liberation against authoritarian rule.
');
