declare module 'iconv-lite' {
  export function decode(buffer: Buffer, encoding: string): string;
  export function encode(content: string, encoding: string): Buffer;
  export function encodingExists(encoding: string): boolean;
}
