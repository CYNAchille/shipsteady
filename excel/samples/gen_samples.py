# -*- coding: utf-8 -*-
"""生成合成示例表（全部为虚构数据：演示员工001…、证件号 DEMO-0001…）。

用法:  python gen_samples.py
输出:  同目录下 4 个示例文件 + samples-data.js（base64 内嵌，供 file:// 直接打开时“加载示例数据”使用）

四张表故意做成格式各不相同：
  一部_10月报销.xlsx  表头在第4行（前面有标题行、空行），中间有空行，末尾合计行，日期为 Excel 日期
  二部_报销.csv        表头在第1行，列顺序不同，金额带 ¥ 和千分位，日期 2026/10/3，含空行、合计行，含 1 条与一部完全相同的重复
  三部费用登记.xlsx    表头在第3行，日期 “2026年10月5日”/“20261006”，金额 “800元”，含 1 条与一部同人同日但金额不同（冲突），1 条缺工号，小计行
  外包补录.xlsx        表头在第1行，无部门列、多一列备注，日期 “2026.10.09”，含重复、日期无法识别、金额无法识别各 1 条
"""
import base64
import csv
import datetime as dt
import json
import os

from openpyxl import Workbook

HERE = os.path.dirname(os.path.abspath(__file__))
D = dt.datetime


def save_xlsx(name, sheet_title, rows, date_cols=()):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_title
    for r in rows:
        ws.append(list(r))
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, dt.datetime):
                c.number_format = "yyyy-mm-dd"
    path = os.path.join(HERE, name)
    wb.save(path)
    return path


def main():
    files = []

    files.append(save_xlsx("一部_10月报销.xlsx", "10月", [
        ["一部 2026年10月 报销明细（合成演示数据）"],
        ["制表：演示部门    单位：元"],
        [],
        ["序号", "员工姓名", "工号", "所属部门", "报销日期", "报销金额(元)"],
        [1, "演示员工001", "DEMO-0001", "一部", D(2026, 10, 2), 356.5],
        [2, "  演示员工002 ", "DEMO-0002", "一部", D(2026, 10, 2), 1200],
        [],
        [3, "演示员工003", "DEMO-0003", "一部", D(2026, 10, 3), 89.9],
        [4, "演示员工004", "DEMO-0004", "一部", D(2026, 10, 5), 450],
        [5, "演示员工005", "DEMO-0005", "一部", D(2026, 10, 6), 2300],
        ["合计", None, None, None, None, 4396.4],
    ]))

    csv_path = os.path.join(HERE, "二部_报销.csv")
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, lineterminator="\r\n")
        w.writerows([
            ["名字", "证件号", "金额", "日期", "部门"],
            ["演示员工006", "DEMO-0006", "¥1,050.00", "2026/10/3", "二部"],
            ["演示员工007", "DEMO-0007", "320", "2026/10/4", "二部"],
            ["演示员工002", "DEMO-0002", "1,200.00", "2026/10/2", "一部"],
            ["演示员工008 ", "DEMO-0008", "¥75.5", "2026/10/7", "二部"],
            ["", "", "", "", ""],
            ["合计", "", "2,645.50", "", ""],
        ])
    files.append(csv_path)

    files.append(save_xlsx("三部费用登记.xlsx", "Sheet1", [
        ["三部费用登记表"],
        ["（合成演示数据，仅供演示）"],
        ["姓名", "员工编号", "部门名称", "发生日期", "费用"],
        ["演示员工009", "DEMO-0009", "三部", "2026年10月5日", "800元"],
        ["演示员工010", "DEMO-0010", "三部", "20261006", 150],
        ["演示员工003", "DEMO-0003", "一部", "2026-10-03", 98.9],
        ["演示员工011", None, "三部", "2026-10-08", 60],
        ["小计", None, None, None, 1108.9],
    ]))

    files.append(save_xlsx("外包补录.xlsx", "补录", [
        ["人员姓名", "ID", "日期", "金额", "备注"],
        ["演示员工012", "DEMO-0012", "2026.10.09", 500, "外包"],
        ["演示员工013", "DEMO-0013", "待补", 260, "日期待确认"],
        ["演示员工006", "DEMO-0006", D(2026, 10, 3), 1050, "重复提交"],
        [],
        ["演示员工014", "DEMO-0014", D(2026, 10, 10), "约300", "金额待确认"],
    ]))

    payload = []
    for p in files:
        with open(p, "rb") as f:
            payload.append({"name": os.path.basename(p), "b64": base64.b64encode(f.read()).decode("ascii")})
    with open(os.path.join(HERE, "samples-data.js"), "w", encoding="utf-8") as f:
        f.write("// 由 gen_samples.py 生成：示例表的 base64 副本（合成演示数据）\n")
        f.write("window.DEMO_SAMPLES = " + json.dumps(payload, ensure_ascii=False) + ";\n")
    print("generated:", *[os.path.basename(p) for p in files], "samples-data.js")


if __name__ == "__main__":
    main()
