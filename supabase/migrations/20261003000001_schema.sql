-- M1: tables. RLS lives in the next migration.
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'), -- lowercase url-safe, 3-80 chars
  title text not null check (char_length(title) between 1 and 200),
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  -- 1 MiB cap on the text form (octet_length, not pg_column_size: the latter is the compressed size).
  -- widgets/edges, when present, must be arrays.
  doc jsonb not null check (
    jsonb_typeof(doc) = 'object' and octet_length(doc::text) < 1048576
    and coalesce(jsonb_typeof(doc -> 'widgets'), 'array') = 'array'
    and coalesce(jsonb_typeof(doc -> 'edges'), 'array') = 'array'),
  revision int not null default 0,
  published_revision int,
  published_doc jsonb check (published_doc is null or (
    jsonb_typeof(published_doc) = 'object' and octet_length(published_doc::text) < 1048576
    and coalesce(jsonb_typeof(published_doc -> 'widgets'), 'array') = 'array'
    and coalesce(jsonb_typeof(published_doc -> 'edges'), 'array') = 'array')),
  -- title as it was at publish time; non-owners read this, never the live title (a rename stays private
  -- until the next publish). Slug is NOT snapshotted: clients cannot change it (no UPDATE grant), so it is stable.
  published_title text check (char_length(published_title) between 1 and 200),
  -- links as they were at publish time; non-owners read these, never live board_links (drafts stay private)
  published_links jsonb not null default '[]' check (jsonb_typeof(published_links) = 'array' and octet_length(published_links::text) < 1048576),
  deleted_at timestamptz,
  -- a snapshot always has a title and vice versa
  constraint boards_published_title_chk check ((published_doc is null) = (published_title is null)),
  forked_from uuid, -- reserved, unused in v1
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boards_owner_idx on public.boards (owner_id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger boards_set_updated_at before update on public.boards
  for each row execute function public.set_updated_at();

create table public.board_shares (
  board_id uuid references public.boards on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key (board_id, user_id)
);

create table public.board_links (
  id uuid primary key default gen_random_uuid(),
  from_board_id uuid not null references public.boards on delete cascade,
  from_widget_id text check (char_length(from_widget_id) <= 100),
  to_board_id uuid not null references public.boards on delete cascade,
  label text check (char_length(label) <= 200),
  pinned_revision int
);
create index board_links_from_idx on public.board_links (from_board_id);
create index board_links_to_idx on public.board_links (to_board_id);

create table public.topics (
  slug text primary key,
  title text not null,
  summary text,
  tags text[] not null default '{}' check (cardinality(tags) <= 20)
);

create table public.board_topics (
  board_id uuid references public.boards on delete cascade,
  topic_slug text references public.topics,
  primary key (board_id, topic_slug)
);
