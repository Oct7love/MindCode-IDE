declare module 'chardet' {
  export function detect(buffer: Buffer): string | null;
  export function detectFile(path: string): Promise<string | null>;
  export function detectFileSync(path: string): string | null;
}
