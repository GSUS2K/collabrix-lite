import { useState, useEffect } from 'react';
import { DiscordSDK } from '@discord/embedded-app-sdk';

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;

let sdkInstance;
const search = new URLSearchParams(window.location.search);
if (search.get('frame_id')) {
    sdkInstance = new DiscordSDK(clientId);
} else {
    console.warn("No frame_id found in URL. Mocking DiscordSDK to prevent crash.");
    sdkInstance = {
        ready: async () => console.log('Mock SDK ready called'),
        commands: {
            authorize: async () => { throw new Error("Mock SDK cannot authorize"); },
            authenticate: async () => { throw new Error("Mock SDK cannot authenticate"); },
        }
    };
}
export const discordSdk = sdkInstance;

export function useDiscord() {
    const [isReady, setIsReady] = useState(false);
    const [auth, setAuth] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function setupDiscord() {
            if (!clientId) {
                setError(new Error("No Discord Client ID found. Check VITE_DISCORD_CLIENT_ID env var."));
                return;
            }
            try {
                // Add a timeout so ready() doesn't hang silently
                await Promise.race([
                    discordSdk.ready(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('SDK ready() timed out — check URL Mapping in Discord Developer Portal')), 6000)
                    ),
                ]);

                // Patch all XHR/fetch/WebSocket to route through Discord's proxy
                // Requires URL Mapping in Discord Dev Portal: /backend → https://collabrix-lite.onrender.com
                if (discordSdk.patchUrlMappings) {
                    discordSdk.patchUrlMappings([
                        { prefix: '/backend', target: 'https://collabrix-lite.onrender.com' },
                    ]);
                }

                setIsReady(true);
            } catch (err) {
                setError(err);
            }
        }
        setupDiscord();
    }, []);

    const authenticate = async () => {
        try {
            const { code } = await discordSdk.commands.authorize({
                client_id: clientId,
                response_type: 'code',
                state: '',
                prompt: 'none',
                scope: ['identify', 'email'],
            });

            // Exchange code for collabrix JWT via our backend
            const response = await fetch('/api/auth/discord/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });

            if (!response.ok) throw new Error('Failed to exchange Discord code');

            const data = await response.json();
            const { access_token, collabrix_token, user } = data;

            // Authenticate with the Discord SDK using the access_token
            const authResult = await discordSdk.commands.authenticate({ access_token });
            if (!authResult) throw new Error('Discord SDK authenticate failed');

            setAuth(authResult);
            // Return everything the AuthPage needs to log in
            return { collabrix_token, user };

        } catch (err) {
            setError(err);
            throw err;
        }
    };

    return { isReady, authenticate, auth, error };
}
