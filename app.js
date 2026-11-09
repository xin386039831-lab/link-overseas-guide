const data = window.GUIDE_DATA;
const state = {country: '全部', stage: '全部', type: '全部', section: '全部', query: '', savedOnly: false};
const groups = [['country', '国家 / 地区'], ['stage', '学习阶段'], ['type', '路线类型'], ['section', '主题章节']];
const sections = {
  1: '职业培训与护理', 2: '低学费、签证与工作', 3: '政府与公共奖学金',
  4: '欧洲受雇博士', 5: '美国本科及研究生资助', 6: '加拿大本科及研究生资助',
  7: '澳大利亚本科及研究生资助'
};
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase();
const values = (row, key) => key === 'stage' ? row.stage.split('、') : key === 'section'
  ? row.auditTopics?.length ? [...new Set(row.auditTopics.map(topic => sections[topic.split('.')[0]]).filter(Boolean))] : ['更多路线与政策']
  : [row[key]];
const safeURL = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
};
function getSources(row) {
  const seen = new Set();
  return [{label: row.sourceLabel, url: row.source}, ...(row.sources || [])].filter(source => {
    const url = safeURL(source.url);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}
let saved = new Set();
try {
  const stored = JSON.parse(localStorage.getItem('link-guide-favorites') || '[]');
  if (Array.isArray(stored)) saved = new Set(stored.filter(id => data.some(row => row.id === id)));
} catch { /* Favorites are optional when browser storage is unavailable. */ }

function renderFilters() {
  document.querySelector('#filters').innerHTML = groups.map(([key, label]) => {
    const options = ['全部', ...(key === 'section' ? [...Object.values(sections), '更多路线与政策'] : new Set(data.flatMap(row => values(row, key))))];
    return `<div class="filter-row"><span class="filter-title">${label}</span><div class="filter-options" role="group" aria-label="${label}">${options.map(value => `<button type="button" class="chip ${state[key] === value ? 'selected' : ''}" data-key="${key}" data-value="${escapeHTML(value)}" aria-pressed="${state[key] === value}">${escapeHTML(value)}</button>`).join('')}</div><select class="filter-select" data-filter-key="${key}" aria-label="${label}">${options.map(value => `<option value="${escapeHTML(value)}" ${state[key] === value ? 'selected' : ''}>${escapeHTML(value)}</option>`).join('')}</select></div>`;
  }).join('');
}
function renderList(items, ordered = false) {
  if (!items?.length) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</${tag}>`;
}
function renderCard(row) {
  const sources = getSources(row);
  const isSaved = saved.has(row.id);
  const historical = /停止|停收|历史|已截止|已关闭/.test(row.status || '');
  const sourceHTML = sources.map((source, index) => `<li><a href="${escapeHTML(safeURL(source.url))}" target="_blank" rel="noopener noreferrer">${index + 1}. ${escapeHTML(source.label || new URL(source.url).hostname)} ↗</a></li>`).join('');
  return `<article class="card" id="route-${escapeHTML(row.id)}">
    <div class="card-top"><span class="card-number">ROUTE / ${escapeHTML(row.id)}</span><button type="button" class="favorite ${isSaved ? 'is-saved' : ''}" data-save="${escapeHTML(row.id)}" aria-label="${isSaved ? '取消收藏' : '收藏'}：${escapeHTML(row.title)}" aria-pressed="${isSaved}">${isSaved ? '★ 已收藏' : '☆ 收藏'}</button></div>
    <h3><a href="routes/${encodeURIComponent(row.id)}.html">${escapeHTML(row.title)}</a></h3>
    <div class="tags"><span>${escapeHTML(row.country)}</span><span>${escapeHTML(row.stage)}</span><span>${escapeHTML(row.type)}</span></div>
    ${row.status ? `<div class="route-status ${historical ? 'historical' : ''}">${escapeHTML(row.status)}</div>` : ''}
    <p>${escapeHTML(row.description)}</p>
    <div class="card-cost"><span aria-hidden="true">◌</span> ${escapeHTML(row.cost)}</div>
    <details class="detail"><summary>申请条件与注意事项 <span aria-hidden="true">＋</span></summary><p>${escapeHTML(row.details)}</p>
      ${row.facts?.length ? `<h4>关键事实</h4>${renderList(row.facts)}` : ''}
      ${row.steps?.length ? `<h4>如何申请 / 核对</h4>${renderList(row.steps, true)}` : ''}
      <a class="read-route" href="routes/${encodeURIComponent(row.id)}.html">阅读全文与来源 ↗</a>
    </details>
    <details class="card-source"><summary>官方来源 · ${sources.length} <span aria-hidden="true">↗</span></summary><ul>${sourceHTML}</ul></details>
    ${row.verifiedDate ? `<div class="verified-date">资料核查：<time datetime="${escapeHTML(row.verifiedDate)}">${escapeHTML(row.verifiedDate)}</time></div>` : ''}
  </article>`;
}
function renderCards() {
  const query = normalize(state.query).trim();
  const items = data.filter(row => groups.every(([key]) => state[key] === '全部' || values(row, key).includes(state[key]))
    && (!state.savedOnly || saved.has(row.id))
    && (!query || normalize([row.title, row.country, row.stage, row.type, row.cost, row.description, row.details,
      row.status, ...(row.facts || []), ...(row.steps || []), ...getSources(row).map(source => source.label),
      ...values(row, 'section')].join(' ')).includes(query)));
  document.querySelector('#count').textContent = String(data.length).padStart(2, '0');
  document.querySelector('#result-label').textContent = ` / ${items.length} 条`;
  document.querySelector('#empty').hidden = items.length > 0;
  const favoriteButton = document.querySelector('#saved-only');
  favoriteButton.textContent = `${state.savedOnly ? '★' : '☆'} 我的收藏 (${saved.size})`;
  favoriteButton.setAttribute('aria-pressed', String(state.savedOnly));
  document.querySelector('#cards').innerHTML = items.map(renderCard).join('');
}
function reset() {
  for (const [key] of groups) state[key] = '全部';
  state.query = '';
  state.savedOnly = false;
  document.querySelector('#search').value = '';
  renderFilters();
  renderCards();
}
document.querySelector('#filters').addEventListener('click', event => {
  const button = event.target.closest('button[data-key]');
  if (!button) return;
  state[button.dataset.key] = button.dataset.value;
  renderFilters();
  renderCards();
  document.querySelectorAll('#filters button').forEach(next => {
    if (next.dataset.key === button.dataset.key && next.dataset.value === button.dataset.value) next.focus();
  });
});
document.querySelector('#search').addEventListener('input', event => { state.query = event.target.value; renderCards(); });
document.querySelector('#filters').addEventListener('change', event => {
  const select = event.target.closest('select[data-filter-key]');
  if (!select) return;
  const key = select.dataset.filterKey;
  state[key] = select.value;
  renderFilters();
  renderCards();
  document.querySelector(`select[data-filter-key="${key}"]`).focus();
});
document.querySelector('#saved-only').addEventListener('click', () => { state.savedOnly = !state.savedOnly; renderCards(); });
document.querySelector('#cards').addEventListener('click', event => {
  const button = event.target.closest('[data-save]');
  if (!button) return;
  const id = button.dataset.save;
  saved.has(id) ? saved.delete(id) : saved.add(id);
  try { localStorage.setItem('link-guide-favorites', JSON.stringify([...saved])); } catch { /* Storage may be disabled. */ }
  renderCards();
  document.querySelectorAll('[data-save]').forEach(next => { if (next.dataset.save === id) next.focus(); });
});
document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#empty-reset').addEventListener('click', reset);
renderFilters();
renderCards();
