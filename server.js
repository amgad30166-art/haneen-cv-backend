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
  fileFilter: (req, file, cb) => cb(null, ["image/jpeg","image/png","image/jpg"].includes(file.mimetype)),
});

const LOGO_B64 = fs.readFileSync(path.join(__dirname, "logo_b64.txt"), "utf-8").trim();
const LOGO = `data:image/png;base64,${LOGO_B64}`;
const PH = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88P/BfwAJhAPk3KFb2AAAAABJRU5ErkJggg==";

app.get("/", (req, res) => res.json({ status: "ok", version: "4.0.0" }));

app.post("/api/generate-cv",
  upload.fields([{ name:"profilePhoto",maxCount:1 },{ name:"fullPhoto",maxCount:1 },{ name:"passportScan",maxCount:1 }]),
  async (req, res) => {
    try {
      const data = JSON.parse(req.body.data || "{}");
      const u = (f) => f?.[0] ? `data:${f[0].mimetype};base64,${f[0].buffer.toString("base64")}` : PH;

      // Auto-translate name if Arabic name not provided
      if (!data.fullNameAr || data.fullNameAr.trim() === "") {
        data.fullNameAr = transliterate(data.fullName || "");
      }

      const html = buildHTML(data, LOGO, u(req.files?.profilePhoto), u(req.files?.fullPhoto), u(req.files?.passportScan));
      const browser = await puppeteer.launch({ headless:"new", args:["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage"] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({ format:"A4", printBackground:true, margin:{top:0,right:0,bottom:0,left:0} });
      await browser.close();

      const fn = `${(data.fullName||"CV").replace(/\s+/g,"_")}_${data.passportNumber||"PP"}.pdf`;
      res.setHeader("Content-Type","application/pdf");
      res.setHeader("Content-Disposition",`attachment; filename="${fn}"`);
      res.send(pdf);
    } catch(e) {
      console.error("PDF error:",e);
      res.status(500).json({ error:"Failed", details:e.message });
    }
  }
);

// ─── English to Arabic transliteration ──────────────────────────
function transliterate(name) {
  const map = {
    "ph":"ف","th":"ث","sh":"ش","ch":"تش","kh":"خ","gh":"غ","dh":"ذ","zh":"ز",
    "aa":"ا","ee":"ي","oo":"و","ou":"و","ai":"اي","ei":"اي","au":"او",
    "a":"ا","b":"ب","c":"ك","d":"د","e":"ي","f":"ف","g":"غ","h":"ه",
    "i":"ي","j":"ج","k":"ك","l":"ل","m":"م","n":"ن","o":"و","p":"ب",
    "q":"ق","r":"ر","s":"س","t":"ت","u":"و","v":"ف","w":"و","x":"كس",
    "y":"ي","z":"ز",
  };
  const words = name.toLowerCase().split(/\s+/);
  return words.map(w => {
    let ar = "", i = 0;
    while (i < w.length) {
      const two = w.substring(i, i+2);
      if (map[two]) { ar += map[two]; i += 2; }
      else if (map[w[i]]) { ar += map[w[i]]; i++; }
      else { i++; }
    }
    return ar;
  }).join(" ");
}

// ─── Translations ───────────────────────────────────────────────
const T = {
  nat: { Uganda:"أوغندا", Kenya:"كينيا", Philippines:"الفلبين", India:"الهند", Ethiopia:"إثيوبيا", Bangladesh:"بنغلاديش" },
  rel: { Muslim:"مسلم", Christian:"مسيحي" },
  mar: { Single:"أعزب", Married:"متزوج", Divorced:"مطلق", Widowed:"أرمل" },
  gen: { Male:"ذكر", Female:"أنثى" },
  prof: { "Domestic Worker":"عاملة منزلية", "Private Driver":"سائق خاص" },
  edu: { Primary:"ابتدائي", Secondary:"ثانوي", "High School":"ثانوية عامة", Diploma:"دبلوم", Bachelor:"بكالوريوس", None:"لا يوجد" },
  lang: { Poor:"ضعيف", Fair:"مقبول", Good:"جيد", Excellent:"ممتاز", Fluent:"بطلاقة" },
  sk: { Poor:"ضعيف", Good:"جيد", "Very Good":"جيد جداً", Excellent:"ممتاز" },
  skN: { Poor:1, Good:2, "Very Good":3, Excellent:4 },
};
const tr = (m, v) => T[m]?.[v] || v;

// ─── Build HTML - STRICT 2 PAGES ────────────────────────────────
function buildHTML(d, logo, profile, fullPhoto, passport) {
  const pd="#3D1A5C",pm="#5B2D8E",pa="#9B6FC2",nv="#1A1A3E",gd="#C9A84C";
  const dk="#1a1a1a",md="#555",lt="#DDDDE5",bg="#F2F2F7",wt="#FFFFFF",gn="#2E7D32",rd="#C62828",or="#E65100";

  const nat=d.nationality||"", med=d.medicalFit===true||d.medicalFit==="true"||d.medicalFit==="Yes";

  // Format mobile: add spaces for readability
  const mobile = d.mobileNumber || "";

  const sBar=(lv)=>{const n=T.skN[lv]||0;let h="";for(let i=0;i<4;i++)h+=`<span style="display:inline-block;width:18px;height:8px;background:${i<n?pm:lt};border-radius:2px;margin-left:2px;"></span>`;return `<span style="direction:ltr;display:inline-flex;">${h}</span>`;};

  // Compact row for phone readability - single line label
  const row=(ar,val)=>`<tr>
    <td style="padding:3px 8px;font-size:11px;font-weight:700;color:${dk};background:${bg};width:28%;border-bottom:1px solid ${wt};">${ar}</td>
    <td style="padding:3px 8px;font-size:11.5px;font-weight:600;color:${dk};border-bottom:1px solid ${lt};">${val}</td>
  </tr>`;

  // Skills
  const SKS=[["cleaning","التنظيف","Cleaning"],["cooking","الطبخ","Cooking"],["arabicCooking","الطبخ العربي","Arabic Cooking"],["washing","الغسيل","Washing"],["ironing","الكي","Ironing"],["babysitting","رعاية الأطفال","Babysitting"],["childrenCare","العناية بالأطفال","Children Care"],["tutoring","التدريس","Tutoring"],["disabledCare","رعاية ذوي الاحتياجات","Disabled Care"]];
  const sk=d.skills||{};
  let skR="";
  for(const[k,ar,en]of SKS){const lv=sk[k]||"Poor";skR+=`<tr>
    <td style="padding:2px 4px;font-size:9px;color:${dk};border-bottom:1px solid ${lt};line-height:1.15;"><b>${ar}</b><br><span style="font-size:6px;color:${md};">${en}</span></td>
    <td style="padding:2px 2px;border-bottom:1px solid ${lt};text-align:center;">${sBar(lv)}</td>
    <td style="padding:2px 2px;font-size:7.5px;color:${pm};border-bottom:1px solid ${lt};text-align:center;font-weight:800;">${tr("sk",lv)}</td>
  </tr>`;}

  // Experience
  const exps=d.experienceAbroad||[];
  let expR="";
  if(exps.length>0){for(const e of exps)expR+=`<tr><td style="padding:3px 6px;font-size:10px;border-bottom:1px solid ${lt};">${e.country||""}</td><td style="padding:3px 6px;font-size:10px;border-bottom:1px solid ${lt};">${e.period||""} سنة</td><td style="padding:3px 6px;font-size:10px;border-bottom:1px solid ${lt};">${e.position||""}</td></tr>`;}
  else{expR=`<tr><td colspan="3" style="padding:3px;font-size:10px;color:${md};text-align:center;">لا يوجد خبرة سابقة / No previous experience</td></tr>`;}

  const sec=(ar,en)=>`<div style="font-size:11.5px;font-weight:900;color:${pd};padding:2px 0;margin:4px 0 2px;border-bottom:2px solid ${pm};">${ar} <span style="font-size:7.5px;color:${md};font-weight:400;">${en}</span></div>`;

  const pill=(label,val,hl)=>hl
    ?`<span style="background:${pm};border-radius:12px;padding:3px 11px;font-size:10px;color:${wt};font-weight:800;">${val}</span>`
    :`<span style="background:${wt};border:1.5px solid ${lt};border-radius:12px;padding:3px 11px;font-size:10px;"><span style="color:#999;font-size:8px;">${label}</span> <b style="color:${pd};">${val}</b></span>`;

  // Header block (reused on both pages)
  const header = `<div style="background:linear-gradient(135deg,${pd},${pm});padding:7px 16px;display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:8px;">
      <img src="${logo}" style="height:38px;" />
      <div>
        <div style="color:${wt};font-size:14px;font-weight:900;line-height:1.1;">حنين الشرق للإستقدام</div>
        <div style="color:rgba(255,255,255,0.6);font-size:7px;">Haneen Al Sharq Recruitment</div>
      </div>
    </div>
    <div style="text-align:center;direction:ltr;">
      <div style="color:${wt};font-size:10px;font-weight:700;display:flex;gap:10px;justify-content:center;">
        <span>☎ 0502355630</span><span>☎ 0558826167</span>
      </div>
      <div style="color:${wt};font-size:10px;font-weight:700;display:flex;gap:10px;justify-content:center;margin-top:1px;">
        <span>☎ 0535018898</span><span>☎ 0556742038</span>
      </div>
      <div style="color:rgba(255,255,255,0.7);font-size:8px;direction:rtl;margin-top:2px;font-weight:600;">الرياض - حي النهضة - ش. سلمان الفارسي</div>
      <div style="color:${gd};font-size:7.5px;margin-top:1px;">Haneenalsharq11@gmail.com</div>
    </div>
  </div>
  <div style="height:2px;background:linear-gradient(90deg,${gd},${pa},${gd});"></div>`;

  const footer = `<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(135deg,${pd},${nv});padding:5px 16px;display:flex;justify-content:space-between;align-items:center;direction:ltr;">
    <div style="color:${wt};font-size:8px;display:flex;gap:10px;"><span>☎ 0502355630</span><span>☎ 0558826167</span><span>☎ 0535018898</span><span>☎ 0556742038</span></div>
    <div style="text-align:right;"><div style="color:${gd};font-size:7px;">Haneenalsharq11@gmail.com</div><div style="color:rgba(255,255,255,0.6);font-size:6.5px;direction:rtl;">الرياض - حي النهضة - ش. سلمان الفارسي</div></div>
  </div>`;

  const sidebar = `<div style="position:absolute;top:68px;left:0;width:3px;height:calc(100% - 96px);background:linear-gradient(180deg,${pm},${pa},${gd});"></div>`;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
  @page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Cairo',sans-serif;background:${wt};color:${dk}}
  .page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always}
  .page:last-child{page-break-after:auto}
</style>
</head>
<body>

<!-- ═══ PAGE 1: ALL DATA ═══ -->
<div class="page">
  ${header}

  <!-- HERO -->
  <div style="display:flex;padding:8px 16px 6px;gap:12px;background:linear-gradient(180deg,${bg},${wt});border-bottom:2px solid ${lt};">
    <div style="flex-shrink:0;">
      <img src="${profile}" style="width:80px;height:95px;object-fit:cover;border-radius:6px;border:2.5px solid ${pm};" />
    </div>
    <div style="flex:1;">
      <div style="font-size:20px;font-weight:900;color:${pd};line-height:1.1;">${d.fullNameAr || ""}</div>
      <div style="font-size:11px;color:${md};margin-bottom:6px;direction:ltr;text-align:right;">${d.fullName || ""}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${pill("الجنسية",tr("nat",nat))}
        ${pill("الديانة",tr("rel",d.religion||""))}
        ${pill("العمر",(d.age||"")+" سنة")}
        ${pill("الحالة",tr("mar",d.maritalStatus||""))}
        ${pill("الأولاد",d.numberOfChildren??0)}
        ${pill("الراتب",(d.monthlySalary||"")+" ريال")}
        ${pill("",tr("prof",d.profession||""),true)}
      </div>
    </div>
  </div>

  <!-- 2-COLUMN CONTENT -->
  <div style="display:flex;padding:2px 12px;gap:8px;">

    <!-- RIGHT: Tables -->
    <div style="flex:1;min-width:0;">

      ${sec("المعلومات الشخصية","Personal Info")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("الاسم",d.fullName||"")}
        ${row("الجنس",tr("gen",d.gender||"")+" / "+(d.gender||""))}
        ${row("تاريخ الميلاد",d.dateOfBirth||"")}
        ${row("الإقامة",d.currentResidence||"")}
        ${row("الجوال",mobile)}
      </table>

      ${sec("العمل والعقد","Job & Contract")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("المهنة",tr("prof",d.profession||"")+" / "+(d.profession||""))}
        ${row("الراتب",(d.monthlySalary||"")+" ريال / SAR")}
        ${row("العقد",(d.contractPeriod||"2")+" سنة / Years")}
      </table>

      ${sec("جواز السفر","Passport")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("رقم الجواز",d.passportNumber||"")}
        ${row("الإصدار",d.passportIssueDate||"")}
        ${row("الانتهاء",d.passportExpiryDate||"")}
      </table>

      ${sec("التعليم واللغات","Education & Languages")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("التعليم",tr("edu",d.educationLevel||"")+" / "+(d.educationLevel||""))}
        ${row("الإنجليزية",tr("lang",d.englishLevel||"")+" / "+(d.englishLevel||""))}
        ${row("العربية",tr("lang",d.arabicLevel||"")+" / "+(d.arabicLevel||""))}
      </table>

      ${sec("الخبرات","Experience")}
      <table style="width:100%;border-collapse:collapse;">
        <tr><th style="background:${pd};color:${wt};padding:2px 6px;font-size:8px;text-align:right;">الدولة</th><th style="background:${pd};color:${wt};padding:2px 6px;font-size:8px;text-align:right;">المدة</th><th style="background:${pd};color:${wt};padding:2px 6px;font-size:8px;text-align:right;">المنصب</th></tr>
        ${expR}
      </table>

      ${sec("المعلومات الجسدية","Physical")}
      <table style="width:100%;border-collapse:collapse;">
        ${row("الطول",(d.heightCm||"")+" سم / cm")}
        ${row("الوزن",(d.weightKg||"")+" كغ / kg")}
        <tr>
          <td style="padding:3px 8px;font-size:11px;font-weight:700;color:${dk};background:${bg};width:28%;border-bottom:1px solid ${wt};">اللياقة الطبية</td>
          <td style="padding:3px 8px;font-size:12px;font-weight:800;color:${med?gn:or};border-bottom:1px solid ${lt};">
            ${med ? "✓ لائق طبياً / Fit" : "⏳ لم يتم الفحص / Pending"}
          </td>
        </tr>
      </table>
    </div>

    <!-- LEFT: Skills + Photo -->
    <div style="width:215px;flex-shrink:0;display:flex;flex-direction:column;">

      ${sec("المهارات","Skills")}
      <table style="width:100%;border-collapse:collapse;">${skR}</table>

      <!-- FULL PHOTO -->
      <div style="flex:1;margin-top:4px;text-align:center;min-height:0;">
        <img src="${fullPhoto}" style="width:208px;height:100%;max-height:350px;object-fit:cover;object-position:top;border-radius:7px;border:2px solid ${lt};" />
      </div>

      <div style="margin-top:3px;text-align:center;padding:3px 5px;background:${bg};border-radius:4px;border:1px solid ${lt};">
        <div style="font-size:6px;color:${md};">الوكالة / Agency</div>
        <div style="font-size:9px;font-weight:700;color:${pd};">${d.agencyName||""}</div>
      </div>
    </div>
  </div>

  ${footer}
  ${sidebar}
</div>

<!-- ═══ PAGE 2: PASSPORT ONLY ═══ -->
<div class="page">
  ${header}

  <div style="text-align:center;padding:25px 36px 20px;">
    <div style="font-size:20px;font-weight:900;color:${pd};margin-bottom:2px;">صورة جواز السفر</div>
    <div style="font-size:11px;color:${md};margin-bottom:20px;">Passport Copy</div>
    <div style="display:inline-block;padding:10px;border:2px solid ${lt};border-radius:10px;background:${wt};box-shadow:0 4px 16px rgba(0,0,0,0.04);">
      <img src="${passport}" style="max-width:500px;width:100%;height:auto;border-radius:4px;" />
    </div>
    <div style="margin-top:20px;">
      <div style="display:inline-block;padding:8px 22px;background:${bg};border-radius:8px;border:1px solid ${lt};">
        <div style="font-size:15px;font-weight:900;color:${pd};">${d.fullNameAr||d.fullName||""}</div>
        <div style="font-size:10px;color:${md};margin-top:2px;">${d.fullName||""}</div>
        <div style="font-size:9px;color:${pm};margin-top:3px;direction:ltr;letter-spacing:1.5px;">Passport: ${d.passportNumber||""}</div>
      </div>
    </div>
  </div>

  ${footer}
  ${sidebar}
</div>

</body></html>`;
}

app.listen(PORT, () => console.log(`🚀 Haneen CV v4 on port ${PORT}`));
