import { fileTypeFromBuffer } from "file-type";

// Types acceptés → extension du fichier enregistré
const ACCEPTED: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
};

export async function detectImageExtension(content: Buffer): Promise<string | null> {
    const type = await fileTypeFromBuffer(content);
    return (type && ACCEPTED[type.mime]) ?? null;
}