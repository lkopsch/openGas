/**
 * Motor de cálculo do dashboard. Recebe os registros crus do banco e devolve
 * todas as métricas e séries prontas para renderizar (roda no servidor).
 *
 * Premissa do cálculo de consumo: o trecho vale ENTRE abastecimentos de
 * tanque cheio (campo `tanque_cheio`). O litros do trecho é a soma de TODOS
 * os abastecimentos feitos desde o tanque cheio anterior até o tanque cheio
 * que o fecha (parciais entram na soma; o km/L = km do trecho ÷ essa soma).
 * A média usa apenas a ÚLTIMA sequência de trechos válidos (2+ tanques
 * cheios): um km = 0, um trecho implausível (> 30 km/L ou > 2× a mediana dos
 * trechos anteriores) ou a falta de dois tanques cheios seguidos quebra a
 * sequência.
 */
import type {
  Abastecimento,
  CategoriaGasto,
  Despesa,
} from "./types";
import { LABEL_TIPO_DESPESA, labelCombustivel } from "./types";
import { hojeISO } from "./format";

export interface PontoMensal {
  mes: string; // "YYYY-MM"
  combustivel: number;
  manutencao: number;
  imposto: number;
  multa: number;
  seguro: number;
  outro: number;
  total: number;
}

export interface PontoPreco {
  data: string;
  preco: number;
  combustivel: string;
}

export interface PontoConsumo {
  data: string;
  kmPorLitro: number;
  kmRodados: number;
  litros: number;
}

export interface FatiaDistribuicao {
  categoria: CategoriaGasto;
  valor: number;
  percentual: number; // 0-100
}

export interface Lancamento {
  id: string;
  origem: "abastecimento" | "despesa";
  data: string;
  categoria: CategoriaGasto;
  descricao: string;
  local: string | null;
  valor: number;
}

export interface DashboardData {
  // Totais gerais
  totalGeral: number;
  totalCombustivel: number;
  totalOutros: number;
  totalLitros: number;
  kmRodados: number | null;
  qtdAbastecimentos: number;
  qtdDespesas: number;

  // Indicadores
  precoMedioLitro: number | null; // ponderado pelo volume
  ultimoPrecoLitro: number | null;
  consumoMedio: number | null; // km/L
  custoPorKm: number | null; // gasto total / km rodados
  custoCombustivelPorKm: number | null;

  // Mês atual x anterior
  gastoMesAtual: number;
  gastoMesAnterior: number;
  variacaoMensal: number | null; // % (positivo = gastou mais)

  // Impostos destacados nas notas fiscais
  impostos: { federal: number; estadual: number; municipal: number; total: number };

  // Séries para gráficos
  serieMensal: PontoMensal[]; // últimos 12 meses
  seriePreco: PontoPreco[];
  serieConsumo: PontoConsumo[];
  distribuicao: FatiaDistribuicao[];

  ultimosLancamentos: Lancamento[];
}

function somar(valores: (number | null | undefined)[]): number {
  return valores.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/** Chave "YYYY-MM" dos últimos `n` meses, terminando no mês atual. */
function ultimosMeses(n: number): string[] {
  const [ano, mes] = hojeISO().slice(0, 7).split("-").map(Number);
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const total = ano * 12 + (mes - 1) - i;
    const a = Math.floor(total / 12);
    const m = (total % 12) + 1;
    meses.push(`${a}-${String(m).padStart(2, "0")}`);
  }
  return meses;
}

