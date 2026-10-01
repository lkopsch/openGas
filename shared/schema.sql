-- ============================================================================
-- GASOL - Schema do banco SQLite (arquivo data/gasol.db)
-- ----------------------------------------------------------------------------
-- Executado automaticamente na inicialização (lib/db.ts). O app cria o arquivo
-- na primeira execução; rodar de novo não apaga nada (CREATE IF NOT EXISTS).
--
-- Conteúdo espelha o antigo supabase/schema.sql, adaptado para SQLite:
-- ids são TEXT (UUID gerado no app), datas são TEXT "YYYY-MM-DD" e `detalhes`
-- é TEXT contendo JSON. Não há usuários de auth externo: a tabela `usuarios`
-- guarda apenas nome; a "sessão" é um cookie com o id do usuário selecionado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELA: usuarios (sem senha - só o nome, criados pelo próprio app)
-- ----------------------------------------------------------------------------
create table if not exists usuarios (
  id         text primary key,
  nome       text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 2. TABELA: abastecimentos
--    valor_total é uma coluna gerada (preco_litro * litros) - o banco garante
--    a consistência, o app nunca envia esse campo.
-- ----------------------------------------------------------------------------
create table if not exists abastecimentos (
  id                text primary key,
  user_id           text not null references usuarios (id) on delete cascade,
  data              text not null default (strftime('%Y-%m-%d', 'now')),
  local             text,
  combustivel       text not null default 'gasolina_comum',
  preco_litro       real not null check (preco_litro > 0),
  litros            real not null check (litros > 0),
  valor_total       real generated always as (round(preco_litro * litros, 2)) stored,
  km                real not null check (km >= 0), -- odômetro no momento
  tanque_cheio      integer not null default 1 check (tanque_cheio in (0, 1)),
  -- Impostos destacados na nota fiscal (opcionais)
  imposto_federal   real check (imposto_federal >= 0),
  imposto_estadual  real check (imposto_estadual >= 0),
  imposto_municipal real check (imposto_municipal >= 0),
  observacoes       text,
  created_at        text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 3. TABELA: despesas (manutenção, imposto, multa, seguro, outro)
--    Campos comuns em colunas; campos específicos de cada tipo em `detalhes`
--    (TEXT com JSON), ex.: multa -> {"orgao": "...", "pontos": "4"}.
-- ----------------------------------------------------------------------------
create table if not exists despesas (
  id         text primary key,
  user_id    text not null references usuarios (id) on delete cascade,
  tipo       text not null check (tipo in ('manutencao', 'imposto', 'multa', 'seguro', 'outro')),
  data       text not null default (strftime('%Y-%m-%d', 'now')),
  valor      real not null check (valor > 0),
  descricao  text not null,
  local      text,                  -- oficina, órgão, seguradora...
  km         real check (km >= 0),  -- odômetro (opcional)
  detalhes   text not null default '{}', -- JSON com campos específicos por tipo
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ----------------------------------------------------------------------------
-- 4. ÍNDICES (consultas sempre filtram por usuário e ordenam por data)
-- ----------------------------------------------------------------------------
create index if not exists abastecimentos_user_data_idx on abastecimentos (user_id, data desc);
create index if not exists abastecimentos_user_km_idx   on abastecimentos (user_id, km);
create index if not exists despesas_user_data_idx       on despesas (user_id, data desc);
create index if not exists despesas_user_tipo_idx       on despesas (user_id, tipo);

-- ----------------------------------------------------------------------------
-- 5. TRIGGERS: mantêm updated_at atualizado automaticamente
-- ----------------------------------------------------------------------------
create trigger if not exists abastecimentos_set_updated_at
after update on abastecimentos
for each row
begin
  update abastecimentos
  set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  where id = old.id;
end;

create trigger if not exists despesas_set_updated_at
after update on despesas
for each row
begin
  update despesas
  set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  where id = old.id;
end;
