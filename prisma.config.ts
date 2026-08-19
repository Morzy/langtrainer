import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:51214/template1?sslmode=disable',
  },
});
