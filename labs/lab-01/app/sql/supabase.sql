create extension if not exists vector;

create table if not exists rag_documents (
  id bigserial primary key,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists rag_chunks (
  id bigserial primary key,
  document_id bigint not null references rag_documents(id) on delete cascade,
  chunk_index integer not null,
  section text not null,
  content text not null,
  embedding vector(768) not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists rag_chunks_document_idx on rag_chunks(document_id);
