-- Adiciona coluna cpf em profiles (telefone já existe)
alter table public.profiles
    add column if not exists cpf text;

-- Índice para garantir unicidade do CPF quando preenchido
create unique index if not exists idx_profiles_cpf_unique
    on public.profiles (cpf)
    where cpf is not null;

-- Comentário
comment on column public.profiles.cpf is 'CPF do usuário (somente dígitos, 11 caracteres) - usado para emissão de cobrança PagBank';
