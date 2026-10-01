/**
 * Formatação pt-BR usada em todo o app (telas e gráficos).
 */

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const numero2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(valor: number): string {
  return brl.format(valor);
}

/** R$ com 3 casas para preço por litro (ex.: R$ 5,899). */
export function formatPrecoLitro(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })}`;
}

export function formatNumero(valor: number): string {
  return numero.format(valor);
}

export function formatNumero2(valor: number): string {
  return numero2.format(valor);
}

export function formatKm(valor: number): string {
  return `${numero.format(valor)} km`;
}

export function formatLitros(valor: number): string {
  return `${numero2.format(valor)} L`;
}

/**
 * "YYYY-MM-DD" -> "dd/mm/aaaa" sem passar por Date (evita deslocamento de
 * fuso horário em colunas `date`).
 */
export function formatData(dataISO: string): string {
  const [ano, mes, dia] = dataISO.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "YYYY-MM" -> "jan/25" (rótulo de eixo). */
export function formatMesCurto(anoMes: string): string {
  const [ano, mes] = anoMes.split("-").map(Number);
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(2)}`;
}

/** Data ISO de hoje ("YYYY-MM-DD") no fuso local. */
export function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}
