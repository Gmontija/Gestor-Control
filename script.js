// ============================================================
// ESTADO GLOBAL
// ============================================================
let appData = {
  registros: [],   // array de dias registrados
  metas: {},       // configuracoes de metas
  moto: {}         // custos da moto
};

let chartMesInstance = null;

// ============================================================
// PERSISTENCIA: carrega e salva no localStorage
// ============================================================
function carregarDados() {
  try {
    const raw = localStorage.getItem('gestor_ifood_v1');
    if (raw) appData = JSON.parse(raw);
  } catch(e) {
    console.warn('Erro ao carregar dados:', e);
  }
}

function salvarDados() {
  try {
    localStorage.setItem('gestor_ifood_v1', JSON.stringify(appData));
  } catch(e) {
    console.warn('Erro ao salvar dados:', e);
  }
}

// ============================================================
// UTILIDADES
// ============================================================
function moeda(v) {
  // Formata numero como moeda brasileira
  if (v === null || v === undefined || isNaN(v)) return '--';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function moedaCurta(v) {
  // Versao curta sem casas decimais para KPIs grandes
  if (v === null || v === undefined || isNaN(v)) return '--';
  return 'R$' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function num(id) {
  // Le valor numerico de um input pelo id
  return parseFloat(document.getElementById(id)?.value) || 0;
}

function hojeISO() {
  // Retorna data de hoje no formato YYYY-MM-DD
  return new Date().toISOString().split('T')[0];
}

function formatarData(iso) {
  // Converte YYYY-MM-DD para DD/MM/YYYY
  if (!iso) return '--';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function mesAno(iso) {
  // Retorna "Jan/2025" a partir de YYYY-MM-DD
  if (!iso) return '';
  const [y, m] = iso.split('-');
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${nomes[parseInt(m)-1]}/${y}`;
}

function diaDaSemana(iso) {
  // Retorna 0=dom, 1=seg ... 6=sab
  if (!iso) return -1;
  const [y, m, d] = iso.split('-');
  return new Date(y, m - 1, d).getDay();
}

function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${tipo} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

function badge(pct) {
  // Retorna HTML do badge de progresso de meta
  const p = Math.round(pct * 100);
  if (pct >= 1) return `<span class="badge badge-ok">${p}%</span>`;
  if (pct >= 0.75) return `<span class="badge badge-warn">${p}%</span>`;
  return `<span class="badge badge-danger">${p}%</span>`;
}

function barColor(pct) {
  if (pct >= 1) return 'var(--green)';
  if (pct >= 0.75) return 'var(--yellow)';
  return 'var(--red)';
}

// ============================================================
// NAVEGACAO ENTRE VIEWS
// ============================================================
function showView(nome) {
  // Esconde todas as views e mostra a selecionada
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('view-' + nome)?.classList.add('active');

  // Marca o tab ativo pela ordem: dashboard, registro, historico, metas, moto
  const ordem = ['dashboard', 'registro', 'historico', 'metas', 'moto'];
  const idx = ordem.indexOf(nome);
  document.querySelectorAll('.nav-tab')[idx]?.classList.add('active');

  // Acao especifica por view
  if (nome === 'dashboard') renderDashboard();
  if (nome === 'historico') renderHistorico();
  if (nome === 'metas') carregarFormMetas();
  if (nome === 'moto') carregarFormMoto();
}

// ============================================================
// FORMULARIO: REGISTRO DIARIO
// ============================================================
function setupFormulario() {
  // Preenche data de hoje por padrao
  document.getElementById('f-data').value = hojeISO();

  // Adiciona listener de preview ao vivo em todos os campos de ganho/gasto
  const campos = ['f-ganhos','f-gorjetas','f-outros-ganhos','f-pedidos',
                  'f-combustivel','f-alimentacao','f-manutencao','f-outros-gastos','f-horas'];
  campos.forEach(id => {
    document.getElementById(id)?.addEventListener('input', atualizarPreview);
  });
}

function atualizarPreview() {
  // Calcula e exibe previa em tempo real enquanto usuario digita
  const bruto = num('f-ganhos') + num('f-gorjetas') + num('f-outros-ganhos');
  const gastos = num('f-combustivel') + num('f-alimentacao') + num('f-manutencao') + num('f-outros-gastos');
  const lucro = bruto - gastos;
  const horas = num('f-horas');
  const pedidos = num('f-pedidos');

  document.getElementById('prev-bruto').textContent = moeda(bruto);
  document.getElementById('prev-gastos').textContent = moeda(gastos);
  document.getElementById('prev-lucro').textContent = moeda(lucro);
  document.getElementById('prev-hora').textContent = horas > 0 ? moeda(lucro / horas) + '/h' : '--';
  document.getElementById('prev-ticket').textContent = pedidos > 0 ? moeda(bruto / pedidos) : '--';
  document.getElementById('prev-pct').textContent = bruto > 0 ? Math.round((gastos / bruto) * 100) + '%' : '--';

  // Colore lucro conforme positivo/negativo
  const elLucro = document.getElementById('prev-lucro');
  elLucro.style.color = lucro >= 0 ? 'var(--green)' : 'var(--red)';
}

function salvarDia() {
  const data = document.getElementById('f-data').value;
  if (!data) { toast('Informe a data do dia', 'error'); return; }

  // Monta objeto do registro
  const registro = {
    id: Date.now(),
    data,
    horas: num('f-horas'),
    pedidos: num('f-pedidos'),
    ganhos_ifood: num('f-ganhos'),
    gorjetas: num('f-gorjetas'),
    outros_ganhos: num('f-outros-ganhos'),
    bruto: num('f-ganhos') + num('f-gorjetas') + num('f-outros-ganhos'),
    combustivel: num('f-combustivel'),
    alimentacao: num('f-alimentacao'),
    manutencao: num('f-manutencao'),
    outros_gastos: num('f-outros-gastos'),
    gastos: num('f-combustivel') + num('f-alimentacao') + num('f-manutencao') + num('f-outros-gastos'),
    obs: document.getElementById('f-obs').value.trim()
  };
  registro.lucro = registro.bruto - registro.gastos;
  registro.rph = registro.horas > 0 ? registro.lucro / registro.horas : 0;

  // Verifica se ja existe registro para esta data e substitui
  const existeIdx = appData.registros.findIndex(r => r.data === data);
  if (existeIdx >= 0) {
    registro.id = appData.registros[existeIdx].id;
    appData.registros[existeIdx] = registro;
    toast('Dia atualizado com sucesso!');
  } else {
    appData.registros.push(registro);
    toast('Dia salvo com sucesso!');
  }

  salvarDados();
  limparFormulario();
  showView('dashboard');
}

function limparFormulario() {
  ['f-ganhos','f-gorjetas','f-outros-ganhos','f-pedidos',
   'f-combustivel','f-alimentacao','f-manutencao','f-outros-gastos','f-horas','f-obs']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('f-data').value = hojeISO();
  atualizarPreview();
}

// ============================================================
// DASHBOARD: RENDER PRINCIPAL
// ============================================================
function renderDashboard() {
  const hoje = hojeISO();
  const metas = appData.metas || {};

  // Mes atual
  const mesAtual = hoje.slice(0, 7); // YYYY-MM
  const regMes = appData.registros.filter(r => r.data.startsWith(mesAtual));
  const regHoje = appData.registros.find(r => r.data === hoje);

  // ---- Hero: dados de hoje ----
  if (regHoje) {
    document.getElementById('hero-lucro').textContent = moedaCurta(regHoje.lucro);
    document.getElementById('hero-sub').textContent =
      `${regHoje.horas}h online · ${regHoje.pedidos} pedidos · ${formatarData(hoje)}`;

    // Arco de R$/hora
    const metaHora = parseFloat(metas.hora) || 0;
    const rph = regHoje.rph || 0;
    document.getElementById('arc-text').textContent = moeda(rph) + '/h';
    document.getElementById('arc-meta-label').textContent = metaHora > 0 ? `meta R$${metaHora}/h` : 'meta nao definida';

    if (metaHora > 0) {
      const pct = Math.min(rph / metaHora, 1);
      // Arco total = 126 de stroke-dasharray; offset contrario = quanto nao preencheu
      document.getElementById('arc-fill').setAttribute('stroke-dashoffset', Math.round(173 * (1 - pct)));
    }
  } else {
    document.getElementById('hero-lucro').textContent = 'Sem registro';
    document.getElementById('hero-sub').textContent = 'Registre o dia de hoje na aba Registrar Dia';
  }

  // ---- KPIs hoje ----
  // Encontra o dia anterior com registro para calcular deltas
  const regsOrdenados = [...appData.registros].sort((a,b) => b.data.localeCompare(a.data));
  const ontem = regsOrdenados.find(r => r.data < hoje);

  if (regHoje) {
    document.getElementById('kpi-bruto').textContent = moedaCurta(regHoje.bruto);
    if (ontem) {
      const delta = regHoje.bruto - ontem.bruto;
      const elDelta = document.getElementById('kpi-bruto-delta');
      elDelta.textContent = (delta >= 0 ? '+' : '') + moeda(delta) + ' vs ontem';
      elDelta.className = 'kpi-delta ' + (delta >= 0 ? 'up' : 'down');
    }

    document.getElementById('kpi-pedidos').textContent = regHoje.pedidos;
    if (ontem) {
      const d = regHoje.pedidos - ontem.pedidos;
      const el = document.getElementById('kpi-pedidos-delta');
      el.textContent = (d >= 0 ? '+' : '') + d + ' vs ontem';
      el.className = 'kpi-delta ' + (d >= 0 ? 'up' : 'down');
    }

    document.getElementById('kpi-combustivel').textContent = moedaCurta(regHoje.combustivel);
    const pctComb = regHoje.bruto > 0 ? Math.round(regHoje.combustivel / regHoje.bruto * 100) : 0;
    document.getElementById('kpi-combustivel-pct').textContent = pctComb + '% do bruto';
    document.getElementById('kpi-combustivel-pct').className = 'kpi-delta ' + (pctComb > 30 ? 'down' : 'neutral');

    const ticket = regHoje.pedidos > 0 ? regHoje.bruto / regHoje.pedidos : 0;
    document.getElementById('kpi-ticket').textContent = moeda(ticket);
    // Compara ticket medio com historico do mes
    if (regMes.length > 1) {
      const ticketMedio = regMes.reduce((s,r) => s + (r.pedidos > 0 ? r.bruto/r.pedidos : 0), 0) / regMes.length;
      const d = ticket - ticketMedio;
      const el = document.getElementById('kpi-ticket-delta');
      el.textContent = (d >= 0 ? '+' : '') + moeda(d) + ' vs media';
      el.className = 'kpi-delta ' + (d >= 0 ? 'up' : 'down');
    }
  } else {
    ['kpi-bruto','kpi-pedidos','kpi-combustivel','kpi-ticket'].forEach(id => {
      document.getElementById(id).textContent = '--';
    });
  }

  // ---- Grafico de barras do mes ----
  renderGraficoMes(regMes, mesAtual);

  // ---- Resumo do mes ----
  const totalLucro = regMes.reduce((s,r) => s + r.lucro, 0);
  const totalHoras = regMes.reduce((s,r) => s + r.horas, 0);
  const diasTrab = regMes.length;
  const mediaRph = totalHoras > 0 ? totalLucro / totalHoras : 0;

  document.getElementById('res-total').textContent = moeda(totalLucro);
  document.getElementById('res-total').className = 'resumo-val ' + (totalLucro >= 0 ? '' : 'down');
  document.getElementById('res-hora').textContent = moeda(mediaRph) + '/h';
  document.getElementById('res-hora').className = 'resumo-val ' + (mediaRph >= (metas.hora||0) ? 'up' : 'down');
  document.getElementById('res-dias').textContent = diasTrab;

  // ---- Metas ----
  renderMetasDash(regMes, totalLucro, mediaRph);

  // ---- Custos moto ----
  renderCustosDash();

  // ---- Heatmap dias da semana ----
  renderHeatmap();
}

function renderGraficoMes(regMes, mesAtual) {
  // Descobre quantos dias tem o mes
  const [y, m] = mesAtual.split('-');
  const diasNoMes = new Date(y, m, 0).getDate();

  // Cria array de lucro por dia (zero para dias sem registro)
  const lucrosPorDia = Array.from({ length: diasNoMes }, (_, i) => {
    const dStr = String(i + 1).padStart(2, '0');
    const iso = `${mesAtual}-${dStr}`;
    const reg = regMes.find(r => r.data === iso);
    return reg ? reg.lucro : 0;
  });
  const labels = Array.from({ length: diasNoMes }, (_, i) => i + 1);

  // Verifica tema ativo: data-theme tem prioridade sobre preferencia do sistema
  const temaAtual = document.documentElement.getAttribute('data-theme');
  const isDark = temaAtual === 'dark' || (!temaAtual && matchMedia('(prefers-color-scheme: dark)').matches);
  const gridColor = isDark ? '#2c2c2a' : '#e1e0d9';
  const tickColor = isDark ? '#898781' : '#898781';

  if (chartMesInstance) {
    // Atualiza grafico existente sem recriar
    chartMesInstance.data.labels = labels;
    chartMesInstance.data.datasets[0].data = lucrosPorDia;
    chartMesInstance.data.datasets[0].backgroundColor = lucrosPorDia.map(v =>
      v === 0 ? (isDark ? '#2c2c2a' : '#e1e0d9') : (v < 0 ? '#B71525' : '#EA1D2C')
    );
    chartMesInstance.update();
  } else {
    chartMesInstance = new Chart(document.getElementById('chartMes'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: lucrosPorDia,
          backgroundColor: lucrosPorDia.map(v =>
            v === 0 ? (isDark ? '#2c2c2a' : '#e1e0d9') : (v < 0 ? '#B71525' : '#EA1D2C')
          ),
          borderRadius: 3,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ctx.raw === 0 ? 'Sem registro' : 'Lucro: R$ ' + ctx.raw.toFixed(2)
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tickColor, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 15 }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 9 }, callback: v => 'R$' + v },
            border: { display: false }
          }
        }
      }
    });
  }
}

function renderMetasDash(regMes, totalLucro, mediaRph) {
  const metas = appData.metas || {};
  const container = document.getElementById('metas-dash');

  const totalCombMes = regMes.reduce((s,r) => s + r.combustivel, 0);

  // Define quais metas mostrar e como calcular o progresso
  const itens = [
    {
      nome: 'Lucro mensal',
      atual: totalLucro,
      meta: parseFloat(metas.mensal) || 0,
      fmt: v => moeda(v)
    },
    {
      nome: 'R$/hora minimo',
      atual: mediaRph,
      meta: parseFloat(metas.hora) || 0,
      fmt: v => moeda(v) + '/h'
    },
    {
      nome: 'Reserva moto',
      atual: totalCombMes,
      meta: parseFloat(metas.reserva_moto) || 0,
      fmt: v => moeda(v)
    }
  ];

  if (!metas.mensal && !metas.hora) {
    container.innerHTML = '<div style="font-size:13px; color:var(--text3); padding:8px 0;">Defina suas metas na aba Metas para ver o progresso aqui.</div>';
    return;
  }

  container.innerHTML = itens.map(item => {
    if (!item.meta) return '';
    const pct = Math.min(item.atual / item.meta, 1.5);
    const pctDisplay = Math.min(pct, 1);
    return `
      <div class="meta-item">
        <div class="meta-header">
          <span class="meta-name">${item.nome}</span>
          ${badge(pct)}
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round(pctDisplay*100)}%; background:${barColor(pct)};"></div>
        </div>
        <div class="meta-vals">${item.fmt(item.atual)} de ${item.fmt(item.meta)}</div>
      </div>
    `;
  }).join('');
}

function renderCustosDash() {
  const moto = appData.moto || {};
  const container = document.getElementById('custos-dash');

  const itens = [
    { nome: 'Combustivel',      val: parseFloat(moto.combustivel) || 0, icone: 'ti-gas-station' },
    { nome: 'Manutencao',       val: parseFloat(moto.manutencao) || 0, icone: 'ti-tool' },
    { nome: 'Oleo',             val: parseFloat(moto.oleo) || 0, icone: 'ti-droplet' },
    { nome: 'Pneus',            val: parseFloat(moto.pneus) || 0, icone: 'ti-circle' },
    { nome: 'Freios',           val: parseFloat(moto.freios) || 0, icone: 'ti-brake' },
    { nome: 'Documentacao',     val: parseFloat(moto.doc) || 0, icone: 'ti-file-text' },
    { nome: 'Seguro',           val: parseFloat(moto.seguro) || 0, icone: 'ti-shield' },
    { nome: 'Outros',           val: parseFloat(moto.outros) || 0, icone: 'ti-dots' },
  ].filter(i => i.val > 0);

  if (itens.length === 0) {
    container.innerHTML = '<div style="font-size:13px; color:var(--text3);">Configure os custos mensais da moto na aba Moto.</div>';
    return;
  }

  const total = itens.reduce((s, i) => s + i.val, 0);
  const km = parseFloat(moto.km) || 0;

  // Busca lucro bruto do mes para calcular percentual
  const mesAtual = hojeISO().slice(0, 7);
  const regMes = appData.registros.filter(r => r.data.startsWith(mesAtual));
  const totalBruto = regMes.reduce((s, r) => s + r.bruto, 0);

  const rows = itens.map(i => `
    <div class="custos-row">
      <span class="custos-name"><i class="ti ${i.icone}" style="font-size:14px; opacity:.55;"></i>${i.nome}</span>
      <span>
        <span class="custos-val">${moeda(i.val)}</span>
        <span class="custos-pct">${total > 0 ? Math.round(i.val/total*100) : 0}%</span>
      </span>
    </div>
  `).join('');

  const pctDoLucro = totalBruto > 0 ? (total / totalBruto * 100).toFixed(1) : '--';
  const custoPorKm = km > 0 ? moeda(total / km) : '--';

  container.innerHTML = rows + `
    <div class="custos-totals">
      <div class="custos-total-item">
        <div class="custos-total-label">Total mensal</div>
        <div class="custos-total-val">${moeda(total)}</div>
      </div>
      <div class="custos-total-item" style="text-align:center;">
        <div class="custos-total-label">% do bruto</div>
        <div class="custos-total-val" style="color:var(--red);">${pctDoLucro}%</div>
      </div>
      <div class="custos-total-item" style="text-align:right;">
        <div class="custos-total-label">Custo/km</div>
        <div class="custos-total-val">${custoPorKm}</div>
      </div>
    </div>
  `;
}

function renderHeatmap() {
  // Calcula media de R$/hora por dia da semana com base em todos os registros
  const nomes = ['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];
  const totais = Array(7).fill(0);
  const conts  = Array(7).fill(0);

  appData.registros.forEach(r => {
    const dds = diaDaSemana(r.data);
    if (dds >= 0 && r.horas > 0) {
      totais[dds] += r.rph;
      conts[dds]++;
    }
  });

  const medias = totais.map((t, i) => conts[i] > 0 ? t / conts[i] : null);
  const maxVal = Math.max(...medias.filter(v => v !== null), 1);

  // Header dos dias
  const headerEl = document.getElementById('heatmap-header');
  headerEl.innerHTML = nomes.map(n =>
    `<div class="dia-head">${n}</div>`
  ).join('');

  // Celulas coloridas
  const gridEl = document.getElementById('heatmap-grid');
  gridEl.innerHTML = medias.map((v, i) => {
    if (v === null) {
      return `<div class="dia-cell" style="background:var(--surface); color:var(--text3); font-size:10px;">--</div>`;
    }
    const pct = v / maxVal;
    const cls = pct >= 0.75 ? 'day-high' : (pct >= 0.4 ? 'day-mid' : 'day-low');
    return `
      <div class="dia-cell ${cls}">
        R$${Math.round(v)}
        <div class="dia-sub">/hora</div>
      </div>
    `;
  }).join('');

  // Dica sobre o melhor dia
  const melhorIdx = medias.indexOf(Math.max(...medias.filter(v => v !== null)));
  const dicaEl = document.getElementById('heatmap-dica');
  if (appData.registros.length === 0) {
    dicaEl.textContent = 'Registre alguns dias para ver quais rendem mais.';
  } else {
    dicaEl.textContent = medias[melhorIdx] !== null
      ? `${nomes[melhorIdx]} e os dias antes e depois rendem mais. Priorize esses dias quando puder.`
      : 'Dados insuficientes para calcular o melhor dia.';
  }
}

// ============================================================
// HISTORICO
// ============================================================
function renderHistorico() {
  const filtromes = document.getElementById('filtro-mes').value;

  // Popula opcoes de mes no filtro
  const meses = [...new Set(appData.registros.map(r => r.data.slice(0,7)))].sort().reverse();
  const selMes = document.getElementById('filtro-mes');
  const valorAtual = selMes.value;
  selMes.innerHTML = '<option value="">Todos os meses</option>' +
    meses.map(m => `<option value="${m}" ${m === valorAtual ? 'selected' : ''}>${mesAno(m+'-01')}</option>`).join('');

  const regs = [...appData.registros]
    .filter(r => !filtromes || r.data.startsWith(filtromes))
    .sort((a,b) => b.data.localeCompare(a.data));

  document.getElementById('hist-count').textContent = `${regs.length} dia(s)`;

  const container = document.getElementById('hist-content');
  if (regs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon"><i class="ti ti-database-off"></i></div>
        <p>Nenhum registro encontrado.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <table class="hist-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Pedidos</th>
          <th>Bruto</th>
          <th>Gastos</th>
          <th>Lucro</th>
          <th>R$/h</th>
          <th>Acao</th>
        </tr>
      </thead>
      <tbody>
        ${regs.map(r => `
          <tr>
            <td>${formatarData(r.data)}</td>
            <td>${r.pedidos}</td>
            <td>${moeda(r.bruto)}</td>
            <td style="color:var(--red);">${moeda(r.gastos)}</td>
            <td style="color:${r.lucro >= 0 ? 'var(--green)' : 'var(--red)'}; font-weight:600;">${moeda(r.lucro)}</td>
            <td>${r.horas > 0 ? moeda(r.rph)+'/h' : '--'}</td>
            <td>
              <button class="btn btn-danger" style="padding:4px 10px; font-size:11px;" onclick="excluirRegistro(${r.id})">
                <i class="ti ti-trash"></i>
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function excluirRegistro(id) {
  if (!confirm('Excluir este registro?')) return;
  appData.registros = appData.registros.filter(r => r.id !== id);
  salvarDados();
  renderHistorico();
  toast('Registro excluido.');
}

// ============================================================
// METAS
// ============================================================
function carregarFormMetas() {
  const m = appData.metas || {};
  document.getElementById('m-diaria').value = m.diaria || '';
  document.getElementById('m-mensal').value = m.mensal || '';
  document.getElementById('m-hora').value = m.hora || '';
  document.getElementById('m-horas-dia').value = m.horas_dia || '';
  document.getElementById('m-reserva-moto').value = m.reserva_moto || '';
  document.getElementById('m-reserva-emerg').value = m.reserva_emerg || '';
}

function salvarMetas() {
  appData.metas = {
    diaria:        num('m-diaria'),
    mensal:        num('m-mensal'),
    hora:          num('m-hora'),
    horas_dia:     num('m-horas-dia'),
    reserva_moto:  num('m-reserva-moto'),
    reserva_emerg: num('m-reserva-emerg'),
  };
  salvarDados();
  toast('Metas salvas!');
}

// ============================================================
// MOTO
// ============================================================
function carregarFormMoto() {
  const c = appData.moto || {};
  ['combustivel','oleo','pneus','freios','manutencao','doc','seguro','outros','km'].forEach(campo => {
    document.getElementById('c-' + campo).value = c[campo] || '';
  });
}

function salvarMoto() {
  appData.moto = {};
  ['combustivel','oleo','pneus','freios','manutencao','doc','seguro','outros','km'].forEach(campo => {
    appData.moto[campo] = num('c-' + campo);
  });
  salvarDados();
  toast('Custos da moto salvos!');
}

// ============================================================
// TEMA: alterna entre light e dark mode
// ============================================================
function toggleTema() {
  // Le o tema atual do elemento html
  const html = document.documentElement;
  const atual = html.getAttribute('data-theme');

  // Detecta se o sistema prefere dark para saber o "default"
  const sistemaEscuro = matchMedia('(prefers-color-scheme: dark)').matches;

  // Logica de rotacao: sem data-theme (sistema) -> forca oposto -> volta pro sistema
  let proximo;
  if (!atual) {
    // Primeira vez: forca o oposto do sistema
    proximo = sistemaEscuro ? 'light' : 'dark';
  } else if (atual === 'dark') {
    proximo = 'light';
  } else {
    proximo = 'dark';
  }

  html.setAttribute('data-theme', proximo);
  localStorage.setItem('gestor_ifood_tema', proximo);
  atualizarIconeTema(proximo);

  // Recria o grafico do mes para aplicar as cores corretas do novo tema
  if (chartMesInstance) {
    chartMesInstance.destroy();
    chartMesInstance = null;
  }
  renderDashboard();
}

function atualizarIconeTema(tema) {
  // Troca o icone da lua/sol conforme o tema ativo
  const icon = document.getElementById('icon-tema');
  if (!icon) return;
  if (tema === 'dark') {
    icon.className = 'ti ti-sun';
  } else {
    icon.className = 'ti ti-moon';
  }
}

function carregarTema() {
  // Aplica o tema salvo no localStorage ao iniciar a pagina
  const temaSalvo = localStorage.getItem('gestor_ifood_tema');
  if (temaSalvo) {
    document.documentElement.setAttribute('data-theme', temaSalvo);
    atualizarIconeTema(temaSalvo);
  } else {
    // Sem preferencia salva: usa icone de acordo com o sistema
    const sistemaEscuro = matchMedia('(prefers-color-scheme: dark)').matches;
    atualizarIconeTema(sistemaEscuro ? 'dark' : 'light');
  }
}

// ============================================================
// INIT: executa ao carregar a pagina
// ============================================================
carregarTema();
carregarDados();
setupFormulario();
renderDashboard();
