import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Serves a model's verification image to admins only. The [name] segment is
// "<profileId>__id" or "<profileId>__selfie"; the image is stored in the DB as
// a data URL and decoded back to bytes here.
export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profileId, which] = params.name.split("__");
  if (!profileId || (which !== "id" && which !== "selfie"))
    return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const profile = await db.modelProfile.findUnique({ where: { id: profileId } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dataUrl = which === "id" ? profile.idDocPath : profile.selfiePath;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(dataUrl);
  if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = Buffer.from(match[2], "base64");
  return new NextResponse(data, {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "private, no-store",
    },
  });
}
