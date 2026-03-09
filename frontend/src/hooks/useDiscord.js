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
                setError(new Error("No Discord Client ID found"));
                return;
            }
            try {
                await discordSdk.ready();
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
                scope: ['identify']
            });

            // Pass this code to our backend to exchange for an access token
            const response = await fetch('/api/auth/discord/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            if (!response.ok) {
                throw new Error('Failed to exchange code');
            }

            const { access_token } = await response.json();

            const authResult = await discordSdk.commands.authenticate({
                access_token
            });

            if (!authResult) throw new Error("Authenticate command failed");

            setAuth(authResult);
            return authResult;

        } catch (err) {
            setError(err);
            throw err;
        }
    };

    return { isReady, authenticate, auth, error };
}
