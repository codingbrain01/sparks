-- Sparks Supabase remote schema dump
-- Project: ejswfqjgfepizehzrsqr
-- Generated: 2026-05-04T10:01:22.667Z
-- Source: Supabase Management API (no DB password used)
-- Note: Schemas auth/storage/realtime managed by Supabase are not included.
--       Run blocks in order. Idempotency is best-effort.

-- ──────────────────────────────────────────────────────────────────────
-- Extensions
-- ──────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


-- ──────────────────────────────────────────────────────────────────────
-- Enum types
-- ──────────────────────────────────────────────────────────────────────




-- ──────────────────────────────────────────────────────────────────────
-- Sequences
-- ──────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.connections_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.conversations_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.messages_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.post_comments_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.post_likes_id_seq AS bigint START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.posts_id_seq AS bigint START WITH 1 INCREMENT BY 1;


-- ──────────────────────────────────────────────────────────────────────
-- Tables
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE public.calls (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversation_id integer,
  caller_id uuid,
  callee_id uuid,
  type text NOT NULL,
  status text NOT NULL,
  duration_seconds integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.connections (
  id bigint DEFAULT nextval('connections_id_seq'::regclass) NOT NULL,
  requester_id uuid NOT NULL,
  addressee_id uuid NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.conversation_participants (
  conversation_id bigint NOT NULL,
  user_id uuid NOT NULL,
  hidden boolean DEFAULT false NOT NULL
);

CREATE TABLE public.conversations (
  id bigint DEFAULT nextval('conversations_id_seq'::regclass) NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.messages (
  id bigint DEFAULT nextval('messages_id_seq'::regclass) NOT NULL,
  conversation_id bigint NOT NULL,
  sender_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  image_url text
);

CREATE TABLE public.post_comments (
  id bigint DEFAULT nextval('post_comments_id_seq'::regclass) NOT NULL,
  post_id bigint NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.post_likes (
  id bigint DEFAULT nextval('post_likes_id_seq'::regclass) NOT NULL,
  post_id bigint NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.posts (
  id bigint DEFAULT nextval('posts_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  privacy text DEFAULT 'public'::text NOT NULL
);

CREATE TABLE public.profile_photos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  url text NOT NULL,
  order_index integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  username text NOT NULL,
  first_name text DEFAULT ''::text NOT NULL,
  last_name text DEFAULT ''::text NOT NULL,
  age integer DEFAULT 18 NOT NULL,
  looking_for text DEFAULT 'Women'::text NOT NULL,
  bio text DEFAULT ''::text,
  hobbies text[] DEFAULT '{}'::text[],
  avatar_url text,
  online boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  status character varying(20) DEFAULT 'online'::character varying NOT NULL,
  gender character varying(20) DEFAULT 'Man'::character varying NOT NULL
);


-- ──────────────────────────────────────────────────────────────────────
-- Constraints (PK, FK, unique, check)
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.calls ADD CONSTRAINT calls_pkey PRIMARY KEY (id);
ALTER TABLE public.connections ADD CONSTRAINT connections_pkey PRIMARY KEY (id);
ALTER TABLE public.conversation_participants ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);
ALTER TABLE public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_pkey PRIMARY KEY (id);
ALTER TABLE public.posts ADD CONSTRAINT posts_pkey PRIMARY KEY (id);
ALTER TABLE public.profile_photos ADD CONSTRAINT profile_photos_pkey PRIMARY KEY (id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.connections ADD CONSTRAINT connections_requester_id_addressee_id_key UNIQUE (requester_id, addressee_id);
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_post_id_user_id_key UNIQUE (post_id, user_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
ALTER TABLE public.calls ADD CONSTRAINT calls_status_check CHECK ((status = ANY (ARRAY['missed'::text, 'declined'::text, 'ended'::text])));
ALTER TABLE public.calls ADD CONSTRAINT calls_type_check CHECK ((type = ANY (ARRAY['audio'::text, 'video'::text])));
ALTER TABLE public.connections ADD CONSTRAINT connections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])));
ALTER TABLE public.posts ADD CONSTRAINT posts_privacy_check CHECK ((privacy = ANY (ARRAY['public'::text, 'friends'::text, 'private'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_age_check CHECK (((age >= 18) AND (age <= 100)));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_looking_for_check CHECK ((looking_for = ANY (ARRAY['Men'::text, 'Women'::text])));
ALTER TABLE public.calls ADD CONSTRAINT calls_callee_id_fkey FOREIGN KEY (callee_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.calls ADD CONSTRAINT calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.calls ADD CONSTRAINT calls_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public.connections ADD CONSTRAINT connections_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.connections ADD CONSTRAINT connections_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_participants ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public.conversation_participants ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
ALTER TABLE public.post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profile_photos ADD CONSTRAINT profile_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ──────────────────────────────────────────────────────────────────────
-- Indexes (non-PK, non-unique)
-- ──────────────────────────────────────────────────────────────────────




-- ──────────────────────────────────────────────────────────────────────
-- Functions / procedures
-- ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Delete only the user's own chat-image uploads (matched by sender_id
  --    via the public URL embedded in messages.image_url).
  DELETE FROM storage.objects
  WHERE bucket_id = 'chat-images'
    AND name IN (
      SELECT regexp_replace(image_url, '^.*/chat-images/', '')
      FROM public.messages
      WHERE sender_id = uid AND image_url IS NOT NULL
    );

  -- 2. Delete avatars + gallery (per-user folder layout).
  DELETE FROM storage.objects
  WHERE bucket_id IN ('avatars', 'gallery')
    AND (storage.foldername(name))[1] = uid::text;

  -- 3. Wipe content of the user's messages so only an "unavailable user"
  --    placeholder remains for the other party. sender_id will go NULL
  --    automatically when profiles row is deleted (FK ON DELETE SET NULL).
  UPDATE public.messages
  SET content = '', image_url = NULL
  WHERE sender_id = uid;

  -- 4. Drop the auth user. Cascades through profiles → posts, post_likes,
  --    post_comments, profile_photos, connections, calls,
  --    conversation_participants. messages.sender_id becomes NULL via
  --    the FK we just adjusted in step 1.
  DELETE FROM auth.users WHERE id = uid;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, first_name, last_name, age, gender, looking_for)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), 'user_' || substring(NEW.id::text, 1, 8)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'age', '')::integer, 18),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'gender', ''), 'Man'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'looking_for', ''), 'Women')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$
