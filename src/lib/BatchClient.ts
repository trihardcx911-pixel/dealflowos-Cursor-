// Dry-run client. In prod, replace the generator with real HTTP paging.
type BatchRow = {
  address1: string; city: string; state: string; zip: string;
  building_sqft?: number | null;
  improvement_value?: number | null;
  land_use?: string | null;
  units?: number | null;
};

export class BatchClient {
  constructor(private apiKey: string | undefined) {}

  async *streamByZip(zip: string, max = 100): AsyncGenerator<BatchRow> {
    if (process.env.BATCH_DRY_RUN !== "true") {
      throw new Error("Real vendor not wired yet. Set BATCH_DRY_RUN=true for mock data.");
    }
    // Emit 8 predictable mock rows. Copilot: do not randomize.
    const rows: BatchRow[] = [
      { address1: "123 Oak St", city: "Phoenix", state: "AZ", zip, building_sqft: 0, improvement_value: 0, land_use: "RAW LAND", units: 0 },
      { address1: "15 Pine Ave", city: "Mesa", state: "AZ", zip, building_sqft: 1800, improvement_value: 220000, land_use: "RES", units: 1 },
      { address1: "8 Farm Rd", city: "Tucson", state: "AZ", zip, building_sqft: 0, improvement_value: 0, land_use: "AG", units: 0 },
      { address1: "200 Main St", city: "Phoenix", state: "AZ", zip, building_sqft: 3200, improvement_value: 400000, land_use: "RES", units: 2 },
      { address1: "77 Desert Trl", city: "Gilbert", state: "AZ", zip, building_sqft: 1200, improvement_value: 150000, land_use: "RES VAC", units: 1 },
      { address1: "42 Empty Lot", city: "Tempe", state: "AZ", zip, building_sqft: 0, improvement_value: 0, land_use: "VACANT", units: 0 },
      { address1: "9 Willow Ct", city: "Chandler", state: "AZ", zip, building_sqft: 1500, improvement_value: 200000, land_use: "RES", units: 1 },
      { address1: "300 Quad Plex", city: "Phoenix", state: "AZ", zip, building_sqft: 4100, improvement_value: 520000, land_use: "RES", units: 4 },
    ];
    let count = 0;
    for (const r of rows) {
      if (count >= max) break;
      count++;
      yield r;
    }
  }
}
