(function () {
  'use strict';
  var C = window.MergeCore;
  var $ = function (id) { return document.getElementById(id); };
  var qs = location.search;
  var state = { files: [], keyFields: ['id', 'date'], tab: 'merged', result: null };

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtAmt(v) { return typeof v === 'number' ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
  function color(type) {
    if (type === '冲突') return 'red';
    if (type === '重复') return 'yellow';
    if (type === '正常') return '';
    return 'blue';
  }
  function say(t) { $('msg').textContent = t || ''; }
  function noLib() { if (typeof XLSX === 'undefined') { say('表格解析组件加载失败，请检查网络后刷新页面。'); return true; } return false; }

  // ---------- 读入 ----------
  function addTables(list) {
    list.forEach(function (it) {
      if (!it.table.aoa.length) { say('“' + it.name + '”里没有读到数据，已跳过。'); return; }
      var exist = state.files.findIndex(function (f) { return f.name === it.name; });
      var prepared = C.prepare(it.name, it.table);
      if (exist >= 0) state.files[exist] = prepared; else state.files.push(prepared);
    });
    renderAll();
  }

  function readFiles(fileList) {
    if (noLib()) return;
    say('');
    var arr = Array.prototype.slice.call(fileList).filter(function (f) { return /\.(xlsx|xls|csv)$/i.test(f.name); });
    if (!arr.length) { say('请选择 .xlsx / .xls / .csv 文件。'); return; }
    var big = arr.filter(function (f) { return f.size > 20 * 1024 * 1024; });
    if (big.length) { say('单个文件请小于 20MB：' + big.map(function (f) { return f.name; }).join('、')); return; }
    Promise.all(arr.map(function (f) {
      return f.arrayBuffer().then(function (buf) {
        try { return { name: f.name, table: C.readTable(XLSX, f.name, new Uint8Array(buf)) }; }
        catch (e) { say('“' + f.name + '”无法读取：' + e.message); return null; }
      });
    })).then(function (res) { addTables(res.filter(Boolean)); });
  }

  function loadDemo() {
    if (noLib()) return;
    say('');
    state.files = [];
    addTables((window.DEMO_SAMPLES || []).map(function (s) {
      var bin = atob(s.b64), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return { name: s.name, table: C.readTable(XLSX, s.name, u8) };
    }));
  }

  // ---------- 渲染 ----------
  function setStep(n) {
    Array.prototype.forEach.call(document.querySelectorAll('#steps li'), function (li) {
      var s = +li.dataset.s;
      li.className = s < n ? 'done' : s === n ? 'cur' : '';
    });
  }

  function renderAll() {
    var has = state.files.length > 0;
    document.body.classList.toggle('has-files', has);
    $('step2').classList.toggle('hidden', !has);
    $('step3').classList.toggle('hidden', !has);
    $('emptyState').classList.toggle('hidden', has);
    setStep(has ? 3 : 1);
    if (!has) { $('fileList').innerHTML = ''; return; }
    renderKeys();
    renderMaps();
    recompute();
  }

  function renderKeys() {
    $('keyBoxes').innerHTML = C.FIELDS.map(function (f) {
      return '<label><input type="checkbox" value="' + f.key + '"' + (state.keyFields.indexOf(f.key) >= 0 ? ' checked' : '') + '><span>' + f.label + '</span></label>';
    }).join('');
  }

  function sampleValue(f, c) {
    for (var r = f.headerIdx + 1; r < Math.min(f.aoa.length, f.headerIdx + 30); r++) {
      var v = (f.aoa[r] || [])[c];
      if (v !== '' && v !== null && v !== undefined) {
        if (typeof v === 'number' && f.mapping[c] === 'date') return C.parseDate(v) || v;
        return v;
      }
    }
    return '';
  }

  function renderMaps() {
    var opts = [{ key: '', label: '（不使用）' }].concat(C.FIELDS);
    var mappedCols = 0;
    $('mapList').innerHTML = state.files.map(function (f, fi) {
      var head = f.aoa[f.headerIdx] || [];
      var rows = head.map(function (h, c) {
        var ex = sampleValue(f, c);
        if ((h === '' || h === null) && ex === '') return '';
        var cur = f.mapping[c] || '';
        if (cur) mappedCols++;
        var sel = '<select aria-label="' + esc(h) + ' 对应字段" data-f="' + fi + '" data-c="' + c + '" class="' + (cur ? '' : 'un') + '">' + opts.map(function (o) {
          return '<option value="' + o.key + '"' + (o.key === cur ? ' selected' : '') + '>' + o.label + '</option>';
        }).join('') + '</select>';
        return '<tr class="' + (cur ? 'on' : '') + '"><td title="' + esc(h) + '">' + (esc(h) || '<span class="ex">（无列名）</span>') +
          '</td><td class="ex" title="' + esc(ex) + '">' + esc(ex) + '</td><td>' + sel + '</td></tr>';
      }).join('');
      return '<div class="map"><div class="map-h"><b title="' + esc(f.name) + '">' + esc(f.name) + '</b>' +
        '<label>表头在第 <input type="number" min="1" max="' + (f.aoa.length + f.rowOffset) + '" value="' + (f.headerIdx + 1 + f.rowOffset) + '" data-h="' + fi + '"> 行</label></div>' +
        '<table><colgroup><col style="width:33%"><col style="width:31%"><col style="width:36%"></colgroup>' +
        '<tr><th>原列名</th><th>示例值</th><th>对应字段</th></tr>' + rows + '</table></div>';
    }).join('');
    $('mapSummary').textContent = state.files.length + ' 个文件 · ' + mappedCols + ' 列已对应到统一字段';
  }

  function recompute() {
    var res = C.process(state.files, { keyFields: state.keyFields });
    state.result = res;
    var t = res.totals;
    $('fileList').innerHTML = res.stats.map(function (s) {
      return '<li title="' + esc(s.name) + '"><span>' + esc(s.name) + '</span><em>' + s.dataRows + ' 行</em></li>';
    }).join('');
    var cards = [
      ['来源文件', state.files.length, ''], ['有效数据行', t.dataRows, ''], ['合并后行数', t.merged, 'brand'],
      ['去掉的重复', t.dupRemoved, 'yellow'], ['冲突行', t.conflicts, 'red'], ['金额合计', fmtAmt(t.amount), '']
    ];
    $('cards').innerHTML = cards.map(function (c) {
      return '<div class="stat ' + c[2] + '"><div class="v">' + c[1] + '</div><div class="k">' + c[0] + '</div></div>';
    }).join('');
    $('cntMerged').textContent = t.merged;
    $('cntProb').textContent = res.problems.length;
    renderPreview();
  }

  function cell(v, cls) {
    cls = cls || '';
    if (v === '' || v === null || v === undefined) return '<td class="empty ' + cls + '">—</td>';
    return '<td class="' + cls + '">' + esc(cls.indexOf('amt') >= 0 ? fmtAmt(v) : v) + '</td>';
  }
  function renderPreview() {
    var res = state.result, head, body;
    if (state.tab === 'merged') {
      head = '<th>#</th><th>姓名</th><th>证件号/工号</th><th>部门</th><th>日期</th><th class="n">金额</th><th>来源文件</th><th class="n">原行号</th><th>状态</th>';
      body = res.merged.map(function (r, i) {
        var col = color(r.status);
        return '<tr class="' + (col ? 'r-' + col : '') + '"><td class="idx">' + (i + 1) + '</td>' + cell(r.name) + cell(r.id) + cell(r.dept) + cell(r.date) +
          cell(r.amount, 'n amt') + cell(r.file, 'src') + '<td class="n">' + r.row + '</td><td><span class="tag ' + (col || 'ok') + '">' + esc(r.status) + '</span></td></tr>';
      }).join('');
    } else if (state.tab === 'problems') {
      head = '<th>问题类型</th><th>说明</th><th>姓名</th><th>证件号/工号</th><th>日期</th><th class="n">金额</th><th>来源文件</th><th class="n">原行号</th>';
      body = res.problems.length ? res.problems.map(function (p) {
        var r = p.rec, col = color(p.type);
        return '<tr class="r-' + col + '"><td><span class="tag ' + col + '">' + esc(p.type) + '</span></td>' + cell(p.detail) + cell(r.name) + cell(r.id) + cell(r.date) +
          cell(r.amount, 'n amt') + cell(r.file, 'src') + '<td class="n">' + r.row + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty">没有问题行</td></tr>';
    } else {
      var t = res.totals;
      head = '<th>来源文件</th><th class="n">表头所在行</th><th class="n">有效数据行</th><th class="n">清除空行/合计行</th><th class="n">去掉的重复</th><th class="n">问题行</th>';
      body = res.stats.map(function (s) {
        return '<tr><td>' + esc(s.name) + '</td><td class="n">' + s.headerRow + '</td><td class="n">' + s.dataRows + '</td><td class="n">' + s.cleared +
          '</td><td class="n">' + s.dupRemoved + '</td><td class="n">' + s.problemRows + '</td></tr>';
      }).join('') +
        '<tr class="total"><td>合计</td><td></td><td class="n">' + t.dataRows + '</td><td class="n">' + t.cleared + '</td><td class="n">' + t.dupRemoved + '</td><td class="n">' + t.problemRows + '</td></tr>';
    }
    var tbl = $('preview');
    tbl.innerHTML = '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody>';
    tbl.style.animation = 'none'; void tbl.offsetWidth; tbl.style.animation = '';
  }

  function exportXlsx() {
    if (noLib() || !state.result) return;
    var sh = C.toSheets(state.result);
    var wb = XLSX.utils.book_new();
    [['合并结果', sh.main, [14, 14, 10, 12, 12, 22, 8, 14]], ['问题行', sh.prob, [14, 40, 14, 14, 10, 12, 12, 22, 8]], ['汇总', sh.sum, [24, 12, 12, 16, 12, 10]]]
      .forEach(function (s) {
        var ws = XLSX.utils.aoa_to_sheet(s[1]);
        ws['!cols'] = s[2].map(function (w) { return { wch: w }; });
        XLSX.utils.book_append_sheet(wb, ws, s[0]);
      });
    var d = new Date(), stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    XLSX.writeFile(wb, '合并结果_' + stamp + '.xlsx');
  }

  // ---------- 事件 ----------
  $('fileInput').addEventListener('change', function (e) { readFiles(e.target.files); e.target.value = ''; });
  $('demoBtn').addEventListener('click', loadDemo);
  $('resetBtn').addEventListener('click', function () { state.files = []; state.result = null; say(''); renderAll(); });
  $('exportBtn').addEventListener('click', exportXlsx);
  var drop = $('drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) readFiles(e.dataTransfer.files); });
  drop.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === drop) { e.preventDefault(); $('fileInput').click(); } });
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });

  $('mapList').addEventListener('change', function (e) {
    var t = e.target;
    if (t.tagName === 'SELECT') {
      var f = state.files[+t.dataset.f], c = +t.dataset.c, v = t.value;
      if (v) f.mapping = f.mapping.map(function (m, i) { return i !== c && m === v ? '' : m; }); // 一个字段只对应一列
      f.mapping[c] = v;
      renderMaps(); recompute();
    } else if (t.dataset.h !== undefined) {
      var fi = state.files[+t.dataset.h];
      var idx = Math.max(0, Math.min(fi.aoa.length - 1, (parseInt(t.value, 10) || 1) - 1 - fi.rowOffset));
      fi.headerIdx = idx;
      fi.mapping = C.autoMap(fi.aoa[idx] || []);
      renderMaps(); recompute();
    }
  });
  $('keyBoxes').addEventListener('change', function () {
    var ks = Array.prototype.slice.call($('keyBoxes').querySelectorAll('input:checked')).map(function (i) { return i.value; });
    if (!ks.length) { renderKeys(); say('至少保留一个去重关键字段。'); return; }
    say(''); state.keyFields = ks; recompute();
  });
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (!b) return;
    state.tab = b.dataset.tab;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (x) { x.classList.toggle('on', x === b); });
    renderPreview();
  });

  setStep(1);
  // URL 参数：?demo=1 自动加载示例；&cover=1 折叠映射区（作品集封面截图用）；&tab=problems|files 切到对应页签
  if (/[?&]demo=1\b/.test(qs)) loadDemo();
  if (/[?&]cover=1\b/.test(qs)) $('mapBox').open = false;
  var m = qs.match(/[?&]tab=(problems|files)\b/);
  if (m) document.querySelector('.tab[data-tab="' + m[1] + '"]').click();
})();