;


-- ──────────────────────────────────────────────────────────────────────
-- Triggers
-- ──────────────────────────────────────────────────────────────────────

CREATE TRIGGER on_message_inserted AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();


-- ──────────────────────────────────────────────────────────────────────
-- Views
-- ──────────────────────────────────────────────────────────────────────

-- (none)


-- ──────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Caller can insert" ON public.calls AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = caller_id));
CREATE POLICY "Participants can update" ON public.calls AS PERMISSIVE FOR UPDATE TO public USING (((auth.uid() = caller_id) OR (auth.uid() = callee_id)));
CREATE POLICY "Participants can view their calls" ON public.calls AS PERMISSIVE FOR SELECT TO public USING (((auth.uid() = caller_id) OR (auth.uid() = callee_id)));
CREATE POLICY "Users can delete connections" ON public.connections AS PERMISSIVE FOR DELETE TO authenticated USING (((auth.uid() = requester_id) OR (auth.uid() = addressee_id)));
CREATE POLICY "Users can send connection requests" ON public.connections AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = requester_id));
CREATE POLICY "Users can update connection status" ON public.connections AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = addressee_id));
CREATE POLICY "Users can view their connections" ON public.connections AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = requester_id) OR (auth.uid() = addressee_id)));
CREATE POLICY "Participants viewable by authenticated users" ON public.conversation_participants AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add conversation participants" ON public.conversation_participants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can join conversations" ON public.conversation_participants AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own participant row" ON public.conversation_participants AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "Authenticated users can create conversations" ON public.conversations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Participants can delete conversations" ON public.conversations AS PERMISSIVE FOR DELETE TO public USING ((id IN ( SELECT conversation_participants.conversation_id
   FROM conversation_participants
  WHERE (conversation_participants.user_id = auth.uid()))));
