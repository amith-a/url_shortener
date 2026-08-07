import { randomInt } from 'node:crypto';
const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SHORT_CODE_LENGTH = 8;


export function generateShortCode(length = SHORT_CODE_LENGTH): string {
  let shortCode = '';
  for (let index = 0; index < length; index++) {
    shortCode += BASE62.charAt(randomInt(BASE62.length));
  }
  return shortCode;
}
