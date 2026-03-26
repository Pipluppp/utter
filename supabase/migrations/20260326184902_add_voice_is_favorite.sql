alter table "public"."voices" add column "is_favorite" boolean not null default false;

CREATE INDEX idx_voices_user_favorite_created ON public.voices USING btree (user_id, is_favorite DESC, created_at DESC) WHERE (deleted_at IS NULL);


