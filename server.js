const express = require("express");
const cors = require("cors");
const multer = require("multer");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const LOGO_B64 = fs.readFileSync(path.join(__dirname, "logo_b64.txt"), "utf-8").trim();
const LOGO_URI = `data:image/png;base64,${LOGO_B64}`;

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "Haneen Al Sharq CV Generator", version: "2.0.0" });
});

// ─── Generate CV ────────────────────────────────────────────────
app.post(
  "/api/generate-cv",
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "fullPhoto", maxCount: 1 },
    { name: "passportScan", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const data = JSON.parse(req.body.data || "{}");

      const toUri = (f) => {
        if (!f || !f[0]) return PH;
        return `data:${f[0].mimetype};base64,${f[0].buffer.toString("base64")}`;
      };

      const profileB64 = toUri(req.files?.profilePhoto);
      const fullPhotoB64 = toUri(req.files?.fullPhoto);
      const passportB64 = toUri(req.files?.passportScan);

      const html = buildHTML(data, LOGO_URI, profileB64, fullPhotoB64, passportB64);

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      await browser.close();

      // Filename: FullName_PassportNumber.pdf
      const safeName = (data.fullName || "CV").replace(/\s+/g, "_");
      const pp = data.passportNumber || "PP";
      const filename = `${safeName}_${pp}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdf);
    } catch (err) {
      console.error("PDF error:", err);
      res.status(500).json({ error: "Failed to generate PDF", details: err.message });
    }
  }
);

// Placeholder
const PH = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPk3KFb2AAAAABJRU5ErkJggg==";

// ─── Translations ───────────────────────────────────────────────
const T = {
  nat: { Uganda: "أوغندا", Kenya: "كينيا", Philippines: "الفلبين", India: "الهند", Ethiopia: "إثيوبيا", Bangladesh: "بنغلاديش" },
  rel: { Muslim: "مسلم/ة", Christian: "مسيحي/ة" },
  mar: { Single: "أعزب/عزباء", Married: "متزوج/ة", Divorced: "مطلق/ة", Widowed: "أرمل/ة" },
  gen: { Male: "ذكر", Female: "أنثى" },
  prof: { "Domestic Worker": "عاملة منزلية", "Private Driver": "سائق خاص" },
  edu: { Primary: "ابتدائي", Secondary: "ثانوي", "High School": "ثانوية عامة", Diploma: "دبلوم", Bachelor: "بكالوريوس", None: "لا يوجد" },
  lang: { Poor: "ضعيف", Fair: "مقبول", Good: "جيد", Excellent: "ممتاز", Fluent: "بطلاقة" },
  sk: { Poor: "ضعيف", Good: "جيد", "Very Good": "جيد جداً", Excellent: "ممتاز" },
  skN: { Poor: 1, Good: 2, "Very Good": 3, Excellent: 4 },
};
const tr = (m, v) => T[m]?.[v] || v;

// ─── Build Full HTML ────────────────────────────────────────────
function buildHTML(d, logo, profile, fullPhoto, passport) {
  const pd="#3D1A5C", pm="#5B2D8E", pa="#9B6FC2", nv="#1A1A3E", gd="#C9A84C";
  const dk="#1a1a1a", md="#555", lt="#E0E0E8", bg="#F4F4F8", wt="#FFF";
  const gn="#2E7D32", rd="#C62828";

  const nat = d.nationality || "";
  const med = d.medicalFit === true || d.medicalFit === "true" || d.medicalFit === "Yes";

  // Skill bar
  const sBar = (lv) => {
    const n = T.skN[lv] || 0;
    let h = "";
    for (let i = 0; i < 4; i++) h += `<span style="display:inline-block;width:18px;height:7px;background:${i<n?pm:lt};border-radius:2px;margin-left:2px;"></span>`;
    return `<span style="direction:ltr;display:inline-flex;">${h}</span>`;
  };

  // Compact info row
  const row = (ar, en, val) => `<tr>
    <td style="padding:2.5px 7px;font-size:9.5px;background:${bg};width:36%;border-bottom:1px solid ${wt};line-height:1.25;">
      <b style="color:${dk};">${ar}</b> <span style="font-size:7px;color:#999;">${en}</span>
    </td>
    <td style="padding:2.5px 7px;font-size:10px;font-weight:600;color:${dk};border-bottom:1px solid ${lt};line-height:1.25;">${val}</td>
  </tr>`;

  // Skills
  const skills = [
    ["cleaning","التنظيف","Cleaning"],["cooking","الطبخ","Cooking"],
    ["arabicCooking","الطبخ العربي","Arabic Cooking"],["washing","الغسيل","Washing"],
    ["ironing","الكي","Ironing"],["babysitting","رعاية الأطفال","Babysitting"],
    ["childrenCare","العناية بالأطفال","Children Care"],["tutoring","التدريس","Tutoring"],
    ["disabledCare","رعاية ذوي الاحتياجات","Disabled Care"],
  ];
  const sk = d.skills || {};
  let skRows = "";
  for (const [k,ar,en] of skills) {
    const lv = sk[k] || "Poor";
    skRows += `<tr>
      <td style="padding:2px 4px;font-size:8.5px;color:${dk};border-bottom:1px solid ${lt};line-height:1.2;">
        <b>${ar}</b><br><span style="font-size:6px;color:${md};">${en}</span>
      </td>
      <td style="padding:2px 2px;border-bottom:1px solid ${lt};text-align:center;">${sBar(lv)}</td>
      <td style="padding:2px 2px;font-size:7px;color:${pm};border-bottom:1px solid ${lt};text-align:center;font-weight:700;">${tr("sk",lv)}</td>
    </tr>`;
  }

  // Experience
  const exps = d.experienceAbroad || [];
  let expRows = "";
  if (exps.length > 0) {
    for (const e of exps) expRows += `<tr>
      <td style="padding:2.5px 6px;font-size:8.5px;border-bottom:1px solid ${lt};">${e.country||""}</td>
      <td style="padding:2.5px 6px;font-size:8.5px;border-bottom:1px solid ${lt};">${e.period||""} سنة</td>
      <td style="padding:2.5px 6px;font-size:8.5px;border-bottom:1px solid ${lt};">${e.position||""}</td>
    </tr>`;
  } else {
    expRows = `<tr><td colspan="3" style="padding:3px;font-size:8.5px;color:${md};text-align:center;">لا يوجد خبرة سابقة / No previous experience</td></tr>`;
  }

  // Section header
  const sec = (ar, en) => `<div style="font-size:10px;font-weight:800;color:${pd};padding:2px 0;margin:3px 0 1px;border-bottom:2px solid ${pm};">
    ${ar} <span style="font-size:7.5px;color:${md};font-weight:400;">${en}</span>
  </div>`;

  // Tag pill
  const pill = (label, val, hl) => hl
    ? `<span style="background:${pm};border-radius:12px;padding:1.5px 9px;font-size:8px;color:${wt};font-weight:700;">${val}</span>`
    : `<span style="background:${wt};border:1px solid ${lt};border-radius:12px;padding:1.5px 9px;font-size:8px;"><span style="color:#999;font-size:7px;">${label}</span> <b style="color:${pd};">${val}</b></span>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo',sans-serif; background:${wt}; color:${dk}; }
  .page { width:210mm; min-height:297mm; position:relative; overflow:hidden; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
</style>
</head>
<body>

<!-- ═══════════ PAGE 1: ALL DATA ═══════════ -->
<div class="page">

  <!-- HEADER: compact with phones + address -->
  <div style="background:linear-gradient(135deg,${pd},${pm});padding:6px 16px;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:8px;">
      <img src="${logo}" style="height:36px;" />
      <div>
        <div style="color:${wt};font-size:13px;font-weight:800;line-height:1.1;">حنين الشرق للإستقدام</div>
        <div style="color:rgba(255,255,255,0.65);font-size:7.5px;">Haneen Al Sharq Recruitment</div>
      </div>
    </div>
    <div style="text-align:center;direction:ltr;">
      <div style="color:${wt};font-size:7.5px;display:flex;gap:8px;justify-content:center;">
        <span>☎ 0502355630</span><span>☎ 0558826167</span><span>☎ 0535018898</span><span>☎ 0556742038</span>
      </div>
      <div style="color:rgba(255,255,255,0.55);font-size:6.5px;direction:rtl;margin-top:1px;">الرياض - حي النهضة - ش. سلمان الفارسي | Haneenalsharq11@gmail.com</div>
    </div>
  </div>

  <!-- GOLD LINE -->
  <div style="height:2px;background:linear-gradient(90deg,${gd},${pa},${gd});"></div>

  <!-- HERO -->
  <div style="display:flex;padding:6px 16px 5px;gap:10px;background:linear-gradient(180deg,${bg},${wt});border-bottom:1.5px solid ${lt};">
    <div style="flex-shrink:0;">
      <img src="${profile}" style="width:75px;height:90px;object-fit:cover;border-radius:6px;border:2px solid ${pm};" />
    </div>
    <div style="flex:1;">
      <div style="font-size:19px;font-weight:900;color:${pd};line-height:1.1;">${d.fullNameAr || d.fullName || ""}</div>
      <div style="font-size:10.5px;color:${md};margin-bottom:5px;direction:ltr;text-align:right;">${d.fullName || ""}</div>
      <div style="display:flex;flex-wrap:wrap;gap:3px;">
        ${pill("الجنسية", tr("nat", nat))}
        ${pill("الديانة", tr("rel", d.religion || ""))}
        ${pill("العمر", (d.age || "") + " سنة")}
        ${pill("الحالة", tr("mar", d.maritalStatus || ""))}
        ${pill("الأولاد", d.numberOfChildren ?? 0)}
        ${pill("", tr("prof", d.profession || ""), true)}
      </div>
    </div>
  </div>

  <!-- MAIN 2-COLUMN: everything fits on page 1 -->
  <div style="display:flex;padding:3px 12px;gap:8px;">

    <!-- RIGHT: Info tables (compact) -->
    <div style="flex:1;min-width:0;">

      ${sec("المعلومات الشخصية", "Personal Information")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("الاسم الكامل", "Name", d.fullName || "")}
        ${row("الجنس", "Gender", tr("gen", d.gender||"") + " / " + (d.gender||""))}
        ${row("تاريخ الميلاد", "DOB", d.dateOfBirth || "")}
        ${row("الجنسية", "Nationality", tr("nat", nat) + " / " + nat)}
        ${row("الديانة", "Religion", tr("rel", d.religion||"") + " / " + (d.religion||""))}
        ${row("الحالة", "Status", tr("mar", d.maritalStatus||"") + " / " + (d.maritalStatus||""))}
        ${row("الأولاد", "Children", String(d.numberOfChildren ?? 0))}
        ${row("الإقامة", "Residence", d.currentResidence || "")}
      </table>

      ${sec("معلومات العمل", "Job Information")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("المهنة", "Profession", tr("prof", d.profession||"") + " / " + (d.profession||""))}
        ${row("الراتب", "Salary", (d.monthlySalary||"") + " ريال / SAR")}
        ${row("مدة العقد", "Contract", (d.contractPeriod||"2") + " سنة / Years")}
      </table>

      ${sec("جواز السفر", "Passport")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("رقم الجواز", "No.", d.passportNumber || "")}
        ${row("تاريخ الإصدار", "Issue", d.passportIssueDate || "")}
        ${row("تاريخ الانتهاء", "Expiry", d.passportExpiryDate || "")}
      </table>

      ${sec("التعليم واللغات", "Education & Languages")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("التعليم", "Education", tr("edu", d.educationLevel||"") + " / " + (d.educationLevel||""))}
        ${row("الإنجليزية", "English", tr("lang", d.englishLevel||"") + " / " + (d.englishLevel||""))}
        ${row("العربية", "Arabic", tr("lang", d.arabicLevel||"") + " / " + (d.arabicLevel||""))}
      </table>

      ${sec("الخبرات العملية", "Work Experience")}
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <th style="background:${pd};color:${wt};padding:2.5px 6px;font-size:7.5px;text-align:right;">الدولة / Country</th>
          <th style="background:${pd};color:${wt};padding:2.5px 6px;font-size:7.5px;text-align:right;">المدة / Period</th>
          <th style="background:${pd};color:${wt};padding:2.5px 6px;font-size:7.5px;text-align:right;">المنصب / Position</th>
        </tr>
        ${expRows}
      </table>

      ${sec("المعلومات الجسدية", "Physical Info")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("الطول", "Height", (d.heightCm||"") + " سم / cm")}
        ${row("الوزن", "Weight", (d.weightKg||"") + " كغ / kg")}
        <tr>
          <td style="padding:2.5px 7px;font-size:9.5px;background:${bg};width:36%;border-bottom:1px solid ${wt};line-height:1.25;">
            <b style="color:${dk};">اللياقة</b> <span style="font-size:7px;color:#999;">Medical</span>
          </td>
          <td style="padding:2.5px 7px;font-size:10px;font-weight:700;color:${med?gn:rd};border-bottom:1px solid ${lt};">
            ${med ? "✓ لائق طبياً / Fit" : "✗ غير لائق / Not Fit"}
          </td>
        </tr>
      </table>
    </div>

    <!-- LEFT: Skills + FULL PHOTO (bigger) -->
    <div style="width:215px;flex-shrink:0;">

      ${sec("المهارات", "Skills")}
      <table style="width:100%;border-collapse:collapse;">
        ${skRows}
      </table>

      <!-- FULL BODY PHOTO - large -->
      <div style="margin-top:5px;text-align:center;">
        <img src="${fullPhoto}" style="width:205px;height:340px;object-fit:cover;object-position:top;border-radius:8px;border:2px solid ${lt};" />
      </div>

      <!-- Agency -->
      <div style="margin-top:4px;text-align:center;padding:3px;background:${bg};border-radius:4px;border:1px solid ${lt};">
        <div style="font-size:6.5px;color:${md};">الوكالة / Agency</div>
        <div style="font-size:8.5px;font-weight:700;color:${pd};">${d.agencyName || ""}</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(135deg,${pd},${nv});padding:5px 16px;display:flex;justify-content:space-between;align-items:center;direction:ltr;">
    <div style="color:${wt};font-size:7.5px;display:flex;gap:10px;">
      <span>☎ 0502355630</span><span>☎ 0558826167</span><span>☎ 0535018898</span><span>☎ 0556742038</span>
    </div>
    <div style="text-align:right;">
      <div style="color:${gd};font-size:7px;">Haneenalsharq11@gmail.com</div>
      <div style="color:rgba(255,255,255,0.6);font-size:6px;direction:rtl;">الرياض - حي النهضة - ش. سلمان الفارسي</div>
    </div>
  </div>
  <div style="position:absolute;top:50px;left:0;width:3px;height:calc(100% - 80px);background:linear-gradient(180deg,${pm},${pa},${gd});"></div>
</div>

<!-- ═══════════ PAGE 2: PASSPORT SCAN ═══════════ -->
<div class="page">
  <div style="background:linear-gradient(135deg,${pd},${pm});padding:6px 16px;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:8px;">
      <img src="${logo}" style="height:36px;" />
      <div>
        <div style="color:${wt};font-size:13px;font-weight:800;line-height:1.1;">حنين الشرق للإستقدام</div>
        <div style="color:rgba(255,255,255,0.65);font-size:7.5px;">Haneen Al Sharq Recruitment</div>
      </div>
    </div>
    <div style="text-align:left;direction:ltr;">
      <div style="color:rgba(255,255,255,0.5);font-size:6.5px;text-transform:uppercase;letter-spacing:2px;">Passport No.</div>
      <div style="color:${wt};font-size:13px;font-weight:700;letter-spacing:2px;">${d.passportNumber || ""}</div>
    </div>
  </div>
  <div style="height:2px;background:linear-gradient(90deg,${gd},${pa},${gd});"></div>

  <div style="text-align:center;padding:28px 36px 20px;">
    <div style="font-size:20px;font-weight:800;color:${pd};margin-bottom:3px;">صورة جواز السفر</div>
    <div style="font-size:11px;color:${md};margin-bottom:22px;">Passport Copy</div>
    <div style="display:inline-block;padding:10px;border:2px solid ${lt};border-radius:10px;background:${wt};box-shadow:0 4px 16px rgba(0,0,0,0.04);">
      <img src="${passport}" style="max-width:510px;width:100%;height:auto;border-radius:4px;" />
    </div>
    <div style="margin-top:22px;">
      <div style="display:inline-block;padding:8px 24px;background:${bg};border-radius:8px;border:1px solid ${lt};">
        <div style="font-size:15px;font-weight:800;color:${pd};">${d.fullNameAr || d.fullName || ""}</div>
        <div style="font-size:10px;color:${md};margin-top:2px;">${d.fullName || ""}</div>
        <div style="font-size:9px;color:${pm};margin-top:3px;direction:ltr;letter-spacing:1.5px;">Passport: ${d.passportNumber || ""}</div>
      </div>
    </div>
  </div>

  <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(135deg,${pd},${nv});padding:5px 16px;display:flex;justify-content:space-between;align-items:center;direction:ltr;">
    <div style="color:${wt};font-size:7.5px;display:flex;gap:10px;">
      <span>☎ 0502355630</span><span>☎ 0558826167</span><span>☎ 0535018898</span><span>☎ 0556742038</span>
    </div>
    <div style="text-align:right;">
      <div style="color:${gd};font-size:7px;">Haneenalsharq11@gmail.com</div>
      <div style="color:rgba(255,255,255,0.6);font-size:6px;direction:rtl;">الرياض - حي النهضة - ش. سلمان الفارسي</div>
    </div>
  </div>
  <div style="position:absolute;top:50px;left:0;width:3px;height:calc(100% - 80px);background:linear-gradient(180deg,${pm},${pa},${gd});"></div>
</div>

</body></html>`;
}

app.listen(PORT, () => {
  console.log(`🚀 Haneen CV API v2 running on port ${PORT}`);
});
