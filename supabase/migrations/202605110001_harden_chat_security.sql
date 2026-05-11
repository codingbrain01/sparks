-- Harden chat privacy, media access, and TURN credential flow support.

CREATE OR REPLACE FUNCTION public.start_conversation(partner_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  existing_id bigint;
  new_id bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF partner_id IS NULL OR partner_id = uid THEN
    RAISE EXCEPTION 'Invalid conversation partner';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = partner_id) THEN
    RAISE EXCEPTION 'Conversation partner not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.connections
    WHERE status = 'accepted'
      AND (
        (requester_id = uid AND addressee_id = partner_id) OR
        (requester_id = partner_id AND addressee_id = uid)
      )
  ) THEN
    RAISE EXCEPTION 'You must be connected before starting a conversation';
  END IF;

  SELECT cp1.conversation_id
    INTO existing_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp2.conversation_id = cp1.conversation_id
  WHERE cp1.user_id = uid
    AND cp2.user_id = partner_id
  ORDER BY cp1.conversation_id
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    UPDATE public.conversation_participants
    SET hidden = false
    WHERE conversation_id = existing_id
      AND user_id = uid;
    RETURN existing_id;
  END IF;

  INSERT INTO public.conversations DEFAULT VALUES
  RETURNING id INTO new_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (new_id, uid), (new_id, partner_id);

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(conv_id bigint)
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = conv_id
      AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a conversation participant';
  END IF;

  UPDATE public.messages
  SET read_at = COALESCE(read_at, now())
  WHERE conversation_id = conv_id
    AND sender_id IS DISTINCT FROM uid
    AND read_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hide_conversation(conv_id bigint)
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

  UPDATE public.conversation_participants
  SET hidden = true
  WHERE conversation_id = conv_id
    AND user_id = uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a conversation participant';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id bigint)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = conv_id
      AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_access_chat_media(object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  folder text := (storage.foldername(object_name))[1];
BEGIN
  IF folder IS NULL OR folder !~ '^[0-9]+$' THEN
    RETURN false;
  END IF;

  RETURN public.is_conversation_participant(folder::bigint);
END;
$function$;

REVOKE ALL ON FUNCTION public.start_conversation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_conversation_read(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hide_conversation(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_conversation_participant(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_chat_media(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hide_conversation(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_media(text) TO authenticated;

DROP POLICY IF EXISTS "Caller can insert" ON public.calls;
DROP POLICY IF EXISTS "Call participants can insert" ON public.calls;
CREATE POLICY "Call participants can insert" ON public.calls
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = caller_id) OR (auth.uid() = callee_id));

DROP POLICY IF EXISTS "Participants viewable by authenticated users" ON public.conversation_participants;
DROP POLICY IF EXISTS "Participants can view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add their own participant row" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can update own participant row" ON public.conversation_participants;
CREATE POLICY "Participants can view conversation participants" ON public.conversation_participants
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can view their conversations" ON public.conversations;
CREATE POLICY "Participants can view their conversations" ON public.conversations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id));

DROP POLICY IF EXISTS "Participants can delete conversations" ON public.conversations;
CREATE POLICY "Participants can delete conversations" ON public.conversations
  AS PERMISSIVE FOR DELETE TO public
  USING (public.is_conversation_participant(id));

DROP POLICY IF EXISTS "Participants can update messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = sender_id) AND public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id));

UPDATE storage.buckets
SET public = false,
    file_size_limit = 26214400
WHERE id = 'chat-images';

DROP POLICY IF EXISTS "Participants can delete chat images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Participants can upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Public read for chat images" ON storage.objects;
DROP POLICY IF EXISTS "Participants can read chat images" ON storage.objects;

CREATE POLICY "Participants can delete chat images" ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((bucket_id = 'chat-images') AND public.can_access_chat_media(name));

CREATE POLICY "Participants can upload chat images" ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'chat-images') AND public.can_access_chat_media(name));

CREATE POLICY "Participants can read chat images" ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((bucket_id = 'chat-images') AND public.can_access_chat_media(name));
