import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(100).optional(),
});

export async function POST(req: Request) {
  if (process.env.DISABLE_REGISTRATION === "true") {
    return Response.json(
      { error: "Registration is disabled" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid email or password (min 8 characters)" },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (existing?.passwordHash) {
    return Response.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  if (existing && !existing.passwordHash) {
    return Response.json(
      {
        error:
          "This email is already linked to Google. Sign in with Google, or use another email.",
      },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await db.user.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash,
    },
    select: { id: true, email: true },
  });

  return Response.json({ ok: true, user }, { status: 201 });
}
