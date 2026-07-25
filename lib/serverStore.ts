import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { defaultMenu, defaultSiteSettings, type MenuItem, type SiteSettings } from "@/lib/menu";
import type { Order } from "@/lib/orders";

export type StoreData = {
  menu: MenuItem[];
  menuTrash: MenuItem[];
  settings: SiteSettings;
  orders: Order[];
  updatedAt: string;
};

const dataDirectory = process.env.KEBABEST_DATA_DIR
  ? path.resolve(process.env.KEBABEST_DATA_DIR)
  : path.join(process.cwd(), "data");
const storePath = path.join(dataDirectory, "store.json");
let writeQueue: Promise<unknown> = Promise.resolve();

function freshStore(): StoreData {
  return {
    menu: defaultMenu,
    menuTrash: [],
    settings: defaultSiteSettings,
    orders: [],
    updatedAt: new Date().toISOString(),
  };
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(storePath);
  } catch {
    await fs.writeFile(storePath, JSON.stringify(freshStore(), null, 2), "utf8");
  }
}

export async function readStore(): Promise<StoreData> {
  await ensureStore();
  try {
    const parsed = JSON.parse(await fs.readFile(storePath, "utf8")) as Partial<StoreData>;
    return {
      menu: Array.isArray(parsed.menu) ? parsed.menu : defaultMenu,
      menuTrash: Array.isArray(parsed.menuTrash) ? parsed.menuTrash : [],
      settings: { ...defaultSiteSettings, ...(parsed.settings || {}) },
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    const reset = freshStore();
    await atomicWrite(reset);
    return reset;
  }
}

async function atomicWrite(data: StoreData): Promise<void> {
  await fs.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(temporaryPath, storePath);
}

export function updateStore(mutator: (current: StoreData) => StoreData | Promise<StoreData>): Promise<StoreData> {
  const operation = writeQueue.then(async () => {
    const current = await readStore();
    const next = await mutator(current);
    next.updatedAt = new Date().toISOString();
    await atomicWrite(next);
    return next;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}
