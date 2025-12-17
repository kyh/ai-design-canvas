import z from "zod";

export const metadataSchema = z.object({});

export type Metadata = z.infer<typeof metadataSchema>;
