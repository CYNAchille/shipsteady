/* 数据层：评分标准、合成演示数据生成、localStorage 读写 */
(function (global) {
  'use strict';
  var STORE_KEY = 'sportsDemo.v1';

  // 评分标准：std = [[阈值, 等级]...]，hi=true 表示数值越大越好
  var DEFAULT_ITEMS = [
    { k: 'jump',  n: '一分钟跳绳', s: '跳绳',   u: '次', hi: true,  min: 0,   max: 300,  dec: 0, std: [[90, '及格'], [120, '良好'], [140, '优秀']] },
    { k: 'run50', n: '50米跑',     s: '50米',   u: '秒', hi: false, min: 5,   max: 20,   dec: 1, std: [[10.8, '及格'], [9.6, '良好'], [9.0, '优秀']] },
    { k: 'lung',  n: '肺活量',     s: '肺活量', u: 'ml', hi: true,  min: 300, max: 6000, dec: 0, std: [[1300, '及格'], [1800, '良好'], [2100, '优秀']] },
    { k: 'sit',   n: '坐位体前屈', s: '体前屈', u: 'cm', hi: true,  min: -20, max: 40,   dec: 1, std: [[2, '及格'], [9, '良好'], [13, '优秀']] }
  ];
  var TERMS = ['2024秋', '2025春', '2025秋', '2026春', '2026秋']; // 最后一个为本学期
  var GRADES = [
    { g: 3, name: '三年级', cn: '三', classes: [7, 6, 8] },
    { g: 4, name: '四年级', cn: '四', classes: [7, 8, 6] },
    { g: 5, name: '五年级', cn: '五', classes: [7, 8] }
  ];
  var NICK = '林陈王李张刘杨黄赵吴周徐孙马朱胡郭何高罗郑梁谢宋唐许韩冯邓曹彭曾萧田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { var u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  function rnd(v, dec) { var p = Math.pow(10, dec); return Math.round(v * p) / p; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function buildSeed() {
    var r = mulberry32(20261024);
    var classes = [], students = [], records = {};
    TERMS.forEach(function (t) { records[t] = {}; });
    var nickIdx = 0;
    GRADES.forEach(function (gr) {
      gr.classes.forEach(function (count, ci) {
        var cid = 'c' + gr.g + (ci + 1);
        classes.push({ id: cid, grade: gr.g, name: gr.cn + '(' + (ci + 1) + ')班' });
        for (var j = 0; j < count; j++) {
          var sid = 's' + gr.g + (ci + 1) + String(j + 1).padStart(2, '0');
          students.push({
            id: sid, classId: cid,
            name: '演示学生·小' + NICK[nickIdx++ % NICK.length],
            no: String(gr.g) + (ci + 1) + String(j + 1).padStart(2, '0')
          });
          var base = gauss(r) * 0.8;
          var abil = {
            jump: base + gauss(r) * 0.6, run50: base + gauss(r) * 0.6,
            lung: base + gauss(r) * 0.6, sit: gauss(r) * 0.9
          };
          var growth = 0.8 + r() * 0.5;
          TERMS.forEach(function (term, ti) {
            var ae = (gr.g - 4) + (ti - (TERMS.length - 1)) * 0.45 * growth; // 相对四年级本学期的“年龄效应”
            var vals = {
              jump: clamp(rnd(124 + 10 * ae + 20 * abil.jump + gauss(r) * 6, 0), 30, 220),
              run50: clamp(rnd(9.75 - 0.28 * ae - 0.5 * abil.run50 + gauss(r) * 0.2, 1), 7.2, 13.5),
              lung: clamp(Math.round((1820 + 150 * ae + 270 * abil.lung + gauss(r) * 80) / 10) * 10, 600, 3600),
              sit: clamp(rnd(9 + 0.7 * ae + 4.2 * abil.sit + gauss(r) * 1.2, 1), -8, 24)
            };
            var row = {};
            Object.keys(vals).forEach(function (k) {
              var current = ti === TERMS.length - 1;
              if (current) {
                // 本学期部分项目尚未测：三(2)班肺活量整体待录，其余约 8% 随机缺测
                if (cid === 'c32' && k === 'lung') return;
                if (r() < 0.08) return;
              } else if (r() < 0.03) return;
              row[k] = vals[k];
            });
            records[term][sid] = row;
          });
        }
      });
    });
    return {
      v: 1, seededAt: new Date().toISOString(),
      items: clone(DEFAULT_ITEMS), terms: TERMS.slice(), grades: GRADES.map(function (g) { return { g: g.g, name: g.name }; }),
      classes: classes, students: students, records: records
    };
  }

  var Store = {
    DEFAULT_ITEMS: DEFAULT_ITEMS,
    load: function () {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) { var o = JSON.parse(raw); if (o && o.v === 1 && o.students) return o; }
      } catch (e) { /* 存储不可用时退化为内存数据 */ }
      var s = buildSeed(); Store.save(s); return s;
    },
    save: function (s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); return true; } catch (e) { return false; } },
    reset: function () { var s = buildSeed(); Store.save(s); return s; }
  };
  global.Store = Store;
})(window);
