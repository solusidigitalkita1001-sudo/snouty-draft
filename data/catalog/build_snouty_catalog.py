"""
build_snouty_catalog.py
Mengubah export ERP Pralon (master_product_updated.xlsx) menjadi:
  1. snouty_catalog_import_inch.csv  -> siap diimpor (kontrak CATALOG_IMPORT_COLUMNS, 0 galat validator)
  2. snouty_catalog_review.xlsx       -> ringkasan, baris impor, baris mm (pending), baris ditolak, kamus family

Prinsip (mengikuti kebijakan SNOUTY):
  - Spesifikasi hanya diisi bila tertulis EKSPLISIT di nama produk ERP -> VERIFIED dengan rujukan baris export.
  - Kolom tambahan di export (material "asumsi", recommended_temp, kelas, tipe) TIDAK dipakai.
  - Ukuran mm belum didukung PipeSize -> dipisah ke sheet pending_mm (sudah diparse, siap setelah skema diperluas).
  - Tidak ada compatible_skus (harus dari tabel resmi, bukan kesamaan ukuran).

Pemakaian: python build_snouty_catalog.py master_product_updated.xlsx [out_dir]
"""
import re
import sys
from fractions import Fraction
from pathlib import Path

import pandas as pd

SOURCE_FILE_LABEL = "Export ERP master_product_updated.xlsx (diunduh 2026-10-06)"
EXPORT_DATE = "2026-10-06"

IMPORT_COLUMNS = [
    "sku", "name", "family", "category", "source_page", "source_document", "description", "status",
    "image_url", "sizes", "compatible_skus", "documents", "images",
    "material", "standard", "pressure_class", "rod_length", "joint_type", "application",
]

COLORS = ["Abu", "Putih", "Coklat", "Orange", "Hitam", "Biru", "Kuning", "Hijau", "Merah", "Ungu", "Abu-abu"]
NON_PLUMBING = re.compile(r"tempat makan|gantungan|welding rod", re.I)


# ---------------------------------------------------------------- cleaning
def fix_text(s):
    if not isinstance(s, str):
        return s
    try:
        s = s.encode("cp1252").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        for bad, good in [("â‰¤", "≤"), ("Â°", "°"), ("Âº", "º"), ("Â±", "±"), ("Ëš", "˚"), ("Â", "")]:
            s = s.replace(bad, good)
    return re.sub(r"\s+", " ", s).strip()


def fix_weight(raw):
    """Export mencampur teks '0.649' (titik desimal) dengan angka 1304 (koma desimal terbaca ribuan)."""
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None, ""
    if isinstance(raw, str):
        return float(raw.replace(",", ".")), "teks bertitik desimal"
    v = float(raw)
    if v == int(v) and v >= 1000:
        return v / 1000.0, "dikoreksi /1000 (koma desimal terbaca ribuan)"
    return v, ""


# ---------------------------------------------------------------- sizes
INCH_RE = re.compile(r'(?<![\w.])(\d+\s+\d+/\d+|\d+/\d+|\d+(?:[.,]\d+)?)\s*(?:"|\'\')')
MM_RE = re.compile(r"(?<![\w.])((?:\d+(?:[.,]\d+)?\s*x\s*)*\d+(?:[.,]\d+)?)\s*mm(?![a-wyz])", re.I)
ODID_RE = re.compile(r"\b(\d{2,3})/(\d{2,3})\b")


def inch_value(tok):
    tok = tok.replace(",", ".").strip()
    parts = tok.split()
    for part in parts:
        if "/" in part:
            num, den = part.split("/")
            if int(num) >= int(den):  # mis. '21/2' -> ambigu (2 1/2? 21/2?), jangan ditebak
                raise ValueError(f"pecahan ambigu: {part}")
    return float(sum(Fraction(p) if "/" in p else Fraction(p) for p in parts))


def inch_label(tok):
    """Bentuk sel yang diterima PipeSize.parse: '1/2', '1 1/4', '3'."""
    return re.sub(r"\s+", " ", tok.replace(",", ".")).strip()


def parse_sizes(name):
    inch = [inch_label(t) for t in INCH_RE.findall(name)]
    if inch:
        return "inch", inch
    mm = []
    for grp in MM_RE.findall(name):
        mm += [p.strip().replace(",", ".") for p in re.split(r"\s*x\s*", grp)]
    if mm:
        return "mm", mm
    m = ODID_RE.search(name)
    if m and re.search(r"HDPE", name, re.I):
        return "mm", [m.group(1)]  # OD/ID -> OD
    return None, []


