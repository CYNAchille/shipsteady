/* 校园体育成绩记录系统 · H5 演示版（原生 JS，数据仅存 localStorage） */
(function () {
  'use strict';
  var st = Store.load();
  var app = document.getElementById('app');
  var P = new URLSearchParams(location.search);
  if (P.get('reset') === '1') st = Store.reset();
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 工具 ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function curTerm() { return st.terms[st.terms.length - 1]; }
  function item(k) { return st.items.filter(function (x) { return x.k === k; })[0]; }
  function cls(id) { return st.classes.filter(function (c) { return c.id === id; })[0]; }
  function stu(id) { return st.students.filter(function (s) { return s.id === id; })[0]; }
  function gradeName(g) { var x = st.grades.filter(function (y) { return y.g === g; })[0]; return x ? x.name : ''; }
  function studentsOf(cid) { return st.students.filter(function (s) { return s.classId === cid; }).sort(function (a, b) { return a.no < b.no ? -1 : 1; }); }
  function rec(term, sid, k) { var t = st.records[term]; var r = t && t[sid]; return r && r[k] != null ? r[k] : null; }
  function setRec(term, sid, k, v) {
    st.records[term] = st.records[term] || {};
    var r = st.records[term][sid] = st.records[term][sid] || {};
    if (v === null) delete r[k]; else r[k] = v;
  }
  function pct(a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; }
  function fmtPct(a, b) { return b ? pct(a, b) + '%' : '—'; }
  function persist() { if (!Store.save(st)) toast('本机存储不可用，刷新后数据会丢失'); }
  function shortName(n) { return String(n).replace('演示学生·', ''); }

  /* 线性图标（不使用 emoji） */
  var I = {
    pen: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.8 3.1 2.6 3.5 5.2"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    run: '<circle cx="14" cy="4.5" r="2"/><path d="M8 21l3-6 3 2v5M6 12l3-4h5l2 4 3 1"/><path d="M11 15l-2-4"/>'
  };
  function ic(n, s, sw) { s = s || 20; return '<svg class="ic" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>'; }
  // 跑道线装饰
  function lanes(w) {
    var s = '<svg class="lanes" width="' + w + '" height="' + w + '" viewBox="0 0 200 200" fill="none" stroke="#fff" stroke-width="1.2" aria-hidden="true">';
    for (var i = 0; i < 6; i++) { var r = 30 + i * 14; s += '<rect x="' + (100 - r) + '" y="' + (100 - r * 0.62) + '" width="' + r * 2 + '" height="' + r * 1.24 + '" rx="' + r * 0.62 + '"/>'; }
    return s + '</svg>';
  }

  // 等级：-1 未测，0 不及格，1 及格，2 良好，3 优秀
  var LV = [['不及格', 't-bad'], ['及格', 't-ok'], ['良好', 't-good'], ['优秀', 't-best']];
  function level(it, v) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return { lv: -1, text: '未测', cls: 't-none' };
    var lv = 0;
    it.std.forEach(function (s, i) { if (it.hi ? v >= s[0] : v <= s[0]) lv = i + 1; });
    return { lv: lv, text: LV[lv][0], cls: LV[lv][1] };
  }
  function parseVal(it, raw) {
    raw = String(raw).trim();
    if (raw === '') return { empty: true };
    var v = Number(raw);
    if (!isFinite(v) || v < it.min || v > it.max) return { bad: true };
    return { v: Math.round(v * Math.pow(10, it.dec)) / Math.pow(10, it.dec) };
  }

  /* 统计口径：达标率=及格及以上人次/已测人次；优良率=良好+优秀人次/已测人次；已测人数=本学期至少测过一项的学生数 */
  function stats(term, studs) {
    var o = { tested: 0, total: studs.length, n: 0, pass: 0, good: 0, byItem: {} };
    st.items.forEach(function (it) { o.byItem[it.k] = { n: 0, pass: 0, good: 0 }; });
    studs.forEach(function (s) {
      var any = false;
      st.items.forEach(function (it) {
        var v = rec(term, s.id, it.k); if (v === null) return;
        any = true; var L = level(it, v).lv, b = o.byItem[it.k];
        o.n++; b.n++;
        if (L >= 1) { o.pass++; b.pass++; }
        if (L >= 2) { o.good++; b.good++; }
      });
      if (any) o.tested++;
    });
    return o;
  }

  /* ---------- 界面状态 ---------- */
  var firstCls = st.classes[0] ? st.classes[0].id : null;
  var ui = {
    role: ({ teacher: 1, admin: 1, parent: 1 })[P.get('role')] ? P.get('role') : null,
    tab: P.get('tab') || null,
    t: { cls: firstCls, item: st.items[0].k, term: curTerm(), recTerm: curTerm(), draft: {} },
    a: { grade: 'all', term: curTerm(), stuCls: firstCls, exGrade: 'all', exTerm: curTerm(), importMsg: '' },
    p: { stu: null, item: st.items[0].k }
  };
  function defaultKid() { var c = st.classes[st.classes.length - 1]; var s = (c && studentsOf(c.id)[1]) || st.students[0]; return s ? s.id : null; }
  (function applyParams() {
    var ci = parseInt(P.get('class'), 10);
    if (ci >= 1 && st.classes[ci - 1]) { ui.t.cls = st.classes[ci - 1].id; ui.a.stuCls = ui.t.cls; }
    if (P.get('item') && item(P.get('item'))) ui.t.item = ui.p.item = P.get('item');
    var g = parseInt(P.get('grade'), 10); if (g) ui.a.grade = g;
    if (P.get('stu') && stu(P.get('stu'))) ui.p.stu = P.get('stu');
  })();
  if (!ui.p.stu) ui.p.stu = defaultKid();
  var TABS = {
    teacher: [['entry', 'pen', '成绩录入'], ['records', 'list', '本班记录']],
    admin: [['dash', 'chart', '数据看板'], ['students', 'users', '学生名单'], ['standards', 'sliders', '评分标准'], ['export', 'download', '导出']],
    parent: []
  };
  if (ui.role && TABS[ui.role].length && !TABS[ui.role].some(function (t) { return t[0] === ui.tab; })) ui.tab = TABS[ui.role][0][0];

  function draftDirty() { return Object.keys(ui.t.draft).length > 0; }
  function guardDraft() {
    if (!draftDirty()) return true;
    if (confirm('当前有未保存的成绩，确定放弃吗？')) { ui.t.draft = {}; return true; }
    return false;
  }

  /* ---------- 通用片段 ---------- */
  function chips(list, cur, act, extra) {
    return '<div class="chips' + (extra ? ' ' + extra : '') + '">' + list.map(function (x) {
      return '<button class="chip' + (String(x[0]) === String(cur) ? ' on' : '') + '" data-act="' + act + '" data-v="' + esc(x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
  }
  function termSelect(cur, act) {
    return '<select class="sel" data-change="' + act + '" aria-label="学期">' + st.terms.slice().reverse().map(function (t) {
      return '<option value="' + t + '"' + (t === cur ? ' selected' : '') + '>' + t + (t === curTerm() ? '（本学期）' : '') + '</option>';
    }).join('') + '</select>';
  }
  function bars(rows) {
    return rows.map(function (r) {
      var w = r[2] ? pct(r[1], r[2]) : 0;
      return '<div class="hbar"><span class="k">' + esc(r[0]) + '</span><div class="tr"><div class="fl' + (w < 85 ? ' low' : '') + '" style="width:' + w + '%"></div></div><span class="v">' + (r[2] ? w + '%' : '—') + '</span></div>';
    }).join('');
  }
  function classOptions() { return st.classes.slice().sort(function (a, b) { return a.grade - b.grade || (a.name < b.name ? -1 : 1); }).map(function (c) { return [c.id, c.name]; }); }
  function header(title) {
    var roleName = { teacher: '老师', admin: '管理员', parent: '家长' }[ui.role];
    return '<header class="bar"><button class="back" data-act="home">' + ic('back', 16, 2) + '切换身份</button><span class="ttl">' + esc(title) + '<small>演示数据为合成数据</small></span><span class="pill">' + roleName + '</span></header>';
  }
  function tabbar() {
    var t = TABS[ui.role]; if (!t || !t.length) return '';
    return '<nav class="tabbar">' + t.map(function (x) {
      return '<button class="' + (x[0] === ui.tab ? 'on' : '') + '" data-act="tab" data-v="' + x[0] + '">' + ic(x[1], 20) + x[2] + '</button>';
    }).join('') + '</nav>';
  }
  function countUp(val, dec, suffix) { return '<span data-count="' + val + '" data-dec="' + (dec || 0) + '" data-suf="' + (suffix || '') + '">' + val + (suffix || '') + '</span>'; }

  /* 折线 + 渐隐面积图。cfg: labels, values(可含 null), lo, hi, invert, refs[{v,t,c}], fmt */
  var gid = 0;
  function areaChart(cfg) {
    var W = 320, H = cfg.h || 180, L = cfg.l || 30, R = 306, T = 22, B = H - 30, n = cfg.labels.length, id = 'g' + (++gid);
    var X = function (i) { return n === 1 ? (L + R) / 2 : L + i * ((R - L) / (n - 1)); };
    var Y = function (v) { var r = (v - cfg.lo) / (cfg.hi - cfg.lo); return cfg.invert ? T + r * (B - T) : B - r * (B - T); };
    var fmt = cfg.fmt || function (v) { return v; };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(cfg.aria || '趋势图') + '"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--pri);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--pri);stop-opacity:0"/></linearGradient></defs>';
    for (var k = 0; k < 4; k++) { var y = T + k * (B - T) / 3; s += '<line class="grid" x1="' + L + '" x2="' + R + '" y1="' + y + '" y2="' + y + '"/>'; }
    (cfg.refs || []).forEach(function (rf) {
      if (rf.v < Math.min(cfg.lo, cfg.hi) || rf.v > Math.max(cfg.lo, cfg.hi)) return;
      var yy = Y(rf.v);
      s += '<line class="ref" x1="' + L + '" x2="' + R + '" y1="' + yy + '" y2="' + yy + '" style="stroke:' + rf.c + '"/><text class="reft" x="' + (L - 4) + '" y="' + (yy + 3) + '" text-anchor="end" style="fill:' + rf.c + '">' + rf.t + '</text>';
    });
    var segs = [], seg = [];
    cfg.values.forEach(function (v, i) { if (v == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push([X(i), Y(v)]); });
    if (seg.length) segs.push(seg);
    segs.forEach(function (sg) {
      var line = sg.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      if (sg.length > 1) s += '<path class="area" d="' + line + ' L' + sg[sg.length - 1][0].toFixed(1) + ' ' + B + ' L' + sg[0][0].toFixed(1) + ' ' + B + ' Z" fill="url(#' + id + ')"/>';
      s += '<path class="ln" pathLength="1" d="' + line + '"/>';
    });
    var lastIdx = -1; cfg.values.forEach(function (v, i) { if (v != null) lastIdx = i; });
    cfg.labels.forEach(function (lb, i) {
      var v = cfg.values[i];
      s += '<text class="ax" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(lb) + '</text>';
      if (v == null) { s += '<text class="na" x="' + X(i) + '" y="' + (B - 4) + '" text-anchor="middle">未测</text>'; return; }
      var bad = cfg.isBad && cfg.isBad(v);
      s += '<circle class="pt' + (bad ? ' bad' : '') + (i === lastIdx ? ' last' : '') + '" cx="' + X(i) + '" cy="' + Y(v) + '" r="' + (i === lastIdx ? 5 : 4) + '"/><text class="pv" x="' + X(i) + '" y="' + (Y(v) - 10) + '" text-anchor="middle">' + fmt(v) + '</text>';
    });
    return s + '</svg>';
  }

  /* ---------- 首页（落地页） ---------- */
  function vHome() {
    var all = st.students, s = stats(curTerm(), all);
    var trend = st.terms.map(function (t) { var x = stats(t, all); return x.n ? pct(x.pass, x.n) : null; });
    var vs = trend.filter(function (v) { return v != null; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), sp = '';
    if (vs.length > 1) {
      var pts = trend.map(function (v, i) { return v == null ? null : [i * (180 / (trend.length - 1)), 34 - (v - lo) / ((hi - lo) || 1) * 28]; }).filter(Boolean);
      sp = '<svg viewBox="-4 0 188 40" width="100%" height="40" preserveAspectRatio="none" aria-hidden="true"><path d="' + pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ') + '" fill="none" stroke="#9be6bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
    }
    var roles = [
      ['teacher', 'pen', '老师', '按班级整班录入，边输边出等级，历史成绩随时改', ['整班录入', '实时等级', '历史修改']],
      ['admin', 'chart', '学校管理员', '达标率、优良率、各班对比一屏看完，名单和标准自己配', ['数据看板', 'CSV 导入导出', '标准可配']],
      ['parent', 'trend', '家长', '孩子每一项成绩的成长曲线，本学期等级一目了然', ['成长曲线', '学期对比']]
    ];
    return '<div class="home">' +
      '<section class="hero">' + lanes(300) +
      '<div class="brand"><span class="mark">' + ic('run', 18, 2) + '</span>校园体育成绩记录系统</div>' +
      '<h1>体测成绩录一次<br><em>三端同时看得到</em></h1>' +
      '<p>老师在手机上整班录入，学校看板实时汇总，家长随时查看孩子的成长曲线。</p>' +
      '<div class="hstats"><div><b class="num">' + countUp(st.students.length) + '</b><span>名学生</span></div><div><b class="num">' + countUp(pct(s.pass, s.n), 1) + '<small>%</small></b><span>本学期达标率</span></div><div><b class="num">' + countUp(st.terms.length) + '</b><span>个学期记录</span></div></div>' +
      (sp ? '<div class="spark"><span>历年达标率</span>' + sp + '<span class="num">' + st.terms[0] + '→' + curTerm() + '</span></div>' : '') +
      '</section>' +
      '<div class="sec"><h2>选一个身份开始体验</h2><div class="label">演示版无需登录，进入后可随时切换身份</div></div>' +
      roles.map(function (c, i) {
        return '<button class="rolecard' + (i === 1 ? ' dark' : '') + '" data-act="role" data-v="' + c[0] + '"><span class="ri">' + ic(c[1], 24) + '</span><span class="rt"><b>我是' + c[2] + '</b><small>' + c[3] + '</small><span class="feats">' + c[4].map(function (f) { return '<span>' + f + '</span>'; }).join('') + '</span></span><span class="arr">' + ic('chev', 18, 2) + '</span></button>';
      }).join('') +
      '<div class="sec"><h2>为学校场景准备的细节</h2></div>' +
      '<div class="why">' +
      '<div><span class="ico">' + ic('sliders', 18) + '</span><p style="margin:0"><b>评分标准可配置</b><span>阈值改了，三端等级立即按新标准重算，不用改代码。</span></p></div>' +
      '<div><span class="ico">' + ic('download', 18) + '</span><p style="margin:0"><b>名单进、成绩出</b><span>从 Excel 粘贴名单批量导入；成绩按年级、学期导出 CSV。</span></p></div>' +
      '<div><span class="ico">' + ic('lock', 18) + '</span><p style="margin:0"><b>数据只在本机</b><span>演示版数据仅存在你的浏览器里，不上传任何服务器。</span></p></div>' +
      '</div>' +
      '<div class="foot"><button class="btn ghost" data-act="reset">' + ic('refresh', 16, 2) + '重置演示数据</button><p>当前 ' + st.grades.length + ' 个年级 · ' + st.classes.length + ' 个班 · ' + st.students.length + ' 名演示学生<br>所有姓名与成绩均为合成数据</p></div>' +
      '</div>';
  }

  /* ---------- 老师端 ---------- */
  function vEntry() {
    var t = ui.t, it = item(t.item), studs = studentsOf(t.cls), c = cls(t.cls);
    var rows = studs.map(function (s, i) {
      var has = Object.prototype.hasOwnProperty.call(t.draft, s.id);
      var raw = has ? t.draft[s.id] : (rec(t.term, s.id, it.k) == null ? '' : rec(t.term, s.id, it.k));
      var pv = parseVal(it, raw), L = level(it, pv.v);
      return '<div class="stu' + (has ? ' dirty' : '') + '" data-sid="' + s.id + '"><div class="av">' + esc(s.name.slice(-1)) + '</div>' +
        '<div class="nm">' + esc(shortName(s.name)) + '<small>' + esc(s.no) + '</small></div>' +
        '<input class="inp' + (pv.bad ? ' err' : '') + '" inputmode="decimal" enterkeyhint="next" data-idx="' + i + '" data-sid="' + s.id + '" value="' + esc(raw) + '" placeholder="—" aria-label="' + esc(s.name) + '成绩">' +
        '<span class="tag ' + (pv.bad ? 't-err' : L.cls) + '">' + (pv.bad ? '有误' : L.text) + '</span></div>';
    }).join('');
    return header('成绩录入') + '<main class="body">' +
      '<div class="card"><div class="row"><span class="eyebrow" style="margin:0">学期</span>' + termSelect(t.term, 'tTerm') + '</div>' +
      '<div class="eyebrow mt">班级</div>' + chips(classOptions(), t.cls, 'tCls') +
      '<div class="eyebrow mt">测试项目</div>' + chips(st.items.map(function (x) { return [x.k, x.s]; }), t.item, 'tItem', 'seg') + '</div>' +
      '<div class="card"><div class="row"><b class="h">' + esc(c ? c.name : '') + ' · ' + esc(it.n) + '<span class="label">（' + esc(it.u) + '）</span></b><span class="label num" id="prog"></span></div>' +
      '<div class="std">' + it.std.map(function (s) { return '<span>' + s[1] + ' ' + (it.hi ? '≥' : '≤') + ' <b>' + s[0] + '</b></span>'; }).join('') + (it.hi ? '' : '<span>越短越好</span>') + '</div>' +
      '<div class="progress"><i id="progBar" style="width:0"></i></div>' +
      (t.term !== curTerm() ? '<div class="hint warn">正在修改历史学期 ' + esc(t.term) + ' 的成绩</div>' : '') +
      '<div style="margin-top:6px">' + (studs.length ? rows : '<div class="empty">本班暂无学生，请管理员在「学生名单」中添加</div>') + '</div></div>' +
      '<div class="savebar"><span class="label" id="live"></span><button class="btn green" data-act="tSave" id="saveBtn">' + ic('check', 18, 2.2) + '保存本班成绩</button></div>' +
      '</main>';
  }
  function updEntryStats() {
    var t = ui.t, it = item(t.item), studs = studentsOf(t.cls), done = 0, pass = 0, bad = 0;
    studs.forEach(function (s) {
      var has = Object.prototype.hasOwnProperty.call(t.draft, s.id);
      var raw = has ? t.draft[s.id] : rec(t.term, s.id, it.k);
      var pv = parseVal(it, raw == null ? '' : raw);
      if (pv.bad) { bad++; return; }
      if (pv.empty) return;
      done++; if (level(it, pv.v).lv >= 1) pass++;
    });
    var pg = document.getElementById('prog'), lv = document.getElementById('live'), pb = document.getElementById('progBar');
    if (pg) pg.textContent = '已录 ' + done + '/' + studs.length;
    if (pb) requestAnimationFrame(function () { pb.style.width = (studs.length ? done / studs.length * 100 : 0) + '%'; });
    var nd = Object.keys(t.draft).length;
    if (lv) lv.innerHTML = (nd ? '<span class="dot"></span> ' + nd + ' 处未保存 · ' : '') + '本项达标 ' + pass + '/' + done + (bad ? ' · <span class="bad">' + bad + ' 个格式有误</span>' : '');
  }
  function saveEntry() {
    var t = ui.t, it = item(t.item), saved = 0, bad = 0, ids = [];
    Object.keys(t.draft).forEach(function (sid) {
      var pv = parseVal(it, t.draft[sid]);
      if (pv.bad) { bad++; return; }
      setRec(t.term, sid, it.k, pv.empty ? null : pv.v); saved++; ids.push(sid);
      delete t.draft[sid];
    });
    persist();
    render();
    ids.forEach(function (sid) { var r = app.querySelector('.stu[data-sid="' + sid + '"]'); if (r) r.classList.add('flash'); });
    var b = document.getElementById('saveBtn');
    if (b && saved && !bad) { b.classList.add('saved'); b.innerHTML = ic('check', 18, 2.4) + '已保存 ' + saved + ' 条'; setTimeout(function () { if (b.isConnected) { b.classList.remove('saved'); b.innerHTML = ic('check', 18, 2.2) + '保存本班成绩'; } }, 1600); }
    if (bad) toast('已保存 ' + saved + ' 条，' + bad + ' 个成绩超出合理范围（' + it.min + '–' + it.max + it.u + '），请检查');
    else toast(saved ? '已保存 ' + saved + ' 条，家长端同步可见' : '没有需要保存的修改', saved);
  }

  function vRecords() {
    var t = ui.t, studs = studentsOf(t.cls), c = cls(t.cls), term = t.recTerm, s = stats(term, studs);
    var head = '<tr><th style="text-align:left;padding-left:4px">学生</th>' + st.items.map(function (it) { return '<th>' + esc(it.s) + '<small>' + esc(it.u) + '</small></th>'; }).join('') + '</tr>';
    var body = studs.map(function (x) {
      return '<tr><td class="tn">' + esc(shortName(x.name)) + '<small>' + esc(x.no) + '</small></td>' + st.items.map(function (it) {
        var v = rec(term, x.id, it.k), L = level(it, v);
        return '<td><button class="cell ' + L.cls + '" data-act="editCell" data-k="' + it.k + '" title="点击修改">' + (v == null ? '—' : v) + '</button></td>';
      }).join('') + '</tr>';
    }).join('');
    return header('本班记录') + '<main class="body">' +
      '<div class="card"><div class="eyebrow">班级</div>' + chips(classOptions(), t.cls, 'tCls') +
      '<div class="eyebrow mt">学期</div>' + chips(st.terms.slice().reverse().map(function (x) { return [x, x]; }), term, 'tRecTerm') + '</div>' +
      '<div class="kpis"><div class="kpi"><b>' + s.tested + '<small style="font-size:13px;color:var(--faint)">/' + s.total + '</small></b><span>已测人数</span></div><div class="kpi"><b>' + fmtPct(s.pass, s.n) + '</b><span>达标率</span></div><div class="kpi"><b>' + fmtPct(s.good, s.n) + '</b><span>优良率</span></div></div>' +
      '<div class="card mt"><div class="row"><b class="h">' + esc(c ? c.name : '') + ' · ' + esc(term) + '</b><span class="label">点成绩可修改</span></div>' +
      (studs.length ? '<div class="tblwrap"><table class="tbl">' + head + body + '</table></div>' : '<div class="empty">本班暂无学生</div>') +
      '<div class="legend"><span class="tag t-bad">不及格</span><span class="tag t-ok">及格</span><span class="tag t-good">良好</span><span class="tag t-best">优秀</span><span class="tag t-none">未测</span></div></div>' +
      '</main>';
  }

  /* ---------- 管理员端 ---------- */
  function scopeStudents(grade) {
    return st.students.filter(function (s) { var c = cls(s.classId); return c && (grade === 'all' || c.grade === grade); });
  }
  function gradeChips(cur, act) {
    return chips([['all', '全校']].concat(st.grades.map(function (g) { return [g.g, g.name]; })), cur, act, 'seg');
  }
  function ring(p) {
    var r = 32, C = 2 * Math.PI * r;
    return '<div class="ring"><svg width="76" height="76" viewBox="0 0 76 76"><circle class="trk" cx="38" cy="38" r="' + r + '" fill="none" stroke-width="8"/><circle class="val" cx="38" cy="38" r="' + r + '" fill="none" stroke-width="8" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '" data-ring="' + (C * (1 - p / 100)).toFixed(2) + '"/></svg></div>';
  }
  function vDash() {
    var a = ui.a, studs = scopeStudents(a.grade), s = stats(a.term, studs);
    var itemRows = st.items.map(function (it) { var b = s.byItem[it.k]; return [it.s, b.pass, b.n]; });
    var classRows = st.classes.filter(function (c) { return a.grade === 'all' || c.grade === a.grade; }).map(function (c) {
      var cs = stats(a.term, studentsOf(c.id)); return [c.name.replace('班', ''), cs.pass, cs.n];
    });
    var trend = st.terms.map(function (t) { var ts = stats(t, studs); return ts.n ? pct(ts.pass, ts.n) : null; });
    var tv = trend.filter(function (v) { return v != null; });
    var lo = Math.max(0, Math.floor((Math.min.apply(null, tv.concat([85])) - 8) / 5) * 5), hi = 100;
    var passP = pct(s.pass, s.n), scope = a.grade === 'all' ? '全校' : gradeName(a.grade);
    return header('体育数据看板') + '<main class="body">' +
      '<div class="card">' + gradeChips(a.grade, 'aGrade') + '<div class="row mt"><span class="label">统计学期</span>' + termSelect(a.term, 'aTerm') + '</div></div>' +
      '<div class="hero-kpi">' + lanes(220) +
      '<div class="top"><div><div class="lbl">' + esc(scope) + ' · ' + esc(a.term) + ' 达标率</div><div class="big" id="kPass">' + (s.n ? countUp(passP, 1) + '<small>%</small>' : '—') + '</div><div class="sub">及格及以上 ' + s.pass + ' / 已测 ' + s.n + ' 人次</div></div>' + ring(passP) + '</div>' +
      '<div class="split"><div><b id="kGood">' + (s.n ? countUp(pct(s.good, s.n), 1, '%') : '—') + '</b><span>优良率（良好+优秀）</span></div><div><b id="kTested">' + countUp(s.tested) + '<small style="font-size:13px;opacity:.6">/' + s.total + '</small></b><span>已测人数</span></div></div></div>' +
      '<div class="card"><div class="card-h"><b class="h">各项目达标率</b><span class="label">按人次</span></div>' + bars(itemRows) + '</div>' +
      '<div class="card"><div class="card-h"><b class="h">各班对比</b><span class="label">综合达标率</span></div>' + bars(classRows) + '</div>' +
      '<div class="card"><div class="card-h"><b class="h">历年学期达标率</b><span class="label">' + esc(scope) + '</span></div>' +
      areaChart({ labels: st.terms, values: trend, lo: lo, hi: hi, l: 30, fmt: function (v) { return v + '%'; }, refs: [{ v: 90, t: '90%', c: 'var(--faint)' }], aria: '历年学期达标率' }) + '</div>' +
      '<p class="label pad">口径：达标率 = 及格及以上的人次 ÷ 已测人次；优良率 = 良好与优秀的人次 ÷ 已测人次；已测人数 = 本学期至少测过一项的学生。低于 85% 的条形标为橙色。</p>' +
      '</main>';
  }
  function vStudents() {
    var a = ui.a, studs = studentsOf(a.stuCls), c = cls(a.stuCls);
    return header('学生名单') + '<main class="body">' +
      '<div class="card"><div class="row"><span class="eyebrow" style="margin:0">选择班级</span><span class="label">全校共 ' + st.students.length + ' 人</span></div>' + chips(classOptions(), a.stuCls, 'aStuCls') + '</div>' +
      '<div class="card"><div class="row"><b class="h">' + esc(c ? c.name : '') + ' · ' + studs.length + ' 人</b></div>' +
      (studs.length ? studs.map(function (s) {
        return '<div class="stu"><div class="av">' + esc(s.name.slice(-1)) + '</div><div class="nm">' + esc(s.name) + '<small>学号 ' + esc(s.no) + '</small></div><button class="mini danger" data-act="delStu" data-v="' + s.id + '">删除</button></div>';
      }).join('') : '<div class="empty">本班暂无学生</div>') + '</div>' +
      '<div class="card"><b class="h">新增学生</b><div class="form2"><input class="inp wide" id="nName" placeholder="姓名" maxlength="20"><input class="inp wide" id="nNo" placeholder="学号" inputmode="numeric" maxlength="12"></div><button class="btn sm" data-act="addStu">添加到 ' + esc(c ? c.name : '') + '</button></div>' +
      '<div class="card"><b class="h">批量导入</b><p class="label" style="margin:6px 0 0">每行一名学生：<code>姓名,学号,班级</code>，班级可省略（导入到当前班）。可直接从 Excel 复制粘贴。</p>' +
      '<textarea id="csv" rows="5" placeholder="姓名,学号,班级&#10;演示学生·小安,3291,三(2)班&#10;演示学生·小白,3292"></textarea>' +
      '<button class="btn sm" data-act="importCsv">导入名单</button>' + (a.importMsg ? '<div class="hint">' + a.importMsg + '</div>' : '') + '</div>' +
      '</main>';
  }
  function normCls(s) { return String(s).replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')').replace(/班$/, ''); }
  function addStudent(name, no, cid) {
    name = String(name || '').trim(); no = String(no || '').trim();
    if (!name) return '姓名为空';
    if (!no) return '学号为空';
    if (st.students.some(function (s) { return s.no === no; })) return '学号 ' + no + ' 已存在';
    st.students.push({ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), classId: cid, name: name.slice(0, 20), no: no.slice(0, 12) });
    return null;
  }
  function importCsv(text) {
    var ok = 0, errs = [];
    String(text).split(/\r?\n/).forEach(function (line, i) {
      if (!line.trim()) return;
      var f = line.split(/[,，\t]/).map(function (x) { return x.trim().replace(/^"|"$/g, ''); });
      if (i === 0 && /姓名/.test(f[0])) return; // 表头
      var cid = ui.a.stuCls;
      if (f[2]) {
        var m = st.classes.filter(function (c) { return normCls(c.name) === normCls(f[2]); })[0];
        if (!m) { errs.push('第' + (i + 1) + '行：找不到班级「' + esc(f[2]) + '」'); return; }
        cid = m.id;
      }
      var e = addStudent(f[0], f[1], cid);
      if (e) errs.push('第' + (i + 1) + '行：' + esc(e)); else ok++;
    });
    if (ok) persist();
    return '成功导入 ' + ok + ' 人' + (errs.length ? '；<span class="bad">' + errs.length + ' 行未导入</span><br>' + errs.slice(0, 6).join('<br>') + (errs.length > 6 ? '<br>…' : '') : '');
  }
  function vStandards() {
    return header('项目与评分标准') + '<main class="body">' +
      '<p class="label pad">修改阈值后，老师端、看板、家长端的等级立即按新标准重新计算（已录成绩不变）。</p>' +
      st.items.map(function (it) {
        return '<div class="card"><div class="row"><b class="h">' + esc(it.n) + '</b><span class="label">' + esc(it.u) + ' · ' + (it.hi ? '越大越好' : '越小越好') + '</span></div>' +
          '<div class="stdgrid">' + it.std.map(function (s, i) {
            return '<label><span class="tag ' + LV[i + 1][1] + '">' + s[1] + ' ' + (it.hi ? '≥' : '≤') + '</span><input class="inp" inputmode="decimal" data-std="' + it.k + '" data-i="' + i + '" value="' + s[0] + '" aria-label="' + esc(it.n + s[1]) + '阈值"></label>';
          }).join('') + '</div></div>';
      }).join('') +
      '<button class="btn green" data-act="saveStd">' + ic('check', 18, 2.2) + '保存评分标准</button><button class="btn ghost mt" data-act="defStd">' + ic('refresh', 16, 2) + '恢复默认标准</button>' +
      '</main>';
  }
  function saveStd() {
    var next = JSON.parse(JSON.stringify(st.items)), err = null;
    app.querySelectorAll('[data-std]').forEach(function (inp) {
      var it = next.filter(function (x) { return x.k === inp.getAttribute('data-std'); })[0];
      var v = Number(inp.value);
      if (inp.value.trim() === '' || !isFinite(v)) err = err || (it.n + '：阈值必须是数字');
      it.std[+inp.getAttribute('data-i')][0] = v;
    });
    if (!err) next.forEach(function (it) {
      var a = it.std.map(function (s) { return s[0]; });
      var okOrder = it.hi ? (a[0] < a[1] && a[1] < a[2]) : (a[0] > a[1] && a[1] > a[2]);
      if (!okOrder) err = err || (it.n + '：' + (it.hi ? '及格 < 良好 < 优秀' : '及格 > 良好 > 优秀（用时越短越好）') + ' 顺序不对');
    });
    if (err) { toast(err); return; }
    st.items = next; persist(); render(); toast('评分标准已保存，各端等级已重新计算', true);
  }
  function exportRows() {
    var a = ui.a, rows = [['学期', '年级', '班级', '学号', '姓名', '项目', '成绩', '单位', '等级']];
    scopeStudents(a.exGrade).slice().sort(function (x, y) { return x.no < y.no ? -1 : 1; }).forEach(function (s) {
      var c = cls(s.classId);
      st.items.forEach(function (it) {
        var v = rec(a.exTerm, s.id, it.k); if (v == null) return;
        rows.push([a.exTerm, gradeName(c.grade), c.name, s.no, s.name, it.n, v, it.u, level(it, v).text]);
      });
    });
    return rows;
  }
  function toCsv(rows) {
    return rows.map(function (r) { return r.map(function (x) { x = String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(','); }).join('\r\n');
  }
  function vExport() {
    var a = ui.a, rows = exportRows(), keep = function (_, i) { return i !== 0 && i !== 1; };
    return header('导出成绩') + '<main class="body">' +
      '<div class="card"><div class="eyebrow">导出范围</div>' + gradeChips(a.exGrade, 'aExGrade') + '<div class="row mt"><span class="label">学期</span>' + termSelect(a.exTerm, 'aExTerm') + '</div></div>' +
      '<div class="card"><div class="row"><b class="h">共 ' + (rows.length - 1) + ' 条成绩</b><span class="label">CSV · Excel 可直接打开</span></div>' +
      '<div class="tblwrap"><table class="tbl small"><tr>' + rows[0].filter(keep).map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>' +
      rows.slice(1, 7).map(function (r) { return '<tr>' + r.filter(keep).map(function (x) { return '<td>' + esc(shortName(x)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table></div>' +
      (rows.length > 7 ? '<div class="label mt">仅预览前 6 条</div>' : '') + '</div>' +
      '<button class="btn green" data-act="dlCsv"' + (rows.length > 1 ? '' : ' disabled') + '>' + ic('download', 18, 2) + '下载 CSV 文件</button><button class="btn ghost mt" data-act="cpCsv"' + (rows.length > 1 ? '' : ' disabled') + '>复制到剪贴板（微信内打开时用）</button>' +
      '<div class="card mt"><b class="h">演示数据</b><p class="label" style="margin:6px 0 12px">恢复为初始的合成演示数据，本机的所有修改会被清除。</p><button class="btn ghost" data-act="reset">' + ic('refresh', 16, 2) + '重置演示数据</button></div>' +
      '</main>';
  }

  /* ---------- 家长端 ---------- */
  function kidChart(it, s) {
    var vals = st.terms.map(function (t) { return rec(t, s.id, it.k); });
    var vs = vals.filter(function (v) { return v != null; });
    if (!vs.length) return '<div class="empty">暂无该项目成绩</div>';
    var passLine = it.std[0][0], bestLine = it.std[2][0];
    var mn = Math.min.apply(null, vs.concat([passLine])), mx = Math.max.apply(null, vs.concat([passLine]));
    var pad = (mx - mn) * 0.18 || 1;
    return areaChart({
      labels: st.terms, values: vals, lo: mn - pad, hi: mx + pad, invert: !it.hi, l: 34,
      refs: [{ v: passLine, t: '及格', c: 'var(--warn)' }, { v: bestLine, t: '优秀', c: 'var(--pri)' }],
      isBad: function (v) { return level(it, v).lv < 1; }, aria: it.n + '成长曲线'
    });
  }
  function vParent() {
    var s = stu(ui.p.stu);
    if (!s) return header('我的孩子') + '<main class="body"><div class="empty">暂无学生，请先在管理员端添加</div></main>';
    var c = cls(s.classId), it = item(ui.p.item), now = curTerm(), prev = st.terms[st.terms.length - 2];
    var opts = classOptions().map(function (cc) {
      return '<optgroup label="' + esc(cc[1]) + '">' + studentsOf(cc[0]).map(function (x) { return '<option value="' + x.id + '"' + (x.id === s.id ? ' selected' : '') + '>' + esc(x.name) + '（' + esc(cc[1]) + '）</option>'; }).join('') + '</optgroup>';
    }).join('');
    var vals = st.terms.map(function (t) { return rec(t, s.id, it.k); }).filter(function (v) { return v != null; });
    var hint = '';
    if (vals.length >= 2) {
      var d = Math.round((vals[vals.length - 1] - vals[0]) * 10) / 10, better = it.hi ? d > 0 : d < 0;
      hint = '从最早一次到最近一次' + (d === 0 ? '持平' : (better ? '进步了 ' : '退步了 ') + '<b class="num">' + Math.abs(d) + '</b> ' + it.u) + (it.hi ? '' : '（用时越短越好）');
    }
    var CL = level(it, rec(now, s.id, it.k));
    var tiles = st.items.map(function (x) {
      var v = rec(now, s.id, x.k), pv = prev ? rec(prev, s.id, x.k) : null, L = level(x, v), dd = '';
      if (v != null && pv != null) {
        var df = Math.round((v - pv) * 10) / 10, up = x.hi ? df > 0 : df < 0;
        dd = df === 0 ? '<span class="d">与上学期持平</span>' : '<span class="d ' + (up ? 'up' : 'down') + '">比上学期 ' + (df > 0 ? '+' : '') + df + '</span>';
      } else dd = '<span class="d">上学期未测</span>';
      return '<button class="tile' + (x.k === it.k ? ' on' : '') + '" data-act="pItem" data-v="' + x.k + '"><div class="t">' + esc(x.n) + '<span class="tag ' + L.cls + '">' + L.text + '</span></div><div class="v">' + (v == null ? '—' : v) + '<small>' + esc(x.u) + '</small></div>' + dd + '</button>';
    }).join('');
    return header('我的孩子') + '<main class="body">' +
      '<div class="kid">' + lanes(200) + '<div class="av big">' + esc(s.name.slice(-1)) + '</div><div style="flex:1;min-width:0;position:relative"><b>' + esc(s.name) + '</b><div class="label">' + esc(gradeName(c.grade)) + ' ' + esc(c.name) + ' · 学号 ' + esc(s.no) + '</div>' +
      '<select class="sel" data-change="pStu" aria-label="选择孩子">' + opts + '</select></div></div>' +
      '<div class="card"><div class="row"><b class="h">' + esc(it.n) + ' 成长曲线<span class="label">（' + esc(it.u) + '）</span></b><span class="tag wide ' + CL.cls + '">本学期 ' + CL.text + '</span></div>' + kidChart(it, s) +
      (hint ? '<div class="label">' + hint + '</div>' : '') + '</div>' +
      '<div class="row" style="padding:4px 4px 10px"><b class="h">本学期（' + now + '）各项</b><span class="label">点卡片切换曲线</span></div>' +
      '<div class="tiles">' + tiles + '</div>' +
      '</main>';
  }

  /* ---------- 渲染与事件 ---------- */
  var lastView = '';
  function render(scrollTop) {
    var html, view = (ui.role || 'home') + '/' + (ui.tab || '');
    if (!ui.role) html = vHome();
    else if (ui.role === 'teacher') html = ui.tab === 'records' ? vRecords() : vEntry();
    else if (ui.role === 'admin') html = ({ dash: vDash, students: vStudents, standards: vStandards, export: vExport })[ui.tab]();
    else html = vParent();
    app.innerHTML = html + tabbar();
    app.className = 'app' + (ui.role && TABS[ui.role].length ? ' has-tab' : '') + (view !== lastView ? ' enter' : '');
    lastView = view;
    document.body.classList.toggle('on-home', !ui.role);
    if (ui.role === 'teacher' && ui.tab === 'entry') updEntryStats();
    animateNumbers();
    if (scrollTop) window.scrollTo(0, 0);
    var q = new URLSearchParams(); if (ui.role) q.set('role', ui.role); if (ui.role && ui.tab && TABS[ui.role].length) q.set('tab', ui.tab);
    try { history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '')); } catch (e) { /* file:// 下部分浏览器不允许 */ }
  }
  function animateNumbers() {
    var els = app.querySelectorAll('[data-count]'), rings = app.querySelectorAll('[data-ring]');
    requestAnimationFrame(function () { rings.forEach(function (r) { r.style.strokeDashoffset = r.getAttribute('data-ring'); }); });
    if (REDUCED) return;
    els.forEach(function (el) {
      var to = +el.getAttribute('data-count'), dec = +el.getAttribute('data-dec'), suf = el.getAttribute('data-suf'), t0 = null;
      function step(ts) {
        if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / 700), e = 1 - Math.pow(1 - k, 3);
        el.textContent = (to * e).toFixed(dec) + suf;
        if (k < 1) requestAnimationFrame(step); else el.textContent = to + suf;
      }
      requestAnimationFrame(step);
    });
  }
  var tt;
  function toast(msg, ok) {
    var t = document.getElementById('toast'); if (!t) return;
    t.innerHTML = (ok ? ic('check', 16, 2.4) : '') + '<span>' + esc(msg) + '</span>'; t.classList.add('show'); clearTimeout(tt);
    tt = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  var ACT = {
    home: function () { if (!guardDraft()) return; ui.role = null; render(true); },
    role: function (v) { ui.role = v; ui.tab = TABS[v].length ? TABS[v][0][0] : null; render(true); },
    tab: function (v) { if (ui.role === 'teacher' && v !== 'entry' && !guardDraft()) return; ui.tab = v; render(true); },
    reset: function () { if (!confirm('确定恢复初始演示数据吗？本机的所有修改会被清除。')) return; st = Store.reset(); ui.t.draft = {}; ui.p.stu = defaultKid(); render(); toast('已恢复初始演示数据', true); },
    tCls: function (v) { if (!guardDraft()) return; ui.t.cls = v; render(); },
    tItem: function (v) { if (!guardDraft()) return; ui.t.item = v; render(); },
    tRecTerm: function (v) { ui.t.recTerm = v; render(); },
    tSave: saveEntry,
    editCell: function (v, el) { ui.t.item = el.getAttribute('data-k'); ui.t.term = ui.t.recTerm; ui.t.draft = {}; ui.tab = 'entry'; render(true); },
    aGrade: function (v) { ui.a.grade = v === 'all' ? 'all' : +v; render(); },
    aExGrade: function (v) { ui.a.exGrade = v === 'all' ? 'all' : +v; render(); },
    aStuCls: function (v) { ui.a.stuCls = v; ui.a.importMsg = ''; render(); },
    addStu: function () {
      var e = addStudent(document.getElementById('nName').value, document.getElementById('nNo').value, ui.a.stuCls);
      if (e) { toast(e); return; } persist(); ui.a.importMsg = ''; render(); toast('已添加', true);
    },
    delStu: function (v) {
      var s = stu(v); if (!s || !confirm('删除「' + s.name + '」？该生的所有成绩记录也会一并删除。')) return;
      st.students = st.students.filter(function (x) { return x.id !== v; });
      st.terms.forEach(function (t) { if (st.records[t]) delete st.records[t][v]; });
      if (ui.p.stu === v) ui.p.stu = defaultKid();
      persist(); render(); toast('已删除', true);
    },
    importCsv: function () { var tx = document.getElementById('csv').value; if (!tx.trim()) { toast('请先粘贴名单'); return; } ui.a.importMsg = importCsv(tx); render(); },
    saveStd: saveStd,
    defStd: function () { if (!confirm('恢复默认评分标准？')) return; st.items = JSON.parse(JSON.stringify(Store.DEFAULT_ITEMS)); persist(); render(); toast('已恢复默认标准', true); },
    dlCsv: function () {
      var a = ui.a, csv = '﻿' + toCsv(exportRows());
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob);
      var link = document.createElement('a'); link.href = url;
      link.download = '体育成绩_' + a.exTerm + '_' + (a.exGrade === 'all' ? '全校' : gradeName(a.exGrade)) + '.csv';
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      toast('已生成 CSV；微信内若无法下载，请用「复制」', true);
    },
    cpCsv: function () {
      var csv = toCsv(exportRows());
      var done = function () { toast('已复制 ' + (exportRows().length - 1) + ' 条，可粘贴到 Excel', true); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(csv).then(done, fallback); else fallback();
      function fallback() { var ta = document.createElement('textarea'); ta.value = csv; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请使用下载'); } ta.remove(); }
    },
    pItem: function (v) { ui.p.item = v; render(); }
  };
  var CHANGE = {
    tTerm: function (v) { if (!guardDraft()) { render(); return; } ui.t.term = v; render(); },
    aTerm: function (v) { ui.a.term = v; render(); },
    aExTerm: function (v) { ui.a.exTerm = v; render(); },
    pStu: function (v) { ui.p.stu = v; render(); }
  };
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.disabled) return;
    var f = ACT[el.getAttribute('data-act')]; if (f) f(el.getAttribute('data-v'), el);
  });
  app.addEventListener('change', function (e) {
    var el = e.target.closest('[data-change]'); if (!el) return;
    CHANGE[el.getAttribute('data-change')](el.value);
  });
  app.addEventListener('input', function (e) {
    var el = e.target; if (!el.matches('.stu .inp[data-sid]')) return;
    var sid = el.getAttribute('data-sid'), it = item(ui.t.item), orig = rec(ui.t.term, sid, it.k);
    var origS = orig == null ? '' : String(orig);
    if (el.value.trim() === origS) delete ui.t.draft[sid]; else ui.t.draft[sid] = el.value;
    var pv = parseVal(it, el.value), L = level(it, pv.v), tag = el.nextElementSibling;
    tag.textContent = pv.bad ? '有误' : L.text; tag.className = 'tag ' + (pv.bad ? 't-err' : L.cls);
    el.classList.toggle('err', !!pv.bad);
    el.closest('.stu').classList.toggle('dirty', Object.prototype.hasOwnProperty.call(ui.t.draft, sid));
    updEntryStats();
  });
  app.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target.matches('.stu .inp[data-idx]')) return;
    e.preventDefault();
    var nx = app.querySelector('.stu .inp[data-idx="' + (+e.target.getAttribute('data-idx') + 1) + '"]');
    if (nx) nx.focus(); else e.target.blur();
  });
  window.addEventListener('beforeunload', function (e) { if (draftDirty()) { e.preventDefault(); e.returnValue = ''; } });

  render();
})();
