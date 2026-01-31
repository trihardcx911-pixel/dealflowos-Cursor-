/**
 * Minimal module declarations so tsc can resolve deps that live in node_modules.
 * Used when @types or package-built-in types are not found (e.g. ESM subpaths).
 */
declare module "firebase-admin/app";
declare module "firebase-admin/auth";
declare module "jsonwebtoken";
declare module "stripe";
declare module "express-rate-limit";
declare module "multer";
declare module "xlsx";
declare module "luxon";