def dedupe_sorted(values, unit):
    key = inch_value if unit == "inch" else (lambda x: float(x))
    seen, out = set(), []
    for v in sorted(values, key=key):
        k = key(v)
        if k not in seen:
            seen.add(k)
            out.append(v)
    return out


# ---------------------------------------------------------------- name parsing
PIPE_SERIES_RE = re.compile(r"(?<![\w-])(AW|VP|VU|D|C)(?![\w-])")
FITTING_SERIES_RE = re.compile(r" - (AW|D|C|W)\b")
S_RE = re.compile(r"\bS-(\d+(?:\.\d+)?)\b")
PN_RE = re.compile(r"PN\s*-?\s*(\d+(?:[.,]\d+)?)", re.I)
SDR_RE = re.compile(r"SDR\s*-?\s*(\d+(?:[.,]\d+)?)", re.I)
LEN_RE = re.compile(r"x\s*(\d+(?:[.,]\d+)?)\s*(?:meter|m)\b", re.I)
END_RE = re.compile(r"\((Plain|TS|Bell)\s*End\s*\)", re.I)


def parse_name(name):
    p = {}
    is_pipe = name.lower().startswith("pipa")
    is_pe = bool(re.search(r"\b(HDPE|MDPE|PE)\b", name))
    p["product_type"] = "pipa" if is_pipe else "fitting"
    p["unit"], p["sizes"] = parse_sizes(name)
    p["size_error"] = ""
    if p["sizes"]:
        try:
            p["sizes"] = dedupe_sorted(p["sizes"], p["unit"])
        except ValueError as e:
            p["size_error"] = f"Ukuran ambigu di nama produk ({e})"
            p["sizes"] = []

    color = next((c for c in COLORS if re.search(rf"\b{c}\b", name)), "")
    p["color"] = color

    # series / kelas tekanan, hanya token yang tertulis
    series, pn, sdr = "", "", ""
    m = PN_RE.search(name)
    pn = f"PN {m.group(1).replace(',', '.')}" if m else ""
    m = SDR_RE.search(name)
    sdr = f"SDR {m.group(1).replace(',', '.')}" if m else ""
    if is_pipe:
        m = PIPE_SERIES_RE.search(name)
        series = m.group(1) if m else ""
    else:
        m = FITTING_SERIES_RE.search(name)
        series = m.group(1) if m else ""
    p["series_token"] = series
    m = S_RE.search(name)
    s_series = f"S-{m.group(1)}" if m else ""
    pressure = [x for x in [series if series in ("AW", "D", "C", "VP", "VU") else "", s_series, pn, sdr] if x]
    p["pressure_class"] = " · ".join(pressure)

    # panjang batang (pipa)
    p["rod_length"] = ""
    if is_pipe:
        m = LEN_RE.search(name)
        if m:
            v = float(m.group(1).replace(",", "."))
            p["rod_length"] = f"{v:g} m"

    # sambungan / ujung (pipa)
    m = END_RE.search(name)
    joint = f"{m.group(1).capitalize() if m.group(1).upper() != 'TS' else 'TS'} end" if m else ""
    if not joint and is_pipe and re.search(r"\bThread\b", name):
        joint = "Thread"
    p["joint_type"] = joint

    # material: hanya bila tertulis
    m = re.search(r"\b(HDPE|MDPE)\b", name)  # FRP di nama fitting tidak jelas bagian mana -> tidak diklaim
    p["material"] = m.group(1) if m else ""

    # family (taksonomi matcher)
    if is_pipe:
        if re.search(r"jacking", name, re.I):
            fam = "PIPA JACKING"
        elif re.search(r"\bMDPE\b", name):
            fam = "MDPE"
        elif re.search(r"\bHDPE\b", name):
            fam = "HDPE"
        elif re.search(r"High Impact Conduit|\bHIC\b", name, re.I):
            fam = "PVC HIC"
        elif S_RE.search(name):
            fam = f"PVC S-{S_RE.search(name).group(1)}"
        elif series in ("AW", "D", "C", "VP", "VU"):
            fam = f"PVC {series}"
        else:
            m = re.search(r"Kelas\s+([A-Z])|Type\s+(I{1,3}V?|IV)", name)
            fam = f"PVC SNI KELAS {m.group(1)}" if m and m.group(1) else (f"PVC SNI TYPE {m.group(2)}" if m else "")
    else:
        fam = "FITTING FRP" if re.search(r"\bFRP\b", name) else ("FITTING HDPE" if is_pe else "FITTING PVC")
    p["family"] = fam

    # jenis fitting / caption
    core = name
    core = re.sub(r"\(.*?\)", " ", core)
    core = INCH_RE.sub(" ", core)
    core = MM_RE.sub(" ", core)
    core = re.sub(r"x\s*\d+(?:[.,]\d+)?\s*(?:meter|m|cm)\b", " ", core, flags=re.I)
    core = re.sub(r" - (AW|D|C|W)\b", " ", core)
    core = re.sub(r"\b(" + "|".join(COLORS) + r")\b", " ", core)
    core = re.sub(r"\b(Ts|TS|Dv|DV|PE|HDPE|PN\s*-?\s*\d+(?:[.,]\d+)?)\b", " ", core)
    core = re.sub(r"[\s\-x]+$", "", re.sub(r"\s+", " ", core)).strip(" -")
    p["kind_label"] = core
    if is_pipe:
        cat = (fam if fam.startswith("PIPA") else f"PIPA {fam}") + (f" · {joint.upper()}" if joint else "")
    else:
        cat = f"FITTING · {core.upper()}" if core else "FITTING"
    p["category"] = cat[:120]
    return p


