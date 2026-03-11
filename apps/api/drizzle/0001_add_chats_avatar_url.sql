-- Add avatar_url to chats for group avatars
ALTER TABLE "chats" ADD COLUMN IF NOT EXISTS "avatar_url" text;
