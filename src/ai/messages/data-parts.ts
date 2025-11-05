import z from "zod";
import { blockSchema } from "@/lib/schema";

// Type for the data field in messages
// All keys are optional - we check which one is present at runtime
export type DataPart = {
  "generate-text-block"?: {
    block: z.infer<typeof blockSchema>;
    status: "done";
  };
  "generate-frame-block"?: {
    block: z.infer<typeof blockSchema>;
    status: "done";
  };
  "generate-image-block"?: {
    block: z.infer<typeof blockSchema>;
    status: "done";
  };
};
