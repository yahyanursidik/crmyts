interface NetlifyEvent {
    path: string;
    httpMethod: string;
    headers: Record<string, string | undefined>;
    queryStringParameters: Record<string, string | undefined> | null;
    body: string | null;
}
export declare const handler: (event: NetlifyEvent) => Promise<{
    statusCode: number;
    headers: Record<string, string>;
    body: string;
}>;
export {};
