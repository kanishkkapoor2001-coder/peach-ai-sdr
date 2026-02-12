import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection pooling configuration for Neon
// This reuses connections instead of creating new ones each request
const connectionString = process.env.DATABASE_URL;

// Check if DATABASE_URL is valid
const isValidDatabaseUrl = connectionString &&
  connectionString.startsWith("postgres") &&
  !connectionString.includes("your_") &&
  !connectionString.includes("_here");

if (!isValidDatabaseUrl && typeof window === "undefined") {
  console.error("\n⚠️  DATABASE_URL is not configured!");
  console.error("Please update your .env.local file with a valid Neon PostgreSQL URL.");
  console.error("Get a free database at: https://neon.tech\n");
}

// Create a single shared connection pool
// max: 10 connections, idle_timeout: 20 seconds
const queryClient = isValidDatabaseUrl
  ? postgres(connectionString!, {
      max: 10, // Maximum connections in pool
      idle_timeout: 20, // Close idle connections after 20s
      connect_timeout: 10, // Timeout after 10s if can't connect
      prepare: false, // Disable prepared statements (required for some Neon setups)
    })
  : null;

// Create a mock db that throws helpful errors if database is not configured
const createMockDb = () => {
  const handler = {
    get: () => {
      throw new Error(
        "Database not configured. Please set DATABASE_URL in your .env.local file with a valid Neon PostgreSQL URL. Get a free database at: https://neon.tech"
      );
    },
  };
  return new Proxy({}, handler);
};

export const db = queryClient
  ? drizzle(queryClient, { schema })
  : createMockDb() as ReturnType<typeof drizzle>;

// Export schema for convenience
export * from "./schema";
