export type BatchRecord = { address: string; city: string; state: string; zip: string; units?: number; zoning?: string | null; improvement_value?: number | null; building_sqft?: number | null; };

export class BatchClient {
  constructor(private apiKey: string) {}
  async *searchByZip(zip: string): AsyncGenerator<BatchRecord> {
    // Mock 5 records; real integration later
    const samples: BatchRecord[] = [
      { address: "12 Main St", city: "Atlanta", state: "GA", zip },
      { address: "44 Pine Rd", city: "Atlanta", state: "GA", zip, building_sqft: 0, improvement_value: 0, zoning: "VACANT" }, // land signal
      { address: "88 Oak Ave", city: "Atlanta", state: "GA", zip, units: 3 }, // multi
      { address: "22 Lake Dr", city: "Atlanta", state: "GA", zip },
      { address: "101 Maple Ct", city: "Atlanta", state: "GA", zip }
    ];
    for (const r of samples) yield r;
  }
}
