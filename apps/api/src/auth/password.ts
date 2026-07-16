import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTS);
}

export function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  return verify(hashValue, password, ARGON2_OPTS);
}
