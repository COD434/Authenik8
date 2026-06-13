"use strict";
var _a, _b, _c, _d, _e;
var _f, _g, _h, _j, _k;
process.env.NODE_ENV = "test";
(_a = (_f = process.env).JWT_SECRET) !== null && _a !== void 0 ? _a : (_f.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters");
(_b = (_g = process.env).JWT_REFRESH_SECRET) !== null && _b !== void 0 ? _b : (_g.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-at-least-32-characters");
(_c = (_h = process.env).SESSION_SECRET) !== null && _c !== void 0 ? _c : (_h.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters");
(_d = (_j = process.env).DATABASE_URL) !== null && _d !== void 0 ? _d : (_j.DATABASE_URL = "postgresql://seeisa:karabo@localhost:5432/top_user_test");
(_e = (_k = process.env).BASE_URL) !== null && _e !== void 0 ? _e : (_k.BASE_URL = "http://localhost:5000");
