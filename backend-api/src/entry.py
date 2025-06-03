from workers import Response, handler
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List

class OdisseyAPI:
    def __init__(self, env):
        self.db = env.DB
        
    async def handle_request(self, request) -> Response:
        """Main request router"""
        url = request.url
        method = request.method
        path = url.split('/')[-1] if '/' in url else url
        
        # Remove query parameters for routing
        if '?' in path:
            path = path.split('?')[0]
            
        try:
            # Route handling
            if method == "GET" and path == "":
                return await self.health_check()
            elif method == "GET" and path == "demo-worlds":
                return await self.get_demo_worlds()
            elif method == "POST" and path == "users":
                return await self.create_user(request)
            elif method == "POST" and path == "worlds":
                return await self.create_world(request)
            elif method == "GET" and path.startswith("worlds"):
                return await self.get_worlds()
            elif method == "POST" and path == "sessions":
                return await self.create_session(request)
            elif method == "POST" and path.startswith("sessions") and path.endswith("interact"):
                session_id = path.split('/')[1]  # Extract session ID
                return await self.story_interact(request, session_id)
            else:
                return Response(
                    json.dumps({"error": "Not found"}),
                    status=404,
                    headers={"Content-Type": "application/json"}
                )
        except Exception as e:
            return Response(
                json.dumps({"error": str(e)}),
                status=500,
                headers={"Content-Type": "application/json"}
            )
    
    async def health_check(self) -> Response:
        """Health check endpoint"""
        return Response(
            json.dumps({
                "status": "healthy",
                "service": "Odissey Storytelling API",
                "version": "0.1.0",
                "timestamp": datetime.now().isoformat()
            }),
            headers={"Content-Type": "application/json"}
        )
    
    async def get_demo_worlds(self) -> Response:
        """Get demo worlds for instant access"""
        try:
            # Query demo worlds with world details
            stmt = """
            SELECT 
                dw.id as demo_id,
                w.id as world_id,
                w.title,
                w.description,
                w.genre,
                w.thumbnail_url,
                dw.preview_content,
                dw.target_personality
            FROM demo_worlds dw
            JOIN worlds w ON dw.world_id = w.id
            WHERE dw.access_level = 'public'
            ORDER BY w.created_at DESC
            LIMIT 10
            """
            
            result = await self.db.prepare(stmt).all()
            demo_worlds = []
            
            for row in result.results:
                demo_worlds.append({
                    "demo_id":           row.demo_id,
                    "world_id":          row.world_id,
                    "title":             row.title,
                    "description":       row.description,
                    "genre":             row.genre,
                    "thumbnail_url":     row.thumbnail_url,
                    "preview_content":   row.preview_content,
                    "target_personality": json.loads(row.target_personality) if row.target_personality else {}
                })
            
            return Response(
                json.dumps({"demo_worlds": demo_worlds}),
                headers={"Content-Type": "application/json"}
            )
        except Exception as e:
            return Response(
                json.dumps({"error": f"Failed to fetch demo worlds: {str(e)}"}),
                status=500,
                headers={"Content-Type": "application/json"}
            )
    
    async def create_user(self, request) -> Response:
        """Create a new user profile"""
        try:
            data = await request.json()
            user_id = str(uuid.uuid4())
            
            # Basic user data with defaults
            name = data.get("name", f"User_{user_id[:8]}")
            age = data.get("age")
            gender = data.get("gender")
            auth_type = data.get("auth_type", "guest")
            
            # Insert user
            stmt = """
            INSERT INTO users (id, name, age, gender, auth_type)
            VALUES (?, ?, ?, ?, ?)
            """
            await self.db.prepare(stmt).bind(user_id, name, age, gender, auth_type).run()
            
            # Create initial personality assessment if provided
            if "personality" in data:
                personality_id = str(uuid.uuid4())
                personality_stmt = """
                INSERT INTO personality_assessments 
                (id, user_id, trait_scores, assessment_method)
                VALUES (?, ?, ?, ?)
                """
                await self.db.prepare(personality_stmt).bind(
                    personality_id,
                    user_id,
                    json.dumps(data["personality"]),
                    "preference_discovery"
                ).run()
            
            return Response(
                json.dumps({
                    "user_id": user_id,
                    "name": name,
                    "route_to_demo": age is None or age < 13  # Kids go to demo first
                }),
                headers={"Content-Type": "application/json"}
            )
        except Exception as e:
            return Response(
                json.dumps({"error": f"Failed to create user: {str(e)}"}),
                status=500,
                headers={"Content-Type": "application/json"}
            )
    
    async def create_world(self, request) -> Response:
        """Create a new world with artifacts"""
        try:
            data = await request.json()
            world_id = str(uuid.uuid4())
            
            # Required fields
            creator_id = data.get("creator_id")
            title = data.get("title", "Untitled World")
            description = data.get("description", "")
            genre = data.get("genre", "adventure")
            
            # World artifacts for coherence
            default_artifacts = {
                "characters": [],
                "settings": [],
                "rules": [],
                "events": [],
                "story_template": "basic_adventure"
            }
            artifacts = data.get("artifacts", default_artifacts)
            
            stmt = """
            INSERT INTO worlds 
            (id, creator_id, title, description, genre, artifacts, privacy_flag)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            await self.db.prepare(stmt).bind(
                world_id,
                creator_id,
                title,
                description,
                genre,
                json.dumps(artifacts),
                data.get("privacy_flag", "public")
            ).run()
            
            # If marked as demo world, add to demo_worlds table
            if data.get("is_demo", False):
                demo_id = str(uuid.uuid4())
                demo_stmt = """
                INSERT INTO demo_worlds (id, world_id, preview_content, target_personality)
                VALUES (?, ?, ?, ?)
                """
                await self.db.prepare(demo_stmt).bind(
                    demo_id,
                    world_id,
                    data.get("preview_content", ""),
                    json.dumps(data.get("target_personality", {}))
                ).run()
            
            return Response(
                json.dumps({
                    "world_id": world_id,
                    "title": title,
                    "artifacts": artifacts
                }),
                headers={"Content-Type": "application/json"}
            )
        except Exception as e:
            return Response(
                json.dumps({"error": f"Failed to create world: {str(e)}"}),
                status=500,
                headers={"Content-Type": "application/json"}
            )
    
    async def get_worlds(self) -> Response:
        """Get public worlds for discovery"""
        try:
            stmt = """
            SELECT id, title, description, genre, thumbnail_url, preview_content, created_at
            FROM worlds 
            WHERE privacy_flag = 'public'
            ORDER BY created_at DESC
            LIMIT 20
            """
            
            result = await self.db.prepare(stmt).all()
            worlds = []
            
            for row in result.results:
                worlds.append({
                    "world_id": row["id"],
                    "title": row["title"],
                    "description": row["description"],
                    "genre": row["genre"],
                    "thumbnail_url": row["thumbnail_url"],
                    "preview_content": row["preview_content"],
                    "created_at": row["created_at"]
                })
            
            return Response(
                json.dumps({"worlds": worlds}),
                headers={"Content-Type": "application/json"}
            )
        except Exception as e:
            return Response(
                json.dumps({"error": f"Failed to fetch worlds: {str(e)}"}),
                status=500,
                headers={"Content-Type": "application/json"}
            )
    
    async def create_session(self, request) -> Response:
        """Create a new story session"""
        try:
            data = await request.json()
            session_id = str(uuid.uuid4())
            
            user_id = data.get("user_id")
            world_id = data.get("world_id")
            personality_snapshot = data.get("personality_snapshot", {})
            
            stmt = """
            INSERT INTO sessions (id, user_id, world_id, personality_snapshot)
            VALUES (?, ?, ?, ?)
            """
            await self.db.prepare(stmt).bind(
                session_id,
                user_id,
                world_id,
                json.dumps(personality_snapshot)
            ).run()
            
            # Get world artifacts for session initialization
            world_stmt = "SELECT title, artifacts FROM worlds WHERE id = ?"
            world_result = await self.db.prepare(world_stmt).bind(world_id).first()
            
            if world_result:
                world_artifacts = json.loads(world_result["artifacts"])
                
                # Create initial narrator message
                initial_message = self.generate_story_opening(
                    world_result["title"], 
                    world_artifacts, 
                    personality_snapshot
                )
                
                # Log initial narrator message
                chat_id = str(uuid.uuid4())
                chat_stmt = """
                INSERT INTO chat_logs (id, session_id, speaker, content, system_prompt_used)
                VALUES (?, ?, ?, ?, ?)
                """
                await self.db.prepare(chat_stmt).bind(
                    chat_id,
                    session_id,
                    "narrator",
                    initial_message,
                    "story_opening"
                ).run()
            
            return Response(
                json.dumps({
                    "session_id": session_id,
                    "initial_message": initial_message if world_result else "Welcome to your adventure!",
                    "world_title": world_result["title"] if world_result else "Unknown World"
                }),
                headers={"Content-Type": "application/json"}
            )
        except Exception as e:
            return Response(
                json.dumps({"error": f"Failed to create session: {str(e)}"}),
                status=500,
                headers={"Content-Type": "application/json"}
            )
    
    async def story_interact(self, request, session_id: str) -> Response:
        """Handle story interaction with basic AI simulation"""
        try:
            data = await request.json()
            user_message = data.get("message", "")
            
            # Log user message
            user_chat_id = str(uuid.uuid4())
            user_stmt = """
            INSERT INTO chat_logs (id, session_id, speaker, content)
            VALUES (?, ?, ?, ?)
            """
            await self.db.prepare(user_stmt).bind(
                user_chat_id,
                session_id,
                "user",
                user_message
            ).run()
            
            # Get session context
            session_stmt = """
            SELECT s.personality_snapshot, w.title, w.artifacts
            FROM sessions s
            JOIN worlds w ON s.world_id = w.id
            WHERE s.id = ?
            """
            session_result = await self.db.prepare(session_stmt).bind(session_id).first()
            
            if not session_result:
                return Response(
                    json.dumps({"error": "Session not found"}),
                    status=404,
                    headers={"Content-Type": "application/json"}
                )
            
            # Generate narrator response (basic simulation for now)
            personality = json.loads(session_result["personality_snapshot"] or "{}")
            artifacts = json.loads(session_result["artifacts"])
            
            narrator_response = self.generate_narrator_response(
                user_message, 
                artifacts, 
                personality
            )
            
            # Log narrator response
            narrator_chat_id = str(uuid.uuid4())
            narrator_stmt = """
            INSERT INTO chat_logs (id, session_id, speaker, content, system_prompt_used)
            VALUES (?, ?, ?, ?, ?)
            """
            await self.db.prepare(narrator_stmt).bind(
                narrator_chat_id,
                session_id,
                "narrator",
                narrator_response,
                "basic_interaction"
            ).run()
            
            return Response(
                json.dumps({
                    "narrator_response": narrator_response,
                    "session_id": session_id
                }),
                headers={"Content-Type": "application/json"}
            )
        except Exception as e:
            return Response(
                json.dumps({"error": f"Failed to process interaction: {str(e)}"}),
                status=500,
                headers={"Content-Type": "application/json"}
            )
    
    def generate_story_opening(self, world_title: str, artifacts: Dict, personality: Dict) -> str:
        """Generate opening story message (basic version)"""
        # This is a simplified version - in the full system this would use AI
        settings = artifacts.get("settings", [])
        characters = artifacts.get("characters", [])
        
        setting_text = f" in {settings[0]}" if settings else ""
        character_text = f" You notice {characters[0]} nearby." if characters else ""
        
        personality_trait = ""
        if personality.get("adventurous", 0) > 0.7:
            personality_trait = " Your heart races with excitement for the adventure ahead."
        elif personality.get("creative", 0) > 0.7:
            personality_trait = " Your imagination sparkles with possibilities."
        
        return f"Welcome to {world_title}! You find yourself{setting_text}.{character_text}{personality_trait} What would you like to do?"
    
    def generate_narrator_response(self, user_message: str, artifacts: Dict, personality: Dict) -> str:
        """Generate narrator response (basic simulation)"""
        # This is a very basic response generator for the zero version
        # In the full system, this would use sophisticated AI with system prompts
        
        responses = [
            "Your action echoes through the world around you. Something stirs in response...",
            "The world shifts subtly as you make your choice. What happens next?",
            "Your decision creates ripples of change. The story continues to unfold...",
            "The adventure takes an unexpected turn based on your actions.",
            "Your courage and creativity guide the story in a new direction."
        ]
        
        # Add some personality-based flavor
        if personality.get("brave", 0) > 0.7:
            responses.append("Your bravery inspires those around you. The path ahead becomes clearer.")
        if personality.get("creative", 0) > 0.7:
            responses.append("Your creative spirit unlocks new possibilities in this magical world.")
        
        import random
        return random.choice(responses)

@handler
async def on_fetch(request, env):
    api = OdisseyAPI(env)
    return await api.handle_request(request)
