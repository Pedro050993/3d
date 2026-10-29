-- Obras 3D: esquema compartilhado com papéis.
-- pendente: cadastrou-se e aguarda liberação; leitura: só consulta;
-- campo: lança avanço e conclusão; admin: tudo, inclusive estrutura e usuários.

create table if not exists public.perfis (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text not null default '',
  papel text not null default 'pendente' check (papel in ('pendente', 'leitura', 'campo', 'admin')),
  criado_em timestamptz not null default now()
);

-- e-mails que entram como administradores já liberados
create table if not exists public.admins_iniciais (email text primary key);
insert into public.admins_iniciais (email) values ('pedro.melecardi@outlook.com') on conflict do nothing;

create or replace function public.meu_papel() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select papel from public.perfis where user_id = auth.uid()), 'pendente')
$$;

create or replace function public.antes_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admins_iniciais a where lower(a.email) = lower(new.email)) then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end $$;

create or replace function public.apos_novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (user_id, email, nome, papel)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', ''),
    case when exists (select 1 from public.admins_iniciais a where lower(a.email) = lower(new.email)) then 'admin' else 'pendente' end)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists antes_novo_usuario on auth.users;
create trigger antes_novo_usuario before insert on auth.users for each row execute function public.antes_novo_usuario();
drop trigger if exists apos_novo_usuario on auth.users;
create trigger apos_novo_usuario after insert on auth.users for each row execute function public.apos_novo_usuario();

-- liberar acesso / mudar papel (só administradores); libera também o login do e-mail
create or replace function public.definir_papel(alvo uuid, novo text) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if public.meu_papel() <> 'admin' then raise exception 'Apenas administradores mudam papéis.'; end if;
  if novo not in ('pendente', 'leitura', 'campo', 'admin') then raise exception 'Papel inválido.'; end if;
  if alvo = auth.uid() and novo <> 'admin' then raise exception 'Você não pode tirar seu próprio acesso de administrador.'; end if;
  update public.perfis set papel = novo where user_id = alvo;
  if novo <> 'pendente' then
    update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = alvo;
  end if;
end $$;
revoke all on function public.definir_papel(uuid, text) from public, anon;
grant execute on function public.definir_papel(uuid, text) to authenticated;

create table if not exists public.obras (
  id text primary key,
  nome text not null,
  arquivada boolean not null default false,
  estrutura jsonb not null,
  versao integer not null default 1,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id)
);

create table if not exists public.lancamentos (
  obra_id text not null references public.obras(id) on delete cascade,
  elem_id text not null,
  etapa_id text not null,
  comp text not null check (comp ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  v double precision not null,
  obs text not null default '',
  origem text not null default 'individual',
  em timestamptz not null default now(),
  por uuid references auth.users(id) default auth.uid(),
  primary key (obra_id, elem_id, etapa_id, comp)
);

create table if not exists public.conclusoes (
  id text primary key,
  obra_id text not null references public.obras(id) on delete cascade,
  elem_id text not null,
  comp text not null,
  acao text not null check (acao in ('finalizar', 'entregar', 'reabrir')),
  obs text not null default '',
  seq integer not null default 0,
  em timestamptz not null default now(),
  por uuid references auth.users(id) default auth.uid()
);
create index if not exists conclusoes_obra on public.conclusoes (obra_id);

create table if not exists public.revisoes (
  id text primary key,
  obra_id text not null references public.obras(id) on delete cascade,
  em timestamptz not null default now(),
  por uuid references auth.users(id) default auth.uid(),
  dados jsonb not null
);
create index if not exists revisoes_obra on public.revisoes (obra_id, em);

alter table public.perfis enable row level security;
alter table public.admins_iniciais enable row level security;
alter table public.obras enable row level security;
alter table public.lancamentos enable row level security;
alter table public.conclusoes enable row level security;
alter table public.revisoes enable row level security;

-- perfis: cada um vê o seu; liberados veem todos (para mostrar quem lançou)
create policy perfis_ler on public.perfis for select to authenticated
  using (user_id = (select auth.uid()) or (select public.meu_papel()) in ('leitura', 'campo', 'admin'));
create policy perfis_meu_nome on public.perfis for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.perfis from authenticated;
grant update (nome) on public.perfis to authenticated;

create policy obras_ler on public.obras for select to authenticated using ((select public.meu_papel()) in ('leitura', 'campo', 'admin'));
create policy obras_criar on public.obras for insert to authenticated with check ((select public.meu_papel()) = 'admin');
create policy obras_alterar on public.obras for update to authenticated using ((select public.meu_papel()) = 'admin') with check ((select public.meu_papel()) = 'admin');
create policy obras_excluir on public.obras for delete to authenticated using ((select public.meu_papel()) = 'admin');

create policy lanc_ler on public.lancamentos for select to authenticated using ((select public.meu_papel()) in ('leitura', 'campo', 'admin'));
create policy lanc_criar on public.lancamentos for insert to authenticated with check ((select public.meu_papel()) in ('campo', 'admin'));
create policy lanc_alterar on public.lancamentos for update to authenticated using ((select public.meu_papel()) in ('campo', 'admin')) with check ((select public.meu_papel()) in ('campo', 'admin'));
create policy lanc_excluir on public.lancamentos for delete to authenticated using ((select public.meu_papel()) in ('campo', 'admin'));

create policy conc_ler on public.conclusoes for select to authenticated using ((select public.meu_papel()) in ('leitura', 'campo', 'admin'));
create policy conc_criar on public.conclusoes for insert to authenticated with check ((select public.meu_papel()) in ('campo', 'admin'));
create policy conc_alterar on public.conclusoes for update to authenticated using ((select public.meu_papel()) in ('campo', 'admin')) with check ((select public.meu_papel()) in ('campo', 'admin'));
create policy conc_excluir on public.conclusoes for delete to authenticated using ((select public.meu_papel()) in ('campo', 'admin'));

-- histórico: campo só acrescenta; apagar (limpeza de avanços) é do administrador
create policy rev_ler on public.revisoes for select to authenticated using ((select public.meu_papel()) in ('leitura', 'campo', 'admin'));
create policy rev_criar on public.revisoes for insert to authenticated with check ((select public.meu_papel()) in ('campo', 'admin'));
create policy rev_excluir on public.revisoes for delete to authenticated using ((select public.meu_papel()) = 'admin');

-- tempo real
alter publication supabase_realtime add table public.lancamentos, public.conclusoes, public.obras;

-- documentos e plantas
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false) on conflict (id) do nothing;
create policy docs_ler on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and (select public.meu_papel()) in ('leitura', 'campo', 'admin'));
create policy docs_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (select public.meu_papel()) = 'admin');
create policy docs_trocar on storage.objects for update to authenticated
  using (bucket_id = 'documentos' and (select public.meu_papel()) = 'admin');
create policy docs_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and (select public.meu_papel()) = 'admin');

-- meu_papel só para quem está logado
revoke all on function public.meu_papel() from public, anon;
grant execute on function public.meu_papel() to authenticated;
revoke all on function public.antes_novo_usuario() from public, anon, authenticated;
revoke all on function public.apos_novo_usuario() from public, anon, authenticated;
