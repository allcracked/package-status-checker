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
        Create TABLE IF NOT EXISTS changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guia TEXT NOT NULL,
            changedKey TEXT NOT NULL,
            changedValue TEXT NOT NULL,
            changedTo TEXT NOT NULL,
            changedAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_changes_guia ON changes (guia);
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
}

const databasePath =
  config.SERCARGO_DB_PATH ??
  (process.env.NODE_ENV === "production" ? "/data/sercargo.db" : "sercargo.db");

export default new DB(databasePath);
