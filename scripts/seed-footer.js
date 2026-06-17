/**
 * Seed the Footer single-type (columns + socials + copyright + bottom links),
 * enable public read for it, and remove the footer Menu that was previously
 * (incorrectly) seeded with position `end` — `position` is reserved for ordering
 * header nav around the BE category tree.
 *
 *   node scripts/seed-footer.js
 *
 * Idempotent: only fills the footer when it has no columns yet; permission and
 * cleanup steps are safe to repeat.
 */
"use strict";

const { createStrapi, compileStrapi } = require("@strapi/strapi");

const FOOTER_UID = "api::footer.footer";
const MENU_UID = "api::menu.menu";
const OLD_FOOTER_MENU_HANDLE = "footer-menu";

const COLUMNS = [
  {
    title: "Mua sắm",
    links: [
      { label: "Sản phẩm mới", url: "/c/new" },
      { label: "Bán chạy nhất", url: "/c/best-sellers" },
      { label: "Khuyến mãi", url: "/c/sale" },
      { label: "Hàng cao cấp", url: "/c/premium" },
    ],
  },
  {
    title: "Hỗ trợ khách hàng",
    links: [
      { label: "Trung tâm trợ giúp", url: "/help" },
      { label: "Theo dõi đơn hàng", url: "/orders/track" },
      { label: "Vận chuyển & giao nhận", url: "/shipping" },
      { label: "Đổi trả & hoàn tiền", url: "/returns" },
      { label: "Câu hỏi thường gặp", url: "/faq" },
    ],
  },
  {
    title: "Về chúng tôi",
    links: [
      { label: "Giới thiệu", url: "/about" },
      { label: "Hệ thống cửa hàng", url: "/stores" },
      { label: "Tuyển dụng", url: "/careers" },
      { label: "Tin tức", url: "/blog" },
    ],
  },
  {
    title: "Chính sách",
    links: [
      { label: "Chính sách bảo mật", url: "/privacy" },
      { label: "Điều khoản sử dụng", url: "/terms" },
      { label: "Chính sách bảo hành", url: "/warranty" },
      { label: "Chính sách thanh toán", url: "/payment" },
    ],
  },
];

const SOCIALS = [
  { platform: "facebook", url: "https://facebook.com/shopping" },
  { platform: "instagram", url: "https://instagram.com/shopping" },
  { platform: "youtube", url: "https://youtube.com/@shopping" },
  { platform: "tiktok", url: "https://tiktok.com/@shopping" },
];

const BOTTOM_LINKS = [
  { label: "Bảo mật", url: "/privacy" },
  { label: "Điều khoản", url: "/terms" },
];

const link = (l) => ({ ...l, openInNewTab: false, highlight: false });

async function enablePublicRead(strapi) {
  const role = await strapi.db
    .query("plugin::users-permissions.role")
    .findOne({ where: { type: "public" } });
  if (!role) return;

  const action = `${FOOTER_UID}.find`;
  const existing = await strapi.db
    .query("plugin::users-permissions.permission")
    .findOne({ where: { action, role: role.id } });

  if (!existing) {
    await strapi.db
      .query("plugin::users-permissions.permission")
      .create({ data: { action, role: role.id } });
    console.log(`🔓 Enabled public read: ${action}`);
  } else {
    console.log(`↪︎  Public read already enabled: ${action}`);
  }
}

async function removeOldFooterMenu(strapi) {
  const menus = await strapi
    .documents(MENU_UID)
    .findMany({ filters: { handle: OLD_FOOTER_MENU_HANDLE } });
  for (const m of menus) {
    await strapi.documents(MENU_UID).delete({ documentId: m.documentId });
    console.log(`🗑️  Removed misplaced footer menu (documentId=${m.documentId}).`);
  }
}

async function seedFooter(strapi) {
  const current = await strapi.documents(FOOTER_UID).findFirst({ populate: { columns: true } });
  if (current?.columns?.length) {
    console.log("↪︎  Footer already has columns — skipping data seed.");
    return;
  }

  const data = {
    tagline: "Mua sắm trực tuyến — sản phẩm chính hãng, giao nhanh toàn quốc.",
    columns: COLUMNS.map((c) => ({ title: c.title, links: c.links.map(link) })),
    socials: SOCIALS,
    copyright: "© {year} Shopping. All rights reserved.",
    bottomLinks: BOTTOM_LINKS.map(link),
  };

  // Single type: update the existing draft if present, else create.
  if (current?.documentId) {
    await strapi.documents(FOOTER_UID).update({ documentId: current.documentId, data, status: "published" });
  } else {
    await strapi.documents(FOOTER_UID).create({ data, status: "published" });
  }
  console.log(`✅ Seeded Footer (${COLUMNS.length} columns, ${SOCIALS.length} socials).`);
}

async function run() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = "error";

  try {
    await enablePublicRead(app);
    await removeOldFooterMenu(app);
    await seedFooter(app);
  } finally {
    await app.destroy();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
