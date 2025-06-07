# Backend API Requirements

This document outlines the API endpoints required from the backend, based on the frontend application's `src/api.ts` file. Each entry specifies the endpoint, HTTP method, expected request payload, and the expected response.

## Authentication & Authorization

### 1. `POST /auth/guest`
- **Description**: Allows a user to log in as a guest, creating a temporary session.
- **Method**: `POST`
- **Request**: 
  - `Headers`: `Content-Type: application/json`
  - `Body`: None
- **Response**: 
  - `200 OK`: 
    ```json
    {
      "sessionToken": "string",
      "routeToDemo": "boolean" 
    }
    ```
    - `sessionToken`: A JWT or similar token for subsequent authenticated requests.
    - `routeToDemo`: A boolean indicating if the user should be routed directly to demo worlds.

### 2. `POST /auth/google`
- **Description**: Allows a user to log in using Google SSO.
- **Method**: `POST`
- **Request**: 
  - `Headers`: `Content-Type: application/json`
  - `Body`: 
    ```json
    {
      "token": "string" 
    }
    ```
    - `token`: The Google authentication token.
- **Response**: 
  - `200 OK`: 
    ```json
    {
      "sessionToken": "string",
      "routeToDemo": "boolean" 
    }
    ```
    - `sessionToken`: A JWT or similar token for subsequent authenticated requests.
    - `routeToDemo`: A boolean indicating if the user should be routed directly to demo worlds.

### 3. `GET /auth/validate`
- **Description**: Validates the authenticity and expiration of a given session token.
- **Method**: `GET`
- **Request**: 
  - `Headers`: 
    - `Content-Type: application/json`
    - `Authorization: Bearer <sessionToken>`
  - `Body`: None
- **Response**: 
  - `200 OK`: Indicates the token is valid.
  - `401 Unauthorized`: Indicates the token is invalid or expired.

## World Management

### 1. `GET /demo/worlds`
- **Description**: Fetches a list of pre-built demo worlds available for instant play.
- **Method**: `GET`
- **Request**: 
  - `Headers`: `Authorization: Bearer <sessionToken>`
  - `Body`: None
- **Response**: 
  - `200 OK`: Array of `DemoWorld` objects.
    ```json
    [
      {
        "id": "string",
        "title": "string",
        "description": "string | undefined",
        "previewContent": "string | undefined"
      }
    ]
    ```

### 2. `GET /worlds?public=true&page={}&personality={}`
- **Description**: Fetches a paginated list of public worlds, optionally filtered/sorted by user personality.
- **Method**: `GET`
- **Request**: 
  - `Headers`: `Authorization: Bearer <sessionToken>`
  - `Query Parameters`:
    - `public`: `true` (always true for this endpoint)
    - `page`: `number` (current page number, default to 1)
    - `personality`: `string` (JSON stringified `PersonalityProfile` object, optional)
- **Response**: 
  - `200 OK`: Array of `WorldSummary` objects.
    ```json
    [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "genre": "string",
        "thumbnailUrl": "string | undefined",
        "previewContent": "string",
        "createdAt": "Date",
        "quickPlayReady": "boolean"
      }
    ]
    ```

### 3. `POST /worlds/co-create`
- **Description**: Initiates a new world co-creation session with an initial concept provided by the user.
- **Method**: `POST`
- **Request**: 
  - `Headers`: 
    - `Content-Type: application/json`
    - `Authorization: Bearer <sessionToken>`
  - `Body`: 
    ```json
    {
      "concept": "string" 
    }
    ```
    - `concept`: The initial idea or concept for the new world.
- **Response**: 
  - `200 OK`: A string representing the AI's initial response or a session ID for the co-creation.
    ```json
    "string" 
    ```
    (Note: The frontend expects a string response, likely the AI's first conversational turn.)

## Session Management

### 1. `POST /sessions/new`
- **Description**: Creates a new personalized story session for a given world.
- **Method**: `POST`
- **Request**: 
  - `Headers`: 
    - `Content-Type: application/json`
    - `Authorization: Bearer <sessionToken>`
  - `Body`: 
    ```json
    {
      "worldId": "string" 
    }
    ```
    - `worldId`: The ID of the world to start a session with.
- **Response**: 
  - `200 OK`: 
    ```json
    {
      "sessionId": "string",
      "worldState": "string",
      "personalitySnapshot": "any | undefined" 
    }
    ```
    - `sessionId`: The ID of the newly created session.
    - `worldState`: The initial state or context of the world for the session.
    - `personalitySnapshot`: An optional snapshot of the user's personality at the start of the session.

### 2. `POST /sessions/{sessionId}/interact`
- **Description**: Sends a user's utterance to the active story session and receives the AI's coherent response.
- **Method**: `POST`
- **Path Parameters**:
  - `sessionId`: The ID of the active story session.
- **Request**: 
  - `Headers`: 
    - `Content-Type: application/json`
    - `Authorization: Bearer <sessionToken>`
  - `Body`: 
    ```json
    {
      "utterance": "string" 
    }
    ```
    - `utterance`: The user's message or choice.
- **Response**: 
  - `200 OK`: 
    ```json
    {
      "response": "string" 
    }
    ```
    - `response`: The AI narrator's coherent response.

## Onboarding & Personality

### 1. `POST /onboarding/preference-discovery`
- **Description**: Completes the user's initial preference discovery quiz, generating a personality profile.
- **Method**: `POST`
- **Request**: 
  - `Headers`: 
    - `Content-Type: application/json`
    - `Authorization: Bearer <sessionToken>`
  - `Body`: `PreferenceResponses` object.
    ```json
    {
      "adventureStyle": "magical" | "technological" | "natural" | "mysterious",
      "characterType": "hero" | "explorer" | "creator" | "friend",
      "interests": ["magic" | "technology" | "animals" | "space"],
      "visualResponses": "string[]" 
    }
    ```
- **Response**: 
  - `200 OK`: A `PersonalityProfile` object.
    ```json
    {
      "traitScores": "Record<string, number>",
      "confidenceLevel": "number",
      "assessmentMethod": "quiz" | "interaction",
      "timestamp": "Date" 
    }
    ``` 