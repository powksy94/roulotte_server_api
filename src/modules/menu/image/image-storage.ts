import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export interface ImageStorage {
    save(content: Buffer, extension: string): Promise<string>;
    remove(imageUrl: string): Promise<void>;
}

export class LocalImageStorage implements ImageStorage {
    constructor(private readonly uploadsDir: string) {}

    async save(content: Buffer, extension: string) {
        const name = `${randomUUID()}.${extension}`;
        const dir = join(this.uploadsDir, "dishes");
        await mkdir(dir, { recursive: true });
        await writeFile(join(dir, name), content);
        return `/uploads/dishes/${name}`;
    }

    async remove(imageUrl: string) {
        // basename : on ne supprime que dans notre dossier, quel que soit le chemin
        await rm(join(this.uploadsDir, "dishes", basename(imageUrl)), { force: true });
    }
}