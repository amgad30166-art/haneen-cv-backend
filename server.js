const express = require("express");
const cors = require("cors");
const multer = require("multer");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Multer for file uploads (stored in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ─── Load embedded logo ─────────────────────────────────────────
const LOGO_B64 = fs.readFileSync(
  path.join(__dirname, "logo_b64.txt"),
  "utf-8"
).trim();
const LOGO_DATA_URI = `data:image/png;base64,${LOGO_B64}`;

// ─── Health check ───────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "Haneen Al Sharq CV Generator",
    version: "1.0.0",
  });
});

// ─── Generate CV PDF ────────────────────────────────────────────
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

      // Convert uploaded images to base64 data URIs
      const toDataUri = (file) => {
        if (!file || !file[0]) return placeholderImg();
        const b64 = file[0].buffer.toString("base64");
        const mime = file[0].mimetype;
        return `data:${mime};base64,${b64}`;
      };

      const profileB64 = toDataUri(req.files?.profilePhoto);
      const fullPhotoB64 = toDataUri(req.files?.fullPhoto);
      const passportB64 = toDataUri(req.files?.passportScan);

      // Build HTML
      const html = buildFullHTML(data, LOGO_DATA_URI, profileB64, fullPhotoB64, passportB64);

      // Generate PDF with Puppeteer
      const browser = await puppeteer.launch({
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--font-render-hinting=none",
        ],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });

      await browser.close();

      // Send PDF
      const filename = `CV_${(data.fullName || "candidate").replace(/\s+/g, "_")}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdf);
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({ error: "Failed to generate PDF", details: err.message });
    }
  }
);

// ─── Placeholder image (1x1 transparent) ────────────────────────
function placeholderImg() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPk3KFb2AAAAABJRU5ErkJggg==";
}

// ─── Translation maps ───────────────────────────────────────────
const T = {
  nat: { Uganda: "أوغندا", Kenya: "كينيا", Philippines: "الفلبين", India: "الهند", Ethiopia: "إثيوبيا", Bangladesh: "بنغلاديش" },
  rel: { Muslim: "مسلم/ة", Christian: "مسيحي/ة" },
  mar: { Single: "أعزب/عزباء", Married: "متزوج/ة", Divorced: "مطلق/ة", Widowed: "أرمل/ة" },
  gen: { Male: "ذكر", Female: "أنثى" },
  prof: { "Domestic Worker": "عاملة منزلية", "Private Driver": "سائق خاص" },
  edu: { Primary: "ابتدائي", Secondary: "ثانوي", "High School": "ثانوية عامة", Diploma: "دبلوم", Bachelor: "بكالوريوس", None: "لا يوجد" },
  lang: { Poor: "ضعيف", Fair: "مقبول", Good: "جيد", Excellent: "ممتاز", Fluent: "بطلاقة" },
  skill: { Poor: "ضعيف", Good: "جيد", "Very Good": "جيد جداً", Excellent: "ممتاز" },
  skillLevel: { Poor: 1, Good: 2, "Very Good": 3, Excellent: 4 },
};

const tr = (map, val) => T[map]?.[val] || val;

// ─── Build full 2-page HTML ─────────────────────────────────────
function buildFullHTML(d, logo, profile, fullPhoto, passport) {
  const C = {
    pd: "#3D1A5C", pm: "#5B2D8E", pl: "#7B4FA2", pa: "#9B6FC2",
    nv: "#1A1A3E", gd: "#C9A84C", dk: "#2D2D2D", md: "#666666",
    lt: "#E0E0E8", bg: "#F4F4F8", wt: "#FFFFFF", gn: "#2E7D32", rd: "#C62828",
  };

  // Skill bar HTML
  const skillBar = (level) => {
    const n = T.skillLevel[level] || 0;
    let dots = "";
    for (let i = 0; i < 4; i++) {
      dots += `<span style="display:inline-block;width:16px;height:8px;background:${i < n ? C.pm : C.lt};border-radius:2px;margin-left:2px;"></span>`;
    }
    return `<span style="direction:ltr;display:inline-flex;">${dots}</span>`;
  };

  // Info row
  const irow = (arL, enL, val) => `
    <tr>
      <td style="padding:5px 10px;font-size:9.5px;color:${C.md};background:${C.bg};width:44%;border-bottom:1px solid ${C.wt};">
        ${arL}<br><span style="font-size:7.5px;color:#999;">${enL}</span>
      </td>
      <td style="padding:5px 10px;font-size:10px;font-weight:600;color:${C.dk};border-bottom:1px solid ${C.lt};">${val}</td>
    </tr>`;

  // Skills section
  const skillsList = [
    ["cleaning", "التنظيف", "Cleaning"], ["cooking", "الطبخ", "Cooking"],
    ["arabicCooking", "الطبخ العربي", "Arabic Cooking"], ["washing", "الغسيل", "Washing"],
    ["ironing", "الكي", "Ironing"], ["babysitting", "رعاية الأطفال", "Babysitting"],
    ["childrenCare", "العناية بالأطفال", "Children Care"], ["tutoring", "التدريس", "Tutoring"],
    ["disabledCare", "رعاية ذوي الاحتياجات", "Disabled Care"],
  ];

  const skills = d.skills || {};
  let skillsRows = "";
  for (const [key, arN, enN] of skillsList) {
    const lv = skills[key] || "Poor";
    skillsRows += `
      <tr>
        <td style="padding:3px 6px;font-size:8.5px;color:${C.dk};border-bottom:1px solid ${C.lt};">
          ${arN}<br><span style="font-size:6.5px;color:${C.md};">${enN}</span>
        </td>
        <td style="padding:3px 4px;border-bottom:1px solid ${C.lt};text-align:center;">${skillBar(lv)}</td>
        <td style="padding:3px 4px;font-size:7.5px;color:${C.pm};border-bottom:1px solid ${C.lt};text-align:center;font-weight:700;">${tr("skill", lv)}</td>
      </tr>`;
  }

  // Experience rows
  const exps = d.experienceAbroad || [];
  let expRows = "";
  if (exps.length > 0) {
    for (const e of exps) {
      expRows += `
        <tr>
          <td style="padding:5px 10px;font-size:8.5px;border-bottom:1px solid ${C.lt};">${e.country || ""}</td>
          <td style="padding:5px 10px;font-size:8.5px;border-bottom:1px solid ${C.lt};">${e.period || ""} سنة</td>
          <td style="padding:5px 10px;font-size:8.5px;border-bottom:1px solid ${C.lt};">${e.position || ""}</td>
        </tr>`;
    }
  } else {
    expRows = `<tr><td colspan="3" style="padding:6px;font-size:8.5px;color:${C.md};text-align:center;">لا يوجد خبرة سابقة / No previous experience</td></tr>`;
  }

  const med = d.medicalFit === true || d.medicalFit === "true" || d.medicalFit === "Yes";
  const nat = d.nationality || "";

  // Tag pill helper
  const pill = (label, value, highlight) => {
    if (highlight) return `<span style="background:${C.pm};border-radius:15px;padding:3px 12px;font-size:8.5px;color:${C.wt};font-weight:600;">${value}</span>`;
    return `<span style="background:${C.wt};border:1px solid ${C.lt};border-radius:15px;padding:3px 12px;font-size:8.5px;">
      <span style="color:${C.md};font-size:7.5px;">${label}</span> <b style="color:${C.pd};">${value}</b>
    </span>`;
  };

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700&display=swap');
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Cairo', 'Tajawal', sans-serif; background:${C.wt}; color:${C.dk}; }
  .page { width:210mm; min-height:297mm; position:relative; overflow:hidden; page-break-after:always; }
  .page:last-child { page-break-after:auto; }
</style>
</head>
<body>

<!-- ══════════════ PAGE 1 ══════════════ -->
<div class="page">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,${C.pd},${C.pm});height:72px;padding:0 22px;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="${logo}" style="height:52px;" />
      <div>
        <div style="color:${C.wt};font-size:16px;font-weight:800;">حنين الشرق للإستقدام</div>
        <div style="color:rgba(255,255,255,0.8);font-size:9px;letter-spacing:0.5px;">Haneen Al Sharq Recruitment</div>
      </div>
    </div>
    <div style="text-align:left;direction:ltr;">
      <div style="color:rgba(255,255,255,0.55);font-size:7px;text-transform:uppercase;letter-spacing:2px;">Passport No.</div>
      <div style="color:${C.wt};font-size:15px;font-weight:700;letter-spacing:2.5px;">${d.passportNumber || ""}</div>
    </div>
  </div>

  <!-- GOLD LINE -->
  <div style="height:3px;background:linear-gradient(90deg,${C.gd},${C.pa},${C.gd});"></div>

  <!-- HERO -->
  <div style="display:flex;padding:14px 22px 12px;gap:16px;background:linear-gradient(180deg,${C.bg},${C.wt});border-bottom:2px solid ${C.lt};">
    <div style="flex-shrink:0;">
      <img src="${profile}" style="width:105px;height:125px;object-fit:cover;border-radius:8px;border:3px solid ${C.pm};box-shadow:0 3px 12px rgba(61,26,92,0.15);" />
    </div>
    <div style="flex:1;">
      <div style="font-size:24px;font-weight:800;color:${C.pd};line-height:1.2;">${d.fullNameAr || d.fullName || ""}</div>
      <div style="font-size:13px;color:${C.md};margin-bottom:10px;direction:ltr;text-align:right;font-weight:400;">${d.fullName || ""}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${pill("الجنسية", tr("nat", nat))}
        ${pill("الديانة", tr("rel", d.religion || ""))}
        ${pill("العمر", (d.age || "") + " سنة")}
        ${pill("الحالة", tr("mar", d.maritalStatus || ""))}
        ${pill("الأولاد", d.numberOfChildren ?? 0)}
        ${pill("", tr("prof", d.profession || ""), true)}
      </div>
    </div>
  </div>

  <!-- MAIN CONTENT -->
  <div style="display:flex;padding:10px 18px;gap:14px;">

    <!-- RIGHT: Info -->
    <div style="flex:1;min-width:0;">

      <div style="font-size:11px;font-weight:700;color:${C.pd};padding:5px 0;margin-bottom:4px;border-bottom:2.5px solid ${C.pm};">
        المعلومات الشخصية <span style="font-size:8px;color:${C.md};font-weight:400;">Personal Information</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        ${irow("الاسم الكامل", "Full Name", d.fullName || "")}
        ${irow("الجنس", "Gender", tr("gen", d.gender || "") + " / " + (d.gender || ""))}
        ${irow("تاريخ الميلاد", "Date of Birth", d.dateOfBirth || "")}
        ${irow("الجنسية", "Nationality", tr("nat", nat) + " / " + nat)}
        ${irow("الديانة", "Religion", tr("rel", d.religion || "") + " / " + (d.religion || ""))}
        ${irow("الحالة الاجتماعية", "Marital Status", tr("mar", d.maritalStatus || "") + " / " + (d.maritalStatus || ""))}
        ${irow("عدد الأولاد", "Children", String(d.numberOfChildren ?? 0))}
        ${irow("الإقامة الحالية", "Residence", d.currentResidence || "")}
      </table>

      <div style="font-size:11px;font-weight:700;color:${C.pd};padding:5px 0;margin-bottom:4px;border-bottom:2.5px solid ${C.pm};">
        معلومات العمل <span style="font-size:8px;color:${C.md};font-weight:400;">Job Information</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        ${irow("المهنة", "Profession", tr("prof", d.profession || "") + " / " + (d.profession || ""))}
        ${irow("الراتب الشهري", "Monthly Salary", (d.monthlySalary || "") + " ريال / SAR")}
        ${irow("مدة العقد", "Contract Period", (d.contractPeriod || "2") + " سنة / Years")}
      </table>

      <div style="font-size:11px;font-weight:700;color:${C.pd};padding:5px 0;margin-bottom:4px;border-bottom:2.5px solid ${C.pm};">
        بيانات جواز السفر <span style="font-size:8px;color:${C.md};font-weight:400;">Passport Details</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        ${irow("رقم الجواز", "Passport No.", d.passportNumber || "")}
        ${irow("تاريخ الإصدار", "Issue Date", d.passportIssueDate || "")}
        ${irow("تاريخ الانتهاء", "Expiry Date", d.passportExpiryDate || "")}
      </table>

      <div style="font-size:11px;font-weight:700;color:${C.pd};padding:5px 0;margin-bottom:4px;border-bottom:2.5px solid ${C.pm};">
        التعليم واللغات <span style="font-size:8px;color:${C.md};font-weight:400;">Education & Languages</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        ${irow("المستوى التعليمي", "Education", tr("edu", d.educationLevel || "") + " / " + (d.educationLevel || ""))}
        ${irow("اللغة الإنجليزية", "English", tr("lang", d.englishLevel || "") + " / " + (d.englishLevel || ""))}
        ${irow("اللغة العربية", "Arabic", tr("lang", d.arabicLevel || "") + " / " + (d.arabicLevel || ""))}
      </table>

      <div style="font-size:11px;font-weight:700;color:${C.pd};padding:5px 0;margin-bottom:4px;border-bottom:2.5px solid ${C.pm};">
        الخبرات العملية <span style="font-size:8px;color:${C.md};font-weight:400;">Work Experience</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <tr>
          <th style="background:${C.pd};color:${C.wt};padding:5px 10px;font-size:8px;text-align:right;">الدولة / Country</th>
          <th style="background:${C.pd};color:${C.wt};padding:5px 10px;font-size:8px;text-align:right;">المدة / Period</th>
          <th style="background:${C.pd};color:${C.wt};padding:5px 10px;font-size:8px;text-align:right;">المنصب / Position</th>
        </tr>
        ${expRows}
      </table>

      <div style="font-size:11px;font-weight:700;color:${C.pd};padding:5px 0;margin-bottom:4px;border-bottom:2.5px solid ${C.pm};">
        المعلومات الجسدية <span style="font-size:8px;color:${C.md};font-weight:400;">Physical Information</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${irow("الطول", "Height", (d.heightCm || "") + " سم / cm")}
        ${irow("الوزن", "Weight", (d.weightKg || "") + " كغ / kg")}
        <tr>
          <td style="padding:5px 10px;font-size:9.5px;color:${C.md};background:${C.bg};width:44%;border-bottom:1px solid ${C.wt};">
            اللياقة الطبية<br><span style="font-size:7.5px;color:#999;">Medical Fitness</span>
          </td>
          <td style="padding:5px 10px;font-size:11px;font-weight:700;color:${med ? C.gn : C.rd};border-bottom:1px solid ${C.lt};">
            ${med ? "✓ لائق طبياً / Medically Fit" : "✗ غير لائق / Not Fit"}
          </td>
        </tr>
      </table>
    </div>

    <!-- LEFT: Skills + Photo -->
    <div style="width:205px;flex-shrink:0;">
      <div style="font-size:11px;font-weight:700;color:${C.pd};padding:5px 0;margin-bottom:4px;border-bottom:2.5px solid ${C.pm};">
        المهارات <span style="font-size:8px;color:${C.md};font-weight:400;">Skills</span>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        ${skillsRows}
      </table>

      <img src="${fullPhoto}" style="width:195px;height:265px;object-fit:cover;object-position:top;border-radius:8px;border:2px solid ${C.lt};" />

      <div style="margin-top:8px;text-align:center;padding:6px;background:${C.bg};border-radius:6px;border:1px solid ${C.lt};">
        <div style="font-size:7px;color:${C.md};">الوكالة / Agency</div>
        <div style="font-size:9.5px;font-weight:700;color:${C.pd};">${d.agencyName || ""}</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(135deg,${C.pd},${C.nv});padding:9px 22px;display:flex;justify-content:space-between;align-items:center;direction:ltr;">
    <div style="color:${C.wt};font-size:8.5px;display:flex;gap:14px;">
      <span>☎ 050 235 5630</span><span>☎ 055 882 6167</span><span>☎ 053 501 8898</span><span>☎ 055 674 2038</span>
    </div>
    <div style="text-align:right;">
      <div style="color:${C.gd};font-size:8px;">Haneenalsharq11@gmail.com</div>
      <div style="color:rgba(255,255,255,0.7);font-size:7px;direction:rtl;">الرياض، حي النهضة، شارع سلمان الفارسي</div>
    </div>
  </div>

  <!-- SIDE ACCENT -->
  <div style="position:absolute;top:75px;left:0;width:3px;height:calc(100% - 112px);background:linear-gradient(180deg,${C.pm},${C.pa},${C.gd});"></div>
</div>

<!-- ══════════════ PAGE 2 ══════════════ -->
<div class="page">
  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,${C.pd},${C.pm});height:72px;padding:0 22px;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:12px;">
      <img src="${logo}" style="height:52px;" />
      <div>
        <div style="color:${C.wt};font-size:16px;font-weight:800;">حنين الشرق للإستقدام</div>
        <div style="color:rgba(255,255,255,0.8);font-size:9px;">Haneen Al Sharq Recruitment</div>
      </div>
    </div>
    <div style="text-align:left;direction:ltr;">
      <div style="color:rgba(255,255,255,0.55);font-size:7px;text-transform:uppercase;letter-spacing:2px;">Passport No.</div>
      <div style="color:${C.wt};font-size:15px;font-weight:700;letter-spacing:2.5px;">${d.passportNumber || ""}</div>
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(90deg,${C.gd},${C.pa},${C.gd});"></div>

  <!-- PASSPORT SECTION -->
  <div style="text-align:center;padding:35px 40px 20px;">
    <div style="font-size:22px;font-weight:800;color:${C.pd};margin-bottom:4px;">صورة جواز السفر</div>
    <div style="font-size:13px;color:${C.md};margin-bottom:30px;">Passport Copy</div>
    <div style="display:inline-block;padding:14px;border:2px solid ${C.lt};border-radius:14px;background:${C.wt};box-shadow:0 6px 25px rgba(0,0,0,0.06);">
      <img src="${passport}" style="max-width:540px;width:100%;height:auto;border-radius:6px;" />
    </div>
    <div style="margin-top:30px;">
      <div style="display:inline-block;padding:12px 30px;background:${C.bg};border-radius:10px;border:1px solid ${C.lt};">
        <div style="font-size:18px;font-weight:800;color:${C.pd};">${d.fullNameAr || d.fullName || ""}</div>
        <div style="font-size:12px;color:${C.md};margin-top:3px;">${d.fullName || ""}</div>
        <div style="font-size:11px;color:${C.pm};margin-top:5px;direction:ltr;letter-spacing:2px;">Passport: ${d.passportNumber || ""}</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(135deg,${C.pd},${C.nv});padding:9px 22px;display:flex;justify-content:space-between;align-items:center;direction:ltr;">
    <div style="color:${C.wt};font-size:8.5px;display:flex;gap:14px;">
      <span>☎ 050 235 5630</span><span>☎ 055 882 6167</span><span>☎ 053 501 8898</span><span>☎ 055 674 2038</span>
    </div>
    <div style="text-align:right;">
      <div style="color:${C.gd};font-size:8px;">Haneenalsharq11@gmail.com</div>
      <div style="color:rgba(255,255,255,0.7);font-size:7px;direction:rtl;">الرياض، حي النهضة، شارع سلمان الفارسي</div>
    </div>
  </div>
  <div style="position:absolute;top:75px;left:0;width:3px;height:calc(100% - 112px);background:linear-gradient(180deg,${C.pm},${C.pa},${C.gd});"></div>
</div>

</body></html>`;
}

// ─── Start server ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Haneen CV API running on port ${PORT}`);
});
