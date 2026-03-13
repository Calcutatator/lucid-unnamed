export interface EchoResult {
  echo: unknown;
  timestamp: string;
}

export function createEchoResponse(body: unknown): EchoResult {
  return {
    echo: body,
    timestamp: new Date().toISOString(),
  };
}
