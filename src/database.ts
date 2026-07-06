import Database from "better-sqlite3";

import { config } from "./config";
import InTransitParcel from "./models/InTransitParcels.model";

interface SercargoParcel
  extends Pick<
    InTransitParcel,
    "guia" | "tracking" | "estado" | "fecha" | "probable" | "total_monto"
  > {
  id: number;
}

interface SercargoParcelChange extends Pick<InTransitParcel, "guia"> {
  id?: number;
  changedKey: keyof InTransitParcel;
  changedValue: string;
  changedTo: string;
  changedAt: number;
}

class DB {
  private db: Database.Database;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
        CREATE TABLE IF NOT EXISTS parcels (
            id INTEGER PRIMARY KEY,
            guia TEXT NOT NULL,
            tracking TEXT NOT NULL,
            estado TEXT NOT NULL,
            fecha TEXT NOT NULL,
            probable TEXT NOT NULL,
            total_monto TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guia TEXT NOT NULL,
            changedKey TEXT NOT NULL,
            changedValue TEXT NOT NULL,
            changedTo TEXT NOT NULL,
            changedAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_changes_guia ON changes (guia);

        CREATE TABLE IF NOT EXISTS parcel_settings (
            guia TEXT PRIMARY KEY,
            nickname TEXT,
            hidden INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS global_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);
  }

  addParcel(parcel: SercargoParcel) {
    this.db
      .prepare(
        "INSERT INTO parcels (id, guia, tracking, estado, fecha, probable, total_monto) VALUES (@id, @guia, @tracking, @estado, @fecha, @probable, @total_monto)"
      )
      .run(parcel);
  }

  getParcels(): SercargoParcel[] {
    return this.db.prepare("SELECT * FROM parcels").all() as SercargoParcel[];
  }

  getParcel(id: number): SercargoParcel | undefined {
    return this.db
      .prepare("SELECT * FROM parcels WHERE id = @id")
      .get({ id }) as SercargoParcel;
  }

  updateParcel(id: number, parcel: Partial<SercargoParcel>) {
    const keys = Object.keys(parcel);
    const set = keys.map((key) => `${key} = @${key}`).join(", ");
    this.db
      .prepare(`UPDATE parcels SET ${set} WHERE id = @id`)
      .run({ id, ...parcel });
  }

  deleteParcel(id: number) {
    this.db.prepare("DELETE FROM parcels WHERE id = @id").run({ id });
  }

  addChange(change: SercargoParcelChange) {
    this.db
      .prepare(
        "INSERT INTO changes (guia, changedKey, changedValue, changedTo, changedAt) VALUES (@guia, @changedKey, @changedValue, @changedTo, @changedAt)"
      )
      .run(change);
  }

  getChanges(): SercargoParcelChange[] {
    return this.db
      .prepare("SELECT * FROM changes")
      .all() as SercargoParcelChange[];
  }

  getParcelChanges(guia: string): SercargoParcelChange[] | [] {
    return this.db
      .prepare("SELECT * FROM changes WHERE guia = @guia ORDER BY changedAt DESC")
      .all({ guia }) as SercargoParcelChange[];
  }

  getParcelSettings(guia: string): { guia: string; nickname: string | null; hidden: number } {
    const res = this.db.prepare("SELECT * FROM parcel_settings WHERE guia = @guia").get({ guia });
    return (res as any) || { guia, nickname: null, hidden: 0 };
  }

  setParcelNickname(guia: string, nickname: string | null) {
    this.db.prepare(
      "INSERT INTO parcel_settings (guia, nickname) VALUES (@guia, @nickname) ON CONFLICT(guia) DO UPDATE SET nickname = @nickname"
    ).run({ guia, nickname });
  }

  setParcelHidden(guia: string, hidden: boolean) {
    this.db.prepare(
      "INSERT INTO parcel_settings (guia, hidden) VALUES (@guia, @hidden) ON CONFLICT(guia) DO UPDATE SET hidden = @hidden"
    ).run({ guia, hidden: hidden ? 1 : 0 });
  }

  getGlobalSetting(key: string): string | null {
    const res = this.db.prepare("SELECT value FROM global_settings WHERE key = @key").get({ key });
    return (res as any)?.value || null;
  }

  setGlobalSetting(key: string, value: string) {
    this.db.prepare(
      "INSERT INTO global_settings (key, value) VALUES (@key, @value) ON CONFLICT(key) DO UPDATE SET value = @value"
    ).run({ key, value });
  }

  close() {
    this.db.close();
  }
}

const databasePath =
  config.SERCARGO_DB_PATH ??
  (process.env.NODE_ENV === "production" ? "/data/sercargo.db" : "sercargo.db");

export default new DB(databasePath);
