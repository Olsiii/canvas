import type { FastifyReply } from "fastify";
import { SESSION_COOKIE_NAME } from "./session";

const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export function setSessionCookie(res: FastifyReply, sessionId: string) {
  res.setCookie(SESSION_COOKIE_NAME, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_COOKIE_MAX_AGE_SEC,
  });
}

export function clearSessionCookie(res: FastifyReply) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}
