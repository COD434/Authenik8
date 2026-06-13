process.env.NODE_ENV = "test";
process.env.JWT_SECRET ??= "test-jwt-secret-that-is-at-least-32-characters";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-that-is-at-least-32-characters";
process.env.SESSION_SECRET ??= "test-session-secret-that-is-at-least-32-characters";
process.env.DATABASE_URL ??= "postgresql://seeisa:karabo@localhost:5432/top_user_test";
process.env.BASE_URL ??= "http://localhost:5000";
