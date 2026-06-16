import type { AvoChatMessage } from './avoChatSession';
import * as debug from './debug';

interface AvoChatResponse {
  text?: string;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 15000;
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-key';
const hostedAvoChatUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/avo-chat`;

async function parseErrorMessage(response: Response) {
  try {
    const data = await response.json() as AvoChatResponse;
    return data.error || `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Avo is taking longer than expected. Please try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestFromUrl(url: string, init: RequestInit) {
  const response = await fetchWithTimeout(url, init);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  const data = await response.json() as AvoChatResponse;
  if (!data.text) {
    throw new Error('Empty Avo response');
  }

  return data.text;
}

function requestFromHostedFunction(messages: AvoChatMessage[]) {
  return requestFromUrl(hostedAvoChatUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ messages }),
  });
}

function requestFromLocalDevFunction(messages: AvoChatMessage[]) {
  return requestFromUrl('/api/avo-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
}

export async function requestAvoChat(messages: AvoChatMessage[]): Promise<string> {
  if (import.meta.env.DEV) {
    try {
      return await requestFromLocalDevFunction(messages);
    } catch (localError) {
      debug.warn('[Avo chat] Local dev endpoint failed, falling back to hosted function.', localError);
    }
  }

  return requestFromHostedFunction(messages);
}
