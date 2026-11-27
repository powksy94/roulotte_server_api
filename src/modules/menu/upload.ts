import multer from "multer";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single("image");