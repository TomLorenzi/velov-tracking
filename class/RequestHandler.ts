class RequestHandler {
    private accessToken?: string;
    private refreshToken?: string;

    private tokenExpirationTime: number;

    constructor() {
        this.tokenExpirationTime = 60 * 60 * 1000;
    }

    async handleRequest(url: string, options?: RequestInit): Promise<any> {
        if (!process.env.VELOV_API_KEY) {
            throw new Error('VELOV_API_KEY is not defined');
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
            await this.getToken();
            return this.handleRequest(url, options);
        }

        return response.json();
    }

    async getToken() {
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
                key: process.env.VELOV_API_KEY,
            }),
        });

        const data = await response.json();
        this.accessToken = data.accessToken;
        this.refreshToken = data.refreshToken;
    }

    async refreshLastToken() {
        const response = await fetch('https://api.cyclocity.fr/auth/access_tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refreshToken: this.refreshToken,
            }),
        });

        this.accessToken = (await response.json()).accessToken;
        this.refreshToken = undefined;
        this.clearTokenTimeout();
    }

    async clearTokenTimeout() {
        setTimeout(() => {
            this.accessToken = undefined;
        }, this.tokenExpirationTime);
    }
}

const requestHandler = new RequestHandler();
export default requestHandler;