# ---------------------------------------------------------------- validator (cermin catalog-import.validator.ts)
def validate_row(r, seen_skus):
    issues = []
    for col in ["sku", "name", "family", "category", "source_page"]:
        if not str(r.get(col, "")).strip():
            issues.append(f"Kolom `{col}` wajib diisi.")
    try:
        if int(r["source_page"]) <= 0:
            raise ValueError
    except (ValueError, TypeError):
        issues.append("source_page harus bilangan bulat positif.")
    for col in ["sku", "name", "family", "category", "material", "standard", "pressure_class",
                "rod_length", "joint_type", "application"]:
        if ";" in str(r.get(col, "")):
            issues.append(f"Kolom `{col}` hanya menerima satu nilai.")
    for col, n in [("sku", 64), ("name", 160), ("family", 80), ("category", 120)]:
        if len(str(r.get(col, ""))) > n:
            issues.append(f"Kolom `{col}` melebihi {n} karakter.")
    for s in [x for x in str(r.get("sizes", "")).split(";") if x.strip()]:
        try:
            v = inch_value(s)
            if not (0 < v <= 100):
                raise ValueError
        except Exception:
            issues.append(f"Ukuran tidak terbaca: {s.strip()}")
    k = str(r["sku"]).lower()
    if k in seen_skus:
        issues.append(f"SKU `{r['sku']}` sudah dipakai di baris {seen_skus[k]}.")
    return issues


