/**
 * Tipos do domínio. Espelham as tabelas de data/schema.sql.
 */

export interface Abastecimento {
  id: string;
  user_id: string;
  data: string; // date ISO "YYYY-MM-DD"
  local: string | null;
  combustivel: string;
  preco_litro: number;
  litros: number;
  valor_total: number; // coluna gerada no banco (preco_litro * litros)
  km: number;
  /** true = tanque cheio; o consumo (km/L) só é calculado entre abastecimentos com tanque cheio */
  tanque_cheio: boolean;
  imposto_federal: number | null;
  imposto_estadual: number | null;
  imposto_municipal: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export const TIPOS_DESPESA = [
  "manutencao",
  "imposto",
  "multa",
  "seguro",
  "outro",
] as const;

export type TipoDespesa = (typeof TIPOS_DESPESA)[number];

export interface Despesa {
  id: string;
  user_id: string;
  tipo: TipoDespesa;
  data: string; // date ISO "YYYY-MM-DD"
  valor: number;
  descricao: string;
  local: string | null;
  km: number | null;
  /** Campos específicos de cada tipo (ver DETALHES_POR_TIPO em despesa-form) */
  detalhes: Record<string, string>;
  created_at: string;
  updated_at: string;
}

/** Rótulos em pt-BR para exibição. */
export const LABEL_TIPO_DESPESA: Record<TipoDespesa, string> = {
  manutencao: "Manutenção",
  imposto: "Imposto",
  multa: "Multa",
  seguro: "Seguro",
  outro: "Outro",
};

export const COMBUSTIVEIS = [
  { value: "gasolina_comum", label: "Gasolina comum" },
  { value: "gasolina_aditivada", label: "Gasolina aditivada" },
  { value: "etanol", label: "Etanol" },
  { value: "diesel", label: "Diesel" },
  { value: "diesel_s10", label: "Diesel S10" },
  { value: "gnv", label: "GNV" },
] as const;

export function labelCombustivel(value: string): string {
  return COMBUSTIVEIS.find((c) => c.value === value)?.label ?? value;
}

/**
 * Categoria de gasto usada nos gráficos: combustível + tipos de despesa.
 * A ORDEM é fixa e define a cor de cada categoria (ver lib/palette.ts).
 */
export const CATEGORIAS_GASTO = [
  "combustivel",
  "manutencao",
  "imposto",
  "multa",
  "seguro",
  "outro",
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export const LABEL_CATEGORIA: Record<CategoriaGasto, string> = {
  combustivel: "Combustível",
  manutencao: "Manutenção",
  imposto: "Imposto",
  multa: "Multa",
  seguro: "Seguro",
  outro: "Outro",
};

/* ----------------------------------------------------------------------------
 * Parsers de linha do banco: colunas `numeric` do Postgres podem chegar como
 * string dependendo do driver — aqui garantimos number nos campos numéricos.
 * ------------------------------------------------------------------------- */

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

function numOuNull(v: unknown): number | null {
  return v === null || v === undefined || v === "" ? null : num(v);
}

function jsonDetalhes(v: unknown): Record<string, string> {
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "") return {};
    try {
      const parsed: unknown = JSON.parse(s);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
      return {};
    } catch {
      return {};
    }
  }
  return v && typeof v === "object"
    ? (v as Record<string, string>)
    : {};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAbastecimentoRow(row: any): Abastecimento {
  return {
    ...row,
    preco_litro: num(row.preco_litro),
    litros: num(row.litros),
    valor_total: num(row.valor_total),
    km: num(row.km),
    tanque_cheio: num(row.tanque_cheio) === 1,
    imposto_federal: numOuNull(row.imposto_federal),
    imposto_estadual: numOuNull(row.imposto_estadual),
    imposto_municipal: numOuNull(row.imposto_municipal),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseDespesaRow(row: any): Despesa {
  return {
    ...row,
    valor: num(row.valor),
    km: numOuNull(row.km),
    detalhes: jsonDetalhes(row.detalhes),
  };
}
