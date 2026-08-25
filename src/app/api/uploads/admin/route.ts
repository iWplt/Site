import { NextResponse } from "next/server";
import {
  uploadFormOptionImageAction,
  uploadFormProductImageAction,
  uploadOutfitImageAction,
  uploadProductImageAction
} from "@/app/actions";
import { actionFail, type ActionResult } from "@/lib/action-result";
import { getCurrentUser } from "@/lib/auth";
import { ingestAdminImageFile } from "@/lib/ingest-admin-image";
import { parseAdminUploadKind } from "@/lib/upload-limits";

export const runtime = "nodejs";

function statusFor(result: ActionResult<unknown>): number {
  if (result.success) return 200;
  if (result.code === "unauthorized") return 401;
  if (result.code === "not_found") return 404;
  return 400;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json(actionFail("غير مصرح.", "unauthorized"), { status: 401 });
  }

  const formData = await request.formData();
  const kind = parseAdminUploadKind(formData.get("kind"));
  if (!kind) {
    return NextResponse.json(actionFail("بيانات الصورة غير مكتملة.", "validation"), { status: 400 });
  }

  const ingested = await ingestAdminImageFile(formData.get("file"));
  if (!ingested.success) {
    return NextResponse.json(ingested, { status: 400 });
  }

  const result =
    kind === "option"
      ? await uploadFormOptionImageAction(formData)
      : kind === "outfit"
        ? await uploadOutfitImageAction(formData)
        : kind === "form-product"
          ? await uploadFormProductImageAction(formData)
          : await uploadProductImageAction(formData);

  return NextResponse.json(result, { status: statusFor(result) });
}
