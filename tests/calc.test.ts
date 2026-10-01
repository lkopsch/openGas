import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calcularDashboard} from '../src/lib/calc';
import type {Abastecimento} from '../src/lib/types';
const fill=(km:number,litros:number,full=true,day='01'):Abastecimento=>({id:day,user_id:'test',data:`2026-09-${day}`,local:null,combustivel:'gasolina_comum',preco_litro:6,litros,valor_total:litros*6,km,tanque_cheio:full,imposto_federal:1,imposto_estadual:2,imposto_municipal:null,observacoes:null,created_at:day,updated_at:day});
test('Consumo inclui litros parciais entre tanques cheios',()=>{const s=calcularDashboard([fill(1000,40,true,'01'),fill(1100,10,false,'02'),fill(1400,30,true,'03')],[]);assert.equal(s.consumoMedio,10);assert.equal(s.totalCombustivel,480);assert.equal(s.impostos.total,9);});
test('Trecho implausível interrompe sequência e odômetro ausente não cria consumo',()=>{assert.equal(calcularDashboard([fill(0,40),fill(1000,40,true,'02')],[]).consumoMedio,null);assert.equal(calcularDashboard([fill(1000,40),fill(1400,40,true,'02'),fill(5000,40,true,'03')],[]).consumoMedio,10);});
