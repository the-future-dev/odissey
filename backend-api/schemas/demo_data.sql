-- Insert demo worlds for immediate testing
INSERT INTO users (id, name, age, auth_type) VALUES 
('demo-user-1', 'Demo Kid', 10, 'demo'),
('demo-user-2', 'Demo Teen', 14, 'demo');

INSERT INTO worlds (id, creator_id, title, description, genre, artifacts, privacy_flag) VALUES 
('demo-world-1', 'demo-user-1', 'Dragon Valley Adventure', 'A magical valley where friendly dragons live and help young heroes on their quests.', 'fantasy', 
 '{"characters": ["Sparkle the Dragon", "Wise Oak Tree"], "settings": ["Misty Dragon Valley", "Crystal Cave"], "rules": ["Dragons are friendly helpers", "Magic works through kindness"], "events": ["The Lost Crystal Quest"], "story_template": "hero_journey"}', 'public'),
('demo-world-2', 'demo-user-1', 'Space Explorer Academy', 'Join the academy where young cadets learn to explore distant galaxies and make alien friends.', 'sci-fi',
 '{"characters": ["Captain Nova", "Zix the Friendly Alien"], "settings": ["Space Station Cosmos", "Planet Zephyr"], "rules": ["Technology helps solve problems", "Friendship bridges all species"], "events": ["The Mysterious Signal"], "story_template": "exploration"}', 'public');

INSERT INTO demo_worlds (id, world_id, preview_content, target_personality) VALUES 
('demo-1', 'demo-world-1', 'Meet Sparkle, a shimmering purple dragon who needs your help finding the lost Crystal of Kindness! Will you brave the misty valley?', '{"adventurous": 0.8, "creative": 0.7, "kind": 0.9}'),
('demo-2', 'demo-world-2', 'Blast off to the stars! Captain Nova has detected a mysterious signal from beyond the galaxy. Your mission: investigate and make new friends!', '{"curious": 0.9, "brave": 0.8, "logical": 0.7}');

INSERT INTO system_prompts (id, type, template, variables) VALUES 
('story-opening', 'narration', 'Welcome to {world_title}! You find yourself {setting}. {character_intro} {personality_hook} What would you like to do?', '["world_title", "setting", "character_intro", "personality_hook"]'),
('basic-interaction', 'narration', 'Your {action_type} creates {consequence}. {world_response} {personality_response}', '["action_type", "consequence", "world_response", "personality_response"]'); 