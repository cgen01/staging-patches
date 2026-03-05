import type { Context } from "@netlify/functions";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { password } = await req.json();
  if (!password) {
    return new Response(JSON.stringify({ error: "Password required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const passwordHash = process.env.PASSWORD_HASH;
  const jwtSecret = process.env.JWT_SECRET;

  if (!passwordHash || !jwtSecret) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = jwt.sign({ authorized: true }, jwtSecret, { expiresIn: "7d" });

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
