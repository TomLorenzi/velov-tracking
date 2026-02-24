class RequestHandler {
    private accessToken?: string;
    private refreshToken?: string;
    private tokenExpirationTimer?: ReturnType<typeof setTimeout>;
    private readonly tokenExpirationTime: number;
    private static readonly MAX_RETRIES = 1;

    constructor() {
        this.tokenExpirationTime = 60 * 60 * 1000;
    }

    async handleRequest(url: string, options?: RequestInit, retryCount = 0): Promise<unknown> {
        if (!process.env.CLICLOCITY_API_KEY) {
            throw new Error('CLICLOCITY_API_KEY is not defined');
        }
        if (!this.accessToken) {
            await this.getToken();
        }

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options?.headers,
                'Authorization': `Taknv1  ${this.accessToken}`,
            },
        });

        if (response.status === 401) {
            if (retryCount >= RequestHandler.MAX_RETRIES) {
                throw new Error('Authentication failed after retry — aborting to prevent infinite loop');
            }
            console.log('Token expired, refreshing...');
            this.accessToken = undefined;
            this.refreshToken = undefined;
            await this.getToken();
            return this.handleRequest(url, options, retryCount + 1);
        }

        if (response.status !== 200) {
            //looks like the token is invalid but doesn't throw a 401
            this.accessToken = undefined;
            this.refreshToken = undefined;
            throw new Error(`Request failed with status ${response.status}`);
        }

        return response.json();
    }

    async getToken(): Promise<void> {
        if (this.refreshToken) {
            await this.refreshLastToken();
            return;
        }
        const response = await fetch('https://api.cyclocity.fr/auth/environments/PRD/client_tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: 'vls.web.lyon:PRD',
                key: process.env.CLICLOCITY_API_KEY,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to get token: ${response.status}`);
        }

        const data = await response.json();
        this.accessToken = data.accessToken;
        this.refreshToken = data.refreshToken;
        this.scheduleTokenExpiration();
    }

    async refreshLastToken(): Promise<void> {
        const response = await fetch('https://api.cyclocity.fr/auth/access_tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refreshToken: this.refreshToken,
            }),
        });

        if (!response.ok) {
            // Refresh failed — clear tokens so getToken() will do a full auth next time
            this.accessToken = undefined;
            this.refreshToken = undefined;
            throw new Error(`Failed to refresh token: ${response.status}`);
        }

        const data = await response.json();
        console.log('Token refreshed:', data);
        this.accessToken = data.accessToken;
        this.refreshToken = undefined;
        this.scheduleTokenExpiration();
    }

    private scheduleTokenExpiration(): void {
        if (this.tokenExpirationTimer) {
            clearTimeout(this.tokenExpirationTimer);
        }
        this.tokenExpirationTimer = setTimeout(() => {
            this.accessToken = undefined;
        }, this.tokenExpirationTime);
    }
}

const requestHandler = new RequestHandler();
export default requestHandler;