# ---------------------------------------------------------------- main
def build(src, out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw = pd.read_excel(src, dtype=object)
    raw.columns = [fix_text(c) for c in raw.columns]

    imp, mm_rows, rejected, seen = [], [], [], {}
    for i, row in raw.iterrows():
        excel_row = i + 2  # header = baris 1
        name = fix_text(row["product_name"])
        sku = str(row["id"]).strip()
        weight, weight_note = fix_weight(row["weight"])
        p = parse_name(name)

        base_review = {
            "excel_row": excel_row, "sku": sku, "name": name, "erp_class": row["class"],
            "family": p["family"], "product_type": p["product_type"], "kind_label": p["kind_label"],
            "series_token": p["series_token"], "pressure_class": p["pressure_class"],
            "rod_length": p["rod_length"], "joint_type": p["joint_type"], "material": p["material"],
            "color": p["color"], "weight_kg": weight, "weight_note": weight_note,
            "sku_is_erp_code": "tidak" if sku.startswith(("__export__", "product:")) else "ya",
        }

        reason = ""
        if NON_PLUMBING.search(name):
            reason = "Bukan produk perpipaan"
        elif p["size_error"]:
            reason = p["size_error"]
        elif not p["sizes"]:
            reason = "Ukuran tidak terbaca dari nama produk"
        elif not p["family"]:
            reason = "Family tidak bisa ditentukan dari nama (series/kelas tidak tertulis)"
        if reason:
            rejected.append({**base_review, "unit": p["unit"] or "", "sizes": "; ".join(p["sizes"]),
                             "alasan": reason})
            continue

        if p["unit"] == "mm":
            mm_rows.append({**base_review, "unit": "mm", "sizes_mm": "; ".join(p["sizes"]),
                            "category": p["category"]})
            continue

        rec = {c: "" for c in IMPORT_COLUMNS}
        rec.update({
            "sku": sku, "name": name, "family": p["family"], "category": p["category"],
            "source_page": excel_row, "source_document": SOURCE_FILE_LABEL,
            "description": f"Warna: {p['color']}" if p["color"] else "",
            "sizes": "; ".join(p["sizes"]),
            "material": p["material"], "pressure_class": p["pressure_class"],
            "rod_length": p["rod_length"], "joint_type": p["joint_type"],
        })
        issues = validate_row(rec, seen)
        if issues:
            rejected.append({**base_review, "unit": "inch", "sizes": rec["sizes"], "alasan": " | ".join(issues)})
            continue
        seen[sku.lower()] = excel_row
        imp.append(rec)
        base_review["sizes"] = rec["sizes"]

    imp_df = pd.DataFrame(imp, columns=IMPORT_COLUMNS)
    mm_df = pd.DataFrame(mm_rows)
    rej_df = pd.DataFrame(rejected)
    imp_df.to_csv(out_dir / "snouty_catalog_import_inch.csv", index=False, encoding="utf-8")
    return raw, imp_df, mm_df, rej_df


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "master_product_updated.xlsx"
    out = sys.argv[2] if len(sys.argv) > 2 else "."
    raw, imp, mm, rej = build(src, out)
    print(f"total {len(raw)} | impor inci {len(imp)} | pending mm {len(mm)} | ditolak {len(rej)}")


# ---------------------------------------------------------------- review workbook
MATCHER_FAMILIES = {"PVC AW", "PVC D", "HDPE", "FITTING PVC"}


def write_review(raw, imp, mm, rej, path):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter

    wb = Workbook()
    hdr_font = Font(name="Arial", bold=True, color="FFFFFF")
    hdr_fill = PatternFill("solid", start_color="1F4E78")
    base = Font(name="Arial", size=10)

    def sheet(ws, df, widths=None):
        ws.append(list(df.columns))
        for row in df.itertuples(index=False):
            ws.append([None if (isinstance(v, float) and pd.isna(v)) else v for v in row])
        for c in ws[1]:
            c.font, c.fill = hdr_font, hdr_fill
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.font = base
        for i, col in enumerate(df.columns, 1):
            w = (widths or {}).get(col) or min(max(len(str(col)), *(len(str(v)) for v in df[col].head(300))) + 2, 60)
            ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = "A2"
        ws.auto_filter.ref = ws.dimensions

    # --- Ringkasan
    ws = wb.active
    ws.title = "Ringkasan"
    bold = Font(name="Arial", bold=True, size=10)
    title = Font(name="Arial", bold=True, size=13)
    ws["A1"] = "Katalog SNOUTY dari export ERP Pralon"
    ws["A1"].font = title
    ws["A2"] = f"Sumber: {SOURCE_FILE_LABEL}. source_page = nomor baris di file export (header = baris 1)."
    ws["A2"].font = base
    rows = [
        ("Total baris export", len(raw)),
        ("Siap impor (ukuran inci)", "=COUNTA(import_inch!A:A)-1"),
        ("Pending (ukuran mm, menunggu perluasan PipeSize)", "=COUNTA(pending_mm!A:A)-1"),
        ("Ditolak", "=COUNTA(ditolak!A:A)-1"),
        ("Cek: jumlah = total", "=IF(B5+B6+B7=B4,\"OK\",\"SELISIH\")"),
    ]
    ws["A3"], ws["A3"].font = "Ringkasan", bold
    for i, (k, v) in enumerate(rows, start=4):
        ws.cell(i, 1, k).font = base
        ws.cell(i, 2, v).font = base

    ws["A10"], ws["A10"].font = "Family", bold
    for col, t in zip("BCDE", ["Siap impor", "Pending mm", "Dikenal matcher hari ini?", "Catatan"]):
        ws[f"{col}10"], ws[f"{col}10"].font = t, bold
    fams = sorted(set(imp.family) | set(mm.family))
    for j, f in enumerate(fams, start=11):
        ws.cell(j, 1, f).font = base
        ws.cell(j, 2, f'=COUNTIF(import_inch!C:C,A{j})').font = base
        ws.cell(j, 3, f'=COUNTIF(pending_mm!F:F,A{j})').font = base
        ws.cell(j, 4, "ya" if f in MATCHER_FAMILIES else "belum").font = base
    last = 10 + len(fams)
    ws.cell(last + 1, 1, "Total").font = bold
    ws.cell(last + 1, 2, f"=SUM(B11:B{last})").font = bold
    ws.cell(last + 1, 3, f"=SUM(C11:C{last})").font = bold
    ws.column_dimensions["A"].width = 52
    for c in "BCD":
        ws.column_dimensions[c].width = 22

    n = last + 4
    ws.cell(n, 1, "Catatan penting").font = bold
    notes = [
        "Spesifikasi hanya diisi bila tertulis eksplisit di nama produk ERP (AW/D/C/VP/VU, S-x, PN, SDR, panjang, ujung pipa, HDPE/MDPE). Sisanya kosong -> UNAVAILABLE.",
        "Kolom export material/recommended_temp/kelas/tipe (berisi 'asumsi') sengaja tidak dipakai.",
        "Token seri fitting 'W', 'Ts', 'Dv' tidak dimasukkan ke pressure_class karena artinya belum terverifikasi; tersimpan di kolom series_token untuk review.",
        "compatible_skus kosong: kompatibilitas harus dari tabel resmi, bukan kesamaan ukuran.",
        "Fitting reducer/tee mencantumkan semua ukurannya di `sizes` (seperti katalog contoh), sehingga bisa cocok untuk kebutuhan ukuran cabang.",
        "Satu kebutuhan bisa cocok ke beberapa SKU (panjang 4/5.8/6 m, warna). Cek perilaku matcher saat kandidat > 1.",
        "Berat (weight_kg) tidak ada di skema SNOUTY; disimpan di sheet review saja, sudah dikoreksi format desimalnya.",
    ]
    for k, t in enumerate(notes, start=n + 1):
        c = ws.cell(k, 1, f"- {t}")
        c.font = base
        c.alignment = Alignment(wrap_text=False)

    sheet(wb.create_sheet("import_inch"), imp)
    mm_cols = ["excel_row", "sku", "name", "erp_class", "unit", "family", "sizes_mm", "category", "pressure_class",
               "rod_length", "joint_type", "material", "series_token", "color", "weight_kg", "weight_note",
               "sku_is_erp_code"]
    mm2 = mm[mm_cols].copy()
    # family di kolom F agar COUNTIF ringkasan konsisten
    sheet(wb.create_sheet("pending_mm"), mm2)
    rej_cols = ["excel_row", "sku", "name", "erp_class", "alasan", "unit", "sizes", "family", "series_token"]
    sheet(wb.create_sheet("ditolak"), rej[rej_cols])

    kam = pd.DataFrame({
        "family": fams,
        "dikenal_matcher": ["ya" if f in MATCHER_FAMILIES else "belum" for f in fams],
        "aturan_penentuan": [family_rule(f) for f in fams],
    })
    sheet(wb.create_sheet("kamus_family"), kam)
    wb.save(path)


def family_rule(f):
    if f.startswith("FITTING"):
        return {"FITTING PVC": "Bukan 'Pipa…', tanpa token PE/HDPE/FRP",
                "FITTING HDPE": "Bukan 'Pipa…', ada token PE/HDPE/MDPE",
                "FITTING FRP": "Bukan 'Pipa…', ada token FRP"}[f]
    if f.startswith("PVC S-"):
        return "Pipa dengan token seri ISO 'S-x' di nama"
    if f.startswith("PVC SNI"):
        return "Pipa dengan 'Kelas A/B' atau 'Type I/II/III' di nama"
    return {"PVC AW": "Pipa dengan token AW", "PVC D": "Pipa dengan token D", "PVC C": "Pipa dengan token C",
            "PVC VP": "Pipa dengan token VP", "PVC VU": "Pipa dengan token VU", "HDPE": "Pipa dengan token HDPE",
            "MDPE": "Pipa dengan token MDPE", "PVC HIC": "Pipa High Impact Conduit / HIC",
            "PIPA JACKING": "Pipa dengan kata Jacking"}.get(f, "")


def write_mm_import(mm, path):
    """Format impor untuk SETELAH PipeSize mendukung mm (lihat PIPE_SIZE_MM_EXTENSION.md). Sel ukuran: '63 mm; 110 mm'."""
    rows = []
    for _, r in mm.iterrows():
        rec = {c: "" for c in IMPORT_COLUMNS}
        rec.update({
            "sku": r["sku"], "name": r["name"], "family": r["family"], "category": r["category"],
            "source_page": r["excel_row"], "source_document": SOURCE_FILE_LABEL,
            "description": f"Warna: {r['color']}" if r["color"] else "",
            "sizes": "; ".join(f"{s:g} mm" if isinstance(s, float) else f"{s} mm" for s in str(r["sizes_mm"]).split("; ")),
            "material": r["material"], "pressure_class": r["pressure_class"],
            "rod_length": r["rod_length"], "joint_type": r["joint_type"],
        })
        rows.append(rec)
    pd.DataFrame(rows, columns=IMPORT_COLUMNS).to_csv(path, index=False, encoding="utf-8")
