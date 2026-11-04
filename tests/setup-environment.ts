// Unit/mock integration tests must never inherit live credentials from .env.local.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@database.invalid/test';
process.env.DATABASE_URL_DIRECT = process.env.DATABASE_URL;
process.env.AUTH_SECRET = 'unit-tests-only-random-looking-secret-32-characters';
process.env.MAILKETING_API_TOKEN = '';
process.env.S3_ENDPOINT = '';
process.env.S3_ACCESS_KEY_ID = '';
process.env.S3_SECRET_ACCESS_KEY = '';
process.env.S3_BUCKET = '';
process.env.S3_PUBLIC_URL_PREFIX = '';
process.env.GOOGLE_CLIENT_ID = '';
