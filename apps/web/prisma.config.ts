import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Generation needs no credentials. CLI database operations require DIRECT_URL.
  datasource: { url: process.env.DIRECT_URL ?? "" },
});
