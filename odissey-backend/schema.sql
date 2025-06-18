-- Base Tables (existing)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  initial_state TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Story abstraction fields
  genre TEXT,
  world_laws TEXT,
  perspective TEXT DEFAULT 'second-person',
  beginning_type TEXT DEFAULT 'exposition'
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  world_id TEXT NOT NULL,
  world_state TEXT,
  coherence_state TEXT,
  story_state TEXT, -- JSON serialized SessionStoryState
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('user', 'narrator')) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Story Abstraction Tables

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  role TEXT NOT NULL, -- protagonist, antagonist, ally, neutral, etc.
  character_traits TEXT NOT NULL, -- personality description
  abilities TEXT NOT NULL, -- skills, powers, etc.
  relationships TEXT DEFAULT '{}', -- JSON serialized relationships map
  history TEXT NOT NULL,
  goals TEXT NOT NULL, -- what they're trying to achieve
  knowledge_base TEXT DEFAULT '[]', -- JSON serialized - subset of lore they know
  secrets TEXT DEFAULT '', -- information only they know
  current_location TEXT, -- current location ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (world_id) REFERENCES worlds(id),
  FOREIGN KEY (current_location) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  history TEXT DEFAULT '',
  connections TEXT DEFAULT '{}', -- JSON serialized - connected locations and how
  properties TEXT DEFAULT '{}', -- JSON serialized - special properties, atmosphere
  inhabitants TEXT DEFAULT '[]', -- JSON serialized - list of character IDs
  items TEXT DEFAULT '[]', -- JSON serialized - list of item IDs present
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  significance TEXT NOT NULL, -- why this item matters to the story
  properties TEXT DEFAULT '{}', -- JSON serialized - magical properties, uses, etc.
  current_location TEXT, -- location_id or 'character:{character_id}'
  history TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  session_id TEXT, -- if session-specific, null for world events
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT CHECK(event_type IN ('major', 'minor', 'background', 'trigger')) NOT NULL,
  triggers TEXT DEFAULT '[]', -- JSON serialized - conditions that trigger this event
  consequences TEXT DEFAULT '[]', -- JSON serialized - what happens when triggered
  status TEXT CHECK(status IN ('pending', 'triggered', 'completed')) DEFAULT 'pending',
  participants TEXT DEFAULT '[]', -- JSON serialized - character IDs involved
  location_id TEXT, -- where the event takes place
  triggered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (world_id) REFERENCES worlds(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  narrative_hints TEXT NOT NULL, -- how this theme should appear in narration
  symbols TEXT DEFAULT '[]', -- JSON serialized - symbolic elements
  progression TEXT DEFAULT '', -- how theme develops through story
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

CREATE TABLE IF NOT EXISTS lore_entries (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL, -- history, magic, politics, etc.
  access_level TEXT CHECK(access_level IN ('public', 'restricted', 'secret')) DEFAULT 'public',
  unlock_triggers TEXT DEFAULT '[]', -- JSON serialized - what unlocks this lore
  connected_entries TEXT DEFAULT '[]', -- JSON serialized - related lore entry IDs
  is_discovered BOOLEAN DEFAULT FALSE, -- whether players have access
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

-- Session-specific state tracking
CREATE TABLE IF NOT EXISTS session_character_states (
  session_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  current_location TEXT NOT NULL,
  status TEXT NOT NULL, -- alive, dead, missing, etc.
  memory TEXT DEFAULT '[]', -- JSON array of recent interactions
  disposition INTEGER DEFAULT 0, -- -100 to 100, how they feel about player
  goals_progress TEXT DEFAULT '{}', -- JSON object goal_id -> progress percentage
  temporary_states TEXT DEFAULT '{}', -- JSON object for cursed, injured, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, character_id),
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (character_id) REFERENCES characters(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_world_id ON sessions(world_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_characters_world_id ON characters(world_id);
CREATE INDEX IF NOT EXISTS idx_characters_location ON characters(current_location);
CREATE INDEX IF NOT EXISTS idx_locations_world_id ON locations(world_id);
CREATE INDEX IF NOT EXISTS idx_items_world_id ON items(world_id);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(current_location);
CREATE INDEX IF NOT EXISTS idx_events_world_id ON events(world_id);
CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_themes_world_id ON themes(world_id);
CREATE INDEX IF NOT EXISTS idx_lore_entries_world_id ON lore_entries(world_id);
CREATE INDEX IF NOT EXISTS idx_lore_entries_access_level ON lore_entries(access_level);
CREATE INDEX IF NOT EXISTS idx_session_character_states_session ON session_character_states(session_id);

-- -- Sample data for testing (fantasy-adventure world)
-- INSERT OR IGNORE INTO worlds (id, title, description, initial_state, genre, world_laws, perspective, beginning_type) VALUES 
-- ('fantasy-adventure', 'Epic Fantasy Realm', 'A magical world of ancient mysteries, heroic quests, and mythical creatures.', 
-- 'You stand at the edge of the Whispering Woods, a realm where magic flows through every leaf and shadow. An ancient path winds deeper into the forest, while a distant village glows warmly in the valley below.', 
-- 'fantasy', 'Magic is real and follows ancient laws. Good and evil are in constant struggle. Heroes can change the fate of the world.', 'second-person', 'exposition');

-- -- Sample locations
-- INSERT OR IGNORE INTO locations (id, world_id, name, description, history, properties) VALUES 
-- ('whispering-woods-edge', 'fantasy-adventure', 'Edge of Whispering Woods', 
-- 'A mystical boundary where the mundane world meets the realm of magic. Ancient trees tower overhead, their leaves rustling with whispered secrets.',
-- 'This threshold has been crossed by countless heroes throughout history.',
-- '{"atmosphere": "mystical", "starting": true, "magical_presence": "moderate"}'),

-- ('village-of-millhaven', 'fantasy-adventure', 'Village of Millhaven', 
-- 'A peaceful farming village nestled in a green valley. Smoke rises from chimneys and the sound of daily life echoes through cobblestone streets.',
-- 'Founded 200 years ago by settlers seeking refuge from the wars. Known for its magical herb gardens.',
-- '{"atmosphere": "peaceful", "safe_haven": true, "magical_presence": "low"}');

-- -- Sample characters
-- INSERT OR IGNORE INTO characters (id, world_id, name, description, role, character_traits, abilities, history, goals, knowledge_base, current_location) VALUES 
-- ('elder-thoran', 'fantasy-adventure', 'Elder Thoran', 
-- 'A wise old mage with a long silver beard and knowing eyes. He wears simple robes but radiates ancient power.',
-- 'ally', 'Wise, patient, mysterious, protective of ancient knowledge',
-- 'Ancient magic, prophecy reading, elemental control',
-- 'A former member of the ancient Circle of Mages who survived the Great War of Shadows',
-- 'Guide worthy heroes and protect the realm from emerging darkness',
-- '["ancient-prophecy", "magic-fundamentals", "realm-history"]',
-- 'village-of-millhaven'),

-- ('shadow-wolf', 'fantasy-adventure', 'Shadow Wolf', 
-- 'A massive wolf with midnight-black fur and gleaming yellow eyes. It moves like liquid darkness between the trees.',
-- 'neutral', 'Wild, unpredictable, intelligent, territorial',
-- 'Shadow manipulation, supernatural speed, keen senses',
-- 'Ancient guardian of the sacred groves, descended from the first spirit wolves',
-- 'Protect the sacred groves from intruders and maintain the balance of nature',
-- '["grove-secrets", "nature-magic"]',
-- 'whispering-woods-edge');

-- -- Sample items
-- INSERT OR IGNORE INTO items (id, world_id, name, description, significance, properties, current_location) VALUES 
-- ('ancient-compass', 'fantasy-adventure', 'Ancient Compass', 
-- 'A brass compass whose needle always points toward magical sources rather than magnetic north.',
-- 'A relic from the age of exploration, it can guide heroes to places of power.',
-- '{"magical": true, "guidance": "magical_sources", "durability": "ancient"}',
-- 'village-of-millhaven'),

-- ('starlight-herb', 'fantasy-adventure', 'Starlight Herb', 
-- 'A silvery plant that glows faintly in moonlight. Legend says it only grows where starlight has touched the earth.',
-- 'Essential ingredient for powerful healing potions and magical remedies.',
-- '{"magical": true, "healing_component": true, "rarity": "uncommon"}',
-- 'whispering-woods-edge');

-- -- Sample lore entries
-- INSERT OR IGNORE INTO lore_entries (id, world_id, title, content, category, access_level, unlock_triggers) VALUES 
-- ('magic-fundamentals', 'fantasy-adventure', 'The Nature of Magic', 
-- 'Magic in this realm flows from the connection between all living things. It can be channeled through emotion, focused through study, or awakened through great need.',
-- 'magic', 'public', '[]'),

-- ('ancient-prophecy', 'fantasy-adventure', 'The Prophecy of the Chosen One', 
-- 'When darkness rises from the forgotten depths, a hero shall emerge to restore the balance. They will be known by their courage, their compassion, and their ability to unite the fractured peoples of the realm.',
-- 'prophecy', 'restricted', '[{"type": "conversation", "character_id": "elder-thoran"}, {"type": "keyword", "value": "prophecy"}]'),

-- ('realm-history', 'fantasy-adventure', 'The Great War of Shadows', 
-- 'Three centuries ago, the realm was nearly consumed by an army of shadow creatures led by the Dark Sorcerer Malachar. The war ended when the Circle of Mages sacrificed themselves to seal the darkness away.',
-- 'history', 'restricted', '[{"type": "conversation", "character_id": "elder-thoran"}, {"type": "location_exploration", "location_id": "village-of-millhaven"}]');

-- -- Sample events
-- INSERT OR IGNORE INTO events (id, world_id, name, description, event_type, triggers, consequences, participants) VALUES 
-- ('first-encounter-wolf', 'fantasy-adventure', 'Encounter with the Shadow Wolf', 
-- 'The legendary Shadow Wolf emerges from the darkness to test the newcomer.',
-- 'major', 
-- '[{"type": "location", "value": "whispering-woods-edge"}, {"type": "timeline_position", "position": 2}]',
-- '[{"type": "spawn_character", "character_id": "shadow-wolf"}]',
-- '["shadow-wolf"]'),

-- ('herb-gathering-quest', 'fantasy-adventure', 'Elder Thoran''s Request', 
-- 'Elder Thoran asks for help gathering rare magical herbs from the Whispering Woods.',
-- 'minor',
-- '[{"type": "conversation", "character_id": "elder-thoran"}, {"type": "relationship_threshold", "character_id": "elder-thoran", "threshold": 20}]',
-- '[{"type": "spawn_item", "item_id": "starlight-herb", "location_id": "whispering-woods-edge"}]',
-- '["elder-thoran"]');

-- -- Sample themes
-- INSERT OR IGNORE INTO themes (id, world_id, name, description, narrative_hints) VALUES 
-- ('heroic-journey', 'fantasy-adventure', 'The Hero''s Journey', 
-- 'The classic pattern of personal growth through adversity and discovery.',
-- 'Emphasize moments of choice, personal growth, and the cost of heroism. Show how challenges forge character.'),

-- ('nature-vs-civilization', 'fantasy-adventure', 'Balance Between Nature and Civilization', 
-- 'The eternal tension between progress and preservation.',
-- 'Contrast the peaceful village life with the wild magic of the forest. Show both the benefits and costs of each way of life.');

-- =====================================================================================
-- TITANIC STORY WORLD - Complete historical romance/disaster narrative
-- =====================================================================================

-- Titanic world
INSERT OR IGNORE INTO worlds (id, title, description, initial_state, genre, world_laws, perspective, beginning_type) VALUES 
('titanic-adventure',
'RMS Titanic - Maiden Voyage',
'April 1912. Board the legendary "unsinkable" ship for a voyage that will change history forever.', 
'April 10th, 1912. Southampton, England. You stand before the magnificent RMS Titanic, the largest and most luxurious ship ever built. Passengers around you buzz with excitement about the maiden voyage to New York. The ship towers above like a floating palace, its four massive smokestacks reaching toward the sky. Your ticket is in hand, your luggage checked. This voyage promises to be the journey of a lifetime.', 
'historical-romance',
'The year is 1912. Social class determines everything. The ship will hit an iceberg on April 14th. There are not enough lifeboats for everyone. Women and children board lifeboats first.',
'second-person',
'exposition');

-- Titanic locations
INSERT OR IGNORE INTO locations (id, world_id, name, description, history, properties) VALUES 
('southampton-dock', 'titanic-adventure', 'Southampton Dock', 
'The bustling departure dock where Titanic begins her maiden voyage. Crowds of passengers, well-wishers, and crew create a carnival atmosphere. The massive ship dominates the skyline.',
'Southampton has been England''s premier passenger port for transatlantic voyages.',
'{"atmosphere": "exciting", "starting": true, "time_period": "departure", "social_mixing": true}'),

('first-class-promenade', 'titanic-adventure', 'First Class Promenade Deck', 
'An elegant covered walkway stretching along the ship''s side. Well-dressed passengers stroll leisurely, enjoying the sea air and socializing. Large windows offer stunning ocean views.',
'The promenade was designed to rival the finest hotels of Europe.',
'{"atmosphere": "luxurious", "class_restriction": "first", "social_hub": true, "romantic_potential": true}'),

('grand-staircase', 'titanic-adventure', 'Grand Staircase', 
'The breathtaking centerpiece of the ship - a sweeping oak staircase beneath an ornate glass dome. Crystal chandeliers cast warm light over passengers dressed in their finest evening wear.',
'Considered one of the most beautiful staircases ever built.',
'{"atmosphere": "magnificent", "class_restriction": "first", "iconic": true, "formal_events": true}'),

('first-class-dining', 'titanic-adventure', 'First Class Dining Saloon', 
'An opulent dining room rivaling the finest restaurants in London or Paris. White-uniformed waiters serve elaborate courses to passengers seated at tables adorned with fine china and crystal.',
'The dining room could seat over 550 first-class passengers.',
'{"atmosphere": "refined", "class_restriction": "first", "meal_times": true, "social_interaction": true}'),

('third-class-general', 'titanic-adventure', 'Third Class General Room', 
'A modest but cheerful common area where third-class passengers gather. Families share simple meals, children play, and someone often plays an accordion or fiddle for entertainment.',
'Third class on Titanic was superior to first class on many other ships.',
'{"atmosphere": "communal", "class_restriction": "third", "family_friendly": true, "music": true}'),

('boat-deck', 'titanic-adventure', 'Boat Deck', 
'The highest deck of the ship, where the lifeboats hang in their davits. During the day, it offers spectacular views. At night, it becomes crucial for survival.',
'The boat deck held only enough lifeboats for about half the souls aboard.',
'{"atmosphere": "open", "lifeboats": true, "emergency_access": true, "night_danger": true}'),

('ship-bridge', 'titanic-adventure', 'Ship''s Bridge', 
'The command center of the great ship. Officers monitor the ship''s course while the telegraph communicates with the engine room. Ice warnings pile up on the desk.',
'From here, Captain Smith commanded what he believed was an unsinkable vessel.',
'{"atmosphere": "tense", "crew_only": true, "navigation": true, "ice_warnings": true}'),

('engine-room', 'titanic-adventure', 'Engine Room', 
'The thunderous heart of the ship. Massive steam engines and boilers power Titanic through the Atlantic. Workers shovel coal in the sweltering heat.',
'The engine room employed hundreds of men in dangerous, exhausting work.',
'{"atmosphere": "industrial", "crew_only": true, "dangerous": true, "flooding_risk": true}');

-- Titanic characters
INSERT OR IGNORE INTO characters (id, world_id, name, description, role, character_traits, abilities, history, goals, knowledge_base, current_location) VALUES 
('rose-dewitt-bukater', 'titanic-adventure', 'Rose DeWitt Bukater', 
'A beautiful 17-year-old first-class passenger from Philadelphia. Despite her privileged upbringing, she feels trapped by society''s expectations and yearns for freedom.',
'love_interest', 'Intelligent, spirited, rebellious, artistic, compassionate but sheltered',
'Artistic sensibility, social graces, surprising courage in crisis',
'Born into Philadelphia high society, educated in the finest schools but yearns for freedom',
'Escape the suffocating expectations of high society and find true love and purpose',
'["high-society-customs", "art-appreciation", "family-pressures"]',
'first-class-promenade'),

('jack-dawson', 'titanic-adventure', 'Jack Dawson', 
'A penniless but charismatic artist who won his third-class ticket in a lucky poker game. His carefree spirit and zest for life are infectious.',
'love_interest', 'Optimistic, adventurous, artistic, free-spirited, kind-hearted',
'Artistic talent, street smarts, ability to connect with people from all walks of life',
'Grew up poor but found freedom through art and travel, won his ticket in a poker game',
'Make the most of every moment and help others see the beauty in life',
'["street-survival", "artistic-techniques", "working-class-wisdom"]',
'third-class-general'),

('captain-smith', 'titanic-adventure', 'Captain Edward Smith', 
'The veteran commander of Titanic on his final voyage before retirement. Known as the "Millionaire''s Captain" for his popularity with wealthy passengers.',
'authority', 'Experienced, confident, beloved by passengers, but perhaps overconfident',
'Expert seamanship, leadership, passenger relations',
'40 years at sea, commanding White Star Line vessels, this is his final voyage before retirement',
'Complete his final voyage safely and retire with his reputation intact',
'["ship-operations", "ice-conditions", "passenger-safety", "navigation-routes"]',
'ship-bridge'),

('cal-hockley', 'titanic-adventure', 'Caledon Hockley', 
'Rose''s wealthy but controlling fiancé. Heir to a Pittsburgh steel fortune, he represents everything Rose wants to escape from.',
'antagonist', 'Arrogant, possessive, traditional, ruthless when threatened',
'Wealth, social influence, business connections',
'Heir to Hockley Steel fortune, used to getting his way through money and influence',
'Maintain control over Rose and preserve his social standing',
'["business-dealings", "high-society-expectations", "financial-power"]',
'first-class-dining'),

('molly-brown', 'titanic-adventure', 'Margaret "Molly" Brown', 
'A spirited Denver socialite known for her big heart and fearless nature. New money but generous spirit.',
'ally', 'Brave, outspoken, generous, unconventional, maternal',
'Leadership in crisis, social connections, fierce determination',
'Rose from poverty to wealth through mining fortune, never forgot her humble roots',
'Help others and prove that courage matters more than breeding',
'["social-dynamics", "crisis-leadership", "american-west-stories"]',
'first-class-promenade'),

('thomas-andrews', 'titanic-adventure', 'Thomas Andrews', 
'The ship''s designer, aboard to observe the vessel''s performance. A brilliant naval architect who cares deeply about passenger safety.',
'ally', 'Brilliant, dedicated, caring, perfectionist, tragically prescient',
'Ship design expertise, engineering knowledge, problem-solving',
'Chief designer of Titanic, devoted his life to shipbuilding and passenger safety',
'Ensure the ship performs perfectly and keep passengers safe',
'["ship-construction", "safety-systems", "structural-weaknesses", "lifeboat-calculations"]',
'grand-staircase'),

('lookout-fleet', 'titanic-adventure', 'Frederick Fleet', 
'A young lookout in the crow''s nest. On the night of April 14th, he will be the first to spot the iceberg.',
'witness', 'Dutiful, sharp-eyed, nervous about missing binoculars',
'Excellent eyesight, experience watching for hazards',
'Experienced lookout who served on multiple ships, knows the importance of vigilance',
'Spot dangers and alert the bridge to keep the ship safe',
'["ice-identification", "ship-procedures", "binocular-importance"]',
'boat-deck');

-- Titanic items
INSERT OR IGNORE INTO items (id, world_id, name, description, significance, properties, current_location) VALUES 
('passenger-ticket', 'titanic-adventure', 'Passenger Ticket', 
'Your boarding pass for the RMS Titanic. The class printed on it determines which areas of the ship you can access.',
'Determines your social standing and survival chances aboard the ship.',
'{"class_determinant": true, "ship_access": true, "historical_document": true}',
'southampton-dock'),

('heart-of-ocean', 'titanic-adventure', 'Heart of the Ocean Necklace', 
'A stunning blue diamond necklace worth a fortune. Once owned by Louis XVI, it represents both beauty and the burden of wealth.',
'A symbol of the class divide and the prison of wealth that traps Rose.',
'{"priceless": true, "cursed_history": true, "symbol_of_oppression": true}',
'first-class-dining'),

('drawing-portfolio', 'titanic-adventure', 'Artist''s Portfolio', 
'A leather portfolio containing sketches and drawings. Art has the power to capture truth and emotion beyond social facades.',
'Represents artistic vision and the ability to see beyond surface appearances.',
'{"artistic_tool": true, "truth_revealing": true, "personal_expression": true}',
'third-class-general'),

('life-jacket', 'titanic-adventure', 'Life Jacket', 
'A cork-filled life vest that provides flotation in the icy Atlantic waters. In the early hours of April 15th, these become precious beyond measure.',
'The difference between life and death in the frigid waters.',
'{"survival_equipment": true, "buoyancy": true, "limited_quantity": true}',
'boat-deck'),

('wireless-message', 'titanic-adventure', 'Ice Warning Message', 
'A wireless telegram warning of ice in the ship''s path. Several such warnings have been received but not all have reached the bridge.',
'Represents the ignored warnings that could have prevented disaster.',
'{"warning": true, "unheeded": true, "crucial_information": true}',
'ship-bridge'),

('lifeboat-20', 'titanic-adventure', 'Lifeboat', 
'A wooden lifeboat designed to hold 65 people. There are only enough lifeboats for about half the souls aboard.',
'The inadequate safety provisions reveal the hubris of believing the ship unsinkable.',
'{"survival_vessel": true, "limited_capacity": true, "last_hope": true}',
'boat-deck'),

('crows-nest-binoculars', 'titanic-adventure', 'Crow''s Nest Binoculars', 
'Powerful binoculars meant for the lookouts. Unfortunately, they were locked away and not available on the fatal night.',
'The missing binoculars that might have spotted the iceberg sooner.',
'{"navigation_tool": true, "missing": true, "could_have_saved_ship": true}',
'ship-bridge');

-- Titanic lore entries
INSERT OR IGNORE INTO lore_entries (id, world_id, title, content, category, access_level, unlock_triggers) VALUES 
('ship-specifications', 'titanic-adventure', 'RMS Titanic - The Ship of Dreams', 
'At 882 feet long and 175 feet high, Titanic is the largest moving object ever created by man. She boasts electric lighting, heated swimming pools, a gymnasium, and even a squash court. The ship was designed with watertight compartments and could survive flooding in up to four compartments.',
'ship_design', 'public', '[]'),

('class-system', 'titanic-adventure', 'The Rigid Class System of 1912', 
'Aboard Titanic, your ticket class determines everything - where you eat, sleep, and even which decks you can access. First-class passengers paid up to $4,350 (equivalent to over $100,000 today) while third-class tickets cost only $15-40. The ship''s design physically separates the classes with locked gates and separate staircases.',
'society', 'public', '[]'),

('unsinkable-myth', 'titanic-adventure', 'The "Unsinkable" Ship', 
'The press dubbed Titanic "practically unsinkable" due to her advanced safety features. This confidence led to carrying only enough lifeboats for about half the people aboard - the legal minimum required at the time. The builders believed the ship itself was a lifeboat.',
'safety', 'restricted', '[{"type": "conversation", "character_id": "thomas-andrews"}, {"type": "location_exploration", "location_id": "boat-deck"}]'),

('ice-conditions', 'titanic-adventure', 'Ice Warnings and Atlantic Conditions', 
'The winter of 1912 was unusually mild, causing massive amounts of ice to break off and drift south into shipping lanes. Multiple ships sent ice warnings to Titanic throughout April 14th, but not all messages reached the bridge. The wireless operators were busy sending passenger messages.',
'navigation', 'restricted', '[{"type": "conversation", "character_id": "captain-smith"}, {"type": "item_interaction", "item_id": "wireless-message"}]'),

('lifeboat-regulations', 'titanic-adventure', 'Inadequate Lifeboat Laws', 
'British Board of Trade regulations, written for smaller ships, required lifeboats based on ship tonnage, not passenger capacity. Titanic carried 20 lifeboats - more than legally required but only enough for 1,178 people out of over 2,200 aboard. The law hadn''t kept pace with ship size.',
'regulations', 'restricted', '[{"type": "conversation", "character_id": "thomas-andrews"}, {"type": "event_triggered", "event_id": "lifeboat-drill"}]'),

('survivors-stories', 'titanic-adventure', 'Tales of Heroism and Tragedy', 
'In the final hours, the rigid class barriers broke down. Some wealthy men gave up their seats in lifeboats. The ship''s band played until the end. Many crew members stayed at their posts to help passengers escape. These acts of courage illuminate the best of human nature in the darkest hour.',
'heroism', 'secret', '[{"type": "event_triggered", "event_id": "ship-sinking"}, {"type": "timeline_position", "position": 10}]'),

('historical-context', 'titanic-adventure', 'The Edwardian Era''s End', 
'Titanic''s sinking marked the end of an age of optimism and technological confidence. The disaster shattered beliefs in human progress and the conquering of nature through engineering. It foreshadowed the coming Great War and the collapse of the old social order.',
'history', 'secret', '[{"type": "event_triggered", "event_id": "rescue-arrival"}, {"type": "lore_discovered", "lore_id": "survivors-stories"}]');

-- Titanic events
INSERT OR IGNORE INTO events (id, world_id, name, description, event_type, triggers, consequences, participants) VALUES 
('boarding-ship', 'titanic-adventure', 'Boarding the Titanic', 
'You present your ticket and board the magnificent ship. The contrast between passenger classes is immediately apparent.',
'major', 
'[{"type": "location", "value": "southampton-dock"}, {"type": "timeline_position", "position": 1}]',
'[{"type": "move_character", "character_id": "passenger", "to_location": "first-class-promenade"}]',
'[]'),

('departure-southampton', 'titanic-adventure', 'Departure from Southampton', 
'April 10th, 12:00 PM. Titanic''s massive whistles sound as she departs Southampton. Passengers wave from the decks as England disappears behind them.',
'major',
'[{"type": "timeline_position", "position": 2}, {"type": "location", "value": "first-class-promenade"}]',
'[{"type": "unlock_lore", "lore_id": "ship-specifications"}]',
'["captain-smith"]'),

('meeting-love-interest', 'titanic-adventure', 'A Chance Encounter', 
'Fate brings two souls together despite the barriers of class and circumstance. A chance meeting that will change everything.',
'major',
'[{"type": "timeline_position", "position": 3}, {"type": "keyword", "value": "talk"}, {"type": "location", "value": "first-class-promenade"}]',
'[{"type": "spawn_character", "character_id": "rose-dewitt-bukater"}, {"type": "spawn_character", "character_id": "jack-dawson"}]',
'["rose-dewitt-bukater", "jack-dawson"]'),

('dinner-invitation', 'titanic-adventure', 'Dinner in First Class', 
'An invitation to dine among the elite reveals the stark contrasts between social classes and the artificial barriers that separate people.',
'minor',
'[{"type": "relationship_threshold", "character_id": "rose-dewitt-bukater", "threshold": 30}, {"type": "location", "value": "first-class-dining"}]',
'[{"type": "unlock_lore", "lore_id": "class-system"}]',
'["rose-dewitt-bukater", "cal-hockley", "molly-brown"]'),

('lifeboat-drill', 'titanic-adventure', 'Lifeboat Drill Cancelled', 
'Captain Smith cancels the Sunday lifeboat drill due to calm weather. This decision will have tragic consequences.',
'background',
'[{"type": "timeline_position", "position": 5}, {"type": "location", "value": "boat-deck"}]',
'[{"type": "unlock_lore", "lore_id": "lifeboat-regulations"}]',
'["captain-smith", "thomas-andrews"]'),

('ice-warnings-received', 'titanic-adventure', 'Ice Warnings Accumulate', 
'Multiple ice warnings arrive throughout the day, but the ship maintains speed. Confidence in the "unsinkable" ship overrides caution.',
'background',
'[{"type": "timeline_position", "position": 6}, {"type": "location", "value": "ship-bridge"}]',
'[{"type": "spawn_item", "item_id": "wireless-message", "location_id": "ship-bridge"}]',
'["captain-smith", "lookout-fleet"]'),

('iceberg-collision', 'titanic-adventure', 'Collision with Iceberg', 
'11:40 PM, April 14th. "Iceberg right ahead!" The lookout''s cry comes too late. Titanic strikes the iceberg, sealing the fate of over 1,500 souls.',
'major',
'[{"type": "timeline_position", "position": 8}, {"type": "keyword", "value": "iceberg"}]',
'[{"type": "unlock_lore", "lore_id": "ice-conditions"}, {"type": "modify_location", "location_id": "engine-room", "changes": {"flooding": true}}]',
'["lookout-fleet", "captain-smith", "thomas-andrews"]'),

('ship-sinking', 'titanic-adventure', 'The Ship is Sinking', 
'Water pours into the lower decks. Thomas Andrews delivers the devastating news: Titanic will sink within hours. "Women and children first" becomes the desperate cry.',
'major',
'[{"type": "event_completed", "event_id": "iceberg-collision"}, {"type": "timeline_position", "position": 9}]',
'[{"type": "unlock_lore", "lore_id": "survivors-stories"}, {"type": "spawn_item", "item_id": "life-jacket", "location_id": "boat-deck"}]',
'["thomas-andrews", "captain-smith", "molly-brown"]'),

('final-moments', 'titanic-adventure', 'The Final Moments', 
'As Titanic''s stern rises high into the air, passengers and crew face their final moments with courage, love, and dignity.',
'major',
'[{"type": "event_completed", "event_id": "ship-sinking"}, {"type": "timeline_position", "position": 12}]',
'[{"type": "unlock_lore", "lore_id": "historical-context"}]',
'["rose-dewitt-bukater", "jack-dawson", "captain-smith", "thomas-andrews"]'),

('rescue-arrival', 'titanic-adventure', 'RMS Carpathia Arrives', 
'Dawn breaks as the rescue ship Carpathia arrives. Survivors are pulled from lifeboats, forever changed by the tragedy.',
'major',
'[{"type": "event_completed", "event_id": "final-moments"}, {"type": "timeline_position", "position": 15}]',
'[{"type": "unlock_lore", "lore_id": "historical-context"}]',
'["molly-brown", "rose-dewitt-bukater"]');

-- Titanic themes
INSERT OR IGNORE INTO themes (id, world_id, name, description, narrative_hints) VALUES 
('nature-conquers-hubris', 'titanic-adventure', 'Nature Conquers Human Hubris', 
'The "unsinkable" ship meets the unstoppable force of nature, revealing the limits of human engineering and pride.',
'Emphasize the contrast between human confidence and natural power. Show how pride precedes the fall. The iceberg represents nature''s indifferent strength.'),

('love-transcends-class', 'titanic-adventure', 'Love Transcends Social Barriers', 
'True love recognizes no boundaries of wealth or status. The heart sees what society blinds itself to.',
'Highlight moments where genuine emotion breaks through social conventions. Show how artificial the class barriers are when faced with real human connection.'),

('mortality-reveals-character', 'titanic-adventure', 'Crisis Reveals True Character', 
'Facing death strips away social pretenses and reveals who people truly are underneath their roles and expectations.',
'In moments of crisis, show characters acting beyond their social programming. Courage, cowardice, sacrifice, and selfishness emerge independent of class or status.'),

('time-is-precious', 'titanic-adventure', 'The Preciousness of Time', 
'Every moment becomes infinitely valuable when you realize how few remain. Life must be lived fully while we can.',
'Emphasize the urgency of seizing the moment. Show how ordinary moments become precious when viewed through the lens of mortality. Make every interaction count.'),

('sacrifice-and-duty', 'titanic-adventure', 'Duty and Sacrifice', 
'The highest human calling is to put others before oneself, especially when facing ultimate danger.',
'Show characters choosing duty over self-preservation. Highlight moments of selfless sacrifice. The band playing as the ship sinks embodies this theme perfectly.');

-- Insert missing lore for other characters to know
INSERT OR IGNORE INTO lore_entries (id, world_id, title, content, category, access_level, unlock_triggers) VALUES 
('grove-secrets', 'fantasy-adventure', 'Secrets of the Sacred Groves', 
'Deep within the Whispering Woods lie ancient groves where the first druids communed with nature spirits. These places hold immense magical power but are fiercely protected.',
'nature', 'secret', '[{"type": "character_present", "character_id": "shadow-wolf"}, {"type": "location_exploration", "location_id": "whispering-woods-edge"}]'),

('nature-magic', 'fantasy-adventure', 'The Old Ways of Nature Magic', 
'Before human wizards learned to channel magic through study, the animals and spirits of the forest wielded magic instinctively. This primal magic is older and more powerful than human spellcraft.',
'magic', 'restricted', '[{"type": "conversation", "character_id": "shadow-wolf"}, {"type": "keyword", "value": "nature magic"}]'); 