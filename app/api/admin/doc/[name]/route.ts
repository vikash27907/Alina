import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { currentUser } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

// serves verification documents to admins only
export async function GET(
  _req: Request,
  { params }: { params: { name: string } }
) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const safe = path.basename(params.name); // no path traversal
  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, safe));
    const ext = safe.split(".").pop() || "jpg";
    return new NextResponse(data, {
      headers: {
        "Content-Type": `image/${ext === "jpg" ? "jpeg" : ext}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
