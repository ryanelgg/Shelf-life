import { registerPlugin } from '@capacitor/core';

interface AppleAuthorizeOptions {
  clientId: string;
  redirectURI: string;
  scopes?: string;
  nonce?: string;
}

interface AppleAuthorizeResult {
  response: {
    user?: string;
    email?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    identityToken?: string | null;
    authorizationCode?: string | null;
  };
}

export const SignInWithApple = registerPlugin<{
  authorize(options: AppleAuthorizeOptions): Promise<AppleAuthorizeResult>;
}>('SignInWithApple');
