import { User } from '../database/db-types';

export function createCallbackErrorPage(message: string): Response {
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Authentication Error - Odyssey</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 2rem;
        max-width: 500px;
        margin: 0 auto;
        text-align: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .container {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      }
      .error { color: #dc2626; margin: 1rem 0; }
      .button {
        background: #8B5CF6;
        color: white;
        padding: 12px 24px;
        border: none;
        border-radius: 8px;
        text-decoration: none;
        display: inline-block;
        margin-top: 1rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>🚫 Authentication Failed</h2>
      <p class="error">${message}</p>
      <p>Please close this window and try again.</p>
      <a href="/" class="button">Return to App</a>
    </div>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Set-Cookie': 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', // Clear state cookie
    },
    status: 400,
  });
}

export function createCallbackSuccessPage(accessToken: string, user: User): Response {
  const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Authentication Success - Odyssey</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 2rem;
        max-width: 500px;
        margin: 0 auto;
        text-align: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .container {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      }
      .success { color: #059669; margin: 1rem 0; }
      .user-info { 
        margin: 1rem 0; 
        padding: 1rem; 
        background: #f8fafc; 
        border-radius: 8px; 
      }
      .avatar { 
        width: 64px; 
        height: 64px; 
        border-radius: 50%; 
        margin: 0 auto 1rem; 
        display: block; 
      }
      .disclaimer {
        background: #fef3c7;
        border: 1px solid #fbbf24;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
        font-size: 0.9em;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>🎉 Welcome to Odyssey!</h2>
      <p class="success">Authentication successful!</p>
      
      <div class="user-info">
        ${user.picture_url ? `<img src="${user.picture_url}" alt="Profile" class="avatar">` : ''}
        <h3>Hello, ${user.name}!</h3>
        <p>${user.email}</p>
      </div>

      <p>You can now close this window and enjoy your storytelling adventure!</p>
      
      <script>
        // Store the authentication token in localStorage immediately
        try {
          localStorage.setItem('odyssey_google_token', '${accessToken}');
          localStorage.setItem('odyssey_google_user', JSON.stringify({
            id: ${user.id},
            email: '${user.email}',
            name: '${user.name}',
            picture_url: '${user.picture_url || ''}'
          }));
          
          // Communicate with the parent window (mobile app) immediately
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              token: '${accessToken}',
              user: {
                id: ${user.id},
                email: '${user.email}',
                name: '${user.name}',
                picture_url: '${user.picture_url || ''}'
              }
            }, '*');
          }
          
          // Close immediately after storing data
          setTimeout(() => {
            window.close();
          }, 100);
          
        } catch (err) {
          console.error('Failed to store authentication data:', err);
          // Still try to close even if storage fails
          setTimeout(() => {
            window.close();
          }, 1000);
        }
      </script>
    </div>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Set-Cookie': 'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0', // Clear state cookie
    },
  });
}