CREATE POLICY "Participants can view their conversations" ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated USING ((id IN ( SELECT conversation_participants.conversation_id
   FROM conversation_participants
  WHERE (conversation_participants.user_id = auth.uid()))));
CREATE POLICY "Users can view their conversations" ON public.conversations AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Participants can send messages" ON public.messages AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((auth.uid() = sender_id) AND (conversation_id IN ( SELECT conversation_participants.conversation_id
   FROM conversation_participants
  WHERE (conversation_participants.user_id = auth.uid())))));
CREATE POLICY "Participants can view messages" ON public.messages AS PERMISSIVE FOR SELECT TO authenticated USING ((conversation_id IN ( SELECT conversation_participants.conversation_id
   FROM conversation_participants
  WHERE (conversation_participants.user_id = auth.uid()))));
CREATE POLICY "Comments viewable by authenticated users" ON public.post_comments AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create comments" ON public.post_comments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own comments" ON public.post_comments AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Likes viewable by authenticated users" ON public.post_likes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add own likes" ON public.post_likes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can remove own likes" ON public.post_likes AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Posts viewable based on privacy" ON public.posts AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR (privacy = 'public'::text) OR ((privacy = 'friends'::text) AND (EXISTS ( SELECT 1
   FROM connections
  WHERE ((connections.status = 'accepted'::text) AND (((connections.requester_id = auth.uid()) AND (connections.addressee_id = posts.user_id)) OR ((connections.addressee_id = auth.uid()) AND (connections.requester_id = posts.user_id)))))))));
CREATE POLICY "Users can create posts" ON public.posts AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can delete own posts" ON public.posts AS PERMISSIVE FOR DELETE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Users can update own posts" ON public.posts AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = user_id));
CREATE POLICY "Anyone can view profile photos" ON public.profile_photos AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Users can delete their own photos" ON public.profile_photos AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Users can insert their own photos" ON public.profile_photos AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users can update their own photos" ON public.profile_photos AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));
CREATE POLICY "Profiles viewable by authenticated users" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((auth.uid() = id));


-- ──────────────────────────────────────────────────────────────────────
-- Realtime publication
-- ──────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;


-- ──────────────────────────────────────────────────────────────────────
-- Storage buckets
-- ──────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('avatars', 'avatars', 'true', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('chat-images', 'chat-images', 'true', '26214400', NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('gallery', 'gallery', 'true', '26214400', NULL) ON CONFLICT (id) DO NOTHING;


-- ──────────────────────────────────────────────────────────────────────
-- Storage policies (storage.objects)
-- ──────────────────────────────────────────────────────────────────────

CREATE POLICY "Participants can delete chat images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'chat-images'::text) AND ((storage.foldername(name))[1] IN ( SELECT (conversation_participants.conversation_id)::text AS conversation_id
   FROM conversation_participants
  WHERE (conversation_participants.user_id = auth.uid())))));
CREATE POLICY "Users can delete own avatar" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can delete own gallery files" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'gallery'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
CREATE POLICY "Auth users can upload to gallery" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'gallery'::text) AND (auth.role() = 'authenticated'::text)));
CREATE POLICY "Authenticated users can upload chat images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'chat-images'::text));
CREATE POLICY "Users can upload own avatar" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Anyone can view gallery" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'gallery'::text));
CREATE POLICY "Public read access" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'avatars'::text));
CREATE POLICY "Public read for chat images" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'chat-images'::text));
CREATE POLICY "Users can update own avatar" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
