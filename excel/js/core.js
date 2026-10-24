/* 合并清洗核心逻辑：只处理“二维数组”，不依赖页面，浏览器与 node 共用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MergeCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FIELDS = [
    { key: 'name', label: '姓名' },
    { key: 'id', label: '证件号/工号' },
    { key: 'dept', label: '部门' },
    { key: 'date', label: '日期' },
    { key: 'amount', label: '金额' }
  ];

  // 同义列名：先精确匹配，再按关键词包含匹配
  var SYNONYMS = {
    name: ['姓名', '名字', '员工姓名', '人员姓名', '职员姓名', '员工', '人员', '联系人', '报销人', '申请人', 'name'],
    id: ['证件号', '证件号码', '身份证号', '工号', '员工编号', '员工号', '人员编号', '职工号', '编号', 'id', '员工id'],
    dept: ['部门', '所属部门', '部门名称', '科室', '组别', '团队', '所属团队', 'dept', 'department'],
    date: ['日期', '报销日期', '发生日期', '业务日期', '申请日期', '时间', '发生时间', 'date'],
    amount: ['金额', '报销金额', '费用', '费用金额', '数额', '总额', '实发', '款项', 'amount']
  };
  var KEYWORDS = [
    ['amount', /金额|费用|款/],
    ['date', /日期|时间/],
    ['dept', /部门|科室|团队/],
    ['name', /姓名|名字/],
    ['id', /工号|编号|证件|身份证|^id$/i]
  ];
  var IGNORE_HEADERS = /^(序号|行号|no\.?|#)$/i;
  var TOTAL_RE = /^(合\s*计|小\s*计|总\s*计|总\s*和|汇\s*总)/;

  function clean(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v.replace(/^[\s　 ]+|[\s　 ]+$/g, '');
    return v;
  }
  function isEmpty(v) { return clean(v) === ''; }
  function normHeader(h) {
    return String(clean(h)).toLowerCase()
      .replace(/[\(（\[【].*?[\)）\]】]/g, '')
      .replace(/[\s　:：_\-]/g, '');
  }

  function matchField(h) {
    var n = normHeader(h);
    if (!n || IGNORE_HEADERS.test(n)) return '';
    for (var k in SYNONYMS) if (SYNONYMS[k].indexOf(n) >= 0) return k;
    for (var i = 0; i < KEYWORDS.length; i++) if (KEYWORDS[i][1].test(n)) return KEYWORDS[i][0];
    return '';
  }

  /** 在前 15 行中找“最像表头”的一行：命中同义列名最多、且至少 2 个。返回 0 起的行下标。 */
  function detectHeader(aoa) {
    var best = -1, bestScore = 1;
    var lim = Math.min(aoa.length, 15);
    for (var r = 0; r < lim; r++) {
      var row = aoa[r] || [], seen = {}, score = 0;
      for (var c = 0; c < row.length; c++) {
        if (typeof row[c] !== 'string') continue;
        var f = matchField(row[c]);
        if (f && !seen[f]) { seen[f] = 1; score++; }
      }
      if (score > bestScore) { best = r; bestScore = score; }
    }
    if (best >= 0) return best;
    for (var r2 = 0; r2 < aoa.length; r2++) if ((aoa[r2] || []).some(function (v) { return !isEmpty(v); })) return r2;
    return 0;
  }

  /** 给表头每一列建议一个统一字段（每个字段只占一列，先到先得）。返回与列等长的数组，''=忽略。 */
  function autoMap(headerRow) {
    var used = {}, out = [];
    for (var c = 0; c < headerRow.length; c++) {
      var f = matchField(headerRow[c]);
      if (f && !used[f]) { used[f] = 1; out.push(f); } else out.push('');
    }
    return out;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function validYMD(y, m, d) {
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return '';
    var dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d > dim) return '';
    return y + '-' + pad(m) + '-' + pad(d);
  }
  /** 日期统一成 YYYY-MM-DD；无法识别返回 null。Excel 序列号按 1900 日期系统换算。 */
  function parseDate(v) {
    v = clean(v);
    if (v === '') return '';
    if (v instanceof Date && !isNaN(v)) return validYMD(v.getFullYear(), v.getMonth() + 1, v.getDate()) || null;
    if (typeof v === 'number') {
      if (v > 1000 && v < 100000) {
        var dt = new Date(Math.round((v - 25569) * 86400000));
        return validYMD(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()) || null;
      }
      if (v >= 19000101 && v <= 21001231) v = String(v); else return null;
    }
    var s = String(v), m;
    if ((m = s.match(/^(\d{4})\s*[-\/.年]\s*(\d{1,2})\s*[-\/.月]\s*(\d{1,2})\s*日?(?:[\sT]+\d{1,2}:\d{2}(?::\d{2})?)?$/)))
      return validYMD(+m[1], +m[2], +m[3]) || null;
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return validYMD(+m[1], +m[2], +m[3]) || null;
    return null;
  }
  /** 金额转数字：去 ¥/￥/元/RMB/千分位/空格；无法识别返回 null。 */
  function parseAmount(v) {
    v = clean(v);
    if (v === '') return '';
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) / 100 : null;
    var s = String(v).replace(/[¥￥,，\s]|元|rmb|cny/gi, '');
    if (/^\(\d+(\.\d+)?\)$/.test(s)) s = '-' + s.slice(1, -1);
    if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return null;
    return Math.round(parseFloat(s) * 100) / 100;
  }

  function isTotalRow(row) {
    for (var c = 0; c < row.length; c++) {
      var v = clean(row[c]);
      if (typeof v === 'string' && TOTAL_RE.test(v)) return true;
    }
    return false;
  }

  /**
   * files: [{ name, aoa, headerIdx, mapping, rowOffset? }]  mapping 与表头列等长，值为字段 key 或 ''
   * opts:  { keyFields: ['id','date'] }
   * 返回 { merged, problems, stats, totals }
   */
  function process(files, opts) {
    var keyFields = (opts && opts.keyFields && opts.keyFields.length) ? opts.keyFields : ['id', 'date'];
    var records = [], stats = [];

    files.forEach(function (f, fi) {
      var st = { name: f.name, headerRow: f.headerIdx + 1 + (f.rowOffset || 0), dataRows: 0, cleared: 0, dupRemoved: 0, problemRows: 0 };
      stats.push(st);
      for (var r = f.headerIdx + 1; r < f.aoa.length; r++) {
        var row = f.aoa[r] || [];
        if (!row.some(function (v) { return !isEmpty(v); })) { st.cleared++; continue; }
        if (isTotalRow(row)) { st.cleared++; continue; }
        var rec = { file: f.name, fileIdx: fi, row: r + 1 + (f.rowOffset || 0), name: '', id: '', dept: '', date: '', amount: '', issues: [], raw: {} };
        f.mapping.forEach(function (key, c) {
          if (!key) return;
          var v = clean(row[c]);
          if (rec.raw[key] !== undefined && rec.raw[key] !== '') return; // 同一字段映射了多列：取第一个非空
          rec.raw[key] = v;
          if (key === 'date') {
            var d = parseDate(v);
            if (d === null) { rec.issues.push({ type: '日期无法识别', detail: '原值“' + v + '”' }); d = ''; }
            rec.date = d;
          } else if (key === 'amount') {
            var a = parseAmount(v);
            if (a === null) { rec.issues.push({ type: '金额无法识别', detail: '原值“' + v + '”' }); a = ''; }
            rec.amount = a;
          } else {
            rec[key] = v === '' ? '' : String(v);
          }
        });
        if (keyFields.indexOf('id') >= 0 && rec.id === '' && f.mapping.indexOf('id') >= 0)
          rec.issues.unshift({ type: '缺证件号/工号', detail: '' });
        st.dataRows++;
        records.push(rec);
      }
    });

    // 去重 / 冲突
    var groups = {};
    var compareFields = FIELDS.map(function (x) { return x.key; }).filter(function (k) { return keyFields.indexOf(k) < 0; });
    records.forEach(function (rec) {
      var parts = keyFields.map(function (k) { return String(rec[k]); });
      if (parts.some(function (p) { return p === ''; })) return;
      var key = parts.join('\u0001');
      var g = groups[key];
      if (!g) { groups[key] = [rec]; return; }
      // 与组内已保留的行比较
      var dupOf = null;
      for (var i = 0; i < g.length; i++) {
        var o = g[i], diff = [];
        compareFields.forEach(function (k) {
          if (rec[k] !== '' && o[k] !== '' && String(rec[k]) !== String(o[k])) diff.push(k);
        });
        if (!diff.length) { dupOf = o; break; }
        rec._conflictWith = rec._conflictWith || [];
        rec._conflictWith.push({ other: o, diff: diff });
      }
      if (dupOf) {
        rec.duplicate = true;
        rec.issues.unshift({ type: '重复', detail: '与 ' + dupOf.file + ' 第' + dupOf.row + '行 重复，已去除' });
        rec._conflictWith = null;
      } else {
        g.push(rec);
      }
    });
    function label(k) { for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === k) return FIELDS[i].label; return k; }
    records.forEach(function (rec) {
      if (!rec._conflictWith) return;
      rec._conflictWith.forEach(function (cw) {
        var txt = cw.diff.map(label).join('、') + '不一致';
        rec.issues.unshift({ type: '冲突', detail: '与 ' + cw.other.file + ' 第' + cw.other.row + '行 ' + txt });
        if (!cw.other._conflictMarked || cw.other._conflictMarked.indexOf(rec) < 0) {
          cw.other.issues.unshift({ type: '冲突', detail: '与 ' + rec.file + ' 第' + rec.row + '行 ' + txt });
          (cw.other._conflictMarked = cw.other._conflictMarked || []).push(rec);
        }
      });
    });

    var merged = [], problems = [], total = 0;
    records.forEach(function (rec) {
      rec.status = rec.issues.length ? rec.issues[0].type : '正常';
      if (rec.issues.length) stats[rec.fileIdx].problemRows++;
      rec.issues.forEach(function (is) { problems.push({ type: is.type, detail: is.detail, rec: rec }); });
      if (rec.duplicate) { stats[rec.fileIdx].dupRemoved++; return; }
      merged.push(rec);
      if (typeof rec.amount === 'number') total += rec.amount;
    });
    problems.sort(function (a, b) { return a.rec.fileIdx - b.rec.fileIdx || a.rec.row - b.rec.row; });

    var totals = stats.reduce(function (t, s) {
      t.dataRows += s.dataRows; t.cleared += s.cleared; t.dupRemoved += s.dupRemoved; t.problemRows += s.problemRows; return t;
    }, { dataRows: 0, cleared: 0, dupRemoved: 0, problemRows: 0 });
    totals.merged = merged.length;
    totals.conflicts = records.filter(function (r) { return r.status === '冲突'; }).length;
    totals.amount = Math.round(total * 100) / 100;
    return { merged: merged, problems: problems, stats: stats, totals: totals };
  }

  /** 生成导出用的二维数组（合并结果 / 问题行 / 汇总） */
  function toSheets(res) {
    var head = FIELDS.map(function (f) { return f.label; }).concat(['来源文件', '原行号', '状态']);
    var main = [head].concat(res.merged.map(function (r) {
      return [r.name, r.id, r.dept, r.date, r.amount, r.file, r.row, r.status];
    }));
    var prob = [['问题类型', '说明'].concat(head.slice(0, 7))].concat(res.problems.map(function (p) {
      var r = p.rec; return [p.type, p.detail, r.name, r.id, r.dept, r.date, r.amount, r.file, r.row];
    }));
    var sum = [['来源文件', '表头所在行', '有效数据行', '清除空行/合计行', '去掉的重复', '问题行']].concat(
      res.stats.map(function (s) { return [s.name, s.headerRow, s.dataRows, s.cleared, s.dupRemoved, s.problemRows]; }),
      [['合计', '', res.totals.dataRows, res.totals.cleared, res.totals.dupRemoved, res.totals.problemRows],
       [], ['合并后行数', res.totals.merged], ['金额合计（可识别部分）', res.totals.amount], ['说明', '演示数据为合成数据']]);
    return { main: main, prob: prob, sum: sum };
  }

  /** 用 SheetJS 读取文件字节，返回首个有内容的工作表的二维数组（浏览器与 node 共用同一读法）。 */
  function readTable(XLSX, name, bytes) {
    var wb;
    if (/\.csv$/i.test(name)) {
      var text;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch (e) { text = new TextDecoder('gbk').decode(bytes); } // 兼容 Excel 另存的 GBK 编码 CSV
      text = text.replace(/^﻿/, '');
      wb = XLSX.read(text, { type: 'string', raw: true });
    } else {
      wb = XLSX.read(bytes, { type: 'array' });
    }
    for (var i = 0; i < wb.SheetNames.length; i++) {
      var ws = wb.Sheets[wb.SheetNames[i]];
      if (!ws || !ws['!ref']) continue;
      var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true });
      if (!aoa.length) continue;
      return { sheet: wb.SheetNames[i], aoa: aoa, rowOffset: XLSX.utils.decode_range(ws['!ref']).s.r, sheetCount: wb.SheetNames.length };
    }
    return { sheet: '', aoa: [], rowOffset: 0, sheetCount: wb.SheetNames.length };
  }

  /** 读入后一步到位：识别表头 + 自动映射 */
  function prepare(name, table) {
    var h = detectHeader(table.aoa);
    return { name: name, sheet: table.sheet, aoa: table.aoa, rowOffset: table.rowOffset, headerIdx: h,
      mapping: autoMap(table.aoa[h] || []) };
  }

  return { FIELDS: FIELDS, readTable: readTable, prepare: prepare, detectHeader: detectHeader, autoMap: autoMap, matchField: matchField,
    parseDate: parseDate, parseAmount: parseAmount, process: process, toSheets: toSheets };
});