export function calcularDashboard(
  abastecimentos: Abastecimento[],
  despesas: Despesa[]
): DashboardData {
  const totalCombustivel = somar(abastecimentos.map((a) => a.valor_total));
  const totalOutros = somar(despesas.map((d) => d.valor));
  const totalGeral = totalCombustivel + totalOutros;
  const totalLitros = somar(abastecimentos.map((a) => a.litros));

  // --- Consumo ------------------------------------------------------------
  // O trecho de consumo vale ENTRE abastecimentos de tanque cheio: o litros
  // gasto no trecho é a soma de TODOS os abastecimentos feitos depois do
  // tanque cheio anterior até (e incluindo) o tanque cheio que fecha o trecho
  // — parciais no meio entram na soma (senão o km/L fica superestimado, pois
  // o tanque cheio final só repõe o que foi rodado desde o último abastecimento).
  // Abastecimentos sem odômetro (km = 0, ex.: importados do xlsx) ficam fora
  // e QUEBRAM a sequência. A lista é percorrida em ordem cronológica
  // (data, created_at) e dividida em SEQUÊNCIAS de trechos válidos; a sequência
  // também quebra quando o trecho é implausível — consumo acima de
  // LIMITE_PLAUSIVEL_KM_L ou distância > 2× a mediana dos trechos anteriores
  // (indica um tanque cheio esquecido). A média usa apenas a ÚLTIMA sequência
  // com 2+ abastecimentos de tanque cheio.
  const cronologico = [...abastecimentos].sort(
    (a, b) =>
      a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at)
  );

  const LIMITE_PLAUSIVEL_KM_L = 30;

  function mediana(valores: number[]): number | null {
    if (valores.length === 0) return null;
    const ord = [...valores].sort((a, b) => a - b);
    const meio = Math.floor(ord.length / 2);
    return ord.length % 2 === 0
      ? (ord[meio - 1] + ord[meio]) / 2
      : ord[meio];
  }

  /** Um abastecimento de tanque cheio + o litros do trecho fechado por ele. */
  interface CheioDoTrecho {
    abastecimento: Abastecimento;
   /** litros consumidos desde o tanque cheio anterior (inclui os parciais) */
    litros: number;
  }

  function sequenciasDeConsumo(lista: Abastecimento[]): CheioDoTrecho[][] {
    const sequencias: CheioDoTrecho[][] = [];
    let atual: CheioDoTrecho[] = [];
    let trechosKm: number[] = [];
    let litrosParciais = 0;
    const fechar = () => {
      if (atual.length > 0) sequencias.push(atual);
      atual = [];
      trechosKm = [];
      litrosParciais = 0;
    };
    for (const a of lista) {
      if (a.km <= 0) {
        fechar();
        continue;
      }
      if (!a.tanque_cheio) {
        // Parcial: não fecha trecho, mas o litros entra na soma do próximo
        // tanque cheio (só se já houver um tanque cheio ancorando a sequência).
        if (atual.length > 0) litrosParciais += a.litros;
        continue;
      }
      if (atual.length > 0) {
        const anterior = atual[atual.length - 1].abastecimento;
        const litrosTrecho = a.litros + litrosParciais;
        const delta = a.km - anterior.km;
        const media = mediana(trechosKm);
        const quebra =
          delta <= 0 ||
          litrosTrecho <= 0 ||
          delta / litrosTrecho > LIMITE_PLAUSIVEL_KM_L ||
          (trechosKm.length >= 2 &&
            media !== null &&
            delta > 2 * media);
        if (quebra) {
          fechar();
        } else if (delta > 0) {
          trechosKm.push(delta);
        }
      }
      atual.push({ abastecimento: a, litros: a.litros + litrosParciais });
      litrosParciais = 0;
    }
    fechar();
    return sequencias;
  }

  const sequencia = (
    sequenciasDeConsumo(cronologico).filter((s) => s.length >= 2).at(-1) ?? []
  ).sort((a, b) => a.abastecimento.km - b.abastecimento.km);

  const serieConsumo: PontoConsumo[] = [];
  let kmPercorridos = 0;
  let litrosConsumidos = 0;
  for (let i = 1; i < sequencia.length; i++) {
    const anterior = sequencia[i - 1].abastecimento;
    const atual = sequencia[i].abastecimento;
    const delta = atual.km - anterior.km;
    const litros = sequencia[i].litros;
    if (delta > 0 && litros > 0) {
      serieConsumo.push({
        data: atual.data,
        kmPorLitro: delta / litros,
        kmRodados: delta,
        litros,
      });
      kmPercorridos += delta;
      litrosConsumidos += litros;
    }
  }
  const consumoMedio =
    litrosConsumidos > 0 ? kmPercorridos / litrosConsumidos : null;
  const kmRodados =
    sequencia.length >= 2
      ? sequencia[sequencia.length - 1].abastecimento.km -
        sequencia[0].abastecimento.km
      : null;

  // --- Preço do litro -------------------------------------------------------
  const porData = [...abastecimentos].sort(
    (a, b) =>
      a.data.localeCompare(b.data) || a.created_at.localeCompare(b.created_at)
  );
  const seriePreco: PontoPreco[] = porData.map((a) => ({
    data: a.data,
    preco: a.preco_litro,
    combustivel: labelCombustivel(a.combustivel),
  }));
  const precoMedioLitro = totalLitros > 0 ? totalCombustivel / totalLitros : null;
  const ultimoPrecoLitro =
    porData.length > 0 ? porData[porData.length - 1].preco_litro : null;

  // --- Custo por km ---------------------------------------------------------
  const custoPorKm = kmRodados && kmRodados > 0 ? totalGeral / kmRodados : null;
  const custoCombustivelPorKm =
    kmRodados && kmRodados > 0 ? totalCombustivel / kmRodados : null;

  // --- Série mensal (últimos 12 meses, empilhada por categoria) ------------
  const meses = ultimosMeses(12);
  const mapaMensal = new Map<string, PontoMensal>(
    meses.map((mes) => [
      mes,
      {
        mes,
        combustivel: 0,
        manutencao: 0,
        imposto: 0,
        multa: 0,
        seguro: 0,
        outro: 0,
        total: 0,
      },
    ])
  );
  for (const a of abastecimentos) {
    const ponto = mapaMensal.get(a.data.slice(0, 7));
    if (ponto) {
      ponto.combustivel += a.valor_total;
      ponto.total += a.valor_total;
    }
  }
  for (const d of despesas) {
    const ponto = mapaMensal.get(d.data.slice(0, 7));
    if (ponto) {
      ponto[d.tipo] += d.valor;
      ponto.total += d.valor;
    }
  }
  const serieMensal = meses.map((mes) => mapaMensal.get(mes)!);

  // --- Mês atual x anterior -------------------------------------------------
  const gastoMesAtual = serieMensal[serieMensal.length - 1]?.total ?? 0;
  const gastoMesAnterior = serieMensal[serieMensal.length - 2]?.total ?? 0;
  const variacaoMensal =
    gastoMesAnterior > 0
      ? ((gastoMesAtual - gastoMesAnterior) / gastoMesAnterior) * 100
      : null;

  // --- Impostos das notas fiscais -------------------------------------------
  const federal = somar(abastecimentos.map((a) => a.imposto_federal));
  const estadual = somar(abastecimentos.map((a) => a.imposto_estadual));
  const municipal = somar(abastecimentos.map((a) => a.imposto_municipal));

  // --- Distribuição por categoria (ordem fixa; só categorias com valor) ----
  const porCategoria: Record<CategoriaGasto, number> = {
    combustivel: totalCombustivel,
    manutencao: 0,
    imposto: 0,
    multa: 0,
    seguro: 0,
    outro: 0,
  };
  for (const d of despesas) porCategoria[d.tipo] += d.valor;
  const distribuicao: FatiaDistribuicao[] = (
    Object.entries(porCategoria) as [CategoriaGasto, number][]
  )
    .filter(([, valor]) => valor > 0)
    .map(([categoria, valor]) => ({
      categoria,
      valor,
      percentual: totalGeral > 0 ? (valor / totalGeral) * 100 : 0,
    }));

  // --- Últimos lançamentos (mescla das duas tabelas) ------------------------
  const lancamentos: (Lancamento & { criadoEm: string })[] = [
    ...abastecimentos.map((a) => ({
      id: a.id,
      origem: "abastecimento" as const,
      data: a.data,
      categoria: "combustivel" as const,
      descricao: `${labelCombustivel(a.combustivel)} · ${a.litros.toLocaleString(
        "pt-BR",
        { maximumFractionDigits: 2 }
      )} L`,
      local: a.local,
      valor: a.valor_total,
      criadoEm: a.created_at,
    })),
    ...despesas.map((d) => ({
      id: d.id,
      origem: "despesa" as const,
      data: d.data,
      categoria: d.tipo as CategoriaGasto,
      descricao: d.descricao || LABEL_TIPO_DESPESA[d.tipo],
      local: d.local,
      valor: d.valor,
      criadoEm: d.created_at,
    })),
  ];
  lancamentos.sort(
    (a, b) =>
      b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)
  );
  const ultimosLancamentos = lancamentos
    .slice(0, 8)
    .map(({ criadoEm: _criadoEm, ...resto }) => resto);

  return {
    totalGeral,
    totalCombustivel,
    totalOutros,
    totalLitros,
    kmRodados,
    qtdAbastecimentos: abastecimentos.length,
    qtdDespesas: despesas.length,
    precoMedioLitro,
    ultimoPrecoLitro,
    consumoMedio,
    custoPorKm,
    custoCombustivelPorKm,
    gastoMesAtual,
    gastoMesAnterior,
    variacaoMensal,
    impostos: {
      federal,
      estadual,
      municipal,
      total: federal + estadual + municipal,
    },
    serieMensal,
    seriePreco,
    serieConsumo,
    distribuicao,
    ultimosLancamentos,
  };
}
